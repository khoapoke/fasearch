import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import router và các hàm khởi tạo từ Core
from src.api.endpoints import router as search_router
from src.core.ai_model import get_ai_model
from src.core.qdrant_client import get_qdrant_client

# 1. Quản lý vòng đời Server 
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n[+] Đang khởi động Server...")
    # Gọi hàm Singleton để ép tải model CLIP lên VRAM ngay lập tức
    get_ai_model()
    # Mở sẵn luồng kết nối gRPC tới Qdrant
    get_qdrant_client()
    print("[+] Hệ thống AI và Database đã sẵn sàng nhận Request!\n")
    
    yield # Bắt đầu phục vụ API
    
    print("\n[-] Đang tắt Server, dọn dẹp tài nguyên...")

# 2. Khởi tạo ứng dụng FastAPI
app = FastAPI(
    title="Fashion AI Search API",
    description="Backend tìm kiếm thời trang bằng văn bản và hình ảnh đa phương thức (CLIP + Qdrant)",
    version="1.0.0",
    lifespan=lifespan
)

# 3. Cấu hình CORS (Bắt buộc phải có để Frontend React/Vue gọi API không bị lỗi mạng)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Khi lên production nên đổi thành domain thật, vd: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Gắn các API Endpoints vào ứng dụng
app.include_router(search_router, prefix="/api", tags=["Search API"])

# 5. Phục vụ thư mục tĩnh (Giải quyết lỗi trình duyệt không hiện ảnh ở Qdrant Dashboard)
# Từ giờ, frontend có thể hiển thị ảnh bằng link: http://localhost:8000/uploads/ten_file_anh.jpg
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "storage", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.get("/", tags=["Trang chủ"])
async def root():
    return {"message": "Server Fashion Search AI đang chạy tốt! Mở /docs để xem API."}