from typing import List, Tuple


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


def calculate_reciprocal_rank(retrieved_hits: List[bool]) -> float:
    """
    Tính Reciprocal Rank (RR) cho 1 câu truy vấn:
    RR = 1 / rank của kết quả đúng đầu tiên (1-indexed). Nếu không có hit nào, trả về 0.0.
    """
    for rank, is_hit in enumerate(retrieved_hits, start=1):
        if is_hit:
            return 1.0 / rank
    return 0.0
