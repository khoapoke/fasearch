from typing import Dict, List, Tuple

# =========================================================================
# PHẦN 1: CHỈ SỐ CƠ BẢN CHO TỪNG CÂU TRUY VẤN 
# =========================================================================

def calculate_precision_recall_at_k(
    retrieved_hits: List[bool],
    total_relevant: int,
    k: int,
) -> Tuple[float, float, int]:
    """
    Tính Precision@K và Recall@K cho 1 câu truy vấn cụ thể:
    - Precision@K = (Số kết quả đúng trong Top K) / K.
    - Recall@K = (Số kết quả đúng trong Top K) / (Tổng số kết quả đúng thực tế trong Database).
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
    Tính Average Precision (AP) cho 1 câu truy vấn theo chuẩn Information Retrieval (AP@K):
    - AP đo lường xem các kết quả đúng có được dồn lên các vị trí đầu bảng hay không.
    - Công thức: AP = (1 / min(K, total_relevant)) * sum_{i=1}^{K} (Precision@i * rel(i)).
    - Đảm bảo nếu trả về toàn bộ kết quả đúng trong Top K thì AP = 1.0 (100%).
    (Lưu ý: Trung bình cộng AP của nhiều câu truy vấn sẽ tạo thành chỉ số mAP).
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

    # Chuẩn AP@K: chuẩn hóa theo min(K, total_relevant) quốc tế
    denominator = min(len(retrieved_hits), total_relevant)
    # # tính bình thường 
    # denominator= retrieved_hits.count(True)
    return precision_sum / float(denominator) if denominator > 0 else 0.0


def calculate_reciprocal_rank(retrieved_hits: List[bool]) -> float:
    """
    Tính Reciprocal Rank (RR) cho 1 câu truy vấn:
    - RR đo lường vị trí (Rank) xuất hiện của kết quả đúng đầu tiên.
    - Công thức: RR = 1 / rank của kết quả đúng đầu tiên (1-indexed).
    - Ví dụ: Đúng ở vị trí #1 -> RR = 1.0; đúng ở vị trí #2 -> RR = 0.5. Nếu không có hit nào -> RR = 0.0.
    (Lưu ý: Trung bình cộng RR của nhiều câu truy vấn sẽ tạo thành chỉ số MRR).
    """
    for rank, is_hit in enumerate(retrieved_hits, start=1):
        if is_hit:
            return 1.0 / rank
    return 0.0


# =========================================================================
# PHẦN 2: CHỈ SỐ TỔNG HỢP TOÀN HỆ THỐNG
# =========================================================================

def calculate_map(ap_scores: List[float]) -> float:
    """
    Tính Mean Average Precision (mAP) cho toàn bộ hệ thống:
    - mAP = Trung bình cộng (Mean) điểm AP của tất cả các câu truy vấn.
    - Thước đo vàng (Gold Standard) đánh giá chất lượng xếp hạng toàn diện của Search Engine.
    """
    if not ap_scores:
        return 0.0
    return round(sum(ap_scores) / float(len(ap_scores)), 4)


def calculate_mrr(rr_scores: List[float]) -> float:
    """
    Tính Mean Reciprocal Rank (MRR) cho toàn bộ hệ thống:
    - MRR = Trung bình cộng (Mean) điểm RR của tất cả các câu truy vấn.
    - Đo lường mức độ ưu tiên đưa kết quả đúng lên ngay vị trí đầu tiên của hệ thống.
    """
    if not rr_scores:
        return 0.0
    return round(sum(rr_scores) / float(len(rr_scores)), 4)


def calculate_mean_metrics_at_k(accum_metrics: Dict[int, List[float]]) -> Dict[int, float]:
    """
    Tính trung bình cộng các chỉ số tại từng ngưỡng K (Mean Precision@K hoặc Mean Recall@K)
    qua toàn bộ các câu truy vấn trong phiên benchmark.
    """
    mean_dict: Dict[int, float] = {}
    for k, vals in accum_metrics.items():
        mean_dict[k] = round(sum(vals) / float(len(vals)), 4) if vals else 0.0
    return mean_dict


def calculate_mean_latency(latencies: List[float]) -> float:
    """
    Tính thời gian phản hồi tìm kiếm trung bình (Mean Latency) tính bằng mili-giây (ms).
    """
    if not latencies:
        return 0.0
    return round(sum(latencies) / float(len(latencies)), 2)


# Alias tường minh
calculate_mean_average_precision = calculate_map
calculate_mean_reciprocal_rank = calculate_mrr
