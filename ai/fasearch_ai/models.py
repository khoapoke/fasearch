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
        "TEXT_TOO_LONG",
        "PUBLICATION_MISMATCH",
        "FUSION_VERSION_MISMATCH",
        "MODEL_UNAVAILABLE",
        "INDEX_UNAVAILABLE",
        "INTERNAL_ERROR",
    ]
    message: str = Field(min_length=1)


class ComposedFusionProvenance(StrictModel):
    fusion_version: str = Field(min_length=1)
    strategy: Literal["WEIGHTED_SUM"] = "WEIGHTED_SUM"
    image_weight: float = 0.5
    text_weight: float = 0.5
    component_normalization: Literal["L2"] = "L2"
    output_normalization: Literal["L2"] = "L2"
    similarity_metric: Literal["NORMALIZED_INNER_PRODUCT"] = "NORMALIZED_INNER_PRODUCT"


class ComposedProvenance(StrictModel):
    artifact_scope: Literal["PILOT_ONLY"] = "PILOT_ONLY"
    model_config_hash: str = Field(min_length=1)
    text_normalization_version: Literal["nfc-whitespace-v1"] = "nfc-whitespace-v1"
    text_overflow_policy: Literal["REJECT_MODEL_LIMIT", "RAW_CAP_ONLY"]
    self_match_policy: Literal["NONE", "EXCLUDE_ANCHOR_PRODUCT"]
    fusion: ComposedFusionProvenance


class ComposedSearchResult(StrictModel):
    product_id: str = Field(min_length=1)
    product_version_id: str = Field(min_length=1)
    rank: int = Field(ge=1)
    similarity_score: float


class ComposedSearchResponse(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    trace_id: str = Field(min_length=1)
    mode: Literal["COMPOSED"] = "COMPOSED"
    publication: PublicationRef
    requested_k: int = Field(ge=1, le=100)
    returned_k: int = Field(ge=0)
    provenance: ComposedProvenance
    results: list[ComposedSearchResult]
    ai_latency_ms: float = Field(ge=0)


class HealthResponse(StrictModel):
    status: Literal["UP"] = "UP"
    module: Literal["fasearch-ai"] = "fasearch-ai"
    version: str = Field(min_length=1)
class TextSearchResult(StrictModel):
    product_id: str = Field(min_length=1)
    product_version_id: str = Field(min_length=1)
    rank: int = Field(ge=1)
    similarity_score: float


class TextProvenance(StrictModel):
    artifact_scope: Literal["PILOT_ONLY"] = "PILOT_ONLY"
    model_config_hash: str = Field(min_length=1)
    text_normalization_version: Literal["nfc-whitespace-v1"] = "nfc-whitespace-v1"
    text_overflow_policy: Literal["REJECT_MODEL_LIMIT", "RAW_CAP_ONLY"]


class TextSearchResponse(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    trace_id: str = Field(min_length=1)
    mode: Literal["TEXT"] = "TEXT"
    publication: PublicationRef
    requested_k: int = Field(ge=1, le=100)
    returned_k: int = Field(ge=0)
    provenance: TextProvenance
    results: list[TextSearchResult]
    ai_latency_ms: float = Field(ge=0)


class TextSearchRequest(StrictModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    query_text: str = Field(min_length=1)
    k: int = Field(default=10, ge=1, le=100)
    trace_id: str = Field(min_length=1, max_length=128)
    catalog_snapshot_id: str = Field(min_length=1)
    model_version: str = Field(min_length=1)
    index_version: str = Field(min_length=1)
