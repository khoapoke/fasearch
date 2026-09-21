from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PublicationRef(StrictModel):
    catalog_snapshot_id: str = Field(min_length=1)
    model_version: str = Field(min_length=1)
    index_version: str = Field(min_length=1)


class ImageSearchResult(StrictModel):
    product_id: str = Field(min_length=1)
    product_version_id: str = Field(min_length=1)
    rank: int = Field(ge=1)
    similarity_score: float


class ImageSearchResponse(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    trace_id: str = Field(min_length=1)
    mode: Literal["IMAGE"] = "IMAGE"
    publication: PublicationRef
    results: list[ImageSearchResult]
    ai_latency_ms: float = Field(ge=0)
    artifact_scope: Literal["PILOT_ONLY"] = "PILOT_ONLY"


class ErrorResponse(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    trace_id: str | None = None
    code: Literal[
        "INVALID_REQUEST",
        "INVALID_IMAGE",
        "IMAGE_TOO_LARGE",
        "PUBLICATION_MISMATCH",
        "MODEL_UNAVAILABLE",
        "INDEX_UNAVAILABLE",
        "INTERNAL_ERROR",
    ]
    message: str = Field(min_length=1)


class HealthResponse(StrictModel):
    status: Literal["UP"] = "UP"
    module: Literal["fasearch-ai"] = "fasearch-ai"
    version: str = Field(min_length=1)
