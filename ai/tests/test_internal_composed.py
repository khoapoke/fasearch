"""Composed-search adapter tests: strict HTTP contract, real fixture parity,
and loaded-model token-budget guards (Q3)."""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml
from fastapi.testclient import TestClient
from PIL import Image

from fasearch_ai.main import app
from fasearch_ai.composed_request import MAX_IMAGE_BYTES
from fasearch_ai.module import (
    EFFECTIVE_FUSION_VERSION,
    ComposedSearchModule,
    ComposedSearchOutcome,
    FusionVersionMismatchError,
    ModuleUnavailableError,
    PublicationIdentity,
    PublicationMismatchError,
    RankedProduct,
    RetrievalComposedSearchModule,
    TokenBudgetExceededError,
)
from fasearch_ai.runtime import provide_composed_search_module
from ml.retrieval.catalog import prepare_catalog
from ml.retrieval.fixtures import create_dataset_a_fixture
from ml.retrieval.pipeline import build_index, create_encoder, encode_catalog, load_engine


PUBLICATION = PublicationIdentity(
    catalog_snapshot_id="catalog-fixture-v1",
    model_version="fixture-model-v1",
    index_version="fixture-index-v1",
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class FakeComposedModule:
    fusion_version = EFFECTIVE_FUSION_VERSION

    @property
    def publication(self) -> PublicationIdentity:
        return PUBLICATION

    def token_budget(self) -> int | None:
        return None

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
            raise FusionVersionMismatchError(expected_fusion_version, EFFECTIVE_FUSION_VERSION)
        assert image_path.exists()
        assert raw_text == "đổi sang màu xanh"
        assert k == 2
        assert exclude_product_id is None
        return ComposedSearchOutcome(
            publication=self.publication,
            results=(
                RankedProduct("p1", "p1-v1", 1, 0.91),
                RankedProduct("p2", "p2-v1", 2, 0.85),
            ),
            ai_latency_ms=3.0,
            fusion_version=EFFECTIVE_FUSION_VERSION,
            model_config_hash="cfghash123456",
            text_overflow_policy="RAW_CAP_ONLY",
            self_match_policy="NONE",
        )


def _png_bytes(size: int = 12) -> bytes:
    output = BytesIO()
    Image.new("RGB", (size, size), color=(20, 60, 200)).save(output, format="PNG")
    return output.getvalue()


def _jpeg_bytes(size: int = 12) -> bytes:
    output = BytesIO()
    Image.new("RGB", (size, size), color=(200, 40, 40)).save(output, format="JPEG")
    return output.getvalue()


def _media_for(path: Path) -> tuple[str, bytes, str]:
    """Truthful multipart tuple for a fixture image: filename/bytes/MIME."""
    with Image.open(path) as decoded:
        decoded_format = decoded.format
    if decoded_format == "JPEG":
        return (f"{path.stem}.jpg", path.read_bytes(), "image/jpeg")
    if decoded_format == "WEBP":
        return (f"{path.stem}.webp", path.read_bytes(), "image/webp")
    return (f"{path.stem}.png", path.read_bytes(), "image/png")


def _form(**overrides: str) -> dict[str, str]:
    values = {
        "schema_version": "1.0.0",
        "modification_text": "đổi sang màu xanh",
        "trace_id": "trace-1",
        "catalog_snapshot_id": PUBLICATION.catalog_snapshot_id,
        "model_version": PUBLICATION.model_version,
        "index_version": PUBLICATION.index_version,
        "fusion_version": EFFECTIVE_FUSION_VERSION,
        "k": "2",
    }
    values.update(overrides)
    return values


def _client() -> TestClient:
    app.dependency_overrides[provide_composed_search_module] = FakeComposedModule
    return TestClient(app)


def _post(client: TestClient, data: dict, image: bytes = None, ctype: str = "image/png"):
    payload = image if image is not None else _png_bytes()
    return client.post(
        "/internal/v1/search/composed",
        data=data,
        files={"image": ("query.png", payload, ctype)},
        headers={"x-trace-id": "trace-1"},
    )


def test_composed_returns_ranked_contract_with_provenance() -> None:
    with _client() as client:
        response = _post(client, _form())
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "COMPOSED"
    assert payload["schema_version"] == "1.0.0"
    assert payload["requested_k"] == 2
    assert payload["returned_k"] == 2
    assert [item["product_id"] for item in payload["results"]] == ["p1", "p2"]
    assert [item["rank"] for item in payload["results"]] == [1, 2]
    assert payload["provenance"]["fusion"]["fusion_version"] == EFFECTIVE_FUSION_VERSION
    assert payload["provenance"]["fusion"]["strategy"] == "WEIGHTED_SUM"
    assert payload["provenance"]["text_overflow_policy"] == "RAW_CAP_ONLY"
    assert payload["provenance"]["self_match_policy"] == "NONE"
    assert payload["provenance"]["artifact_scope"] == "PILOT_ONLY"
    assert "product_title" not in payload["results"][0]
    assert "image_path" not in json.dumps(payload)


def test_composed_rejects_text_over_raw_cap() -> None:
    with _client() as client:
        response = _post(client, _form(modification_text="a" * 1025))
    assert response.status_code == 400
    assert response.json()["code"] == "TEXT_TOO_LONG"


def test_composed_rejects_whitespace_text() -> None:
    with _client() as client:
        response = _post(client, _form(modification_text="    "))
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST"


def test_composed_rejects_unknown_and_duplicate_parts() -> None:
    with _client() as client:
        unknown = _form()
        unknown["client_alpha"] = "0.9"
        response = _post(client, unknown)
    assert response.status_code == 422
    assert response.json()["code"] == "INVALID_REQUEST"

    with _client() as client:
        response = client.post(
            "/internal/v1/search/composed",
            data=[(key, value) for key, value in _form().items()] + [("k", "3")],
            files={"image": ("query.png", _png_bytes(), "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 422


def test_composed_rejects_trace_mismatch_and_bad_k() -> None:
    with _client() as client:
        response = client.post(
            "/internal/v1/search/composed",
            data=_form(trace_id="trace-other"),
            files={"image": ("query.png", _png_bytes(), "image/png")},
            headers={"x-trace-id": "trace-1"},
        )
    assert response.status_code == 422

    for bad_k in ("0", "101", "2.5", "many"):
        with _client() as client:
            response = _post(client, _form(k=bad_k))
        assert response.status_code == 422, bad_k


def test_composed_rejects_image_problems_with_typed_codes() -> None:
    with _client() as client:
        response = _post(client, _form(), image=b"not-an-image")
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_IMAGE"

    with _client() as client:
        response = _post(client, _form(), image=_png_bytes(), ctype="image/gif")
    assert response.status_code == 415

    with _client() as client:
        response = _post(
            client, _form(), image=_png_bytes() + b"\x00" * (10 * 1024 * 1024 + 1)
        )
    assert response.status_code == 413
    assert response.json()["code"] == "IMAGE_TOO_LARGE"


def test_composed_rejects_declared_mime_format_mismatch() -> None:
    png = _png_bytes()
    jpeg = _jpeg_bytes()
    with _client() as client:
        response = _post(client, _form(), image=png, ctype="image/jpeg")
    assert response.status_code == 415
    assert response.json()["code"] == "INVALID_IMAGE"

    with _client() as client:
        response = _post(client, _form(), image=jpeg, ctype="image/png")
    assert response.status_code == 415
    assert response.json()["code"] == "INVALID_IMAGE"

    with _client() as client:
        response = _post(client, _form(), image=jpeg, ctype="image/jpeg")
    assert response.status_code == 200


def test_composed_image_size_gate_boundary() -> None:
    with _client() as client:
        response = _post(client, _form(), image=b"\x00" * MAX_IMAGE_BYTES)
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_IMAGE"

    with _client() as client:
        response = _post(client, _form(), image=b"\x00" * (MAX_IMAGE_BYTES + 1))
    assert response.status_code == 413
    assert response.json()["code"] == "IMAGE_TOO_LARGE"


def test_composed_rejects_fusion_and_publication_mismatch() -> None:
    with _client() as client:
        response = _post(client, _form(fusion_version="other-fusion-v9"))
    assert response.status_code == 409
    assert response.json()["code"] == "FUSION_VERSION_MISMATCH"

    with _client() as client:
        response = _post(client, _form(index_version="wrong-index"))
    assert response.status_code == 409
    assert response.json()["code"] == "PUBLICATION_MISMATCH"


def _stub_engine(tokenizer=None, search=None):
    encoder = SimpleNamespace(
        processor=SimpleNamespace(tokenizer=tokenizer) if tokenizer else None,
        manifest={"model_version": "stub-v1", "config_hash": "stubhash"},
    )
    return SimpleNamespace(
        encoder=encoder,
        index_manifest={"index_version": "stub-idx-v1"},
        search_composed=search,
    )


class _StubTokenizer:
    model_max_length = 5

    def __call__(self, text: str, truncation: bool):
        assert truncation is False
        return {"input_ids": [101] + [1000] * len(text.split()) + [102]}


def test_stub_tokenizer_rejects_before_core_runs() -> None:
    def forbidden(*args: object, **kwargs: object):
        raise AssertionError("core must not run on token overflow")

    module = RetrievalComposedSearchModule(_stub_engine(_StubTokenizer(), forbidden), "snap")
    assert module.token_budget() == 5
    with pytest.raises(TokenBudgetExceededError):
        module.search_composed(
            Path("/tmp/query.png"),
            "một hai ba bốn",
            2,
            module.publication,
            EFFECTIVE_FUSION_VERSION,
        )


def test_fixture_encoder_reports_no_tokenizer_budget() -> None:
    module = RetrievalComposedSearchModule(_stub_engine(None, None), "snap")
    assert module.token_budget() is None
    assert module.count_model_tokens("bất kỳ văn bản nào") is None


def test_module_rejects_non_finite_core_scores() -> None:
    def nan_core(**kwargs: object):
        return {
            "query": {"fusion": {"image_weight": 0.5, "text_weight": 0.5, "normalization": "L2"}},
            "results": [
                {
                    "product_id": "p1",
                    "product_version_id": "p1-v1",
                    "rank": 1,
                    "similarity_score": float("nan"),
                }
            ],
            "latency_ms": 1.0,
        }

    module = RetrievalComposedSearchModule(_stub_engine(None, nan_core), "snap")
    with pytest.raises(ModuleUnavailableError):
        module.search_composed(
            Path("/tmp/query.png"), "váy linen", 2, module.publication, EFFECTIVE_FUSION_VERSION
        )


@pytest.fixture(scope="module")
def fixture_bundle(tmp_path_factory: pytest.TempPathFactory):
    # One frozen bundle per module: a second FAISS build in the same
    # process is wasted work and destabilizes the native index threads.
    tmp_path = tmp_path_factory.mktemp("composed-fixture")
    fixture_dir = tmp_path / "fixture"
    create_dataset_a_fixture(fixture_dir)
    catalog = prepare_catalog(
        fixture_dir,
        tmp_path / "processed",
        pilot_size=30,
        seed=42,
        snapshot_version="catalog-composed-fixture-v1",
    )
    config = yaml.safe_load(
        (REPOSITORY_ROOT / "ai/configs/baseline.v1.yaml").read_text(encoding="utf-8")
    )
    encoder = create_encoder("fixture", config)
    embeddings_dir = tmp_path / "embeddings"
    index_dir = tmp_path / "index"
    encode_catalog(catalog.catalog_path, embeddings_dir, encoder)
    build_index(catalog.catalog_path, embeddings_dir, index_dir, "fixture-composed-index-v1")
    engine = load_engine(config, "fixture", index_dir)
    module = RetrievalComposedSearchModule(engine, "catalog-composed-fixture-v1")
    return engine, module


def test_http_adapter_matches_direct_core_on_frozen_fixture(fixture_bundle) -> None:
    engine, module = fixture_bundle
    app.dependency_overrides[provide_composed_search_module] = lambda: module

    assert len({row["product_id"] for row in engine.index.mapping}) > 5
    query_path = Path(engine.index.mapping[0]["image_path"])
    raw_text = "đổi sang màu xanh"
    direct = engine.search_composed(image_path=query_path, raw_text=raw_text, k=5)

    with TestClient(app) as client:
        response = client.post(
            "/internal/v1/search/composed",
            data={
                "schema_version": "1.0.0",
                "modification_text": raw_text,
                "trace_id": "trace-parity",
                "catalog_snapshot_id": module.publication.catalog_snapshot_id,
                "model_version": module.publication.model_version,
                "index_version": module.publication.index_version,
                "fusion_version": EFFECTIVE_FUSION_VERSION,
                "k": "5",
            },
            files={"image": _media_for(query_path)},
            headers={"x-trace-id": "trace-parity"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["requested_k"] == 5
    assert payload["returned_k"] == len(direct["results"])
    assert payload["provenance"]["text_overflow_policy"] == "RAW_CAP_ONLY"
    for http_item, core_item in zip(payload["results"], direct["results"]):
        assert (http_item["product_id"], http_item["product_version_id"], http_item["rank"]) == (
            core_item["product_id"],
            core_item["product_version_id"],
            core_item["rank"],
        )
        assert abs(http_item["similarity_score"] - core_item["similarity_score"]) <= 1e-5


def test_http_exclusion_removes_anchor_and_keeps_ranks(fixture_bundle) -> None:
    engine, module = fixture_bundle
    app.dependency_overrides[provide_composed_search_module] = lambda: module

    query_path = Path(engine.index.mapping[0]["image_path"])
    anchor_product = str(engine.index.mapping[0]["product_id"])
    direct = engine.search_composed(
        image_path=query_path, raw_text="váy linen", k=4, exclude_product_id=anchor_product
    )
    assert anchor_product not in [item["product_id"] for item in direct["results"]]

    with TestClient(app) as client:
        response = client.post(
            "/internal/v1/search/composed",
            data={
                "schema_version": "1.0.0",
                "modification_text": "váy linen",
                "trace_id": "trace-exclude",
                "catalog_snapshot_id": module.publication.catalog_snapshot_id,
                "model_version": module.publication.model_version,
                "index_version": module.publication.index_version,
                "fusion_version": EFFECTIVE_FUSION_VERSION,
                "k": "4",
                "exclude_product_id": anchor_product,
            },
            files={"image": _media_for(query_path)},
            headers={"x-trace-id": "trace-exclude"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provenance"]["self_match_policy"] == "EXCLUDE_ANCHOR_PRODUCT"
    assert [item["rank"] for item in payload["results"]] == list(
        range(1, len(payload["results"]) + 1)
    )
    assert anchor_product not in [item["product_id"] for item in payload["results"]]
    assert [
        (item["product_id"], item["product_version_id"]) for item in payload["results"]
    ] == [(item["product_id"], item["product_version_id"]) for item in direct["results"]]
