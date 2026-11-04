import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

from src.core.config import settings
from src.schemas.evaluation import (
    MetricAtK,
    EvaluatedItem,
    QueryEvaluationResult,
    BenchmarkSummary,
)
from src.services.search_service import SearchService, search_by_text
from src.utils.metrics import (
    calculate_average_precision,
    calculate_precision_recall_at_k,
    calculate_reciprocal_rank,
)
from src.utils.csv_helpers import (
    load_ground_truth,
    get_available_test_images,
    get_available_article_types,
    TEST_DATASET_DIR,
    STYLES_CSV_PATH,
    TEST_IMAGES_DIR,
)

logger = logging.getLogger(__name__)

# Bộ kịch bản kiểm thử mặc định chuẩn cho 10 ảnh thời trang mẫu trong dataset/test/
DEFAULT_BENCHMARK_CASES = [
    {
        "query": "áo sơ mi nam nữ casual",
        "target_article_type": "Shirts",
        "description": "Tìm kiếm áo sơ mi (Shirts)",
    },
    {
        "query": "áo thun nam phông trơn t-shirt",
        "target_article_type": "Tshirts",
        "description": "Tìm kiếm áo thun (Tshirts)",
    },
    {
        "query": "quần jeans xanh nam",
        "target_article_type": "Jeans",
        "description": "Tìm kiếm quần bò (Jeans)",
    },
    {
        "query": "quần nỉ thể thao track pants",
        "target_article_type": "Track Pants",
        "description": "Tìm kiếm quần thể thao (Track Pants)",
    },
    {
        "query": "đồng hồ đeo tay watches",
        "target_article_type": "Watches",
        "description": "Tìm kiếm đồng hồ (Watches)",
    },
    {
        "query": "đôi tất vớ nam socks",
        "target_article_type": "Socks",
        "description": "Tìm kiếm tất chân (Socks)",
    },
]


class EvaluationService:
    """
    Service đánh giá chất lượng truy vấn và benchmark mô hình trên từng Collection cụ thể.
    """

    def __init__(self, collection_name: Optional[str] = None):
        self.collection_name = collection_name or settings.qdrant.collection_name
        self.search_srv = SearchService(collection_name=self.collection_name)

    def evaluate_query(
        self,
        query_text: str,
        target_article_type: str,
        k_list: Optional[List[int]] = None,
        limit: int = 10,
        ground_truth: Optional[Dict[str, Dict[str, str]]] = None,
        available_images: Optional[Set[str]] = None,
    ) -> QueryEvaluationResult:
        """
        Thực hiện 1 truy vấn văn bản, so khớp với nhãn Ground Truth và tính các chỉ số đo lường.
        Tự động loại trừ các bản ghi có trạng thái DELETED (xóa mềm).
        """
        if k_list is None:
            k_list = [1, 3, 5, 10]

        gt = ground_truth or load_ground_truth()
        avail_imgs = available_images or get_available_test_images()

        # Xác định tập nhãn đúng (Relevant Set) trong số các ảnh khả dụng
        relevant_filenames = {
            fname for fname, meta in gt.items()
            if (not avail_imgs or fname in avail_imgs)
            and meta.get("articleType", "").strip().lower() == target_article_type.strip().lower()
        }
        total_relevant = len(relevant_filenames)

        # Thực hiện tìm kiếm và đo thời gian Latency trên collection chỉ định
        start_time = time.perf_counter()
        raw_results = self.search_srv.search_by_text(
            query_text=query_text,
            limit=max(limit, max(k_list)),
            exclude_deleted=True,
        )
        latency_ms = (time.perf_counter() - start_time) * 1000.0

        retrieved_hits: List[bool] = []
        evaluated_items: List[EvaluatedItem] = []

        for item in raw_results:
            fname = item.get("file_name", "")
            clean_fname = os.path.basename(fname)
            is_hit = clean_fname in relevant_filenames

            retrieved_hits.append(is_hit)
            meta = gt.get(clean_fname, {})
            evaluated_items.append(
                EvaluatedItem(
                    id=item.get("id", ""),
                    file_name=clean_fname,
                    score=float(item.get("score", 0.0)),
                    is_hit=is_hit,
                    image_path=item.get("image_path"),
                    article_type=meta.get("articleType"),
                    sub_category=meta.get("subCategory"),
                    display_name=meta.get("productDisplayName"),
                )
            )

        # Tính toán MetricAtK cho từng ngưỡng K
        metrics_at_k: Dict[int, MetricAtK] = {}
        for k in sorted(k_list):
            prec, rec, hits = calculate_precision_recall_at_k(
                retrieved_hits=retrieved_hits,
                total_relevant=total_relevant,
                k=k,
            )
            metrics_at_k[k] = MetricAtK(
                k=k,
                precision=round(prec, 4),
                recall=round(rec, 4),
                hit_count=hits,
                total_relevant=total_relevant,
            )

        # Tính Average Precision (AP) và Reciprocal Rank (RR)
        ap = calculate_average_precision(retrieved_hits, total_relevant)
        rr = calculate_reciprocal_rank(retrieved_hits)

        return QueryEvaluationResult(
            query=query_text,
            target_label=target_article_type,
            total_relevant_in_db=total_relevant,
            metrics_at_k=metrics_at_k,
            ap=round(ap, 4),
            rr=round(rr, 4),
            latency_ms=round(latency_ms, 2),
            retrieved_items=evaluated_items[:limit],
        )

    def run_full_benchmark(
        self,
        test_cases: Optional[List[Dict[str, str]]] = None,
        k_list: Optional[List[int]] = None,
    ) -> BenchmarkSummary:
        """
        Chạy toàn bộ bộ kiểm thử Benchmark, tổng hợp mAP, MRR và điểm trung bình Precision@K, Recall@K.
        """
        if k_list is None:
            k_list = [1, 3, 5, 10]
        cases = test_cases or DEFAULT_BENCHMARK_CASES

        gt = load_ground_truth()
        avail_imgs = get_available_test_images()

        query_results: List[QueryEvaluationResult] = []
        ap_scores: List[float] = []
        rr_scores: List[float] = []
        latencies: List[float] = []

        accum_precision: Dict[int, List[float]] = {k: [] for k in k_list}
        accum_recall: Dict[int, List[float]] = {k: [] for k in k_list}

        for case in cases:
            q_text = case["query"]
            target = case["target_article_type"]

            res = self.evaluate_query(
                query_text=q_text,
                target_article_type=target,
                k_list=k_list,
                ground_truth=gt,
                available_images=avail_imgs,
            )
            query_results.append(res)
            ap_scores.append(res.ap)
            rr_scores.append(res.rr)
            latencies.append(res.latency_ms)

            for k, metric in res.metrics_at_k.items():
                accum_precision[k].append(metric.precision)
                accum_recall[k].append(metric.recall)

        # Tính điểm trung bình (Mean Metrics)
        total_q = len(query_results)
        mean_precision = {
            k: round(sum(vals) / total_q, 4) if total_q > 0 else 0.0
            for k, vals in accum_precision.items()
        }
        mean_recall = {
            k: round(sum(vals) / total_q, 4) if total_q > 0 else 0.0
            for k, vals in accum_recall.items()
        }
        mean_map = round(sum(ap_scores) / total_q, 4) if total_q > 0 else 0.0
        mean_mrr = round(sum(rr_scores) / total_q, 4) if total_q > 0 else 0.0
        avg_latency = round(sum(latencies) / total_q, 2) if total_q > 0 else 0.0

        return BenchmarkSummary(
            total_queries=total_q,
            evaluated_images_count=len(avail_imgs) if avail_imgs else len(gt),
            mean_precision_at_k=mean_precision,
            mean_recall_at_k=mean_recall,
            map_score=mean_map,
            mrr_score=mean_mrr,
            avg_latency_ms=avg_latency,
            query_results=query_results,
        )


# =========================================================================
# BACKWARD COMPATIBILITY: Module-level Singletons & Functions
# =========================================================================
evaluation_service = EvaluationService()


def evaluate_query(
    query_text: str,
    target_article_type: str,
    k_list: Optional[List[int]] = None,
    limit: int = 10,
    ground_truth: Optional[Dict[str, Dict[str, str]]] = None,
    available_images: Optional[Set[str]] = None,
) -> QueryEvaluationResult:
    """Hàm module-level tương thích ngược cho scripts/run_benchmark.py."""
    return evaluation_service.evaluate_query(
        query_text=query_text,
        target_article_type=target_article_type,
        k_list=k_list,
        limit=limit,
        ground_truth=ground_truth,
        available_images=available_images,
    )


def run_full_benchmark(
    test_cases: Optional[List[Dict[str, str]]] = None,
    k_list: Optional[List[int]] = None,
) -> BenchmarkSummary:
    """Hàm module-level tương thích ngược cho scripts/run_benchmark.py."""
    return evaluation_service.run_full_benchmark(test_cases=test_cases, k_list=k_list)


__all__ = [
    # Class & Singleton
    "EvaluationService",
    "evaluation_service",
    "DEFAULT_BENCHMARK_CASES",
    # Re-exported CSV & Ground truth helpers
    "load_ground_truth",
    "get_available_test_images",
    "get_available_article_types",
    "TEST_DATASET_DIR",
    "STYLES_CSV_PATH",
    "TEST_IMAGES_DIR",
    # Re-exported metric math functions
    "calculate_precision_recall_at_k",
    "calculate_average_precision",
    "calculate_reciprocal_rank",
    # Module-level benchmark runners
    "evaluate_query",
    "run_full_benchmark",
]
