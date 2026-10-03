"""Strict multipart parsing for the internal composed-search route.

The public UPLOAD/PRODUCT branch split is resolved by Spring Boot; the
internal adapter always receives resolved image bytes plus raw text. This
module still rejects unknown/duplicate parts, enforces the raw text cap and
trace rules, and never trusts caller claims about fusion or publication.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from fastapi import UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

from ml.retrieval.search import normalized_model_view


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_RAW_CODE_POINTS = 1024
MAX_ID_CODE_POINTS = 128

COMPOSED_K_PATTERN = re.compile(r"^[0-9]+$")

ALLOWED_FIELDS = frozenset(
    {
        "schema_version",
        "image",
        "modification_text",
        "trace_id",
        "catalog_snapshot_id",
        "model_version",
        "index_version",
        "fusion_version",
        "k",
        "exclude_product_id",
    }
)


class ComposedHttpError(ValueError):
    def __init__(self, status_code: int, code: str, message: str, trace_id: str | None) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.trace_id = trace_id


@dataclass(frozen=True)
class ComposedInternalRequest:
    image_file: UploadFile
    modification_text: str
    trace_id: str
    k: int
    catalog_snapshot_id: str
    model_version: str
    index_version: str
    fusion_version: str
    exclude_product_id: str | None


def _required(form: Any, name: str, trace_id: str | None) -> Any:
    if name not in form:
        raise ComposedHttpError(422, "INVALID_REQUEST", f"Missing {name}", trace_id)
    items = form.getlist(name)
    if len(items) != 1:
        raise ComposedHttpError(422, "INVALID_REQUEST", f"Duplicate '{name}' part", trace_id)
    return items[0]


def parse_composed_form(form: Any, header_trace: str | None) -> ComposedInternalRequest:
    """Validate raw multipart fields; image bytes are read by the caller."""
    names = set(form.keys())
    unknown = names - ALLOWED_FIELDS
    # Trace is resolved first so every rejection carries an identity.
    raw_trace = form.get("trace_id")
    trace_id = raw_trace if isinstance(raw_trace, str) else None
    if unknown:
        raise ComposedHttpError(
            422, "INVALID_REQUEST", f"Unknown part: {sorted(unknown)[0]}", trace_id
        )
    if not isinstance(trace_id, str) or not trace_id or len(trace_id) > 128:
        raise ComposedHttpError(422, "INVALID_REQUEST", "Invalid trace_id", trace_id)
    if header_trace is not None and header_trace != trace_id:
        raise ComposedHttpError(
            422, "INVALID_REQUEST", "Header trace does not match form trace", trace_id
        )

    schema_version = _required(form, "schema_version", trace_id)
    if schema_version != "1.0.0":
        raise ComposedHttpError(422, "INVALID_REQUEST", "Unsupported schema_version", trace_id)

    image_value = _required(form, "image", trace_id)
    # Starlette's multipart parser instantiates its own UploadFile; FastAPI
    # re-exports a subclass, so both spellings must be accepted here.
    if not isinstance(image_value, (UploadFile, StarletteUploadFile)):
        raise ComposedHttpError(422, "INVALID_REQUEST", "Missing image part", trace_id)

    raw_text = _required(form, "modification_text", trace_id)
    if not isinstance(raw_text, str):
        raise ComposedHttpError(422, "INVALID_REQUEST", "Missing modification_text", trace_id)
    if len(raw_text) > MAX_RAW_CODE_POINTS:
        raise ComposedHttpError(
            400, "TEXT_TOO_LONG", "Modification text exceeds 1024 characters", trace_id
        )
    if not normalized_model_view(raw_text):
        raise ComposedHttpError(
            400, "INVALID_REQUEST", "Modification text is empty", trace_id
        )

    triple = {}
    for name in ("catalog_snapshot_id", "model_version", "index_version", "fusion_version"):
        value = _required(form, name, trace_id)
        if not isinstance(value, str) or not value:
            raise ComposedHttpError(422, "INVALID_REQUEST", f"Missing {name}", trace_id)
        triple[name] = value

    raw_k = _required(form, "k", trace_id) if "k" in names else "10"
    if (
        not isinstance(raw_k, str)
        or not COMPOSED_K_PATTERN.match(raw_k)
    ):
        raise ComposedHttpError(422, "INVALID_REQUEST", "Invalid k", trace_id)
    k = int(raw_k)
    if k < 1 or k > 100:
        raise ComposedHttpError(422, "INVALID_REQUEST", "Invalid k", trace_id)

    exclude: str | None = None
    if "exclude_product_id" in names:
        candidate = _required(form, "exclude_product_id", trace_id)
        if not isinstance(candidate, str):
            raise ComposedHttpError(422, "INVALID_REQUEST", "Invalid exclude_product_id", trace_id)
        exclude = candidate or None
        if exclude is not None and len(exclude) > MAX_ID_CODE_POINTS:
            raise ComposedHttpError(422, "INVALID_REQUEST", "Invalid exclude_product_id", trace_id)

    return ComposedInternalRequest(
        image_file=image_value,
        modification_text=raw_text,
        trace_id=trace_id,
        k=k,
        catalog_snapshot_id=triple["catalog_snapshot_id"],
        model_version=triple["model_version"],
        index_version=triple["index_version"],
        fusion_version=triple["fusion_version"],
        exclude_product_id=exclude,
    )
