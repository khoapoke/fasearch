from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class MetricAtK(BaseModel):
    """Chỉ số đánh giá tại điểm cắt K cụ thể (Top K)."""
    k: int = Field(..., description="Ngưỡng Top K đánh giá (ví dụ: 1, 3, 5, 10)")
    precision: float = Field(..., description="Độ chính xác: Tỷ lệ sản phẩm đúng trong Top K")
    recall: float = Field(..., description="Độ bao phủ: Tỷ lệ sản phẩm đúng tìm được so với tổng số sản phẩm đúng THỰC SỰ có trong collection đang đánh giá")
    hit_count: int = Field(..., description="Số lượng kết quả đúng nằm trong Top K")
    total_relevant: int = Field(..., description="Tổng số sản phẩm đúng thực tế có trong collection đang đánh giá (có nhãn Ground Truth)")


class EvaluatedItem(BaseModel):
    """Thông tin từng sản phẩm được xếp hạng trả về từ Search Engine."""
    id: str
    file_name: str
    score: float
    is_hit: bool
    image_path: Optional[str] = None
    article_type: Optional[str] = None
    sub_category: Optional[str] = None
    display_name: Optional[str] = None


class QueryEvaluationResult(BaseModel):
    """Kết quả đánh giá chi tiết cho 1 câu truy vấn cụ thể."""
    query: str
    target_label: str
    total_relevant_in_db: int
    metrics_at_k: Dict[int, MetricAtK]
    ap: float = Field(..., description="Average Precision (AP) của câu truy vấn này")
    rr: float = Field(default=0.0, description="Reciprocal Rank (RR) của câu truy vấn này")
    latency_ms: float = Field(..., description="Thời gian thực thi tìm kiếm tính bằng mili-giây")
    retrieved_items: List[EvaluatedItem] = Field(default_factory=list)

    def get_metric_at_k(self, k: int) -> MetricAtK:
        """Lấy chỉ số Precision & Recall tại ngưỡng K bất kỳ.
        
        Nếu K đã có trong metrics_at_k, trả về kết quả đã tính toán.
        Nếu K chưa có, tự động tính toán động từ retrieved_items để không bị ràng buộc K cố định.
        """
        if k in self.metrics_at_k:
            return self.metrics_at_k[k]

        if k <= 0:
            return MetricAtK(
                k=k,
                precision=0.0,
                recall=0.0,
                hit_count=0,
                total_relevant=self.total_relevant_in_db,
            )

        sub_items = self.retrieved_items[:k]
        hit_count = sum(1 for item in sub_items if item.is_hit)
        precision = hit_count / k
        recall = (
            hit_count / self.total_relevant_in_db
            if self.total_relevant_in_db > 0
            else 0.0
        )
        return MetricAtK(
            k=k,
            precision=round(precision, 4),
            recall=round(recall, 4),
            hit_count=hit_count,
            total_relevant=self.total_relevant_in_db,
        )


class BenchmarkSummary(BaseModel):
    """Báo cáo tổng kết toàn diện của toàn bộ phiên kiểm thử Benchmark."""
    total_queries: int
    evaluated_images_count: int
    mean_precision_at_k: Dict[int, float]
    mean_recall_at_k: Dict[int, float]
    map_score: float = Field(..., description="Mean Average Precision (mAP) trung bình toàn bộ hệ thống")
    mrr_score: float = Field(default=0.0, description="Mean Reciprocal Rank (MRR) trung bình toàn bộ hệ thống")
    avg_latency_ms: float
    query_results: List[QueryEvaluationResult]
    skipped_queries: List[str] = Field(
        default_factory=list,
        description="Câu truy vấn không có sản phẩm đúng nào trong collection nên bị loại khỏi các giá trị trung bình",
    )

