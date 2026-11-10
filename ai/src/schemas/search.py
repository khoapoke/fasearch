from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class SearchResultItem(BaseModel):
    """Cấu trúc một kết quả tìm kiếm sản phẩm thời trang trả về cho Client."""
    id: str
    score: float
    image_path: str
    file_name: str
    catalog: Optional[str] = None
    product_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchData(BaseModel):
    """Cấu trúc data cho kết quả tìm kiếm thời trang."""
    total: int
    results: List[SearchResultItem]
    # Non-breaking: query gốc + bản dịch Anh dùng để encode CLIP.
    # BE cũ bỏ qua field thừa trong JSON nên hợp đồng hiện tại giữ nguyên.
    translated_query: Optional[str] = None
    query_language: Optional[str] = None


class SearchTextRequest(BaseModel):
    """Dữ liệu Client gửi lên khi tìm kiếm bằng từ khóa văn bản."""
    query: str
    limit: int = 5
