"""Test hợp đồng /internal/v1/* mà Backend (FashionAiPublishClient) gọi khi publish/unpublish sản phẩm."""

import pytest
from fastapi.testclient import TestClient

from conftest import make_image_bytes


def _upsert(client, **form):
    files = form.pop("files", None)
    return client.post("/internal/v1/index/upsert", data={k: str(v) for k, v in form.items()}, files=files)


def test_upsert_text_only_creates_numeric_point(client, mem_repo):
    res = _upsert(client, product_id=806, name="Áo sơ mi", description="cotton", brand_slug="nowsaigon", model="SRC-1")
    assert res.status_code == 200
    body = res.json()
    assert body == {"success": True, "status_code": 200, "message": "Upserted", "data": {"pointId": "806"}, "errors": None}
    rec = mem_repo.get_by_id(806)
    assert rec.id == 806
    assert rec.payload["product_id"] == "806"
    assert rec.payload["catalog"] == "brand_catalog"
    assert rec.payload["metadata"] == {"brand_slug": "nowsaigon", "model": "SRC-1", "name": "Áo sơ mi"}
    assert mem_repo.count_points() == 1


def test_upsert_is_idempotent_and_updates_payload(client, mem_repo):
    _upsert(client, product_id=806, name="A")
    _upsert(client, product_id=806, name="B")
    assert mem_repo.count_points() == 1
    assert mem_repo.get_by_id(806).payload["metadata"]["name"] == "B"


def test_upsert_with_image_uses_image_vector(client, mem_repo):
    files = {"file": ("p.png", make_image_bytes((10, 200, 10)), "image/png")}
    res = _upsert(client, product_id=900, name="x", files=files)
    assert res.status_code == 200
    img_vec = mem_repo.client.retrieve(mem_repo.collection_name, ids=[900], with_vectors=True)[0].vector
    _upsert(client, product_id=901, name="x")  # text vector for the same name
    txt_vec = mem_repo.client.retrieve(mem_repo.collection_name, ids=[901], with_vectors=True)[0].vector
    assert img_vec != txt_vec


def test_upsert_search_roundtrip_returns_product_id(client, mem_repo):
    _upsert(client, product_id=812, name="red dress", brand_slug="rubies")
    res = client.post("/api/search/text", json={"query": "red dress", "limit": 5})
    assert res.json()["data"]["results"][0]["product_id"] == "812"


@pytest.mark.parametrize("pid", ["abc", "-1", "12.5", " "])
def test_upsert_rejects_non_numeric_product_id(client, mem_repo, pid):
    assert _upsert(client, product_id=pid, name="x").status_code == 400


def test_upsert_requires_image_or_text(client, mem_repo):
    res = _upsert(client, product_id=5)
    assert res.status_code == 400
    assert mem_repo.count_points() == 0


def test_upsert_rejects_bad_extension_and_corrupt_image(client, mem_repo):
    assert _upsert(client, product_id=5, files={"file": ("a.gif", b"GIF89a", "image/gif")}).status_code == 400
    assert _upsert(client, product_id=5, files={"file": ("a.jpg", b"junk", "image/jpeg")}).status_code == 400
    assert mem_repo.count_points() == 0


def test_delete_removes_point_and_is_idempotent(client, mem_repo):
    _upsert(client, product_id=806, name="x")
    res = client.delete("/internal/v1/index/products/806")
    assert res.status_code == 200 and res.json()["data"] == {"pointId": "806"}
    assert mem_repo.get_by_id(806) is None
    assert client.delete("/internal/v1/index/products/806").status_code == 200
    assert client.delete("/internal/v1/index/products/abc").status_code == 400


def test_health_reports_collection_and_points(client, mem_repo):
    _upsert(client, product_id=1, name="x")
    res = client.get("/internal/v1/health")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["points"] == 1 and data["collection"]


def test_internal_endpoints_are_loopback_only(fake_processor, mem_repo):
    from src.main import app

    remote = TestClient(app, client=("10.1.2.3", 5000))
    assert remote.get("/internal/v1/health").status_code == 403
    assert remote.delete("/internal/v1/index/products/1").status_code == 403
    assert remote.post("/internal/v1/index/upsert", data={"product_id": "1", "name": "x"}).status_code == 403
    assert mem_repo.count_points() == 0
