import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import torch
from PIL import Image
from qdrant_client.models import PointStruct

from src.core.ai_model import get_ai_model
from src.core.config import settings
from src.db.enums import CatalogCategory, PointStatus
from src.db.models import ImagePointPayload
from src.repositories import ImageRepository, get_image_repository
from src.utils import normalize_slash, to_system_path, to_web_path

logger = logging.getLogger(__name__)

VALID_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


class PointService:
    """
    Dịch vụ quản lý vòng đời và xử lý dữ liệu Vector Point trên Qdrant theo Collection.
    Hoàn toàn độc lập theo từng collection được chỉ định.
    """

    def __init__(
        self,
        collection_name: Optional[str] = None,
        repo: Optional[ImageRepository] = None,
        auto_create_collection: bool = True,
    ) -> None:
        self.collection_name = collection_name or settings.qdrant.collection_name
        self.repo = repo or get_image_repository(self.collection_name)
        if auto_create_collection:
            self.repo.ensure_collection_exists()

    @staticmethod
    def extract_image_vector(image_path: Union[str, Path]) -> List[float]:
        """Trích xuất vector CLIP 512D và chuẩn hóa L2 từ 1 file ảnh vật lý."""
        device, model, processor = get_ai_model()
        sys_path = to_system_path(image_path)
        try:
            with Image.open(sys_path) as img:
                rgb_image = img.convert("RGB")
        except Exception as e:
            raise ValueError(f"Không thể đọc file ảnh '{sys_path}': {e}")

        inputs = processor(images=rgb_image, return_tensors="pt").to(device)
        with torch.no_grad():
            features = model.get_image_features(**inputs)
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            vector = features.cpu().numpy()[0].tolist()

        del inputs, features
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return vector

    @staticmethod
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

    def create_point(
        self,
        image_path: Union[str, Path],
        catalog: Union[CatalogCategory, str] = CatalogCategory.FASHION_PRODUCT,
        status: Union[PointStatus, str] = PointStatus.ACTIVE,
        product_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        point_id: Optional[str] = None,
    ) -> str:
        """
        Tạo mới 1 Vector Point từ file ảnh trong collection:
        1. Trích xuất vector đặc trưng bằng mô hình CLIP (chuẩn hóa L2).
        2. Đóng gói Entity ImagePointPayload.
        3. Lưu trữ vào collection tương ứng trên Qdrant qua Repository.
        Trả về: point_id (UUID).
        """
        path_obj = to_system_path(image_path)
        if not path_obj.exists() or not path_obj.is_file():
            raise FileNotFoundError(f"File ảnh không tồn tại tại: '{path_obj}'")

        # 1. Trích xuất vector
        vector = self.extract_image_vector(path_obj)

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
        self.repo.create(
            point_id=assigned_id,
            vector=vector,
            payload=payload_data,
        )
        logger.info(
            f"Đã tạo Point ID '{assigned_id}' trong collection '{self.collection_name}' cho file: {file_name}"
        )
        return assigned_id

    def delete_point(self, point_id: str, hard_delete: bool = False) -> bool:
        """
        Xóa 1 point trong collection:
        - hard_delete = False (mặc định): Xóa mềm (chuyển status = DELETED).
        - hard_delete = True: Xóa cứng vĩnh viễn khỏi Database.
        """
        if hard_delete:
            res = self.repo.hard_delete(point_id)
            logger.info(f"Đã xóa CỨNG Point ID '{point_id}' khỏi collection '{self.collection_name}'")
            return res
        else:
            res = self.repo.soft_delete(point_id)
            logger.info(f"Đã xóa MỀM Point ID '{point_id}' (status: DELETED) trong collection '{self.collection_name}'")
            return res

    def update_point_payload(self, point_id: str, payload_updates: Dict[str, Any]) -> bool:
        """Cập nhật các trường payload cho một point cụ thể."""
        return self.repo.update_payload(point_id=point_id, payload=payload_updates)

    def clear_all_points(self) -> bool:
        """Xóa toàn bộ vector point trong collection và khởi tạo lại collection rỗng."""
        logger.warning(f"Đang reset toàn bộ dữ liệu trong collection '{self.collection_name}'...")
        return self.repo.reset_collection()

    def delete_collection(self) -> bool:
        """Xóa sổ vĩnh viễn collection này khỏi Database Qdrant."""
        logger.warning(f"Đang xóa vĩnh viễn collection '{self.collection_name}'...")
        return self.repo.delete_this_collection()

    def batch_create_from_directory(
        self,
        target_dir: Union[str, Path],
        batch_size: int = 32,
        catalog: Union[CatalogCategory, str] = CatalogCategory.FASHION_PRODUCT,
        status: Union[PointStatus, str] = PointStatus.SEEDED,
    ) -> Tuple[int, int]:
        """
        Nạp dữ liệu hàng loạt từ thư mục chỉ định vào collection theo batch.
        Trả về: (số_ảnh_thành_công, số_ảnh_bị_lỗi)
        """
        device, model, processor = get_ai_model()

        image_paths = self.scan_directory_images(target_dir)
        total_images = len(image_paths)
        logger.info(
            f"Bắt đầu nạp hàng loạt {total_images} ảnh từ '{target_dir}' vào collection '{self.collection_name}' theo batch {batch_size}..."
        )

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

            inputs = processor(images=batch_images, return_tensors="pt").to(device)
            with torch.no_grad():
                features = model.get_image_features(**inputs)
                features = features / features.norm(p=2, dim=-1, keepdim=True)
                vectors = features.cpu().numpy().tolist()

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

            self.repo.upsert_batch(points=points)
            success_count += len(points)
            logger.info(
                f"Đã nạp lô {i // batch_size + 1}: {len(points)} ảnh (Lũy kế: {success_count}/{total_images})"
            )

            del inputs, features, vectors, batch_images, points
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        logger.info(
            f"Hoàn tất nạp dữ liệu vào '{self.collection_name}'! Thành công: {success_count} | Bỏ qua: {skipped_count}"
        )
        return success_count, skipped_count


# Instance mặc định dùng collection_name từ database.yaml làm fallback
point_service = PointService()

# Tương thích ngược cho các module đang gọi dạng hàm
create_point = point_service.create_point
delete_point = point_service.delete_point
update_point_payload = point_service.update_point_payload
clear_all_points = point_service.clear_all_points
batch_create_from_directory = point_service.batch_create_from_directory
scan_directory_images = PointService.scan_directory_images
_extract_image_vector = PointService.extract_image_vector


if __name__ == "__main__":
    test_img_path = r"dataset/test/images/1855.jpg"
    sys_path = to_system_path(test_img_path)
    web_path = to_web_path(test_img_path)

    print(f"Collection : {point_service.collection_name}")
    print(f"System path: {sys_path}")
    print(f"Web path   : {web_path}")

    point_sev = PointService(collection_name="test")
    print(f"Custom collection: {point_sev.collection_name}")
