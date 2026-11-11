import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import router và các hàm khởi tạo từ Core
from src.api.endpoints import router as search_router
from src.api.internal_endpoints import internal_router
from src.core.ai_model import get_ai_model
from src.core.qdrant_client import get_qdrant_client
from src.core.config import settings, BASE_DIR

# Cấu hình logging
logger = logging.getLogger("uvicorn.error")

# 1. Quản lý vòng đời Server (Lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n[+] Đang khởi động Server...")
    # Gọi hàm Singleton để ép tải model CLIP lên VRAM ngay lập tức
    get_ai_model()
    # Mở sẵn luồng kết nối gRPC tới Qdrant
    get_qdrant_client()
    print("[+] Hệ thống AI và Database đã sẵn sàng nhận Request!\n")

    yield  # Bắt đầu phục vụ API

    print("\n[-] Đang tắt Server, dọn dẹp tài nguyên...")


# 2. Khởi tạo ứng dụng FastAPI
app = FastAPI(
    title="Fashion AI Search API",
    description="Backend tìm kiếm thời trang bằng văn bản và hình ảnh đa phương thức (CLIP + Qdrant)",
    version="1.0.0",
    lifespan=lifespan
)

# 3. Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 4. Middleware bắt lỗi tập trung (Global Exception Handlers)

# 4.1. Bắt lỗi Validate dữ liệu đầu vào (Pydantic / FastAPI 422)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    formatted_errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = " -> ".join([str(l) for l in loc if l not in ("body",)]) or "unknown"
        formatted_errors.append({
            "field": field,
            "message": err.get("msg", "Dữ liệu không hợp lệ")
        })

    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "status_code": 422,
            "message": "Dữ liệu yêu cầu không hợp lệ",
            "data": None,
            "errors": formatted_errors
        }
    )


# 4.2. Bắt lỗi HTTP tường minh (400, 404, 403, ...)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "status_code": exc.status_code,
            "message": str(exc.detail),
            "data": None,
            "errors": None
        }
    )


# 4.3. Bắt lỗi hệ thống chưa lường trước (500 Internal Server Error)
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Lỗi hệ thống chưa xử lý tại {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "status_code": 500,
            "message": "Đã xảy ra lỗi nội bộ hệ thống. Vui lòng thử lại sau.",
            "data": None,
            "errors": None
        }
    )


# 5. Gắn các API Endpoints vào ứng dụng
app.include_router(search_router, prefix="/api", tags=["Search API"])
app.include_router(internal_router, tags=["Internal Index API"])

# 6. Phục vụ thư mục tĩnh (Static files)
UPLOAD_DIR = os.path.join(BASE_DIR, settings.app.upload_dir)
DATASET_DIR = os.path.join(BASE_DIR, settings.app.raw_data_dir)

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATASET_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/dataset", StaticFiles(directory=str(DATASET_DIR)), name="dataset")


@app.get("/", tags=["Trang chủ"])
async def root():
    return {
        "success": True,
        "status_code": 200,
        "message": "Server Fashion Search AI đang chạy tốt! Mở /docs để xem API.",
        "data": None,
        "errors": None
    }