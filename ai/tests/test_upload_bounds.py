"""A3: bounded uploads, MIME agreement, traversal safety, typed errors."""

import io

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _png_bytes(color=(255, 0, 0)):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buf, format="PNG")
    return buf.getvalue()


def test_health_always_answers(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_legacy_text_empty_rejected(client):
    r = client.post("/api/search/text", json={"query": "   ", "limit": 5})
    assert r.status_code == 422
    assert r.json()["code"] == "INVALID_REQUEST"


def test_legacy_text_too_long_rejected(client):
    r = client.post("/api/search/text", json={"query": "x" * 1025, "limit": 5})
    assert r.status_code == 400
    assert r.json()["code"] == "TEXT_TOO_LONG"


def test_json_envelope_cap(client):
    big = "y" * (17 * 1024)
    r = client.post("/api/search/text", json={"query": big, "limit": 5})
    assert r.status_code in (400, 413)


def test_image_unsupported_media_type(client):
    r = client.post("/api/search/image", data={"limit": "5"},
                    files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 415
    assert r.json()["code"] == "UNSUPPORTED_MEDIA_TYPE"


def test_image_mime_mismatch_rejected(client):
    png = _png_bytes()
    r = client.post("/api/search/image", data={"limit": "5"},
                    files={"file": ("a.jpg", png, "image/jpeg")})
    assert r.status_code == 422
    assert r.json()["code"] == "INVALID_REQUEST"


def test_image_traversal_filename_never_echoed(client):
    png = _png_bytes()
    evil = "../../../tmp/pwned.png"
    r = client.post("/api/search/image", data={"limit": "5"},
                    files={"file": (evil, png, "image/png")})
    body = r.text
    assert evil not in body and "pwned" not in body
    assert "tmp" not in body and "uploads" not in body


def test_no_uploads_mount_exposes_query_files(client):
    r = client.get("/uploads/anything.png")
    assert r.status_code == 404


def test_catalogue_photo_unknown_identity_404(client):
    r = client.get("/catalogue/images/no-such-product-v1")
    assert r.status_code == 404
    assert r.json()["code"] == "NOT_FOUND"


def test_catalogue_photo_path_traversal_blocked(client):
    r = client.get("/catalogue/images/..%2F..%2Fetc%2Fpasswd")
    assert r.status_code in (404, 422)


def test_internal_stale_publication_rejected(client):
    body = {"schema_version": "1.0.0", "trace_id": "t-001",
            "catalog_snapshot_id": "stale-catalog",
            "model_version": "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b",
            "index_version": "qdrant-dot-exact-shadow-v1",
            "query_text": "áo thun đỏ", "k": 5}
    r = client.post("/internal/v1/search/text", json=body)
    assert r.status_code == 409
    assert r.json()["code"] == "STALE_PUBLICATION"


def test_internal_unknown_multipart_part_rejected(client):
    png = _png_bytes()
    files = {"image": ("a.png", png, "image/png")}
    data = {"schema_version": "1.0.0", "trace_id": "t-002",
            "catalog_snapshot_id": "catalog-20260908-pilot-v1",
            "model_version": "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b",
            "index_version": "qdrant-dot-exact-shadow-v1",
            "modification_text": "màu đỏ", "k": "5", "evil_part": "x"}
    r = client.post("/internal/v1/search/composed", files=files, data=data)
    assert r.status_code == 422


def test_internal_duplicate_part_rejected(client):
    import httpx
    png = _png_bytes()
    boundary = "BOUNDARY12345"
    payload = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"trace_id\"\r\n\r\nt-003\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"trace_id\"\r\n\r\nt-003\r\n"
        f"--{boundary}--\r\n").encode()
    req = httpx.Request(
        "POST", "http://testserver/internal/v1/search/composed",
        headers={"content-type": f"multipart/form-data; boundary={boundary}"},
        content=payload)
    # Send the actual duplicate multipart bytes, not httpx's list data codec.
    r = client.post("/internal/v1/search/composed", content=payload,
                    headers={"content-type": f"multipart/form-data; boundary={boundary}"})
    assert r.status_code == 422


def test_search_no_store_header(client):
    r = client.post("/api/search/text", json={"query": "   ", "limit": 5})
    assert r.headers.get("Cache-Control") == "no-store"


def test_exception_never_leaks_internals(client):
    r = client.post("/api/search/text", json={"query": "áo thun", "limit": 9999})
    assert r.status_code == 422
    assert "Traceback" not in r.text and ".py" not in r.text
