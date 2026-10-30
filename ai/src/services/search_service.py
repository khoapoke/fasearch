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


def search_by_text(
    query_text: str,
    limit: int = 5,
    exclude_deleted: bool = True,
    score_threshold: torch.Tensor | float | None = None,
):
    """Trích xuất vector text và tìm kiếm ảnh tương đồng qua ImageRepository."""
    device, model, processor = get_ai_model()
    img_repo = get_image_repository()

    text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)

    with torch.no_grad():
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = text_features.cpu().numpy()[0].tolist()

    threshold = float(score_threshold) if score_threshold is not None else None
    results = img_repo.search_vectors(
        query_vector=query_vector,
        limit=limit,
        score_threshold=threshold,
        exclude_deleted=exclude_deleted,
    )
    return _format_results(results)


def search_by_image(
    image_path: str,
    limit: int = 5,
    exclude_deleted: bool = True,
    score_threshold: torch.Tensor | float | None = None,
):
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

    threshold = float(score_threshold) if score_threshold is not None else None
    results = img_repo.search_vectors(
        query_vector=query_vector,
        limit=limit,
        score_threshold=threshold,
        exclude_deleted=exclude_deleted,
    )
    return _format_results(results)


def search_multimodal(
    image_path: str,
    query_text: str,
    limit: int = 5,
    text_weight: float = 0.5,
    exclude_deleted: bool = True,
    score_threshold: torch.Tensor | float | None = None,
):
    """
    Trích xuất vector kết hợp đa phương thức (Ảnh + Văn bản) bằng mô hình CLIP
    và tìm kiếm sản phẩm thời trang tương đồng trên Qdrant.

    - image_path: Đường dẫn tới file ảnh mẫu
    - query_text: Chuỗi văn bản mô tả / bổ trợ (vd: "nhưng màu xanh", "cổ tròn")
    - limit: Số lượng kết quả tối đa
    - text_weight: Trọng số ưu tiên Text (0.0: 100% ảnh, 1.0: 100% text, 0.5: cân bằng 50-50)
    """
    device, model, processor = get_ai_model()
    img_repo = get_image_repository()

    # 1. Trích xuất vector đặc trưng từ ảnh
    try:
        with Image.open(image_path) as img:
            image = img.convert("RGB")
    except Exception as e:
        raise ValueError(f"Không thể đọc ảnh: {e}")

    image_inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

    # 2. Trích xuất vector đặc trưng từ văn bản
    text_inputs = processor(text=[query_text], return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

    # 3. Kết hợp 2 vector có trọng số và chuẩn hóa lại L2 norm
    w_text = max(0.0, min(1.0, float(text_weight)))
    w_img = 1.0 - w_text

    with torch.no_grad():
        combined_features = (w_img * image_features) + (w_text * text_features)
        combined_features = combined_features / combined_features.norm(p=2, dim=-1, keepdim=True)
        query_vector = combined_features.cpu().numpy()[0].tolist()

    # Dọn dẹp tensor và giải phóng bộ nhớ GPU
    del image_inputs, text_inputs, image_features, text_features, combined_features
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    threshold = float(score_threshold) if score_threshold is not None else None
    results = img_repo.search_vectors(
        query_vector=query_vector,
        limit=limit,
        score_threshold=threshold,
        exclude_deleted=exclude_deleted,
    )
    return _format_results(results)


# Alias tương thích
search_by_image_text = search_multimodal
