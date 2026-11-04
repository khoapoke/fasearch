import logging
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

import torch
from PIL import Image

from src.core.ai_model import get_ai_model
from src.core.config import settings
from src.repositories import ImageRepository, get_image_repository
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
        })
    return formatted


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
    ) -> List[Dict[str, Any]]:
        """Trích xuất vector text và tìm kiếm ảnh tương đồng trong collection."""
        device, model, processor = get_ai_model()

        text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)

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
        device, model, processor = get_ai_model()
        sys_path = to_system_path(image_path)

        try:
            with Image.open(sys_path) as img:
                image = img.convert("RGB")
        except Exception as e:
            raise ValueError(f"Không thể đọc ảnh tại '{sys_path}': {e}")

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
    ) -> List[Dict[str, Any]]:
        """
        Trích xuất vector kết hợp đa phương thức (Ảnh + Văn bản) bằng mô hình CLIP
        và tìm kiếm sản phẩm tương đồng trong collection.

        - image_path: Đường dẫn tới file ảnh mẫu
        - query_text: Chuỗi văn bản mô tả / bổ trợ (vd: "nhưng màu xanh", "cổ tròn")
        - limit: Số lượng kết quả tối đa
        - text_weight: Trọng số ưu tiên Text (0.0: 100% ảnh, 1.0: 100% text, 0.5: cân bằng 50-50)
        """
        device, model, processor = get_ai_model()
        sys_path = to_system_path(image_path)

        # 1. Trích xuất vector đặc trưng từ ảnh
        try:
            with Image.open(sys_path) as img:
                image = img.convert("RGB")
        except Exception as e:
            raise ValueError(f"Không thể đọc ảnh tại '{sys_path}': {e}")

        image_inputs = processor(images=image, return_tensors="pt").to(device)
        with torch.no_grad():
            image_features = model.get_image_features(**image_inputs)
            image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

        # 2. Trích xuất vector đặc trưng từ văn bản
        text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)
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
