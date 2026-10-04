import os
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from src.db.schemas import SearchTextRequest, SearchResponse
from src.services.search_service import search_by_text, search_by_image

router = APIRouter()

# Tự động trỏ tới thư mục storage/uploads ở gốc dự án
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "storage", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True) # Tự tạo thư mục nếu chưa có


@router.post("/search/text", response_model=SearchResponse)
async def api_search_text(request: SearchTextRequest):
    try:
        results = search_by_text(request.query, request.limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/image", response_model=SearchResponse)
async def api_search_image(file: UploadFile = File(...), limit: int = Form(5)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không tìm thấy file đính kèm")
    
    # 1. Tạo đường dẫn và lưu file user upload vào storage/uploads
    # (Dùng uuid ghép vào tên file nếu muốn chống trùng lặp tên)
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    
    try:
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
            
   
        results = search_by_image(file_location, limit)
        
        # (Tuỳ chọn) Nếu muốn giữ lại ảnh rác trên server sau khi tìm kiếm xong:
        os.remove(file_location) 
        
        return {"results": results}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__=="__main__":
    

    pass