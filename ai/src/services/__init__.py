"""Services package initialization."""
from src.services.search_service import (
    SearchService,
    search_service,
    search_by_text,
    search_by_image,
    search_multimodal,
)
from src.services.evaluation_service import (
    EvaluationService,
    evaluation_service,
    load_ground_truth,
    get_available_article_types,
    calculate_precision_recall_at_k,
    calculate_average_precision,
    calculate_reciprocal_rank,
    evaluate_query,
    run_full_benchmark,
)
from src.services.point_service import (
    PointService,
    point_service,
    create_point,
    delete_point,
    update_point_payload,
    clear_all_points,
    batch_create_from_directory,
    scan_directory_images,
)

__all__ = [
    # Classes & Singletons
    "PointService",
    "point_service",
    "SearchService",
    "search_service",
    "EvaluationService",
    "evaluation_service",
    # Search functions
    "search_by_text",
    "search_by_image",
    "search_multimodal",
    # Evaluation functions
    "load_ground_truth",
    "get_available_article_types",
    "calculate_precision_recall_at_k",
    "calculate_average_precision",
    "calculate_reciprocal_rank",
    "evaluate_query",
    "run_full_benchmark",
    # Point CUD functions
    "create_point",
    "delete_point",
    "update_point_payload",
    "clear_all_points",
    "batch_create_from_directory",
    "scan_directory_images",
]
