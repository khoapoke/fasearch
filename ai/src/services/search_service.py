import logging
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

import torch
from PIL import Image

from src.core.ai_model import get_ai_model
from src.core.config import settings
from src.core.exceptions import InvalidInputError
from src.repositories import ImageRepository, get_image_repository
from src.services.query_translation import translate_for_search
from src.utils import to_system_path

logger = logging.getLogger(__name__)


def _format_results(results: list) -> List[Dict[str, Any]]:
    """Hàm phụ trợ định dạng dữ liệu thô từ Qdrant thành dict khớp với Schema."""
    formatted = []
    for res in results:
        payload = res.payload or {}
        formatted.append({
            "id": str(res.id),
            "score": res.score,
            "image_path": payload.get("image_path", ""),
            "file_name": payload.get("file_name", ""),
            "catalog": payload.get("catalog", ""),
            # BE (AiSearchResultItem) dùng product_id để gắn kết quả với sản phẩm trong DB
            "product_id": str(payload["product_id"]) if payload.get("product_id") is not None else None,
            "metadata": payload.get("metadata") or {},
        })
    return formatted


def _validate_limit(limit: int) -> None:
    """Limit phải >= 1 (không còn trần ở tầng service; trần HTTP do tầng API quản lý)."""
    if limit is None or limit < 1:
        raise InvalidInputError("Tham số limit phải lớn hơn hoặc bằng 1")


def _validate_query(query_text: str) -> str:
    """Chuẩn hóa và kiểm tra chuỗi truy vấn văn bản (không được rỗng)."""
    clean = (query_text or "").strip()
    if not clean:
        raise InvalidInputError("Chuỗi tìm kiếm (query) không được để trống")
    return clean


def _load_rgb_image(sys_path) -> Image.Image:
    """Đọc ảnh và chuyển RGB; ảnh rỗng/hỏng -> InvalidInputError (HTTP 400), không lộ đường dẫn."""
    try:
        with Image.open(sys_path) as img:
            return img.convert("RGB")
    except Exception as e:
        logger.warning(f"Không thể đọc ảnh tại '{sys_path}': {e}")
        raise InvalidInputError("File ảnh không hợp lệ hoặc bị hỏng")


class SearchService:
    """
    Dịch vụ tìm kiếm vector tương đồng (Text, Image, Multimodal) trên Qdrant theo Collection.
    Hỗ trợ làm việc với bất kỳ collection nào.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        repo: Optional[ImageRepository] = None,
    ) -> None:
        self.collection_name = collection_name or settings.qdrant.collection_name
        self.repo = repo or get_image_repository(self.collection_name)

    def search_by_text(
        self,
        query_text: str,
        limit: int = 5,
        exclude_deleted: bool = True,
        score_threshold: Optional[Union[torch.Tensor, float]] = None,
        use_translation: bool = True,
    ) -> List[Dict[str, Any]]:
        """Trích xuất vector text và tìm kiếm ảnh tương đồng trong collection.

        Query tiếng Việt được dịch sang tiếng Anh (glossary + MarianMT offline)
        trước khi encode CLIP; lỗi dịch fallback về query gốc, không bao giờ 500.
        """
        _validate_limit(limit)
        query_text = _validate_query(query_text)
        search_text = translate_for_search(query_text, enabled=use_translation) or query_text
        device, model, processor = get_ai_model()

        text_inputs = processor(text=[search_text], return_tensors="pt", padding=True, truncation=True).to(device)

        with torch.no_grad():
            text_features = model.get_text_features(**text_inputs)
            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
            query_vector = text_features.cpu().numpy()[0].tolist()

        del text_inputs, text_features
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        threshold = float(score_threshold) if score_threshold is not None else None
        results = self.repo.search_vectors(
            query_vector=query_vector,
            limit=limit,
            score_threshold=threshold,
            exclude_deleted=exclude_deleted,
        )
        return _format_results(results)

    def search_by_image(
        self,
        image_path: Union[str, Path],
        limit: int = 5,
        exclude_deleted: bool = True,
        score_threshold: Optional[Union[torch.Tensor, float]] = None,
    ) -> List[Dict[str, Any]]:
        """Trích xuất vector ảnh và tìm kiếm ảnh tương đồng trong collection."""
        _validate_limit(limit)
        device, model, processor = get_ai_model()
        sys_path = to_system_path(image_path)
        image = _load_rgb_image(sys_path)

        image_inputs = processor(images=image, return_tensors="pt").to(device)

        with torch.no_grad():
            image_features = model.get_image_features(**image_inputs)
            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
            query_vector = image_features.cpu().numpy()[0].tolist()

        del image_inputs, image_features
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        threshold = float(score_threshold) if score_threshold is not None else None
        results = self.repo.search_vectors(
            query_vector=query_vector,
            limit=limit,
            score_threshold=threshold,
            exclude_deleted=exclude_deleted,
        )
        return _format_results(results)

    def search_multimodal(
        self,
        image_path: Union[str, Path],
        query_text: str,
        limit: int = 5,
        text_weight: float = 0.5,
        exclude_deleted: bool = True,
        score_threshold: Optional[Union[torch.Tensor, float]] = None,
        use_translation: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Trích xuất vector kết hợp đa phương thức (Ảnh + Văn bản) bằng mô hình CLIP
        và tìm kiếm sản phẩm tương đồng trong collection.

        - image_path: Đường dẫn tới file ảnh mẫu
        - query_text: Chuỗi văn bản mô tả / bổ trợ (vd: "nhưng màu xanh", "cổ tròn")
        - limit: Số lượng kết quả tối đa
        - text_weight: Trọng số ưu tiên Text (0.0: 100% ảnh, 1.0: 100% text, 0.5: cân bằng 50-50)
        """
        _validate_limit(limit)
        query_text = _validate_query(query_text)
        search_text = translate_for_search(query_text, enabled=use_translation) or query_text
        device, model, processor = get_ai_model()
        sys_path = to_system_path(image_path)

        # 1. Trích xuất vector đặc trưng từ ảnh
        image = _load_rgb_image(sys_path)

        image_inputs = processor(images=image, return_tensors="pt").to(device)
        with torch.no_grad():
            image_features = model.get_image_features(**image_inputs)
            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        # 2. Trích xuất vector đặc trưng từ văn bản (đã dịch sang tiếng Anh)
        text_inputs = processor(text=[search_text], return_tensors="pt", padding=True, truncation=True).to(device)
        with torch.no_grad():
            text_features = model.get_text_features(**text_inputs)
            text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

        # 3. Kết hợp 2 vector có trọng số và chuẩn hóa lại L2 norm
        w_text = max(0.0, min(1.0, float(text_weight)))
        w_img = 1.0 - w_text

        with torch.no_grad():
            combined_features = (w_img * image_features) + (w_text * text_features)
            combined_features = combined_features / combined_features.norm(p=2, dim=-1, keepdim=True)
            query_vector = combined_features.cpu().numpy()[0].tolist()

        del image_inputs, text_inputs, image_features, text_features, combined_features
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        threshold = float(score_threshold) if score_threshold is not None else None
        results = self.repo.search_vectors(
            query_vector=query_vector,
            limit=limit,
            score_threshold=threshold,
            exclude_deleted=exclude_deleted,
        )
        return _format_results(results)


# Instance mặc định dùng collection_name từ database.yaml
search_service = SearchService()

# Tương thích ngược với các lời gọi hàm module-level
search_by_text = search_service.search_by_text
search_by_image = search_service.search_by_image
search_multimodal = search_service.search_multimodal
search_by_image_text = search_multimodal
