from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from ml.retrieval.search import SearchEngine, normalized_model_view


@dataclass(frozen=True)
class PublicationIdentity:
    catalog_snapshot_id: str
    model_version: str
    index_version: str


@dataclass(frozen=True)
class RankedProduct:
    product_id: str
    product_version_id: str
    rank: int
    similarity_score: float


@dataclass(frozen=True)
class ImageSearchOutcome:
    publication: PublicationIdentity
    results: tuple[RankedProduct, ...]
    ai_latency_ms: float


class PublicationMismatchError(ValueError):
    def __init__(
        self,
        expected: PublicationIdentity,
        actual: PublicationIdentity,
    ) -> None:
        super().__init__("Requested publication does not match the loaded AI publication")
        self.expected = expected
        self.actual = actual


class TokenBudgetExceededError(ValueError):
    """Raw-valid text that overflows the loaded model token budget (Q3)."""


class ModuleUnavailableError(RuntimeError):
    code = "INTERNAL_ERROR"


class ModelUnavailableError(ModuleUnavailableError):
    code = "MODEL_UNAVAILABLE"


class IndexUnavailableError(ModuleUnavailableError):
    code = "INDEX_UNAVAILABLE"


class ImageSearchModule(Protocol):
    @property
    def publication(self) -> PublicationIdentity: ...

    def search_image(
        self,
        image_path: Path,
        k: int,
        expected_publication: PublicationIdentity,
    ) -> ImageSearchOutcome: ...


@dataclass(frozen=True)
class ComposedSearchOutcome:
    publication: PublicationIdentity
    results: tuple[RankedProduct, ...]
    ai_latency_ms: float
    fusion_version: str
    model_config_hash: str
    text_overflow_policy: str
    self_match_policy: str


EFFECTIVE_FUSION_VERSION = "equal-weight-l2-v1"
EXPECTED_CORE_FUSION = {"image_weight": 0.5, "text_weight": 0.5, "normalization": "L2"}


class ComposedSearchModule(Protocol):
    @property
    def publication(self) -> PublicationIdentity: ...

    @property
    def fusion_version(self) -> str: ...

    def token_budget(self) -> int | None:
        """Actual loaded-model token budget, or None when the encoder
        exposes no tokenizer (fixture reports RAW_CAP_ONLY)."""
        ...

    def search_composed(
        self,
        image_path: Path,
        raw_text: str,
        k: int,
        expected_publication: PublicationIdentity,
        expected_fusion_version: str,
        exclude_product_id: str | None = None,
    ) -> ComposedSearchOutcome: ...


class RetrievalImageSearchModule:
    """Adapter exposing only ranked identities across the Spring Boot-AI seam."""

    def __init__(self, engine: SearchEngine, catalog_snapshot_id: str) -> None:
        self._engine = engine
        self._publication = PublicationIdentity(
            catalog_snapshot_id=catalog_snapshot_id,
            model_version=str(engine.encoder.manifest["model_version"]),
            index_version=str(engine.index_manifest["index_version"]),
        )

    @property
    def publication(self) -> PublicationIdentity:
        return self._publication

    def search_image(
        self,
        image_path: Path,
        k: int,
        expected_publication: PublicationIdentity,
    ) -> ImageSearchOutcome:
        if expected_publication != self.publication:
            raise PublicationMismatchError(expected_publication, self.publication)

        response = self._engine.search_image(image_path=image_path, k=k)
        results = tuple(
            RankedProduct(
                product_id=str(item["product_id"]),
                product_version_id=str(item["product_version_id"]),
                rank=int(item["rank"]),
                similarity_score=float(item["similarity_score"]),
            )
            for item in response["results"]
        )
        return ImageSearchOutcome(
            publication=self.publication,
            results=results,
            ai_latency_ms=float(response["latency_ms"]),
        )


class FusionVersionMismatchError(ValueError):
    def __init__(self, expected: str, actual: str) -> None:
        super().__init__(
            "Requested fusion version does not match the loaded AI fusion version"
        )
        self.expected = expected
        self.actual = actual


class RetrievalComposedSearchModule:
    """Thin composed adapter over the frozen retrieval core.

    Reuses the cached SearchEngine and the core equal-weight fusion; guards
    the loaded-model token budget (Q3) before encoding and reports the
    effective provenance instead of trusting caller claims.
    """

    def __init__(self, engine: SearchEngine, catalog_snapshot_id: str) -> None:
        self._engine = engine
        self._publication = PublicationIdentity(
            catalog_snapshot_id=catalog_snapshot_id,
            model_version=str(engine.encoder.manifest["model_version"]),
            index_version=str(engine.index_manifest["index_version"]),
        )

    @property
    def publication(self) -> PublicationIdentity:
        return self._publication

    @property
    def fusion_version(self) -> str:
        return EFFECTIVE_FUSION_VERSION

    def token_budget(self) -> int | None:
        tokenizer = getattr(
            getattr(self._engine.encoder, "processor", None), "tokenizer", None
        )
        budget = getattr(tokenizer, "model_max_length", None)
        if isinstance(budget, int) and budget > 0:
            return budget
        return None

    def count_model_tokens(self, model_view: str) -> int | None:
        tokenizer = getattr(
            getattr(self._engine.encoder, "processor", None), "tokenizer", None
        )
        if tokenizer is None:
            return None
        return len(tokenizer(model_view, truncation=False)["input_ids"])

    def search_composed(
        self,
        image_path: Path,
        raw_text: str,
        k: int,
        expected_publication: PublicationIdentity,
        expected_fusion_version: str,
        exclude_product_id: str | None = None,
    ) -> ComposedSearchOutcome:
        if expected_publication != self.publication:
            raise PublicationMismatchError(expected_publication, self.publication)
        if expected_fusion_version != EFFECTIVE_FUSION_VERSION:
            raise FusionVersionMismatchError(
                expected_fusion_version, EFFECTIVE_FUSION_VERSION
            )
        model_view = normalized_model_view(raw_text)
        if not model_view:
            raise ValueError("Modification text is empty after normalization")
        overflow_policy = "RAW_CAP_ONLY"
        budget = self.token_budget()
        if budget is not None:
            overflow_policy = "REJECT_MODEL_LIMIT"
            used = self.count_model_tokens(model_view)
            if used is not None and used > budget:
                raise TokenBudgetExceededError(
                    f"Modification text uses {used} model tokens, budget is {budget}"
                )
        response = self._engine.search_composed(
            image_path=image_path,
            raw_text=raw_text,
            k=k,
            exclude_product_id=exclude_product_id,
        )
        fusion = response.get("query", {}).get("fusion", {})
        if not all(
            fusion.get(key) == value for key, value in EXPECTED_CORE_FUSION.items()
        ):
            raise ModuleUnavailableError(
                "Loaded core fusion does not match the advertised equal-weight fusion"
            )
        results = tuple(
            RankedProduct(
                product_id=str(item["product_id"]),
                product_version_id=str(item["product_version_id"]),
                rank=int(item["rank"]),
                similarity_score=float(item["similarity_score"]),
            )
            for item in response["results"]
        )
        if [item.rank for item in results] != list(range(1, len(results) + 1)):
            raise ModuleUnavailableError("Core returned non-sequential ranks")
        if any(not math.isfinite(item.similarity_score) for item in results):
            raise ModuleUnavailableError("Core returned a non-finite similarity score")
        return ComposedSearchOutcome(
            publication=self.publication,
            results=results,
            ai_latency_ms=float(response["latency_ms"]),
            fusion_version=EFFECTIVE_FUSION_VERSION,
            model_config_hash=str(self._engine.encoder.manifest["config_hash"]),
            text_overflow_policy=overflow_policy,
            self_match_policy="EXCLUDE_ANCHOR_PRODUCT"
            if exclude_product_id
            else "NONE",
        )

@dataclass(frozen=True)
class TextSearchOutcome:
    publication: PublicationIdentity
    results: tuple[RankedProduct, ...]
    ai_latency_ms: float
    model_config_hash: str
    text_overflow_policy: str


class TextSearchModule(Protocol):
    @property
    def publication(self) -> PublicationIdentity: ...

    def token_budget(self) -> int | None: ...

    def search_text(
        self,
        raw_text: str,
        k: int,
        expected_publication: PublicationIdentity,
    ) -> TextSearchOutcome: ...


class RetrievalTextSearchModule:
    """Thin TEXT adapter over the frozen retrieval core.

    Reuses the cached SearchEngine.search_text and the same loaded-model
    token budget guard as composed; never changes encoder/index/CLI.
    """

    def __init__(self, engine: SearchEngine, catalog_snapshot_id: str) -> None:
        self._engine = engine
        self._publication = PublicationIdentity(
            catalog_snapshot_id=catalog_snapshot_id,
            model_version=str(engine.encoder.manifest["model_version"]),
            index_version=str(engine.index_manifest["index_version"]),
        )

    @property
    def publication(self) -> PublicationIdentity:
        return self._publication

    def token_budget(self) -> int | None:
        tokenizer = getattr(
            getattr(self._engine.encoder, "processor", None), "tokenizer", None
        )
        budget = getattr(tokenizer, "model_max_length", None)
        if isinstance(budget, int) and budget > 0:
            return budget
        return None

    def count_model_tokens(self, model_view: str) -> int | None:
        tokenizer = getattr(
            getattr(self._engine.encoder, "processor", None), "tokenizer", None
        )
        if tokenizer is None:
            return None
        return len(tokenizer(model_view, truncation=False)["input_ids"])

    def search_text(
        self,
        raw_text: str,
        k: int,
        expected_publication: PublicationIdentity,
    ) -> TextSearchOutcome:
        if expected_publication != self.publication:
            raise PublicationMismatchError(expected_publication, self.publication)
        model_view = normalized_model_view(raw_text)
        if not model_view:
            raise ValueError("Query text is empty after normalization")
        overflow_policy = "RAW_CAP_ONLY"
        budget = self.token_budget()
        if budget is not None:
            overflow_policy = "REJECT_MODEL_LIMIT"
            used = self.count_model_tokens(model_view)
            if used is not None and used > budget:
                raise TokenBudgetExceededError(
                    f"Query text uses {used} model tokens, budget is {budget}"
                )
        response = self._engine.search_text(raw_text, k=k)
        results = tuple(
            RankedProduct(
                product_id=str(item["product_id"]),
                product_version_id=str(item["product_version_id"]),
                rank=int(item["rank"]),
                similarity_score=float(item["similarity_score"]),
            )
            for item in response["results"]
        )
        if [item.rank for item in results] != list(range(1, len(results) + 1)):
            raise ModuleUnavailableError("Core returned non-sequential ranks")
        if any(not math.isfinite(item.similarity_score) for item in results):
            raise ModuleUnavailableError("Core returned a non-finite similarity score")
        return TextSearchOutcome(
            publication=self.publication,
            results=results,
            ai_latency_ms=float(response["latency_ms"]),
            model_config_hash=str(self._engine.encoder.manifest["config_hash"]),
            text_overflow_policy=overflow_policy,
        )
