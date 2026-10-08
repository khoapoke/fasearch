"""Typed HTTP schemas with privacy-safe identities.

Intentional privacy correction (documented, breaking vs the teammate draft):
``image_path`` no longer carries a server-local absolute filesystem path. It
is a relative opaque catalogue-image URL
(``/catalogue/images/<product_version_id>``) that only resolves for known
publication identities. The legacy key name is kept so existing prototype
consumers keep parsing; the value semantics changed and this is logged in
COMPATIBILITY.md. User-upload filenames are never echoed or served.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict, StrictInt


class SearchResultItem(BaseModel):
    id: str
    score: float
    image_path: str = Field(
        description="Relative catalogue-image URL, never a server filesystem path.")
    file_name: str = Field(
        description="Catalogue file identity from the frozen publication.")
    catalog: Optional[str] = None
    product_id: Optional[str] = None
    product_version_id: Optional[str] = None


class SearchTextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Parse-level bound stays generous; the 1024-char semantic cap plus
    # token-budget check in validation.py produce typed 400 rejections.
    query: str = Field(min_length=1, max_length=4096)
    limit: StrictInt = Field(default=5, ge=1, le=100)


class SearchResponse(BaseModel):
    results: List[SearchResultItem]


class HealthResponse(BaseModel):
    """Canonical internal liveness shape (contracts/internal-ai.openapi.json)."""
    model_config = ConfigDict(extra="forbid")
    status: str = "UP"
    module: str = "fasearch-ai"
    version: str = Field(min_length=1)


class InternalSearchItem(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    product_id: str
    product_version_id: str
    similarity_score: float
    rank: int


class InternalSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    schema_version: str = "1.0.0"
    mode: str
    publication: dict[str, str]
    trace_id: str
    results: List[InternalSearchItem]
    ai_latency_ms: float
    artifact_scope: Optional[str] = None
    requested_k: Optional[int] = None
    returned_k: Optional[int] = None
    provenance: Optional[dict] = None


class ErrorBody(BaseModel):
    code: str
    message: str
    trace_id: Optional[str] = None


if __name__ == "__main__":
    pass
