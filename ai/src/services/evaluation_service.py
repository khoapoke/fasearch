import csv
import logging
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

from src.core.config import BASE_DIR
from src.schemas.evaluation import (
    MetricAtK,
    EvaluatedItem,
    QueryEvaluationResult,
    BenchmarkSummary,
)
from src.services.search_service import search_by_text

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


def calculate_precision_recall_at_k(
    retrieved_hits: List[bool],
    total_relevant: int,
    k: int,
) -> Tuple[float, float, int]:
    """
    Tính Precision@K và Recall@K:
    - Precision@K = (Số kết quả đúng trong Top K) / K
    - Recall@K = (Số kết quả đúng trong Top K) / (Tổng số kết quả đúng thực tế)
    """
    if k <= 0:
        return 0.0, 0.0, 0

    top_k_hits = retrieved_hits[:k]
    hit_count = sum(1 for is_hit in top_k_hits if is_hit)

    precision = hit_count / float(k)
    recall = (hit_count / float(total_relevant)) if total_relevant > 0 else 0.0

    return precision, recall, hit_count


def calculate_average_precision(retrieved_hits: List[bool], total_relevant: int) -> float:
    """
    Tính Average Precision (AP) cho 1 câu truy vấn:
    AP = (1 / total_relevant) * sum_{k=1}^{N} (Precision@k * rel(k))
    """
    if total_relevant <= 0 or not retrieved_hits:
        return 0.0

    running_hits = 0
    precision_sum = 0.0

    for i, is_hit in enumerate(retrieved_hits):
        if is_hit:
            running_hits += 1
            precision_at_i = running_hits / (i + 1)
            precision_sum += precision_at_i

    return precision_sum / float(total_relevant)


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


def evaluate_query(
    query_text: str,
    target_article_type: str,
    k_list: Optional[List[int]] = None,
    limit: int = 10,
    ground_truth: Optional[Dict[str, Dict[str, str]]] = None,
    available_images: Optional[Set[str]] = None,
) -> QueryEvaluationResult:
    """
    Thực hiện 1 truy vấn văn bản, so khớp với nhãn Ground Truth và tính các chỉ số đo lường.
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

    # Thực hiện tìm kiếm và đo thời gian Latency
    start_time = time.perf_counter()
    raw_results = search_by_text(
        query_text=query_text,
        limit=max(limit, max(k_list)),
        exclude_deleted=True,
    )
    latency_ms = (time.perf_counter() - start_time) * 1000.0

    retrieved_hits: List[bool] = []
    evaluated_items: List[EvaluatedItem] = []

    for item in raw_results:
        fname = item.get("file_name", "")
        # Chuẩn hóa tên file để so sánh
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

    # Tính Average Precision (AP)
    ap = calculate_average_precision(retrieved_hits, total_relevant)

    return QueryEvaluationResult(
        query=query_text,
        target_label=target_article_type,
        total_relevant_in_db=total_relevant,
        metrics_at_k=metrics_at_k,
        ap=round(ap, 4),
        latency_ms=round(latency_ms, 2),
        retrieved_items=evaluated_items[:limit],
    )


def run_full_benchmark(
    test_cases: Optional[List[Dict[str, str]]] = None,
    k_list: Optional[List[int]] = None,
) -> BenchmarkSummary:
    """
    Chạy toàn bộ bộ kiểm thử Benchmark, tổng hợp mAP và điểm trung bình Precision@K, Recall@K.
    """
    if k_list is None:
        k_list = [1, 3, 5, 10]
    cases = test_cases or DEFAULT_BENCHMARK_CASES

    gt = load_ground_truth()
    avail_imgs = get_available_test_images()

    query_results: List[QueryEvaluationResult] = []
    ap_scores: List[float] = []
    latencies: List[float] = []

    # Lưu tích lũy precision và recall theo từng k
    accum_precision: Dict[int, List[float]] = {k: [] for k in k_list}
    accum_recall: Dict[int, List[float]] = {k: [] for k in k_list}

    for case in cases:
        q_text = case["query"]
        target = case["target_article_type"]

        res = evaluate_query(
            query_text=q_text,
            target_article_type=target,
            k_list=k_list,
            ground_truth=gt,
            available_images=avail_imgs,
        )
        query_results.append(res)
        ap_scores.append(res.ap)
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
    avg_latency = round(sum(latencies) / total_q, 2) if total_q > 0 else 0.0

    return BenchmarkSummary(
        total_queries=total_q,
        evaluated_images_count=len(avail_imgs) if avail_imgs else len(gt),
        mean_precision_at_k=mean_precision,
        mean_recall_at_k=mean_recall,
        map_score=mean_map,
        avg_latency_ms=avg_latency,
        query_results=query_results,
    )

