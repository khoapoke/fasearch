import logging
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

# Cấu hình an toàn cho Console Windows (tránh lỗi UnicodeEncodeError cp1252)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Đảm bảo đường dẫn gốc dự án nằm trong sys.path
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.core.config import BASE_DIR, settings
from src.services.point_service import PointService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATASET_ROOT = os.path.join(BASE_DIR, settings.app.raw_data_dir)


def seed_data(subfolder: Optional[str] = None, batch_size: int = 32) -> Tuple[int, int]:
    """
    Trích xuất vector embedding và nạp dữ liệu ảnh từ dataset vào Qdrant.
    Khởi tạo và gọi trực tiếp PointService từ tầng Service.
    """
    if subfolder:
        target_dir = os.path.join(DATASET_ROOT, subfolder)
    else:
        target_dir = DATASET_ROOT

    if not os.path.exists(target_dir):
        logger.error(f"Không tìm thấy thư mục dữ liệu tại: '{target_dir}'")
        return 0, 0

    point_service = PointService()
    return point_service.batch_create_from_directory(
        target_dir=target_dir,
        batch_size=batch_size,
    )


def main():
    # =========================================================================
    # CẤU HÌNH SEED DỮ LIỆU (CHỈNH SỬA TRỰC TIẾP TẠI ĐÂY)
    # =========================================================================
    # Thư mục con chứa ảnh trong dataset/ (vd: 'test/images', hoặc None để quét hết)
    subfolder = "test/images"

    # Số lượng ảnh xử lý trong 1 batch GPU/CPU
    batch_size = 16

    seed_data(subfolder=subfolder, batch_size=batch_size)


if __name__ == "__main__":
    main()
