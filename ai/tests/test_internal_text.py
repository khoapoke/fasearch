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


def test_text_lone_surrogate_rejected_typed_before_core():
    with _client() as client:
        raw = (
            '{"schema_version":"1.0.0","query_text":"\\ud800","k":2,'
            '"trace_id":"t-surr","catalog_snapshot_id":"catalog-fixture-v1",'
            '"model_version":"fixture-model-v1","index_version":"fixture-index-v1"}'
        )
        r = client.post(
            "/internal/v1/search/text",
            content=raw.encode("ascii"),
            headers={"content-type": "application/json", "x-trace-id": "t-surr"},
        )
    assert r.status_code == 400, r.text
    assert r.json()["code"] == "INVALID_REQUEST"
    assert r.headers.get("x-trace-id") == "t-surr"
    assert r.headers.get("cache-control") == "no-store"


def test_text_chunked_body_bounded_before_buffering():
    with _client() as client:
        big = (
            '{"schema_version":"1.0.0","query_text":"' + "z" * 17000 + '","k":3,'
            '"trace_id":"t-chunk","catalog_snapshot_id":"c","model_version":"m","index_version":"i"}'
        )
        data = big.encode()

        def chunks():
            for i in range(0, len(data), 997):
                yield data[i : i + 997]

        r = client.post(
            "/internal/v1/search/text",
            content=chunks(),
            headers={"content-type": "application/json", "x-trace-id": "t-chunk"},
        )
    assert r.status_code == 413, r.status_code
    assert r.headers.get("x-trace-id") == "t-chunk"
    assert r.headers.get("cache-control") == "no-store"
