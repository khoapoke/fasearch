"""HTTP surfaces: safe legacy prototype routes + additive internal probes.

Legacy ``POST /api/search/text|image`` stay functional for local prototype
use. They are NOT a replacement public AI backend (see COMPATIBILITY.md).

Safety properties:
- Uploads stream bounded (10 MiB image / 11 MiB envelope / 16 KiB JSON);
  declared-vs-decoded MIME must agree (JPEG/PNG/WEBP).
- Server-generated temp names (uuid hex); same-name uploads cannot collide;
  cleanup in ``finally`` after the worker completes; no public mount.
- Typed errors only; never the raw exception, user query, or private path.
- Heavy torch/client work runs in ``to_thread`` under a bounded semaphore.
"""

from __future__ import annotations

import asyncio
import io
import json
import os
import tempfile
import uuid
import time
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import APIRouter, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from starlette.exceptions import HTTPException
from starlette.formparsers import MultiPartException, MultiPartParser
from python_multipart.exceptions import MultipartParseError

from src.api.validation import (
    ApiError,
    check_publication,
    check_token_budget,
    error_response,
    shadow_publication,
    single_form_field,
    validate_k,
    validate_raw_text,
    validate_trace,
)
from src.core.config import load_shadow_config, task_repo_root
from src.db.schemas import (
    InternalSearchItem,
    InternalSearchResponse,
    SearchResponse,
    SearchTextRequest,
)
from src.services import search_service

router = APIRouter()


@asynccontextmanager
async def _validated_form(request):
    # Own the parser so even native parse errors/cancellation close partial files.
    # Starlette0.41.3 only closes these on MultiPartException, not ParseError.
    parser = MultiPartParser(request.headers, request.stream(), max_files=2, max_fields=16)
    form = None
    try:
        form = await parser.parse()
        yield form
    except ApiError:
        raise
    except (HTTPException, MultiPartException, MultipartParseError):
        raise ApiError(422, "INVALID_REQUEST", "Multipart không hợp lệ.")
    finally:
        try:
            if form is not None:
                await form.close()
        finally:
            # Pinned Starlette parser owns every allocated spool in this list.
            for file in parser._files_to_close_on_error:
                file.close()

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ("JPEG", ".jpg"),
    "image/png": ("PNG", ".png"),
    "image/webp": ("WEBP", ".webp"),
}

COMPOSED_ALLOWED_FIELDS = frozenset({
    "schema_version", "image", "modification_text", "trace_id",
    "catalog_snapshot_id", "model_version", "index_version",
    "fusion_version", "k", "exclude_product_id",
})
IMAGE_ALLOWED_FIELDS = frozenset({
    "image", "trace_id", "catalog_snapshot_id", "model_version",
    "index_version", "k",
})


async def _require_ready(request: Request, trace_id: Optional[str]) -> None:
    """Fail closed (503) while model/collection readiness is unvalidated."""
    from src.core.ai_model import check_model_ready
    from src.core.qdrant_client import check_qdrant_ready
    state = {"model": await asyncio.to_thread(check_model_ready),
             "qdrant": await asyncio.to_thread(check_qdrant_ready)}
    request.app.state.readiness = state
    model = state.get("model", {})
    qdrant = state.get("qdrant", {})
    if not (model.get("ok") and qdrant.get("ok")):
        raise ApiError(503, "MODEL_UNAVAILABLE" if not model.get("ok") else "INDEX_UNAVAILABLE",
                       "Dịch vụ chưa sẵn sàng; thử lại sau.", trace_id)


def _semaphore(request: Request) -> asyncio.Semaphore:
    sem = getattr(request.app.state, "inference_sem", None)
    if sem is None:
        sem = asyncio.Semaphore(4)
        request.app.state.inference_sem = sem
    return sem


async def _run_worker(request, fn, *args, cleanup=None):
    """A shielded owner retains the slot/files through native completion."""
    workers = getattr(request.app.state, "workers", None)
    if workers is None:
        workers = request.app.state.workers = set()
    async def run():
        try:
            async with _semaphore(request):
                return await asyncio.to_thread(fn, *args)
        finally:
            if cleanup is not None:
                cleanup()
    worker = asyncio.create_task(run())
    workers.add(worker)
    def completed(task):
        workers.discard(task)
        if not task.cancelled():
            task.exception()  # Retrieve errors after disconnected requests.
    worker.add_done_callback(completed)
    timeout = load_shadow_config()["api"].get("request_timeout_s", 60)
    try:
        return await asyncio.wait_for(asyncio.shield(worker), timeout)
    except asyncio.TimeoutError:
        raise ApiError(503, "MODEL_UNAVAILABLE", "Thời gian xử lý vượt giới hạn.")


def _checked_text_search(text, k, exclude=None):
    check_token_budget(text, None)
    return search_service.search_by_text(text, k, exclude)


def _checked_composed_search(raw, text, k, exclude=None):
    check_token_budget(text, None)
    return search_service.search_composed(raw, text, k, exclude)


def _task_temp_dir() -> str:
    try:
        base = load_shadow_config().get("runtime_tmp")
    except Exception:
        base = None
    tmp = base or os.path.join(tempfile.gettempdir(), "ai-draft-hardening-uploads")
    os.makedirs(tmp, exist_ok=True)
    return tmp


def _decode_image_bytes(raw: bytes, declared: Optional[str],
                        trace_id: Optional[str], canonical: bool = False) -> bytes:
    """canonical=True speaks the canonical failure contract (internal routes):
    empty/undecodable -> 400 INVALID_IMAGE, decoded-MIME mismatch -> 415
    INVALID_IMAGE. Legacy prototype routes keep documented 422 vocabulary.
    The stronger declared-vs-decoded agreement rejection is preserved."""
    try:
        limits = load_shadow_config()["limits"]
        if len(raw) > int(limits["image_max_bytes"]):
            raise ApiError(413, "PAYLOAD_TOO_LARGE",
                           "Ảnh vượt quá 10 MiB.", trace_id)
    except ApiError:
        raise
    except Exception:
        pass
    if declared not in ALLOWED_IMAGE_TYPES:
        raise ApiError(415, "UNSUPPORTED_MEDIA_TYPE",
                       "Định dạng ảnh không được hỗ trợ.", trace_id)
    if canonical and len(raw) == 0:
        raise ApiError(400, "INVALID_IMAGE", "Ảnh rỗng.", trace_id)
    want_format, _suffix = ALLOWED_IMAGE_TYPES[declared]
    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            got_format = img.format
    except Exception:
        if canonical:
            raise ApiError(400, "INVALID_IMAGE",
                           "Không thể giải mã ảnh.", trace_id)
        raise ApiError(422, "INVALID_REQUEST",
                       "Không thể giải mã ảnh.", trace_id)
    if got_format != want_format:
        if canonical:
            raise ApiError(415, "INVALID_IMAGE",
                           "Khai báo MIME không khớp nội dung ảnh.", trace_id)
        raise ApiError(422, "INVALID_REQUEST",
                       "Khai báo MIME không khớp nội dung ảnh.", trace_id)
    return raw


async def _read_upload_bounded(upload: UploadFile, trace_id: Optional[str]) -> bytes:
    try:
        cap = int(load_shadow_config()["limits"]["envelope_max_bytes"])
    except Exception:
        cap = 11 * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    while True:
        piece = await upload.read(1024 * 1024)
        if not piece:
            break
        total += len(piece)
        if total > cap:
            raise ApiError(413, "PAYLOAD_TOO_LARGE",
                           "Envelope multipart vượt quá giới hạn.", trace_id)
        chunks.append(piece)
    return b"".join(chunks)


@router.post("/search/text", response_model=SearchResponse)
async def api_search_text(request: Request, body: SearchTextRequest):
    trace_id: Optional[str] = None
    try:
        normalized = validate_raw_text(body.query, trace_id)
    except ApiError as exc:
        return error_response(exc.status_code, exc.code, str(exc), exc.trace_id)
    try:
        await _require_ready(request, trace_id)
        results = await _run_worker(request, _checked_text_search, normalized, body.limit)
        resp = {"results": results}
        return SearchResponse(**resp)
    except ApiError as exc:
        return error_response(exc.status_code, exc.code, str(exc), exc.trace_id)
    except Exception:
        return error_response(500, "INTERNAL_ERROR",
                              "Tìm kiếm văn bản thất bại.", trace_id)


async def api_search_image(request: Request,
                           file: UploadFile,
                           limit=5):
    trace_id: Optional[str] = None
    try:
        limit = validate_k(limit, 5, trace_id)
    except ApiError as exc:
        return error_response(exc.status_code, exc.code, str(exc), exc.trace_id)
    declared = (file.content_type or "").lower()
    temp_path: Optional[str] = None
    try:
        raw = await _read_upload_bounded(file, trace_id)
        raw = await _run_worker(request, _decode_image_bytes, raw, declared, trace_id)
        await _require_ready(request, trace_id)
        # Server-generated temp name: user filename is never used or echoed.
        temp_path = os.path.join(_task_temp_dir(), f"q-{uuid.uuid4().hex}.img")
        with open(temp_path, "wb") as fh:
            fh.write(raw)
        owned_path = temp_path
        temp_path = None
        def cleanup():
            if os.path.exists(owned_path):
                os.remove(owned_path)
        results = await _run_worker(request, search_service.search_by_image,
                                    owned_path, limit, cleanup=cleanup)
        return SearchResponse(**{"results": results})
    except ApiError as exc:
        return error_response(exc.status_code, exc.code, str(exc), exc.trace_id)
    except Exception:
        return error_response(500, "INTERNAL_ERROR",
                              "Tìm kiếm ảnh thất bại.", trace_id)
    finally:
        # Cleanup after the actual worker completes (success/failure/cancel).
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
        try:
            await file.close()
        except Exception:
            pass


@router.post("/search/image", response_model=SearchResponse)
async def legacy_image(request: Request):
    async with _validated_form(request) as form:
        if set(form) - {"file", "limit"}:
            raise ApiError(422, "INVALID_REQUEST", "Phần multipart không được hỗ trợ.")
        upload = single_form_field(form, "file", None)
        if not hasattr(upload, "read"):
            raise ApiError(422, "INVALID_REQUEST", "Thiếu phần ảnh.")
        limit = single_form_field(form, "limit", None, required=False)
        return await api_search_image(request, upload, 5 if limit is None else limit)


def _publication_payload(body: dict, trace_id: Optional[str]) -> dict:
    check_publication(body, trace_id)
    return shadow_publication()


@router.post("/internal/v1/search/text", response_model=InternalSearchResponse)
async def internal_search_text(request: Request):
    started = time.perf_counter()
    trace_id: Optional[str] = None
    try:
        try:
            cap = int(load_shadow_config()["limits"]["json_max_bytes"])
        except Exception:
            cap = 16 * 1024
        raw_body = await request.body()
        if len(raw_body) > cap:
            raise ApiError(413, "INVALID_REQUEST",
                           "JSON vượt quá 16 KiB.", trace_id)
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except Exception:
            raise ApiError(422, "INVALID_REQUEST",
                           "JSON không hợp lệ hoặc không phải UTF-8.", trace_id)
        if not isinstance(body, dict):
            raise ApiError(422, "INVALID_REQUEST",
                           "Thân JSON phải là object.", trace_id)
        if body.get("schema_version") != "1.0.0":
            raise ApiError(422, "INVALID_REQUEST",
                           "schema_version không được hỗ trợ.", trace_id)
        trace_id = validate_trace(body.get("trace_id"))
        if set(body) - {"schema_version", "trace_id", "catalog_snapshot_id",
                        "model_version", "index_version", "query_text", "k"}:
            raise ApiError(422, "INVALID_REQUEST", "Trường JSON không được hỗ trợ.", trace_id)
        if request.headers.get("x-trace-id", trace_id) != trace_id:
            raise ApiError(422, "INVALID_REQUEST", "Trace header không khớp.", trace_id)
        pub = _publication_payload(body, trace_id)
        if "k" in body and type(body["k"]) is not int:
            raise ApiError(422, "INVALID_REQUEST", "k phải là integer.", trace_id)
        k = validate_k(body.get("k", 10), 10, trace_id)
        normalized = validate_raw_text(body.get("query_text"), trace_id)
        exclude = body.get("exclude_product_id")
        if exclude is not None and (not isinstance(exclude, str) or len(exclude) > 128):
            raise ApiError(422, "INVALID_REQUEST",
                           "exclude_product_id không hợp lệ.", trace_id)
        await _require_ready(request, trace_id)
        rows = await _run_worker(request, _checked_text_search, normalized, k)
        return _internal_response(pub, trace_id, rows, "TEXT", k, started)
    except ApiError as exc:
        return _internal_error_response(exc, trace_id, image_route=False)
    except Exception:
        return error_response(500, "INTERNAL_ERROR",
                              "Tìm kiếm nội bộ thất bại.", trace_id)


def _internal_error_response(exc: ApiError, trace_id: Optional[str],
                             image_route: bool):
    """Canonical ErrorResponse vocabulary for internal routes only.

    Legacy prototype routes keep their documented vocabulary (COMPATIBILITY);
    shared helpers still raise prototype codes, translated here at the
    internal boundary. Statuses are unchanged (Boot maps by status).
    """
    code = exc.code
    if code == "UNSUPPORTED_MEDIA_TYPE":
        code = "INVALID_IMAGE"
    elif code == "PAYLOAD_TOO_LARGE":
        code = "IMAGE_TOO_LARGE" if image_route else "INVALID_REQUEST"
    return error_response(exc.status_code, code, str(exc),
                           exc.trace_id or trace_id)


def _internal_response(pub: dict, trace_id: str, rows: list, mode: str, k: int, started: float, exclude=None):
    from src.core.publication import MODEL_CONFIG_HASH
    from fastapi.responses import JSONResponse
    items = [InternalSearchItem(
        product_id=str(r.get("product_id") or ""),
        product_version_id=str(r.get("product_version_id") or ""),
        similarity_score=float(r["score"]),
        rank=i + 1,
    ) for i, r in enumerate(rows)]
    body = {"schema_version": "1.0.0", "mode": mode, "trace_id": trace_id,
            "publication": {key: pub[key] for key in ("catalog_snapshot_id", "model_version", "index_version")},
            "results": [item.model_dump() for item in items],
            "ai_latency_ms": (time.perf_counter() - started) * 1000}
    if mode == "IMAGE":
        body["artifact_scope"] = "PILOT_ONLY"
    else:
        body.update(requested_k=k, returned_k=len(items), provenance={
            "artifact_scope": "PILOT_ONLY", "model_config_hash": MODEL_CONFIG_HASH,
            "text_normalization_version": "nfc-whitespace-v1",
            "text_overflow_policy": "REJECT_MODEL_LIMIT"})
        if mode == "COMPOSED":
            body["provenance"].update(self_match_policy="EXCLUDE_ANCHOR_PRODUCT" if exclude else "NONE",
                fusion={"fusion_version": pub["fusion_version"], "strategy": "WEIGHTED_SUM",
                        "image_weight": .5, "text_weight": .5, "component_normalization": "L2",
                        "output_normalization": "L2", "similarity_metric": "NORMALIZED_INNER_PRODUCT"})
    serving_mode = "web" if "web" in str(pub.get("index_version", "")) else "shadow"
    return JSONResponse(body, headers={"Cache-Control": "no-store", "X-FaSearch-Serving-Mode": serving_mode,
                                      "X-FaSearch-Source-Index": pub["source_index_version"]})


async def _parse_image_form(request: Request, allowed: frozenset,
                            need_text_field: Optional[str],
                            default_k: int):
    trace_id: Optional[str] = None
    async with _validated_form(request) as form:
        names = set(form.keys())
        unknown = names - allowed
        trace_id = validate_trace(single_form_field(form, "trace_id", None))
        if unknown:
            raise ApiError(422, "INVALID_REQUEST",
                           "Phần multipart không được hỗ trợ.", trace_id)
        header_trace = request.headers.get("x-trace-id")
        if header_trace is not None and header_trace != trace_id:
            raise ApiError(422, "INVALID_REQUEST",
                           "Trace header không khớp trace form.", trace_id)
        if need_text_field:
            if single_form_field(form, "schema_version", trace_id) != "1.0.0":
                raise ApiError(422, "INVALID_REQUEST", "schema_version không được hỗ trợ.", trace_id)
            if single_form_field(form, "fusion_version", trace_id) != shadow_publication()["fusion_version"]:
                raise ApiError(409, "FUSION_VERSION_MISMATCH", "Fusion version không khớp.", trace_id)
        triple = {}
        for name in ("catalog_snapshot_id", "model_version", "index_version"):
            value = single_form_field(form, name, trace_id)
            if not isinstance(value, str) or not value:
                raise ApiError(422, "INVALID_REQUEST",
                               f"Thiếu {name}.", trace_id)
            triple[name] = value
        check_publication(triple, trace_id)
        raw_k = single_form_field(form, "k", trace_id, required=False)
        k = validate_k(default_k if raw_k is None else raw_k, default_k, trace_id)
        exclude = single_form_field(form, "exclude_product_id", trace_id,
                                    required=False)
        if exclude is not None and (not isinstance(exclude, str) or len(exclude) > 128):
            raise ApiError(422, "INVALID_REQUEST",
                           "exclude_product_id không hợp lệ.", trace_id)
        if exclude is not None:
            from src.core.publication import expected_inventory
            if exclude not in {p["product_id"] for p in expected_inventory().values()}:
                raise ApiError(422, "INVALID_REQUEST", "Anchor không thuộc publication.", trace_id)
        text_value: Optional[str] = None
        if need_text_field:
            raw_text = single_form_field(form, need_text_field, trace_id)
            text_value = validate_raw_text(raw_text, trace_id)
        image_value = single_form_field(form, "image", trace_id)
        if not hasattr(image_value, "read"):
            raise ApiError(422, "INVALID_REQUEST", "Thiếu phần ảnh.", trace_id)
        declared = (getattr(image_value, "content_type", "") or "").lower()
        raw = await _read_upload_bounded(image_value, trace_id)
        raw = await _run_worker(request, _decode_image_bytes, raw, declared, trace_id, True)
        try:
            await image_value.close()
        except Exception:
            pass
        return trace_id, k, exclude, text_value, raw


@router.post("/internal/v1/search/image", response_model=InternalSearchResponse)
async def internal_search_image(request: Request):
    started = time.perf_counter()
    trace_id: Optional[str] = None
    try:
        trace_id, k, exclude, _t, raw = await _parse_image_form(
            request, IMAGE_ALLOWED_FIELDS, None, 10)
        pub = shadow_publication()
        await _require_ready(request, trace_id)
        rows = await _run_worker(request, search_service.search_by_image_bytes,
                                 raw, k, exclude or None)
        return _internal_response(pub, trace_id, rows, "IMAGE", k, started)
    except ApiError as exc:
        return _internal_error_response(exc, trace_id, image_route=True)
    except Exception:
        return error_response(500, "INTERNAL_ERROR",
                              "Tìm kiếm ảnh nội bộ thất bại.", trace_id)


@router.post("/internal/v1/search/composed", response_model=InternalSearchResponse)
async def internal_search_composed(request: Request):
    started = time.perf_counter()
    trace_id: Optional[str] = None
    try:
        trace_id, k, exclude, text_value, raw = await _parse_image_form(
            request, COMPOSED_ALLOWED_FIELDS, "modification_text", 10)
        pub = shadow_publication()
        await _require_ready(request, trace_id)
        rows = await _run_worker(request, _checked_composed_search,
                                 raw, text_value or "", k, exclude or None)
        return _internal_response(pub, trace_id, rows, "COMPOSED", k, started, exclude)
    except ApiError as exc:
        return _internal_error_response(exc, trace_id, image_route=True)
    except Exception:
        return error_response(500, "INTERNAL_ERROR",
                              "Tìm kiếm composed nội bộ thất bại.", trace_id)


_catalogue_index: Optional[dict] = None


def _catalogue_lookup() -> dict:
    global _catalogue_index
    if _catalogue_index is not None:
        return _catalogue_index
    index: dict = {}
    try:
        cfg = load_shadow_config()
        import json as _json
        mapping_path = os.path.join(task_repo_root(),
                                    cfg["assets"]["mapping"])
        with open(mapping_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                row = _json.loads(line)
                pvid = str(row.get("product_version_id", ""))
                if pvid:
                    index[pvid] = row
    except Exception:
        index = {}
    _catalogue_index = index
    return index


@router.get("/catalogue/images/{product_version_id}")
async def catalogue_photo(product_version_id: str):
    """Serve a catalogue photo by exact known publication identity only."""
    if len(product_version_id) > 128 or not product_version_id:
        return error_response(422, "INVALID_REQUEST",
                              "Định danh ảnh không hợp lệ.")
    lookup = _catalogue_lookup()
    row = lookup.get(product_version_id)
    if row is None:
        return error_response(404, "NOT_FOUND",
                              "Ảnh không thuộc bản phát hành đang phục vụ.")
    try:
        photo_dir = os.path.normpath(os.path.join(
            task_repo_root(), load_shadow_config()["assets"]["photo_dir"]))
    except Exception:
        return error_response(503, "UNAVAILABLE",
                              "Kho ảnh chưa được cấu hình.")
    file_name = f"{row.get('product_id', '')}.jpg"
    candidate = os.path.normpath(os.path.join(photo_dir, file_name))
    if not candidate.startswith(photo_dir + os.sep):
        return error_response(404, "NOT_FOUND",
                              "Ảnh không thuộc bản phát hành đang phục vụ.")
    if not os.path.isfile(candidate):
        return error_response(404, "NOT_FOUND",
                              "Ảnh không thuộc bản phát hành đang phục vụ.")
    return FileResponse(candidate, media_type="image/jpeg")


if __name__ == "__main__":
    pass
