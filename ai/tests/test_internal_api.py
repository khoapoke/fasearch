from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path

import yaml
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from fasearch_ai.main import app
from fasearch_ai.module import (
    ImageSearchOutcome,
    IndexUnavailableError,
    PublicationIdentity,
    PublicationMismatchError,
    RankedProduct,
    RetrievalImageSearchModule,
)
from fasearch_ai.runtime import get_image_search_module, provide_image_search_module
from ml.retrieval.catalog import prepare_catalog
from ml.retrieval.fixtures import create_dataset_a_fixture
from ml.retrieval.pipeline import build_index, create_encoder, encode_catalog, load_engine


PUBLICATION = PublicationIdentity(
    catalog_snapshot_id="catalog-fixture-v1",
    model_version="fixture-model-v1",
    index_version="fixture-index-v1",
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class FakeImageSearchModule:
    @property
    def publication(self) -> PublicationIdentity:
        return PUBLICATION

    def search_image(
        self,
        image_path: Path,
        k: int,
        expected_publication: PublicationIdentity,
    ) -> ImageSearchOutcome:
        if expected_publication != self.publication:
            raise PublicationMismatchError(expected_publication, self.publication)
        assert image_path.exists()
        return ImageSearchOutcome(
            publication=self.publication,
            results=(
                RankedProduct("p1", "p1-v1", 1, 0.91),
                RankedProduct("p2", "p2-v1", 2, 0.85),
            )[:k],
            ai_latency_ms=2.5,
        )


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (12, 12), color=(200, 20, 20)).save(output, format="PNG")
    return output.getvalue()


def _form(**overrides: str) -> dict[str, str]:
    values = {
        "trace_id": "trace-1",
        "catalog_snapshot_id": PUBLICATION.catalog_snapshot_id,
        "model_version": PUBLICATION.model_version,
        "index_version": PUBLICATION.index_version,
        "k": "2",
    }
    values.update(overrides)
    return values


def _client() -> TestClient:
    app.dependency_overrides[provide_image_search_module] = FakeImageSearchModule
    return TestClient(app)


def test_health_does_not_require_model_loading() -> None:
    with _client() as client:
        response = client.get("/internal/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"


def test_checked_in_openapi_matches_the_adapter() -> None:
    contract = json.loads(
        (REPOSITORY_ROOT / "contracts/internal-ai.openapi.json").read_text(encoding="utf-8")
    )
    assert contract == app.openapi()


def test_image_search_returns_ranked_identity_contract() -> None:
    with _client() as client:
        response = client.post(
            "/internal/v1/search/image",
            data=_form(),
            files={"image": ("query.png", _png_bytes(), "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "IMAGE"
    assert payload["publication"] == {
        "catalog_snapshot_id": "catalog-fixture-v1",
        "model_version": "fixture-model-v1",
        "index_version": "fixture-index-v1",
    }
    assert [item["product_id"] for item in payload["results"]] == ["p1", "p2"]
    assert "product_title" not in payload["results"][0]


def test_image_search_rejects_publication_mismatch() -> None:
    with _client() as client:
        response = client.post(
            "/internal/v1/search/image",
            data=_form(index_version="wrong-index"),
            files={"image": ("query.png", _png_bytes(), "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 409
    assert response.json()["code"] == "PUBLICATION_MISMATCH"


def test_image_search_rejects_undecodable_image() -> None:
    with _client() as client:
        response = client.post(
            "/internal/v1/search/image",
            data=_form(),
            files={"image": ("query.png", b"not-an-image", "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_IMAGE"


def test_image_search_rejects_unsupported_content_type() -> None:
    with _client() as client:
        response = client.post(
            "/internal/v1/search/image",
            data=_form(),
            files={"image": ("query.gif", _png_bytes(), "image/gif")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 415
    assert response.json()["code"] == "INVALID_IMAGE"


def test_image_search_returns_standard_error_when_index_is_unavailable() -> None:
    def unavailable() -> FakeImageSearchModule:
        raise IndexUnavailableError("Configured index publication is unavailable")

    app.dependency_overrides[provide_image_search_module] = unavailable
    with TestClient(app) as client:
        response = client.post(
            "/internal/v1/search/image",
            data=_form(),
            files={"image": ("query.png", _png_bytes(), "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 503
    assert response.json()["code"] == "INDEX_UNAVAILABLE"


def test_runtime_classifies_a_missing_index_as_unavailable(
    monkeypatch,
    tmp_path: Path,
) -> None:
    get_image_search_module.cache_clear()
    monkeypatch.setenv("FASEARCH_INDEX_DIR", str(tmp_path / "missing-index"))
    try:
        with pytest.raises(IndexUnavailableError):
            get_image_search_module()
    finally:
        get_image_search_module.cache_clear()


def test_http_adapter_runs_the_actual_fixture_retrieval_module(tmp_path: Path) -> None:
    fixture_dir = tmp_path / "fixture"
    create_dataset_a_fixture(fixture_dir)
    catalog = prepare_catalog(
        fixture_dir,
        tmp_path / "processed",
        pilot_size=30,
        seed=42,
        snapshot_version="catalog-http-fixture-v1",
    )
    config = yaml.safe_load(
        (REPOSITORY_ROOT / "ai/configs/baseline.v1.yaml").read_text(encoding="utf-8")
    )
    encoder = create_encoder("fixture", config)
    embeddings_dir = tmp_path / "embeddings"
    index_dir = tmp_path / "index"
    encode_catalog(catalog.catalog_path, embeddings_dir, encoder)
    build_index(
        catalog.catalog_path,
        embeddings_dir,
        index_dir,
        "fixture-http-index-v1",
    )
    engine = load_engine(config, "fixture", index_dir)
    module = RetrievalImageSearchModule(engine, "catalog-http-fixture-v1")
    app.dependency_overrides[provide_image_search_module] = lambda: module

    query_path = Path(engine.index.mapping[0]["image_path"])
    with TestClient(app) as client:
        response = client.post(
            "/internal/v1/search/image",
            data={
                "trace_id": "trace-integration",
                "catalog_snapshot_id": module.publication.catalog_snapshot_id,
                "model_version": module.publication.model_version,
                "index_version": module.publication.index_version,
                "k": "3",
            },
            files={"image": ("query.png", query_path.read_bytes(), "image/png")},
            headers={"x-trace-id": "trace-integration"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["results"]) == 3
    assert [item["rank"] for item in payload["results"]] == [1, 2, 3]
    assert payload["publication"]["index_version"] == "fixture-http-index-v1"
