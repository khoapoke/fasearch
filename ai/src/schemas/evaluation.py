from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class MetricAtK(BaseModel):
    """Chỉ số đánh giá tại điểm cắt K cụ thể (Top K)."""
    k: int = Field(..., description="Ngưỡng Top K đánh giá (ví dụ: 1, 3, 5, 10)")
    precision: float = Field(..., description="Độ chính xác: Tỷ lệ sản phẩm đúng trong Top K")
    recall: float = Field(..., description="Độ bao phủ: Tỷ lệ sản phẩm đúng tìm được so với tổng số đúng trong DB")
    hit_count: int = Field(..., description="Số lượng kết quả đúng nằm trong Top K")
    total_relevant: int = Field(..., description="Tổng số sản phẩm đúng thực tế trong Database")


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

