import logging
from typing import Optional
from qdrant_client import QdrantClient
from src.core.qdrant_client import get_qdrant_client

logger = logging.getLogger(__name__)


class BaseRepository:
    """
    Lớp Repository cơ sở đóng gói kết nối và thao tác nền tảng với Vector Database Qdrant.
    """

    def __init__(self, collection_name: str, client: Optional[QdrantClient] = None) -> None:
        self.collection_name = collection_name
        self._client = client

    @property
    def client(self) -> QdrantClient:
        """Lấy singleton QdrantClient (hoặc client được inject)."""
        if self._client is None:
            self._client = get_qdrant_client()
        return self._client
