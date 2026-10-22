import os
import sys
import uuid
import argparse
import logging
import torch
from pathlib import Path
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

from src.core.config import settings, BASE_DIR
from src.db import ImagePointPayload, CatalogCategory, PointStatus

# Thiết lập logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Cấu hình từ configs/database.yaml
QDRANT_HOST = settings.qdrant.host
QDRANT_PORT = settings.qdrant.grpc_port
COLLECTION_NAME = settings.qdrant.collection_name
MODEL_ID = settings.model.id
RAW_DATA_DIR_NAME = settings.app.raw_data_dir


# Thư mục gốc dự án và đường dẫn dataset
DATASET_ROOT = os.path.join(BASE_DIR, RAW_DATA_DIR_NAME)



def scan_images(target_dir: str):
    """Quét tất cả các file ảnh hợp lệ trong thư mục chỉ định (hỗ trợ đệ quy thư mục con)."""
    valid_extensions = ('.png', '.jpg', '.jpeg', '.webp')
    image_paths = []
    
    for root, _, files in os.walk(target_dir):
        for f in files:
            if f.lower().endswith(valid_extensions):
                image_paths.append(os.path.join(root, f))
                
    return image_paths


def seed_data(subfolder: str | None = None, batch_size: int = 32):
    """
    Trích xuất vector embedding và nạp dữ liệu ảnh từ dataset vào Qdrant.
    - subfolder: Chỉ định thư mục con trong dataset/ (vd: 'test', 'raw'). Nếu None, quét toàn bộ dataset.
    - batch_size: Kích thước lô xử lý ảnh trên GPU/CPU.
    """
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Thiết bị đang sử dụng: {device}")

    # 1. Xác định thư mục quét ảnh
    if subfolder:
        target_dir = os.path.join(DATASET_ROOT, subfolder)
    else:
        target_dir = DATASET_ROOT

    if not os.path.exists(target_dir):
        logger.error(f"Không tìm thấy thư mục dữ liệu tại: '{target_dir}'")
        return

    image_paths = scan_images(target_dir)
    total_images = len(image_paths)
    logger.info(f"Tìm thấy tổng cộng {total_images} ảnh trong '{target_dir}'")

    if total_images == 0:
        logger.warning("Không có ảnh hợp lệ để nạp dữ liệu. Kết thúc tiến trình.")
        return

    # 2. Khởi tạo Model CLIP và Qdrant Client
    logger.info("Đang nạp mô hình CLIP lên thiết bị...")
    model = CLIPModel.from_pretrained(MODEL_ID).to(device)
    model.eval()
    processor = CLIPProcessor.from_pretrained(MODEL_ID)
    client = QdrantClient(host=QDRANT_HOST, grpc_port=QDRANT_PORT, prefer_grpc=True)

    # 3. Nạp dữ liệu theo Batch
    success_count = 0
    skipped_count = 0

    for i in range(0, total_images, batch_size):
        chunk_paths = image_paths[i:i + batch_size]
        batch_images = []
        valid_paths = []

        # Mở ảnh an toàn và lọc bỏ ảnh lỗi (Skip corrupted images)
        for p in chunk_paths:
            try:
                with Image.open(p) as img:
                    batch_images.append(img.convert("RGB"))
                valid_paths.append(p)
            except Exception as e:
                logger.warning(f"Bỏ qua ảnh lỗi hoặc bị hỏng '{p}': {e}")
                skipped_count += 1

        if not batch_images:
            continue

        # Đẩy dữ liệu qua GPU để sinh vector đặc trưng
        inputs = processor(images=batch_images, return_tensors="pt").to(device)

        with torch.no_grad():
            features = model.get_image_features(**inputs)
            # Chuẩn hóa L2 norm cho vector cosine
            features = features / features.norm(p=2, dim=-1, keepdim=True)
            vectors = features.cpu().numpy().tolist()

        points = []
        for j, vector in enumerate(vectors):
            file_abs_path = valid_paths[j]
            # Tạo đường dẫn Web Path chuẩn: /dataset/... để Frontend render trực tiếp
            rel_path = os.path.relpath(file_abs_path, BASE_DIR).replace("\\", "/")
            web_path = f"/{rel_path}" if not rel_path.startswith("/") else rel_path
            file_name = os.path.basename(file_abs_path)

            payload_data = ImagePointPayload(
                image_path=web_path,
                file_name=file_name,
                catalog=CatalogCategory.FASHION_PRODUCT,
                status=PointStatus.SEEDED
            ).to_payload_dict()

            points.append(
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload=payload_data
                )
            )

        client.upsert(collection_name=COLLECTION_NAME, points=points)
        success_count += len(points)
        logger.info(f"Đã nạp lô {i // batch_size + 1}: {len(points)} ảnh (Lũy kế: {success_count}/{total_images})")

        # Quản lý bộ nhớ VRAM/RAM
        del inputs, features, vectors, batch_images, points
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    logger.info(f"HOÀN TẤT SEEDING! Thành công: {success_count} ảnh | Bị lỗi/bỏ qua: {skipped_count} ảnh.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed ảnh từ dataset vào Qdrant Vector Database")
    parser.add_argument(
        "--subfolder",
        type=str,
        default=None,
        help="Tên thư mục con trong dataset/ (vd: 'test', 'raw'). Mặc định quét toàn bộ dataset/."
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Kích thước batch xử lý ảnh (mặc định: 32)."
    )
    args = parser.parse_args()

    seed_data(subfolder=args.subfolder, batch_size=args.batch_size)



    