from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from src.db.enums import PointStatus, CatalogCategory


class ImagePointPayload(BaseModel):
    """
    Thực thể dữ liệu (Entity) lưu trong Payload của Vector Point trên Qdrant.
    """
    image_path: str
    file_name: str
    catalog: CatalogCategory = CatalogCategory.FASHION_PRODUCT
    status: PointStatus = PointStatus.SEEDED
    product_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_payload_dict(self) -> Dict[str, Any]:
        """Chuyển đổi thành dict khớp với cấu trúc lưu trữ của Qdrant Payload."""
        return {
            "image_path": self.image_path,
            "file_name": self.file_name,
            "catalog": str(self.catalog),
            "status": str(self.status),
            "product_id": self.product_id,
            "metadata": self.metadata or {},
            "created_at": self.created_at
        }
