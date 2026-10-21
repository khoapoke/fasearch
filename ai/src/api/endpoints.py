import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from src.db.schemas import SearchTextRequest, SearchResponse
from src.services.search_service import search_by_text, search_by_image
from src.core.config import settings

router = APIRouter()

# Cấu hình từ configs/database.yaml
MAX_SEARCH_LIMIT = settings.get("app", {}).get("max_search_limit", 50)
VALID_IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')

# Tự động trỏ tới thư mục storage/uploads ở gốc dự án
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "storage", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/search/text", response_model=SearchResponse)
async def api_search_text(request: SearchTextRequest):
    if request.limit < 1 or request.limit > MAX_SEARCH_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Tham số limit phải nằm trong khoảng từ 1 đến {MAX_SEARCH_LIMIT}"
        )

    try:
        results = search_by_text(request.query, request.limit)
        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search/image", response_model=SearchResponse)
async def api_search_image(file: UploadFile = File(...), limit: int = Form(5)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file đính kèm")

    # 1. Kiểm tra định dạng file (File extension validation)
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in VALID_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file '{file_ext}' không hợp lệ. Chỉ chấp nhận các file: {', '.join(VALID_IMAGE_EXTENSIONS)}"
        )

    # 2. Ràng buộc tham số limit theo cấu hình configs/database.yaml
    if limit < 1 or limit > MAX_SEARCH_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Tham số limit phải nằm trong khoảng từ 1 đến {MAX_SEARCH_LIMIT}"
        )

    # 3. Tạo tên file tạm ngẫu nhiên bằng UUID để chống Race Condition khi nhiều client upload cùng lúc
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_location = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        results = search_by_image(file_location, limit)
        return {"results": results}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 4. Đảm bảo file tạm luôn luôn được dọn dẹp kể cả khi có ngoại lệ xảy ra
        if os.path.exists(file_location):
            os.remove(file_location)