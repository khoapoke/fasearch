import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from src.schemas.common import ApiResponse
from src.schemas.search import SearchTextRequest, SearchData
from src.services.search_service import search_by_text, search_by_image, search_multimodal
from src.core.config import settings, BASE_DIR

router = APIRouter()

# Cấu hình từ configs/database.yaml và .env
MAX_SEARCH_LIMIT = settings.app.max_search_limit
VALID_IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')

# Tự động trỏ tới thư mục uploads theo cấu hình
UPLOAD_DIR = os.path.join(BASE_DIR, settings.app.upload_dir)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/search/text", response_model=ApiResponse[SearchData])
async def api_search_text(request: SearchTextRequest):
    if request.limit < 1 or request.limit > MAX_SEARCH_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Tham số limit phải nằm trong khoảng từ 1 đến {MAX_SEARCH_LIMIT}"
        )

    results = search_by_text(request.query, request.limit)
    return {
        "success": True,
        "status_code": 200,
        "message": "Tìm kiếm theo văn bản thành công",
        "data": {
            "total": len(results),
            "results": results
        },
        "errors": None
    }


@router.post("/search/image", response_model=ApiResponse[SearchData])
async def api_search_image(file: UploadFile = File(...), limit: int = Form(5)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file đính kèm")

    # 1. Kiểm tra định dạng file ảnh (File extension validation)
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
        return {
            "success": True,
            "status_code": 200,
            "message": "Tìm kiếm theo hình ảnh thành công",
            "data": {
                "total": len(results),
                "results": results
            },
            "errors": None
        }
    finally:
        # 4. Đảm bảo file tạm luôn được dọn dẹp kể cả khi có ngoại lệ xảy ra
        if os.path.exists(file_location):
            os.remove(file_location)


@router.post("/search/multimodal", response_model=ApiResponse[SearchData])
async def api_search_multimodal(
    file: UploadFile = File(...),
    query: str = Form(...),
    limit: int = Form(5),
    text_weight: float = Form(0.5),
):
    """
    Endpoint tìm kiếm đa phương thức kết hợp cả Hình ảnh và Văn bản mô tả.
    - file: Ảnh thời trang mẫu làm gốc
    - query: Chuỗi mô tả bổ trợ hoặc điều chỉnh phong cách (vd: 'màu xanh', 'phong cách vintage')
    - limit: Số lượng kết quả tối đa trả về
    - text_weight: Trọng số ưu tiên văn bản (0.0: 100% theo ảnh, 1.0: 100% theo chữ, 0.5: cân bằng)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file đính kèm")

    if not query or not query.strip():
        raise HTTPException(status_code=400, detail="Chuỗi tìm kiếm (query) không được để trống")

    # 1. Kiểm tra định dạng file ảnh
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in VALID_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng file '{file_ext}' không hợp lệ. Chỉ chấp nhận các file: {', '.join(VALID_IMAGE_EXTENSIONS)}"
        )

    # 2. Ràng buộc tham số limit
    if limit < 1 or limit > MAX_SEARCH_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Tham số limit phải nằm trong khoảng từ 1 đến {MAX_SEARCH_LIMIT}"
        )

    # 3. Ràng buộc tham số text_weight
    if text_weight < 0.0 or text_weight > 1.0:
        raise HTTPException(
            status_code=400,
            detail="Tham số text_weight phải nằm trong khoảng từ 0.0 đến 1.0"
        )

    # 4. Tạo tên file tạm ngẫu nhiên bằng UUID để chống Race Condition
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_location = os.path.join(UPLOAD_DIR, unique_filename)

    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        results = search_multimodal(
            image_path=file_location,
            query_text=query.strip(),
            limit=limit,
            text_weight=text_weight,
        )
        return {
            "success": True,
            "status_code": 200,
            "message": "Tìm kiếm đa phương thức kết hợp thành công",
            "data": {
                "total": len(results),
                "results": results
            },
            "errors": None
        }
    finally:
        # 5. Đảm bảo file tạm luôn được dọn dẹp an toàn
        if os.path.exists(file_location):
            os.remove(file_location)

