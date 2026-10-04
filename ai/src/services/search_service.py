import torch
from PIL import Image
from src.core.ai_model import get_ai_model
from src.core.qdrant_client import get_qdrant_client
from src.core.config import settings

COLLECTION_NAME = settings["qdrant"]["collection_name"]

def _format_results(results):
    """Hàm phụ trợ định dạng dữ liệu thô từ Qdrant thành dict khớp với Schema"""
    formatted = []
    for res in results:
        formatted.append({
            "id": str(res.id),
            "score": res.score,
            "image_path": res.payload.get("image_path", ""),
            "file_name": res.payload.get("file_name", ""),
            "catalog": res.payload.get("catalog", "")
        })
    return formatted

def search_by_text(query_text: str, limit: int = 5):
    device, model, processor = get_ai_model()
    client = get_qdrant_client()

    text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)
    
    with torch.no_grad():
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = text_features.cpu().numpy()[0].tolist()

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=limit,
        with_payload=True
    )
    return _format_results(results)

def search_by_image(image_path: str, limit: int = 5):
    device, model, processor = get_ai_model()
    client = get_qdrant_client()

    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        raise ValueError(f"Không thể đọc ảnh: {e}")

    image_inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = image_features.cpu().numpy()[0].tolist()

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=limit,
        with_payload=True
    )
    return _format_results(results)

