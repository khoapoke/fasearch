from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from ml.retrieval.search import SearchEngine


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
