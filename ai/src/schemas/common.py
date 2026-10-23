from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Cấu trúc phản hồi chuẩn doanh nghiệp (API Response Envelope)."""
    success: bool
    status_code: int
    message: str
    data: Optional[T] = None
    errors: Optional[Any] = None
