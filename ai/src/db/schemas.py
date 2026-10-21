from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel

T = TypeVar("T")

# 1. Cấu trúc một kết quả tìm kiếm thời trang
class SearchResultItem(BaseModel):
    id: str
    score: float
    image_path: str
    file_name: str
    catalog: Optional[str] = None

# 2. Cấu trúc trường data cho kết quả tìm kiếm
class SearchData(BaseModel):
    total: int
    results: List[SearchResultItem]

# 3. Dữ liệu Frontend gửi lên khi tìm kiếm bằng chữ
class SearchTextRequest(BaseModel):
    query: str
    limit: int = 5

# 4. Cấu trúc phản hồi chuẩn doanh nghiệp (API Response Envelope)
class ApiResponse(BaseModel, Generic[T]):
    success: bool
    status_code: int
    message: str
    data: Optional[T] = None
    errors: Optional[Any] = None