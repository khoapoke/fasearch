import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set

from src.core.config import BASE_DIR

logger = logging.getLogger(__name__)

# Đường dẫn tới thư mục test và file nhãn chuẩn Ground Truth
TEST_DATASET_DIR = BASE_DIR / "dataset" / "test"
STYLES_CSV_PATH = TEST_DATASET_DIR / "styles.csv"
TEST_IMAGES_DIR = TEST_DATASET_DIR / "images"

# Bộ nhớ đệm lưu trữ nhãn Ground Truth
_ground_truth_cache: Optional[Dict[str, Dict[str, str]]] = None


def load_ground_truth(csv_path: Optional[Path] = None) -> Dict[str, Dict[str, str]]:
    """
    Đọc file styles.csv và lưu cache dictionary:
    key = "<id>.jpg", value = dict metadata từ CSV
    """
    global _ground_truth_cache
    if _ground_truth_cache is not None:
        return _ground_truth_cache

    target_csv = csv_path or STYLES_CSV_PATH
    if not target_csv.exists():
        logger.warning(f"Không tìm thấy file nhãn Ground Truth tại: {target_csv}")
        return {}

    gt_map = {}
    try:
        with open(target_csv, "r", encoding="utf-8", errors="ignore") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item_id = str(row.get("id", "")).strip()
                if not item_id:
                    continue
                file_name = f"{item_id}.jpg"
                gt_map[file_name] = {
                    "id": item_id,
                    "gender": row.get("gender", "").strip(),
                    "masterCategory": row.get("masterCategory", "").strip(),
                    "subCategory": row.get("subCategory", "").strip(),
                    "articleType": row.get("articleType", "").strip(),
                    "baseColour": row.get("baseColour", "").strip(),
                    "productDisplayName": row.get("productDisplayName", "").strip(),
                }
        _ground_truth_cache = gt_map
        logger.info(f"Đã tải thành công nhãn Ground Truth cho {len(gt_map)} sản phẩm.")
    except Exception as e:
        logger.error(f"Lỗi khi đọc file styles.csv: {e}")
        return {}

    return _ground_truth_cache


def get_available_test_images() -> Set[str]:
    """Lấy danh sách các file ảnh đang có sẵn trong dataset/test/images/."""
    if not TEST_IMAGES_DIR.exists():
        return set()
    return {f.name for f in TEST_IMAGES_DIR.iterdir() if f.is_file()}


def get_available_article_types(csv_path: Optional[Path] = None) -> List[str]:
    """Lấy danh sách các nhãn articleType duy nhất trong file Ground Truth."""
    gt = load_ground_truth(csv_path)
    types = {meta.get("articleType", "").strip() for meta in gt.values() if meta.get("articleType")}
    return sorted(types)
