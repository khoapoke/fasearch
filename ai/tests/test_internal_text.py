"""Internal TEXT contract + boundary checks (fixture-backed, no downloads)."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from fasearch_ai.main import app
from fasearch_ai.module import PublicationIdentity, PublicationMismatchError, RankedProduct
from fasearch_ai.runtime import provide_text_search_module

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PUB = PublicationIdentity(
    catalog_snapshot_id="catalog-fixture-v1",
    model_version="fixture-model-v1",
    index_version="fixture-index-v1",
)


class FakeTextModule:
    @property
    def publication(self):
        return PUB

    def token_budget(self):
        return None

    def search_text(self, raw_text, k, expected_publication):
        from fasearch_ai.module import TextSearchOutcome

        if expected_publication != PUB:
            raise PublicationMismatchError(expected_publication, PUB)
        hits = (
            RankedProduct("p1", "p1-v1", 1, 0.91),
            RankedProduct("p2", "p2-v1", 2, 0.85),
        )[:k]
        return TextSearchOutcome(
            publication=PUB,
            results=hits,
            ai_latency_ms=2.5,
            model_config_hash="hash-fixture",
            text_overflow_policy="RAW_CAP_ONLY",
        )


def _client() -> TestClient:
    app.dependency_overrides[provide_text_search_module] = FakeTextModule
    return TestClient(app)


def _body(**overrides):
    payload = {
        "schema_version": "1.0.0",
        "query_text": "váy đỏ",
        "k": 2,
        "trace_id": "trace-1",
        "catalog_snapshot_id": PUB.catalog_snapshot_id,
        "model_version": PUB.model_version,
        "index_version": PUB.index_version,
    }
    payload.update(overrides)
    return payload


def test_text_success_contract_no_echo():
    with _client() as client:
        r = client.post(
            "/internal/v1/search/text", json=_body(), headers={"x-trace-id": "trace-1"}
        )
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["mode"] == "TEXT"
    assert p["requested_k"] == 2 and p["returned_k"] == 2
    assert [h["rank"] for h in p["results"]] == [1, 2]
    assert "query_text" not in p and "normalized_text" not in str(p)
    assert p["provenance"]["artifact_scope"] == "PILOT_ONLY"
    assert r.headers.get("cache-control") == "no-store"


def test_text_rejects_unknown_field_overlong_blank_and_bad_k():
    with _client() as client:
        assert (
            client.post(
                "/internal/v1/search/text",
                json=_body(unknown_field=1),
                headers={"x-trace-id": "trace-1"},
            ).status_code
            == 422
        )
        assert (
            client.post(
                "/internal/v1/search/text",
                json=_body(query_text="x" * 1025),
                headers={"x-trace-id": "trace-1"},
            ).json()["code"]
            == "TEXT_TOO_LONG"
        )
        assert (
            client.post(
                "/internal/v1/search/text",
                json=_body(query_text="   "),
                headers={"x-trace-id": "trace-1"},
            ).status_code
            == 400
        )
        assert (
            client.post(
                "/internal/v1/search/text",
                json=_body(k=0),
                headers={"x-trace-id": "trace-1"},
            ).status_code
            == 422
        )


def test_text_body_cap_and_trace_mismatch():
    with _client() as client:
        big = _body(query_text="x" * (17 * 1024))
        r = client.post(
            "/internal/v1/search/text", json=big, headers={"x-trace-id": "trace-1"}
        )
        assert r.status_code == 413
        r2 = client.post(
            "/internal/v1/search/text", json=_body(), headers={"x-trace-id": "other"}
        )
        assert r2.status_code == 422


def test_text_publication_mismatch():
    with _client() as client:
        r = client.post(
            "/internal/v1/search/text",
            json=_body(index_version="wrong"),
            headers={"x-trace-id": "trace-1"},
        )
    assert r.status_code == 409
    assert r.json()["code"] == "PUBLICATION_MISMATCH"
