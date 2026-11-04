"""Internal Index API: Backend đồng bộ index khi admin publish / unpublish sản phẩm.

Hợp đồng giữ nguyên với FashionAiPublishClient của Backend (mount ở root, KHÔNG có prefix /api):
- POST   /internal/v1/index/upsert              (multipart: product_id, name?, description?, brand_slug?, model?, file?)
- DELETE /internal/v1/index/products/{product_id}
- GET    /internal/v1/health
Chỉ cho phép gọi từ loopback.
"""

import os
import uuid
import shutil
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request

from src.core.config import settings, BASE_DIR
from src.core.exceptions import InvalidInputError
from src.services.point_service import PointService
from src.utils.point_id import normalize_point_id

internal_router = APIRouter()

VALID_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
UPLOAD_DIR = os.path.join(BASE_DIR, settings.app.upload_dir)
os.makedirs(UPLOAD_DIR, exist_ok=True)

_ALLOWED_INTERNAL_HOSTS = {"127.0.0.1", "::1", "localhost"}


def _require_loopback(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in _ALLOWED_INTERNAL_HOSTS:
        raise HTTPException(status_code=403, detail="Endpoint nội bộ chỉ cho phép truy cập từ loopback")


def _numeric_product_id(product_id: str) -> int:
    text = (product_id or "").strip()
    if not text.isdigit():
        raise HTTPException(status_code=400, detail="product_id phải là số nguyên")
    return int(normalize_point_id(text))


@internal_router.post("/internal/v1/index/upsert")
async def api_index_upsert(
    request: Request,
    product_id: str = Form(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    brand_slug: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Upsert 1 point sản phẩm (idempotent theo product_id)."""
    _require_loopback(request)
    point_id = _numeric_product_id(product_id)

    has_file = file is not None and bool(file.filename)
    if has_file:
        file_ext = os.path.splitext(file.filename)[1].lower()
        if file_ext not in VALID_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Định dạng ảnh không được hỗ trợ")
    elif not any((v or "").strip() for v in (name, description, brand_slug, model)):
        raise HTTPException(status_code=400, detail="Không có dữ liệu để lập chỉ mục: thiếu cả ảnh và văn bản")

    point_srv = PointService()
    tmp_path = os.path.join(UPLOAD_DIR, f"upsert-{uuid.uuid4()}{os.path.splitext(file.filename)[1].lower() if has_file else ''}")
    try:
        image_arg = None
        if has_file:
            with open(tmp_path, "wb+") as out:
                shutil.copyfileobj(file.file, out)
            image_arg = tmp_path
        try:
            point_srv.upsert_product_point(
                product_id=point_id,
                name=name,
                description=description,
                brand_slug=brand_slug,
                model=model,
                image_path=image_arg,
            )
        except InvalidInputError as e:
            raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {"success": True, "status_code": 200, "message": "Upserted", "data": {"pointId": str(point_id)}, "errors": None}


@internal_router.delete("/internal/v1/index/products/{product_id}")
async def api_index_delete(request: Request, product_id: str):
    """Xóa 1 point sản phẩm khỏi index (idempotent)."""
    _require_loopback(request)
    point_id = _numeric_product_id(product_id)
    PointService(auto_create_collection=False).delete_product_point(point_id)
    return {"success": True, "status_code": 200, "message": "Deleted", "data": {"pointId": str(point_id)}, "errors": None}


@internal_router.get("/internal/v1/health")
async def api_internal_health(request: Request):
    """Kiểm tra index: tên collection và số point hiện có."""
    _require_loopback(request)
    info = PointService(auto_create_collection=False).repo.get_collection_info()
    return {
        "success": True,
        "status_code": 200,
        "message": "AI index OK",
        "data": {"collection": settings.qdrant.collection_name, "points": info.get("points_count")},
        "errors": None,
    }
