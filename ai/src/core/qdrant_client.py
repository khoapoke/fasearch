import logging
from qdrant_client import QdrantClient
from src.core.config import settings

logger = logging.getLogger(__name__)

# Biến toàn cục giữ kết nối DB
_client = None
QDRANT_HOST = settings.qdrant.host
QDRANT_PORT = settings.qdrant.grpc_port
QDRANT_PREFER_GRPC = settings.qdrant.prefer_grpc


def get_qdrant_client():
    """
    Hàm này cung cấp client kết nối tới Qdrant.
    Đảm bảo chỉ mở một luồng gRPC duy nhất cho toàn bộ vòng đời của ứng dụng.
    """
    global _client

    if _client is not None:
        return _client

    logger.info("[*] Đang thiết lập luồng kết nối gRPC tới Qdrant...")

    # Kết nối qua cổng 6334 để tối ưu băng thông cho hệ thống tìm kiếm thời trang đa phương thức
    _client = QdrantClient(
        host=QDRANT_HOST,
        grpc_port=QDRANT_PORT,
        prefer_grpc=QDRANT_PREFER_GRPC,
        timeout=5.0,
    )

    logger.info("[*] Kết nối cơ sở dữ liệu vector thành công!")
    return _client