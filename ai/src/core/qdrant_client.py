from qdrant_client import QdrantClient
from src.core.config import settings
# Biến toàn cục giữ kết nối DB
_client = None
HOST=settings["qdrant"]["host"]
PORT=settings["qdrant"]["grpc_port"]
PERFECT_GPRC=settings["qdrant"]["prefer_grpc"]

def get_qdrant_client():
    """
    Hàm này cung cấp client kết nối tới Qdrant.
    Đảm bảo chỉ mở một luồng gRPC duy nhất cho toàn bộ vòng đời của ứng dụng.
    """
    global _client
    
    if _client is not None:
        return _client
        
    print("[*] Đang thiết lập luồng kết nối gRPC tới Qdrant...")
    
    # Kết nối qua cổng 6334 để tối ưu băng thông cho hệ thống tìm kiếm thời trang đa phương thức
    _client = QdrantClient(host=HOST, grpc_port=PORT, prefer_grpc=PERFECT_GPRC)
    
    print("[*] Kết nối cơ sở dữ liệu vector thành công!")
    return _client