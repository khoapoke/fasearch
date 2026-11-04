import argparse

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from src.core.config import settings


# Cấu hình Database 
QDRANT_HOST = settings.qdrant.host
QDRANT_PORT = settings.qdrant.grpc_port
COLLECTION_NAME = settings.qdrant.collection_name
VECTOR_SIZE = settings.qdrant.vector_size


def init_db(reset=False):
    # Kết nối tới Qdrant qua cổng gRPC tốc độ cao
    client = QdrantClient(host=QDRANT_HOST, grpc_port=QDRANT_PORT, prefer_grpc=True)
    
    # Rút phích cắm, xóa sạch dữ liệu cũ nếu reset=True
    if reset and client.collection_exists(COLLECTION_NAME):
        print(f"[*] Đang xóa collection cũ '{COLLECTION_NAME}'...")
        client.delete_collection(collection_name=COLLECTION_NAME)
        
    # Tạo bảng Vector Index mới
    if not client.collection_exists(COLLECTION_NAME):
        print(f"[*] Đang tạo collection mới '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
        )
        print("[*] Khởi tạo Database thành công!")
    else:
        print(f"[*] Collection '{COLLECTION_NAME}' đã tồn tại, giữ nguyên dữ liệu.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Khởi tạo collection Qdrant (mặc định KHÔNG xóa dữ liệu).")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="NGUY HIỂM: xóa collection hiện có rồi tạo lại rỗng (mất toàn bộ point).",
    )
    args = parser.parse_args()
    if args.reset:
        print(f"[!] --reset: collection '{COLLECTION_NAME}' trên {QDRANT_HOST}:{QDRANT_PORT} sẽ bị xóa sạch.")
    init_db(reset=args.reset)


