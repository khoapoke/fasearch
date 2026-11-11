"""Test hợp đồng /api/search/* (BE phụ thuộc: product_id, metadata, limit 1-24, lỗi 400 thay vì 500)."""

import pytest

from conftest import make_image_bytes


def _post_text(client, **body):
    return client.post("/api/search/text", json=body)


def _post_image(client, filename="a.png", data=None, **form):
    data = make_image_bytes() if data is None else data
    return client.post(
        "/api/search/image",
        files={"file": (filename, data, "image/png")},
        data={k: str(v) for k, v in form.items()},
    )


def _post_multi(client, filename="a.png", data=None, **form):
    data = make_image_bytes() if data is None else data
    return client.post(
        "/api/search/multimodal",
        files={"file": (filename, data, "image/png")},
        data={k: str(v) for k, v in form.items()},
    )


# ---- 1. product_id + metadata
def test_text_results_include_product_id_and_metadata(client, seeded):
    res = _post_text(client, query="áo sơ mi", limit=5)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True and body["errors"] is None
    items = {i["id"]: i for i in body["data"]["results"]}
    assert body["data"]["total"] == 3
    # Point id số -> id "806", product_id là chuỗi, metadata có brand_slug/model/name
    assert items["806"]["product_id"] == "806"
    assert items["806"]["metadata"]["brand_slug"] == "nowsaigon"
    assert items["806"]["metadata"]["model"] == "SRC-1"
    assert items["806"]["catalog"] == "brand_catalog"
    # Point dataset (UUID) không có product_id -> null, metadata rỗng (không lỗi)
    uuid_item = items["b7363b77-af4c-5e58-8d43-1d5a9f9e8a51"]
    assert uuid_item["product_id"] is None and uuid_item["metadata"] in ({}, None)
    assert set(uuid_item) == {"id", "score", "image_path", "file_name", "catalog", "product_id", "metadata"}


def test_image_and_multimodal_include_product_id(client, seeded):
    for res in (_post_image(client, limit=5), _post_multi(client, limit=5, query="blue", text_weight=0.5)):
        assert res.status_code == 200
        ids = {i["product_id"] for i in res.json()["data"]["results"]}
        assert {"806", "807"} <= ids


def test_numeric_payload_product_id_is_coerced_to_string(client, mem_repo, fake_processor):
    from conftest import FakeModel
    import torch

    mem_repo.create(5, FakeModel._vec(torch.tensor([1])).numpy()[0].tolist(), {"product_id": 5, "metadata": {"a": 1}})
    res = _post_text(client, query="x", limit=5)
    assert res.status_code == 200
    assert res.json()["data"]["results"][0]["product_id"] == "5"


# ---- 5. limit 1..24
@pytest.mark.parametrize("limit", [1, 5, 24])
def test_limit_accepts_1_to_24(client, seeded, limit):
    assert _post_text(client, query="x", limit=limit).status_code == 200
    assert _post_image(client, limit=limit).status_code == 200


@pytest.mark.parametrize("limit", [0, -1, 25, 100000])
def test_limit_out_of_range_is_400_with_envelope(client, seeded, limit):
    for res in (_post_text(client, query="x", limit=limit), _post_image(client, limit=limit),
                _post_multi(client, limit=limit, query="x")):
        assert res.status_code == 400
        body = res.json()
        assert body["success"] is False and body["status_code"] == 400
        assert "1 đến 24" in body["message"] and body["data"] is None


def test_default_limit_is_5(client, mem_repo, fake_processor):
    from conftest import FakeModel
    import torch

    for i in range(8):
        mem_repo.create(100 + i, FakeModel._vec(torch.tensor([i])).numpy()[0].tolist(), {"product_id": str(100 + i)})
    assert client.post("/api/search/text", json={"query": "x"}).json()["data"]["total"] == 5


# ---- 6. 400 thay vì 500
@pytest.mark.parametrize("query", ["", "   ", "\n\t"])
def test_blank_text_query_is_400(client, seeded, query):
    res = _post_text(client, query=query, limit=5)
    assert res.status_code == 400
    assert "không được để trống" in res.json()["message"]


def test_long_text_query_is_truncated_not_500(client, seeded, fake_processor):
    res = _post_text(client, query="shirt " * 3000, limit=5)
    assert res.status_code == 200
    assert fake_processor.calls[-1]["truncation"] is True  # CLIP chỉ nhận 77 token


def test_multimodal_text_is_also_truncated(client, seeded, fake_processor):
    assert _post_multi(client, limit=5, query="shirt " * 3000).status_code == 200
    assert any(c["has_text"] and c.get("truncation") is True for c in fake_processor.calls)


@pytest.mark.parametrize("data", [b"", b"not an image"])
def test_empty_or_corrupt_image_is_400(client, seeded, data):
    for res in (_post_image(client, filename="a.jpg", data=data, limit=5),
                _post_multi(client, filename="a.jpg", data=data, limit=5, query="x")):
        assert res.status_code == 400
        assert res.json()["success"] is False
        assert "không hợp lệ" in res.json()["message"]
        assert "/" not in res.json()["message"]  # không lộ đường dẫn hệ thống


def test_unsupported_extension_still_400(client, seeded):
    assert _post_image(client, filename="a.bmp", limit=5).status_code == 400


@pytest.mark.parametrize("weight", ["nan", "inf", "-0.1", "1.5"])
def test_invalid_text_weight_is_400(client, seeded, weight):
    assert _post_multi(client, limit=5, query="x", text_weight=weight).status_code == 400


def test_blank_multimodal_query_is_400(client, seeded):
    assert _post_multi(client, limit=5, query="   ").status_code == 400


def test_upload_temp_file_is_cleaned_up(client, seeded):
    import os
    from src.api.endpoints import UPLOAD_DIR

    before = set(os.listdir(UPLOAD_DIR))
    _post_image(client, filename="a.jpg", data=b"bad", limit=5)
    _post_image(client, limit=5)
    assert set(os.listdir(UPLOAD_DIR)) == before


@pytest.mark.parametrize("name", ["../../etc/x.jpg", "a/b/c.png", "áo sơ mi 1.jpg", "..\\..\\x.png"])
def test_odd_upload_filenames_do_not_break_or_escape(client, seeded, name):
    import os
    from src.api.endpoints import UPLOAD_DIR

    res = _post_image(client, filename=name, limit=5)
    assert res.status_code == 200, res.text
    assert _post_multi(client, filename=name, limit=5, query="x").status_code == 200
    assert os.listdir(UPLOAD_DIR) == [] or all(not os.path.isdir(os.path.join(UPLOAD_DIR, n)) for n in os.listdir(UPLOAD_DIR))
