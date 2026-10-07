"""Shared HTTP validation: typed errors, trace/publication rules, text policy.

Never reflects raw exceptions, user queries, or private paths. All rejections
carry a stable machine-readable ``code``.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

from fastapi import Request
from fastapi.responses import JSONResponse

from src.core.config import load_shadow_config

TRACE_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
K_PATTERN = re.compile(r"^[0-9]+$")


class ApiError(ValueError):
    def __init__(self, status_code: int, code: str, message: str,
                 trace_id: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.trace_id = trace_id


def error_response(status_code: int, code: str, message: str,
                   trace_id: Optional[str] = None) -> JSONResponse:
    if not isinstance(trace_id, str) or not TRACE_PATTERN.fullmatch(trace_id):
        trace_id = None
    return JSONResponse(status_code=status_code, content={
        "code": code, "message": message, "trace_id": trace_id},
        headers={"Cache-Control": "no-store"})


def validate_trace(trace_id: Any) -> str:
    if not isinstance(trace_id, str) or not TRACE_PATTERN.fullmatch(trace_id):
        raise ApiError(422, "INVALID_REQUEST", "trace_id không hợp lệ.")
    return trace_id


def shadow_publication() -> dict[str, str]:
    cfg = load_shadow_config()["publication"]
    return {
        "catalog_snapshot_id": cfg["catalog_snapshot_id"],
        "model_version": cfg["model_version"],
        "index_version": cfg.get("serving_index_version") or cfg["shadow_index_version"],
        "fusion_version": cfg["fusion_version"],
        "source_index_version": cfg["source_index_version"],
    }


def check_publication(body: dict[str, Any], trace_id: Optional[str]) -> None:
    """Fail closed (409) on stale/mismatched publication identity."""
    pub = shadow_publication()
    for field in ("catalog_snapshot_id", "model_version", "index_version"):
        want = pub[field]
        got = body.get(field)
        if not isinstance(got, str) or not got:
            raise ApiError(422, "INVALID_REQUEST",
                           f"Thiếu {field}.", trace_id)
        if got != want:
            raise ApiError(409, "STALE_PUBLICATION",
                           f"{field} không khớp bản phát hành shadow đang phục vụ.",
                           trace_id)


def validate_raw_text(raw: Any, trace_id: Optional[str]) -> str:
    if not isinstance(raw, str):
        raise ApiError(422, "INVALID_REQUEST", "Truy vấn văn bản bị thiếu.", trace_id)
    if len(raw) > 1024:
        raise ApiError(400, "TEXT_TOO_LONG",
                       "Truy vấn vượt quá 1024 ký tự.", trace_id)
    if any(0xD800 <= ord(c) <= 0xDFFF for c in raw):
        raise ApiError(400, "INVALID_REQUEST",
                       "Truy vấn chứa ký tự thay thế không hợp lệ.", trace_id)
    normalized = " ".join(unicodedata.normalize("NFC", raw).split())
    if not normalized.strip():
        raise ApiError(422, "INVALID_REQUEST",
                       "Truy vấn rỗng sau chuẩn hóa.", trace_id)
    return normalized


def check_token_budget(normalized_text: str, trace_id: Optional[str]) -> None:
    """Reject loaded-token overflow (incl. special tokens) before encoding."""
    try:
        from src.core.ai_model import get_ai_model
        _, model, processor = get_ai_model()
        budget = model.config.text_config.max_position_embeddings
        if type(budget) is not int or budget < 1:
            raise ValueError("invalid loaded context budget")
        token_ids = processor.tokenizer(
            normalized_text, add_special_tokens=True, truncation=False)["input_ids"]
        if len(token_ids) > budget:
            raise ApiError(400, "TEXT_TOO_LONG",
                           "Truy vấn vượt quá cửa sổ token của mô hình.", trace_id)
    except ApiError:
        raise
    except Exception:
        raise ApiError(503, "UNAVAILABLE", "Bộ kiểm tra token chưa sẵn sàng.", trace_id)


def validate_k(raw: Any, default: int, trace_id: Optional[str]) -> int:
    if raw is None:
        return default
    text = str(raw)
    if len(text) > 3 or not K_PATTERN.fullmatch(text):
        raise ApiError(422, "INVALID_REQUEST", "k không hợp lệ.", trace_id)
    k = int(text)
    if k < 1 or k > 100:
        raise ApiError(422, "INVALID_REQUEST", "k phải trong khoảng 1..100.", trace_id)
    return k


def single_form_field(form: Any, name: str, trace_id: Optional[str],
                      required: bool = True) -> Optional[Any]:
    items = form.getlist(name) if hasattr(form, "getlist") else []
    if not items:
        if required:
            raise ApiError(422, "INVALID_REQUEST", f"Thiếu phần '{name}'.", trace_id)
        return None
    if len(items) != 1:
        raise ApiError(422, "INVALID_REQUEST",
                       f"Phần '{name}' bị trùng lặp.", trace_id)
    return items[0]


async def read_bounded_upload(request: Request, declared_type: Optional[str],
                              trace_id: Optional[str]) -> bytes:
    """Stream the request body with an 11 MiB envelope cap (legacy image)."""
    try:
        from src.core.config import load_shadow_config as _load
        cap = int(_load()["limits"]["envelope_max_bytes"])
    except Exception:
        cap = 11 * 1024 * 1024
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > cap:
            raise ApiError(413, "PAYLOAD_TOO_LARGE",
                           "Envelope multipart vượt quá giới hạn.", trace_id)
        chunks.append(chunk)
    return b"".join(chunks)
