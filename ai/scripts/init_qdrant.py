from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
from src.core.config import settings

# Cấu hình Database từ settings
QDRANT_HOST = settings.qdrant.host
QDRANT_PORT = settings.qdrant.grpc_port
COLLECTION_NAME = settings.qdrant.collection_name
VECTOR_SIZE = settings.qdrant.vector_size


def init_db(reset: bool = False) -> None:
    """Kết nối tới Qdrant và khởi tạo hoặc làm sạch collection."""
    client = QdrantClient(host=QDRANT_HOST, grpc_port=QDRANT_PORT, prefer_grpc=True)

    if reset and client.collection_exists(COLLECTION_NAME):
        print(f"[*] Đang xóa collection cũ '{COLLECTION_NAME}'...")
        client.delete_collection(collection_name=COLLECTION_NAME)

    if not client.collection_exists(COLLECTION_NAME):
        print(f"[*] Đang tạo collection mới '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        print("[*] Khởi tạo Database thành công!")
    else:
        print(f"[*] Collection '{COLLECTION_NAME}' đã tồn tại, giữ nguyên dữ liệu.")


def main():
    # =========================================================================
    # CẤU HÌNH KHỞI TẠO DATABASE (CHỈNH SỬA TRỰC TIẾP TẠI ĐÂY)
    # =========================================================================
    # reset = True : Xóa sạch collection cũ và tạo mới lại từ đầu
    # reset = False: Giữ nguyên collection cũ nếu đã tồn tại
    reset = True

    init_db(reset=reset)


if __name__ == "__main__":
    main()
