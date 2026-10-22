import torch
from PIL import Image
from src.core.ai_model import get_ai_model
from src.repositories import get_image_repository


def _format_results(results):
    """Hàm phụ trợ định dạng dữ liệu thô từ Qdrant thành dict khớp với Schema"""
    formatted = []
    for res in results:
        payload = res.payload or {}
        formatted.append({
            "id": str(res.id),
            "score": res.score,
            "image_path": payload.get("image_path", ""),
            "file_name": payload.get("file_name", ""),
            "catalog": payload.get("catalog", "")
        })
    return formatted


def search_by_text(query_text: str, limit: int = 5):
    """Trích xuất vector text và tìm kiếm ảnh tương đồng qua ImageRepository."""
    device, model, processor = get_ai_model()
    img_repo = get_image_repository()

    text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)

    with torch.no_grad():
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = text_features.cpu().numpy()[0].tolist()

    results = img_repo.search_vectors(query_vector=query_vector, limit=limit, exclude_deleted=True)
    return _format_results(results)


def search_by_image(image_path: str, limit: int = 5):
    """Trích xuất vector ảnh và tìm kiếm ảnh tương đồng qua ImageRepository."""
    device, model, processor = get_ai_model()
    img_repo = get_image_repository()

    try:
        with Image.open(image_path) as img:
            image = img.convert("RGB")
    except Exception as e:
        raise ValueError(f"Không thể đọc ảnh: {e}")

    image_inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = image_features.cpu().numpy()[0].tolist()

    results = img_repo.search_vectors(query_vector=query_vector, limit=limit, exclude_deleted=True)
    return _format_results(results)


# ghi chú là chưa phát triển xong 
def search_by_image_text(image_path:str, query_text:str, limit:int=5):
    """ Trích xuất vector ảnh và text và tìm kiếm tương đồng qua độ đo cosine"""

    pass
