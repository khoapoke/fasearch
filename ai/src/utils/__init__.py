"""
Utils package for fasearch AI.
Provides reusable helpers for paths, validation, metrics, and data loaders.
"""

from src.utils.metrics import (
    calculate_average_precision,
    calculate_precision_recall_at_k,
    calculate_reciprocal_rank,
)
from src.utils.csv_helpers import (
    load_ground_truth,
    get_available_article_types,
    get_available_test_images,
    TEST_DATASET_DIR,
    STYLES_CSV_PATH,
    TEST_IMAGES_DIR,
)
from src.utils.path_helpers import (
    normalize_slash,
    safe_join,
    to_system_path,
    to_web_path,
)

__all__ = [
    "calculate_average_precision",
    "calculate_precision_recall_at_k",
    "calculate_reciprocal_rank",
    "load_ground_truth",
    "get_available_article_types",
    "get_available_test_images",
    "TEST_DATASET_DIR",
    "STYLES_CSV_PATH",
    "TEST_IMAGES_DIR",
    "normalize_slash",
    "to_web_path",
    "to_system_path",
    "safe_join",
]
