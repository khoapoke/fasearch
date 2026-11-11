"""Unit test dịch query VI -> EN cho CLIP (TASK ai-vi-translate-20261105).

Chạy từ thư mục `ai/`:  python -m pytest test/unit/test_query_translation.py -v
Không cần Docker/GPU/tải model: MarianMT không có sẵn trong môi trường test
-> phải fallback glossary/gốc, không bao giờ 500.
"""

import pytest

import src.services.query_translation as qt
from src.services.query_translation import (
    QueryTranslation,
    apply_glossary,
    detect_query_language,
    translate_for_search,
    translate_query,
)


@pytest.fixture(autouse=True)
def _clean_cache(monkeypatch):
    """Mỗi test chạy với QUERY_TRANSLATION=offline và cache sạch."""
    monkeypatch.setenv("QUERY_TRANSLATION", "offline")
    monkeypatch.delenv("GOOGLE_TRANSLATE_API_KEY", raising=False)
    qt._translate_cached.cache_clear()
    qt.reset_marianmt_for_tests()
    yield
    qt._translate_cached.cache_clear()
    qt.reset_marianmt_for_tests()


# ---- 1. Phát hiện ngôn ngữ ----

@pytest.mark.parametrize("query", [
    "áo thun đen", "Quần jean xanh", "váy dự tiệc", "GIÀY THỂ THAO TRẮNG",
    "đầm", "mũ lưỡi trai",
])
def test_diacritics_detected_as_vietnamese(query):
    assert detect_query_language(query) == "vi"


@pytest.mark.parametrize("query", [
    "ao thun", "quan jean", "giay the thao", "vay dam", "mau den", "ao khoac",
])
def test_ascii_vietnamese_tokens_detected_as_vietnamese(query):
    assert detect_query_language(query) == "vi"


@pytest.mark.parametrize("query", [
    "blue shirt", "red dress", "black sneakers", "summer jacket", "cap",
])
def test_english_detected_as_english(query):
    assert detect_query_language(query) == "en"


# ---- 2. Glossary thời trang (pre-pass) ----

@pytest.mark.parametrize("query,expected", [
    ("áo thun đen", "t-shirt black"),
    ("ao thun den", "t-shirt black"),
    ("Quần jean xanh", "jeans blue"),
    ("váy trắng dự tiệc", "skirt white party"),
    ("giày thể thao", "sneakers"),
    ("mũ lưỡi trai đỏ", "cap red"),
])
def test_glossary_translates_fashion_terms(query, expected):
    out, changed = apply_glossary(query)
    assert changed is True
    assert out == expected


def test_glossary_longest_alias_wins():
    # "váy liền" -> dress, không phải "váy" -> skirt
    out, _ = apply_glossary("váy liền đen")
    assert out == "dress black"


def test_glossary_english_untouched_by_translate():
    # Glossary CHỈ áp dụng cho query Việt: "red cap" giữ nguyên
    # (alias "cap"/"cặp" nghĩa là bag, không được phá query Anh).
    result = translate_query("red cap")
    assert result.query_language == "en"
    assert result.translated_query == "red cap"


# ---- 3. translate_query end-to-end (offline env test -> fallback glossary) ----

def test_vietnamese_query_uses_glossary_without_mt_model():
    result = translate_query("áo thun đen")
    assert isinstance(result, QueryTranslation)
    assert result.query_language == "vi"
    assert result.original_query == "áo thun đen"
    # Glossary phủ hết -> dùng luôn, không cần model MarianMT, không 500
    assert result.translated_query == "t-shirt black"
    assert result.engine == "glossary"


def test_english_query_passthrough():
    result = translate_query("blue dress")
    assert result.query_language == "en"
    assert result.translated_query == "blue dress"
    assert result.engine == "passthrough"


def test_blank_query_never_raises():
    for query in ("", "   "):
        result = translate_query(query)
        assert result.translated_query == (query or "")


def test_translate_for_search_never_raises():
    assert translate_for_search("áo sơ mi trắng") != ""
    assert translate_for_search("blue shirt") == "blue shirt"


# ---- 4. Cờ env + fallback ----

def test_mode_off_returns_original(monkeypatch):
    monkeypatch.setenv("QUERY_TRANSLATION", "off")
    result = translate_query("áo thun đen")
    assert result.translated_query == "áo thun đen"
    assert result.engine == "off"


def test_unknown_mode_falls_back_to_offline(monkeypatch):
    monkeypatch.setenv("QUERY_TRANSLATION", "something-else")
    assert qt.translation_mode() == "offline"


def test_mt_failure_falls_back_to_glossary(monkeypatch):
    monkeypatch.setattr(qt, "_load_marianmt", lambda: False)
    # "da" còn sót sau glossary -> thử MT trên query gốc -> lỗi -> glossary
    result = translate_query("túi xách da")
    assert result.translated_query == "handbag da"
    assert result.engine == "fallback"


def test_partial_glossary_uses_mt_on_original_query(monkeypatch):
    # MT nhận query GỐC đầy đủ (khớp phân phối huấn luyện), không ăn text trộn.
    seen = {}

    def fake_mt(text, timeout):
        seen["text"] = text
        return "leather handbag"

    monkeypatch.setattr(qt, "_marian_translate", fake_mt)
    result = translate_query("túi xách da")
    assert seen["text"] == "túi xách da"
    assert result.translated_query == "leather handbag"
    assert result.engine == "offline"


def test_mt_output_still_vietnamese_falls_back_to_glossary(monkeypatch):
    monkeypatch.setattr(qt, "_marian_translate", lambda text, timeout: "túi xách da")
    result = translate_query("túi xách da")
    assert result.translated_query == "handbag da"
    assert result.engine == "fallback"


def test_glossary_english_output_tokens_not_mistaken_for_vietnamese():
    # "ao" trong "ao dai dress" do glossary sinh ra, không phải tiếng Việt còn sót.
    result = translate_query("áo dài đỏ")
    assert result.translated_query == "ao dai dress red"
    assert result.engine == "glossary"


def test_google_mode_without_key_never_calls_network(monkeypatch):
    monkeypatch.setenv("QUERY_TRANSLATION", "google")
    monkeypatch.delenv("GOOGLE_TRANSLATE_API_KEY", raising=False)
    # "da" còn sót -> thử Google (thiếu key, không gọi mạng) -> glossary
    result = translate_query("túi xách da")
    assert result.translated_query == "handbag da"
    assert result.engine == "fallback"


def test_translate_query_never_raises_on_internal_error(monkeypatch):
    monkeypatch.setattr(qt, "detect_query_language", lambda q: (_ for _ in ()).throw(RuntimeError("boom")))
    result = translate_query("áo thun")
    assert result.original_query == "áo thun"
    assert result.engine == "fallback"


def test_lru_cache_returns_consistent_results():
    first = translate_query("quần jean xanh")
    second = translate_query("  quần jean   xanh ")
    assert first.translated_query == second.translated_query == "jeans blue"
    assert qt._translate_cached.cache_info().hits >= 1


# ---- 5. Hợp đồng API: field non-breaking, BE cũ vẫn chạy ----

def test_text_search_response_has_translation_fields(client, seeded):
    res = client.post("/api/search/text", json={"query": "áo sơ mi", "limit": 5})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["query_language"] == "vi"
    assert isinstance(data["translated_query"], str) and data["translated_query"]
    # Hợp đồng BE giữ nguyên: product_id, metadata, envelope
    assert data["total"] == 3
    for item in data["results"]:
        assert set(item) >= {"id", "score", "image_path", "file_name", "catalog", "product_id", "metadata"}


def test_english_search_response_passthrough(client, seeded):
    res = client.post("/api/search/text", json={"query": "blue shirt", "limit": 5})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["query_language"] == "en"
    assert data["translated_query"] == "blue shirt"


def test_multimodal_response_has_translation_fields(client, seeded):
    from conftest import make_image_bytes

    res = client.post(
        "/api/search/multimodal",
        files={"file": ("a.png", make_image_bytes(), "image/png")},
        data={"query": "màu xanh", "limit": "5", "text_weight": "0.5"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["query_language"] == "vi"
    assert "blue" in data["translated_query"]


def test_vietnamese_search_service_uses_english_for_clip(client, seeded, fake_processor):
    """Service phải encode bản dịch (FakeProcessor hash text -> seed khác)."""
    from src.services.search_service import SearchService

    SearchService().search_by_text("áo thun đen", limit=3)
    assert fake_processor.calls and fake_processor.calls[-1]["has_text"] is True
    # Bản dịch "t-shirt black" khác hẳn query gốc -> CLIP nhận text Anh
    assert translate_for_search("áo thun đen") == "t-shirt black"


def test_search_still_400_on_blank_query_despite_translation(client, seeded):
    res = client.post("/api/search/text", json={"query": "   ", "limit": 5})
    assert res.status_code == 400
