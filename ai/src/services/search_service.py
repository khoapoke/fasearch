"""Search services: exact DOT queries over the shadow collection.

- Reuses the singleton model/client builders; no second service copy.
- Queries run with ``exact=True`` (no ANN/quantization) against 512-dim
  L2-normalized vectors with Distance.DOT.
- ``search_composed`` applies the frozen fusion (0.5 image + 0.5 text, L2
  re-normalize) matching the week-4 baseline contract.
- ``exclude_product_id`` (PRODUCT anchor exclusion) is applied as a Qdrant
  filter; the parity runner applies the same mask on the FAISS side.
- Sync functions do blocking torch/client work; the API layer moves them off
  the event loop. Never import another checkout: only this package plus
  named external assets/config.
"""

from __future__ import annotations

import io
from typing import Any, Optional

import torch
from PIL import Image
from qdrant_client.models import Filter, SearchParams

from src.core.ai_model import get_ai_model
from src.core.config import load_shadow_config
from src.core.qdrant_client import get_qdrant_client
from src.core.config import settings as legacy_settings
from src.core.publication import publication_filter, validate_records
from src.api.validation import ApiError, validate_raw_text, check_token_budget

COLLECTION_NAME = legacy_settings["qdrant"]["collection_name"]


def shadow_collection() -> str:
    try:
        return load_shadow_config()["qdrant"]["collection_name"]
    except Exception:
        return "fasearch_shadow_week4_v1"


def catalogue_image_url(product_version_id: str) -> str:
    return f"/catalogue/images/{product_version_id}"


def _format_results(hits) -> list[dict[str, Any]]:
    import math
    try:
        validate_records(hits)
        if any(not math.isfinite(float(hit.score)) for hit in hits):
            raise ValueError("Nonfinite score")
    except ValueError:
        raise ApiError(503, "UNAVAILABLE", "Publication shadow không hợp lệ.")
    formatted = []
    for hit in hits:
        payload = hit.payload or {}
        pvid = str(payload.get("product_version_id", ""))
        formatted.append({
            "id": str(hit.id),
            "score": float(hit.score),
            "image_path": catalogue_image_url(pvid) if pvid else "",
            "file_name": str(payload.get("file_name", "")),
            "catalog": payload.get("catalog"),
            "product_id": payload.get("product_id"),
            "product_version_id": payload.get("product_version_id") or None,
        })
    return formatted


def _exact_params() -> SearchParams:
    return SearchParams(exact=True)


def _exclusion_filter(exclude_product_id: Optional[str]) -> Optional[Filter]:
    return publication_filter(exclude_product_id)


def _query_exact(vector: list[float], limit: int,
                 exclude_product_id: Optional[str] = None,
                 collection: Optional[str] = None):
    client = get_qdrant_client()
    try:
        return client.query_points(
            collection_name=collection or shadow_collection(), query=vector,
            limit=limit, with_payload=True, search_params=_exact_params(),
            query_filter=_exclusion_filter(exclude_product_id),
        ).points
    except Exception:
        raise ApiError(503, "UNAVAILABLE", "Qdrant shadow chưa sẵn sàng.")


def encode_text_vector(query_text: str) -> list[float]:
    query_text = validate_raw_text(query_text, None)
    check_token_budget(query_text, None)
    device, model, processor = get_ai_model()
    text_inputs = processor(text=[query_text], return_tensors="pt",
                            padding=True).to(device)
    with torch.no_grad():
        feats = model.get_text_features(**text_inputs)
        feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
        return feats.cpu().numpy()[0].tolist()


def encode_image_vector(image_bytes: bytes) -> list[float]:
    device, model, processor = get_ai_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        feats = model.get_image_features(**image_inputs)
        feats = feats / feats.norm(p=2, dim=-1, keepdim=True)
        return feats.cpu().numpy()[0].tolist()


def fuse_vectors(image_vector: list[float], text_vector: list[float],
                 image_weight: float = 0.5,
                 text_weight: float = 0.5) -> list[float]:
    import math
    fused = [image_weight * a + text_weight * b
             for a, b in zip(image_vector, text_vector)]
    norm = math.sqrt(sum(v * v for v in fused)) or 1.0
    return [v / norm for v in fused]


def search_by_text(query_text: str, limit: int = 5,
                   exclude_product_id: Optional[str] = None):
    query_vector = encode_text_vector(query_text)
    return _format_results(_query_exact(query_vector, limit, exclude_product_id))


def search_by_image(image_path: str, limit: int = 5,
                    exclude_product_id: Optional[str] = None):
    with open(image_path, "rb") as fh:
        raw = fh.read()
    return search_by_image_bytes(raw, limit, exclude_product_id)


def search_by_image_bytes(image_bytes: bytes, limit: int = 5,
                          exclude_product_id: Optional[str] = None):
    query_vector = encode_image_vector(image_bytes)
    return _format_results(_query_exact(query_vector, limit, exclude_product_id))


def search_composed(image_bytes: bytes, modification_text: str, limit: int = 10,
                    exclude_product_id: Optional[str] = None):
    query_vector = fuse_vectors(encode_image_vector(image_bytes),
                                encode_text_vector(modification_text))
    return _format_results(_query_exact(query_vector, limit, exclude_product_id))
