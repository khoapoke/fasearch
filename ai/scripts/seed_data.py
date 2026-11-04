import argparse
import logging
import os
import sys
from pathlib import Path

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
from src.services.point_service import batch_create_from_directory

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATASET_ROOT = os.path.join(BASE_DIR, settings.app.raw_data_dir)


def seed_data(subfolder: str | None = None, batch_size: int = 32) -> tuple[int, int]:
    """
    CLI wrapper: Trích xuất vector embedding và nạp dữ liệu ảnh từ dataset vào Qdrant.
    Ủy quyền toàn bộ logic nghiệp vụ cho point_service.batch_create_from_directory().
    """
    if subfolder:
        target_dir = os.path.join(DATASET_ROOT, subfolder)
    else:
        target_dir = DATASET_ROOT

    if not os.path.exists(target_dir):
        logger.error(f"Không tìm thấy thư mục dữ liệu tại: '{target_dir}'")
        return 0, 0

    return batch_create_from_directory(
        target_dir=target_dir,
        batch_size=batch_size,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed ảnh từ dataset vào Qdrant Vector Database")
    parser.add_argument(
        "--subfolder",
        type=str,
        default=None,
        help="Tên thư mục con trong dataset/ (vd: 'test', 'test/images'). Mặc định quét toàn bộ dataset/.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Kích thước batch xử lý ảnh (mặc định: 32).",
    )
    args = parser.parse_args()

    seed_data(subfolder=args.subfolder, batch_size=args.batch_size)
