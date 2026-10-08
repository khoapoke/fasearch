"""R2-S2: canonical internal health + error vocabulary regression.

RED-first: internal routes must speak the canonical ErrorResponse enum
(PUBLICATION_MISMATCH / INVALID_IMAGE / IMAGE_TOO_LARGE / INVALID_REQUEST /
MODEL_UNAVAILABLE / INDEX_UNAVAILABLE), expose GET /internal/v1/health as
HealthResponse, and include schema_version in every error body. Legacy
prototype routes intentionally keep their documented vocabulary.
"""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from src.main import app

PUB = {
    "catalog_snapshot_id": "catalog-20260908-pilot-v1",
    "model_version": "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b",
}
CANONICAL = {"INVALID_REQUEST", "INVALID_IMAGE", "IMAGE_TOO_LARGE",
             "TEXT_TOO_LONG", "PUBLICATION_MISMATCH", "FUSION_VERSION_MISMATCH",
             "MODEL_UNAVAILABLE", "INDEX_UNAVAILABLE", "INTERNAL_ERROR"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _png_bytes():
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), (255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def _text_body(**over):
    body = {"schema_version": "1.0.0", "trace_id": "t-s2",
            "query_text": "áo thun", "k": 2}
    body.update(PUB)
    body.update(over)
    return body


def test_internal_health_is_canonical(client):
    r = client.get("/internal/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "UP" and body["module"] == "fasearch-ai"
    assert isinstance(body.get("version"), str) and len(body["version"]) >= 1


def test_error_bodies_carry_schema_version(client):
    r = client.post("/internal/v1/search/text", json=_text_body(k="nope"))
    assert r.status_code == 422
    body = r.json()
    assert body["schema_version"] == "1.0.0"
    assert body["code"] in CANONICAL


def test_stale_publication_is_canonical_mismatch(client):
    r = client.post("/internal/v1/search/text",
                    json=_text_body(catalog_snapshot_id="stale-catalog"))
    assert r.status_code == 409
    assert r.json()["code"] == "PUBLICATION_MISMATCH"


def test_json_oversize_is_invalid_request(client):
    r = client.post("/internal/v1/search/text", content=b"x" * 17000,
                    headers={"Content-Type": "application/json",
                             "X-Trace-Id": "t-s2"})
    assert r.status_code == 413
    assert r.json()["code"] == "INVALID_REQUEST"


def _image_form(**over):
    data = {"trace_id": "t-s2", "k": "2"}
    data.update({k: PUB[k] for k in
                 ("catalog_snapshot_id", "model_version")})
    data["index_version"] = "qdrant-dot-exact-shadow-v1"  # default test config
    data.update(over)
    return data


def test_image_unsupported_mime_is_invalid_image(client):
    r = client.post("/internal/v1/search/image",
                    files={"image": ("a.txt", b"hello", "text/plain")},
                    data=_image_form())
    assert r.status_code == 415
    assert r.json()["code"] == "INVALID_IMAGE"


def test_image_oversize_is_image_too_large(client):
    big = _png_bytes() + b"\x00" * (11 * 1024 * 1024)
    r = client.post("/internal/v1/search/image",
                    files={"image": ("a.png", big, "image/png")},
                    data=_image_form())
    assert r.status_code == 413
    assert r.json()["code"] == "IMAGE_TOO_LARGE"


def test_undecodable_image_is_invalid_image(client):
    r = client.post("/internal/v1/search/image",
                    files={"image": ("a.png", b"not-an-image" * 64, "image/png")},
                    data=_image_form())
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_IMAGE"
    assert r.json()["schema_version"] == "1.0.0"


def test_empty_image_is_invalid_image(client):
    r = client.post("/internal/v1/search/image",
                    files={"image": ("empty.png", b"", "image/png")},
                    data=_image_form())
    assert r.status_code == 400
    assert r.json()["code"] == "INVALID_IMAGE"


def test_decoded_mime_mismatch_is_invalid_image(client):
    # Stronger rejection preserved (canonical accepts this); canonical code.
    r = client.post("/internal/v1/search/image",
                    files={"image": ("a.jpg", _png_bytes(), "image/jpeg")},
                    data=_image_form())
    assert r.status_code == 415
    assert r.json()["code"] == "INVALID_IMAGE"


def test_no_legacy_vocabulary_on_internal_routes(client):
    bodies = [
        ("/internal/v1/search/text", _text_body(
            catalog_snapshot_id="stale-catalog")),
    ]
    for path, body in bodies:
        r = client.post(path, json=body)
        assert r.json()["code"] not in {"STALE_PUBLICATION",
                                        "UNSUPPORTED_MEDIA_TYPE",
                                        "PAYLOAD_TOO_LARGE", "UNAVAILABLE",
                                        "NOT_FOUND"}
