from pydantic import BaseModel
from typing import List, Optional

# Cấu trúc của một kết quả ảnh trả về
class SearchResultItem(BaseModel):
    id: str
    score: float
    image_path: str
    file_name: str
    catalog: Optional[str] = None

# Cấu trúc dữ liệu frontend gửi lên khi tìm bằng chữ
class SearchTextRequest(BaseModel):
    query: str
    limit: int = 5

# Cấu trúc mảng kết quả API trả về cho frontend
class SearchResponse(BaseModel):
    results: List[SearchResultItem]


if __name__=="__main__":

    pass