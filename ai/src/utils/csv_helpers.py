import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Union

from src.core.config import BASE_DIR
from src.core.exceptions import GroundTruthMissingError

logger = logging.getLogger(__name__)

# Đường dẫn tới thư mục test và file nhãn chuẩn Ground Truth mặc định
TEST_DATASET_DIR = BASE_DIR / "dataset" / "test"
STYLES_CSV_PATH = TEST_DATASET_DIR / "styles.csv"
TEST_IMAGES_DIR = TEST_DATASET_DIR / "images"

# Bộ nhớ đệm lưu trữ nhãn Ground Truth theo đường dẫn file
_ground_truth_cache: Dict[str, Dict[str, Dict[str, str]]] = {}


def load_ground_truth(csv_path: Optional[Union[str, Path]] = None) -> Dict[str, Dict[str, str]]:
    """
    Đọc file nhãn Ground Truth (styles.csv) và lưu cache dictionary:
    key = "<id>.jpg", value = dict metadata từ CSV
    """
    target_csv = Path(csv_path).resolve() if csv_path else STYLES_CSV_PATH
    cache_key = str(target_csv)

    if cache_key in _ground_truth_cache:
        return _ground_truth_cache[cache_key]

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
        _ground_truth_cache[cache_key] = gt_map
        logger.info(f"Đã tải thành công nhãn Ground Truth cho {len(gt_map)} sản phẩm từ '{target_csv.name}'.")
    except Exception as e:
        logger.error(f"Lỗi khi đọc file '{target_csv}': {e}")
        return {}

    return _ground_truth_cache.get(cache_key, {})


def get_available_test_images() -> Set[str]:
    """Lấy danh sách các file ảnh đang có sẵn trong dataset/test/images/."""
    if not TEST_IMAGES_DIR.exists():
        return set()
    return {f.name for f in TEST_IMAGES_DIR.iterdir() if f.is_file()}


def get_available_article_types(csv_path: Optional[Union[str, Path]] = None) -> List[str]:
    """Lấy danh sách các nhãn articleType duy nhất trong file Ground Truth."""
    gt = load_ground_truth(csv_path)
    types = {meta.get("articleType", "").strip() for meta in gt.values() if meta.get("articleType")}
    return sorted(types)


def require_ground_truth(csv_path: Optional[Union[str, Path]] = None) -> Dict[str, Dict[str, str]]:
    """
    Như load_ground_truth nhưng báo lỗi rõ ràng (GroundTruthMissingError) khi thiếu / rỗng file nhãn,
    thay vì trả {} để benchmark in ra 0.00% gây hiểu nhầm.
    """
    target_csv = Path(csv_path).resolve() if csv_path else STYLES_CSV_PATH
    gt = load_ground_truth(target_csv)
    if not gt:
        raise GroundTruthMissingError(
            f"Thiếu dữ liệu nhãn Ground Truth: không đọc được '{target_csv}'. "
            "Cần file styles.csv (cột id, articleType, ...) đặt tại dataset/test/styles.csv "
            "hoặc truyền đường dẫn qua csv_path. Không thể tính Precision/Recall khi chưa có nhãn."
        )
    return gt
