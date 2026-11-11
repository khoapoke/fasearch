"""
Utils package for fasearch AI.
Provides reusable helpers for paths, validation, metrics, and data loaders.
"""

from src.utils.metrics import (
    calculate_average_precision,
    calculate_precision_recall_at_k,
    calculate_reciprocal_rank,
    calculate_map,
    calculate_mrr,
    calculate_mean_average_precision,
    calculate_mean_reciprocal_rank,
    calculate_mean_metrics_at_k,
    calculate_mean_latency,
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

from src.utils.formatters import (
    format_percentage,
    format_score,
    format_latency,
)

from src.utils.visualization import (
    create_benchmark_figure,
    plot_benchmark_results,
)

__all__ = [
    # Formatters
    "format_percentage",
    "format_score",
    "format_latency",
    # Visualizations
    "create_benchmark_figure",
    "plot_benchmark_results",
    # Per-query metrics
    "calculate_average_precision",
    "calculate_precision_recall_at_k",
    "calculate_reciprocal_rank",
    # Aggregate system metrics (Mean)
    "calculate_map",
    "calculate_mrr",
    "calculate_mean_average_precision",
    "calculate_mean_reciprocal_rank",
    "calculate_mean_metrics_at_k",
    "calculate_mean_latency",
    # CSV & Ground truth helpers
    "load_ground_truth",
    "get_available_article_types",
    "get_available_test_images",
    "TEST_DATASET_DIR",
    "STYLES_CSV_PATH",
    "TEST_IMAGES_DIR",
    # Path helpers
    "normalize_slash",
    "to_web_path",
    "to_system_path",
    "safe_join",
]
