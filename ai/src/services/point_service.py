import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import torch
from PIL import Image
from qdrant_client.models import PointStruct

from src.core.ai_model import get_ai_model
from src.core.config import BASE_DIR, settings
from src.db.enums import CatalogCategory, PointStatus
from src.db.models import ImagePointPayload
from src.repositories import get_image_repository
from src.utils import to_system_path, to_web_path, normalize_slash, safe_join

logger = logging.getLogger(__name__)

VALID_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


def _extract_image_vector(image_path: Union[str, Path]) -> List[float]:
    """Hàm phụ trợ trích xuất vector CLIP 512D và chuẩn hóa L2 từ 1 file ảnh."""
    device, model, processor = get_ai_model()
    try:
        with Image.open(image_path) as img:
            rgb_image = img.convert("RGB")
    except Exception as e:
        raise ValueError(f"Không thể đọc file ảnh '{image_path}': {e}")

    inputs = processor(images=rgb_image, return_tensors="pt").to(device)
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        features = features / features.norm(p=2, dim=-1, keepdim=True)
        vector = features.cpu().numpy()[0].tolist()

    del inputs, features
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return vector


def create_point(
    image_path: Union[str, Path],
    catalog: Union[CatalogCategory, str] = CatalogCategory.FASHION_PRODUCT,
    status: Union[PointStatus, str] = PointStatus.ACTIVE,
    product_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    point_id: Optional[str] = None,
) -> str:
    """
    Tạo mới 1 Vector Point từ file ảnh:
    1. Trích xuất vector đặc trưng bằng mô hình CLIP (chuẩn hóa L2).
    2. Đóng gói Entity ImagePointPayload.
    3. Lưu trữ vào Qdrant qua Repository.
    Trả về: point_id (UUID).
    """
    repo = get_image_repository()
    path_obj = Path(image_path).resolve()
    if not path_obj.exists() or not path_obj.is_file():
        raise FileNotFoundError(f"File ảnh không tồn tại tại: '{image_path}'")

    # 1. Trích xuất vector
    vector = _extract_image_vector(path_obj)

    # 2. Xây dựng web_path phục vụ web client (/dataset/...)
    web_path = to_web_path(path_obj)

    file_name = path_obj.name
    assigned_id = point_id or str(uuid.uuid4())

    catalog_enum = CatalogCategory(catalog) if isinstance(catalog, str) else catalog
    status_enum = PointStatus(status) if isinstance(status, str) else status

    payload_data = ImagePointPayload(
        image_path=web_path,
        file_name=file_name,
        catalog=catalog_enum,
        status=status_enum,
        product_id=product_id,
        metadata=metadata or {},
    )

    # 3. Ghi vào Qdrant
    repo.create(
        point_id=assigned_id,
        vector=vector,
        payload=payload_data,
    )
    logger.info(f"Đã tạo thành công Point ID: {assigned_id} cho file: {file_name}")
    return assigned_id


def delete_point(point_id: str, hard_delete: bool = False) -> bool:
    """
    Xóa 1 point trong Qdrant:
    - hard_delete = False (mặc định): Xóa mềm (chuyển status = DELETED).
    - hard_delete = True: Xóa cứng vĩnh viễn khỏi Database.
    """
    repo = get_image_repository()
    if hard_delete:
        res = repo.hard_delete(point_id)
        logger.info(f"Đã xóa CỨNG Point ID: {point_id}")
        return res
    else:
        res = repo.soft_delete(point_id)
        logger.info(f"Đã xóa MỀM Point ID: {point_id} (status: DELETED)")
        return res


def update_point_payload(point_id: str, payload_updates: Dict[str, Any]) -> bool:
    """Cập nhật các trường payload cho một point cụ thể."""
    repo = get_image_repository()
    return repo.update_payload(point_id=point_id, payload=payload_updates)


def clear_all_points() -> bool:
    """Xóa toàn bộ vector point trong collection và khởi tạo lại collection rỗng."""
    repo = get_image_repository()
    logger.warning(f"Đang reset toàn bộ collection '{repo.collection_name}'...")
    return repo.reset_collection()


def scan_directory_images(target_dir: Union[str, Path]) -> List[str]:
    """Quét tất cả các file ảnh hợp lệ trong thư mục chỉ định."""
    target_path = Path(target_dir).resolve()
    if not target_path.exists():
        logger.error(f"Thư mục không tồn tại: '{target_path}'")
        return []

    image_paths: List[str] = []
    for root, _, files in os.walk(str(target_path)):
        for f in files:
            if f.lower().endswith(VALID_IMAGE_EXTENSIONS):
                image_paths.append(os.path.join(root, f))
    return image_paths


def batch_create_from_directory(
    target_dir: Union[str, Path],
    batch_size: int = 32,
    catalog: Union[CatalogCategory, str] = CatalogCategory.FASHION_PRODUCT,
    status: Union[PointStatus, str] = PointStatus.SEEDED,
) -> Tuple[int, int]:
    """
    Nạp dữ liệu hàng loạt từ thư mục chỉ định vào Qdrant theo batch:
    - Tối ưu VRAM GPU cho PyTorch.
    - Tự động bỏ qua các ảnh lỗi/bị hỏng.
    Trả về: (số_ảnh_thành_công, số_ảnh_bị_lỗi)
    """
    device, model, processor = get_ai_model()
    repo = get_image_repository()

    image_paths = scan_directory_images(target_dir)
    total_images = len(image_paths)
    logger.info(f"Bắt đầu nạp hàng loạt {total_images} ảnh từ '{target_dir}' theo batch {batch_size}...")

    if total_images == 0:
        logger.warning("Không tìm thấy ảnh hợp lệ nào để nạp.")
        return 0, 0

    success_count = 0
    skipped_count = 0
    catalog_enum = CatalogCategory(catalog) if isinstance(catalog, str) else catalog
    status_enum = PointStatus(status) if isinstance(status, str) else status

    for i in range(0, total_images, batch_size):
        chunk_paths = image_paths[i : i + batch_size]
        batch_images = []
        valid_paths = []

        # 1. Mở ảnh an toàn
        for p in chunk_paths:
            try:
                with Image.open(p) as img:
                    batch_images.append(img.convert("RGB"))
                valid_paths.append(p)
            except Exception as e:
                logger.warning(f"Bỏ qua ảnh lỗi '{p}': {e}")
                skipped_count += 1

        if not batch_images:
            continue

        # 2. Xử lý batch qua PyTorch
        inputs = processor(images=batch_images, return_tensors="pt").to(device)
        with torch.no_grad():
            features = model.get_image_features(**inputs)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            vectors = features.cpu().numpy().tolist()

        # 3. Đóng gói PointStruct
        points: List[PointStruct] = []
        for j, vector in enumerate(vectors):
            file_abs_path = valid_paths[j]
            web_path = to_web_path(file_abs_path)

            payload_data = ImagePointPayload(
                image_path=web_path,
                file_name=Path(file_abs_path).name,
                catalog=catalog_enum,
                status=status_enum,
            ).to_payload_dict()

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=payload_data,
                )
            )

        # 4. Ghi batch vào Qdrant
        repo.upsert_batch(points=points)
        success_count += len(points)
        logger.info(f"Đã nạp lô {i // batch_size + 1}: {len(points)} ảnh (Lũy kế: {success_count}/{total_images})")

        # 5. Dọn dẹp tài nguyên
        del inputs, features, vectors, batch_images, points
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    logger.info(f"Hoàn tất nạp dữ liệu! Thành công: {success_count} | Bỏ qua: {skipped_count}")
    return success_count, skipped_count

if __name__ == "__main__":
    test_img_path = r"D:\fasearch\ai\dataset\test\images\1855.jpg"
   
    img=normalize_slash(test_img_path)
    

    vector

