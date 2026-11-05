"""Dịch câu query tiếng Việt sang tiếng Anh trước khi encode CLIP.

Luồng (theo TASK ai-vi-translate-20261105, đại diện duyệt offline mặc định):
  1. Phát hiện ngôn ngữ: tiếng Việt nếu có dấu HOẶC chứa token Việt
     không dấu thường gặp (``ao``, ``quan``, ``giay``, ``vay``, ``mau`` ...).
     Tiếng Anh/ngôn ngữ khác giữ nguyên.
  2. Glossary thời trang (file data ``fashion_glossary_vi_en.json``, dễ mở rộng):
     thay cụm từ Việt -> Anh, alias dài nhất khớp trước.
     Glossary CHỈ áp dụng khi phát hiện tiếng Việt (tránh làm hỏng query Anh
     như "red cap" vì alias ``cap``/``cặp`` nghĩa là bag).
  3. Phần còn lại dịch bằng MarianMT ``Helsinki-NLP/opus-mt-vi-en`` (CPU,
     lazy-load một lần, có timeout guard); cache LRU theo query chuẩn hóa.
  4. Dùng text tiếng Anh cho CLIP text search và phần text multimodal.
     Response bổ sung field non-breaking ``translated_query``/``query_language``.
  5. Lỗi/timeout -> fallback về query gốc, KHÔNG bao giờ 500.

Cờ cấu hình qua env:
  ``QUERY_TRANSLATION=offline|google|off`` (mặc định ``offline``).
  Chế độ ``google`` đọc ``GOOGLE_TRANSLATE_API_KEY`` từ env nếu có
  (đã cài adapter nhưng mặc định TẮT; không gọi khi thiếu key).
  ``QUERY_TRANSLATION_TIMEOUT_S`` (mặc định 20), ``QUERY_TRANSLATION_MODEL``
  (mặc định Helsinki-NLP/opus-mt-vi-en), ``QUERY_TRANSLATION_CACHE_SIZE``.
"""

import json
import logging
import os
import re
import threading
import unicodedata
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

GLOSSARY_PATH = Path(__file__).resolve().parent / "fashion_glossary_vi_en.json"

DEFAULT_MT_MODEL = "Helsinki-NLP/opus-mt-vi-en"
DEFAULT_TIMEOUT_S = 20.0
DEFAULT_CACHE_SIZE = 512

# Token Việt không dấu thường gặp -> fallback phát hiện khi query không có dấu.
VI_ASCII_TOKENS = frozenset({
    "ao", "quan", "giay", "dep", "vay", "dam", "dam", "tui", "balo", "vi",
    "mu", "non", "khan", "mau", "den", "trang", "do", "xanh", "hong", "vang",
    "tim", "xam", "nau", "kem", "mua", "ban", "dep", "xinh", "re", "moi",
    "nam", "nu", "tre", "em", "be", "trai", "gai", "cong", "so", "dep",
    "thoi", "trang", "kieu", "dang", "co", "tay", "chan", "du", "tiec",
    "the", "thao", "bien", "pho", "hoa", "soc", "caro", "tron", "dai",
    "ngan", "rong", "om", "lung", "thung", "tron", "cao", "thap", "dep",
    "da",  # "túi da"/"giày da" còn sót sau glossary vẫn là tiếng Việt
})

# Regex phát hiện dấu tiếng Việt (bao gồm đ/Đ và nguyên âm có dấu).
_VI_DIACRITIC_RE = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class QueryTranslation:
    """Kết quả dịch một câu query (không bao giờ raise)."""

    original_query: str
    translated_query: str
    query_language: str  # "vi" | "en"
    engine: str  # off|passthrough|glossary|offline|google|fallback


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def detect_query_language(query: str) -> str:
    """Trả về "vi" nếu có dấu tiếng Việt hoặc token Việt không dấu; else "en"."""
    text = _normalize(query)
    if not text:
        return "en"
    if _VI_DIACRITIC_RE.search(text):
        return "vi"
    tokens = set(re.findall(r"[a-z0-9]+", text.lower()))
    if tokens & VI_ASCII_TOKENS:
        return "vi"
    return "en"


def _load_glossary() -> List[Tuple[str, str]]:
    """Đọc data file glossary -> [(alias_lower, english)] alias dài trước.

    File thiếu/hỏng -> fallback tối thiểu để không bao giờ 500.
    """
    try:
        with open(GLOSSARY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        pairs: List[Tuple[str, str]] = []
        for entry in data.get("entries", []):
            en = str(entry.get("en", "")).strip()
            for alias in entry.get("vi", []):
                alias = str(alias).strip().lower()
                if alias and en:
                    pairs.append((alias, en))
        pairs.sort(key=lambda p: len(p[0]), reverse=True)
        return pairs
    except Exception as e:
        logger.warning(f"Không đọc được glossary {GLOSSARY_PATH}: {e}; dùng fallback tối thiểu")
        return [
            ("áo thun", "t-shirt"), ("ao thun", "t-shirt"),
            ("áo sơ mi", "shirt"), ("ao so mi", "shirt"),
            ("áo khoác", "jacket"), ("ao khoac", "jacket"),
            ("quần jean", "jeans"), ("quan jean", "jeans"),
            ("quần short", "shorts"), ("quan short", "shorts"),
            ("váy", "skirt"), ("vay", "skirt"),
            ("đầm", "dress"), ("dam", "dress"),
            ("giày thể thao", "sneakers"), ("giay the thao", "sneakers"),
            ("đen", "black"), ("den", "black"),
            ("trắng", "white"), ("trang", "white"),
        ]


_GLOSSARY_PAIRS: Optional[List[Tuple[str, str]]] = None
_GLOSSARY_LOCK = threading.Lock()


def _glossary_pairs() -> List[Tuple[str, str]]:
    global _GLOSSARY_PAIRS
    if _GLOSSARY_PAIRS is None:
        with _GLOSSARY_LOCK:
            if _GLOSSARY_PAIRS is None:
                _GLOSSARY_PAIRS = _load_glossary()
    return _GLOSSARY_PAIRS


def _compile_glossary_pattern(pairs: List[Tuple[str, str]]) -> "re.Pattern[str]":
    return re.compile(
        r"(?<!\w)(" + "|".join(re.escape(a) for a, _ in pairs) + r")(?!\w)",
        re.IGNORECASE,
    )


_GLOSSARY_PATTERN: Optional["re.Pattern[str]"] = None


def _glossary_pattern() -> "re.Pattern[str]":
    global _GLOSSARY_PATTERN
    if _GLOSSARY_PATTERN is None:
        with _GLOSSARY_LOCK:
            if _GLOSSARY_PATTERN is None:
                _GLOSSARY_PATTERN = _compile_glossary_pattern(_glossary_pairs())
    return _GLOSSARY_PATTERN


_EN_TOKENS: Optional[frozenset] = None


def _en_tokens() -> frozenset:
    """Token tiếng Anh do chính glossary sinh ra (vd ao/dai từ 'ao dai dress')."""
    global _EN_TOKENS
    if _EN_TOKENS is None:
        with _GLOSSARY_LOCK:
            if _EN_TOKENS is None:
                toks = set()
                for _, en in _glossary_pairs():
                    toks.update(re.findall(r"[a-z0-9]+", en.lower()))
                _EN_TOKENS = frozenset(toks)
    return _EN_TOKENS


def _has_vietnamese_remainder(text: str) -> bool:
    """Glossary output còn sót tiếng Việt không (bỏ qua token Anh do glossary sinh)."""
    clean = _normalize(text)
    if _VI_DIACRITIC_RE.search(clean):
        return True
    tokens = set(re.findall(r"[a-z0-9]+", clean.lower()))
    return bool(tokens & VI_ASCII_TOKENS - _en_tokens())


def apply_glossary(text: str) -> Tuple[str, bool]:
    """Thay cụm Việt -> Anh theo glossary. Trả về (text_mới, có_thay_đổi)."""
    clean = _normalize(text)
    if not clean:
        return clean, False
    mapping: Dict[str, str] = {a: en for a, en in _glossary_pairs()}
    pattern = _glossary_pattern()

    changed = False

    def _repl(m: "re.Match[str]") -> str:
        nonlocal changed
        changed = True
        return mapping[m.group(0).lower()]

    out = pattern.sub(_repl, clean)
    out = _normalize(out)
    return out, changed


def translation_mode() -> str:
    mode = os.getenv("QUERY_TRANSLATION", "offline").strip().lower()
    return mode if mode in ("offline", "google", "off") else "offline"


def translation_timeout() -> float:
    try:
        return max(1.0, float(os.getenv("QUERY_TRANSLATION_TIMEOUT_S", DEFAULT_TIMEOUT_S)))
    except ValueError:
        return DEFAULT_TIMEOUT_S


def translation_model_id() -> str:
    return os.getenv("QUERY_TRANSLATION_MODEL", DEFAULT_MT_MODEL).strip() or DEFAULT_MT_MODEL


# ---- MarianMT (lazy, CPU, timeout guard) ----

_mt_tokenizer = None
_mt_model = None
_mt_lock = threading.Lock()
_mt_failed = False


def _offline_env() -> bool:
    return os.getenv("HF_HUB_OFFLINE", "") == "1" or os.getenv("TRANSFORMERS_OFFLINE", "") == "1"


def _load_marianmt() -> bool:
    """Nạp model một lần. Trả về True nếu sẵn sàng; False -> caller fallback."""
    global _mt_tokenizer, _mt_model, _mt_failed
    if _mt_model is not None:
        return True
    if _mt_failed:
        return False
    with _mt_lock:
        if _mt_model is not None:
            return True
        if _mt_failed:
            return False
        try:
            from transformers import MarianMTModel, MarianTokenizer

            model_id = translation_model_id()
            kwargs = {"local_files_only": True} if _offline_env() else {}
            _mt_tokenizer = MarianTokenizer.from_pretrained(model_id, **kwargs)
            _mt_model = MarianMTModel.from_pretrained(model_id, **kwargs)
            _mt_model.eval()
            try:
                import torch

                _mt_model.to("cpu")
            except Exception:
                pass
            logger.info(f"[*] Đã nạp model dịch {model_id} (CPU)")
            return True
        except Exception as e:
            _mt_failed = True
            logger.warning(f"Dịch offline không khả dụng ({e}); fallback query gốc")
            return False


def _marian_translate(text: str, timeout: float) -> Optional[str]:
    if not _load_marianmt():
        return None
    assert _mt_tokenizer is not None and _mt_model is not None
    try:
        import torch

        batch = _mt_tokenizer([text], return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(_mt_model.generate, **batch)
                generated = future.result(timeout=timeout)
        out = _mt_tokenizer.batch_decode(generated, skip_special_tokens=True)
        result = _normalize(out[0]) if out else ""
        return result or None
    except (FutureTimeoutError, TimeoutError):
        logger.warning("Dịch offline timeout; fallback query gốc")
        return None
    except Exception as e:
        logger.warning(f"Dịch offline lỗi ({e}); fallback query gốc")
        return None


def reset_marianmt_for_tests() -> None:
    """Reset singleton MarianMT (chỉ dùng cho unit test)."""
    global _mt_tokenizer, _mt_model, _mt_failed
    with _mt_lock:
        _mt_tokenizer = None
        _mt_model = None
        _mt_failed = False


# ---- Google Cloud Translation adapter (mặc định TẮT) ----

def _google_translate(text: str, timeout: float) -> Optional[str]:
    """Dịch qua Google Cloud Translation. Thiếu key -> None (không gọi mạng)."""
    import urllib.parse
    import urllib.request

    api_key = os.getenv("GOOGLE_TRANSLATE_API_KEY", "").strip()
    if not api_key:
        logger.info("QUERY_TRANSLATION=google nhưng thiếu GOOGLE_TRANSLATE_API_KEY; fallback query gốc")
        return None
    try:
        payload = urllib.parse.urlencode({
            "q": text, "source": "vi", "target": "en",
            "format": "text", "key": api_key,
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://translation.googleapis.com/language/translate/v2",
            data=payload, method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        translated = body["data"]["translations"][0]["translatedText"]
        return _normalize(translated) or None
    except Exception as e:
        logger.warning(f"Dịch Google lỗi ({e}); fallback query gốc")
        return None


# ---- Entry point chính (cached) ----

def _cache_size() -> int:
    try:
        return max(1, int(os.getenv("QUERY_TRANSLATION_CACHE_SIZE", DEFAULT_CACHE_SIZE)))
    except ValueError:
        return DEFAULT_CACHE_SIZE


@lru_cache(maxsize=DEFAULT_CACHE_SIZE)
def _translate_cached(normalized: str, mode: str) -> QueryTranslation:
    lang = detect_query_language(normalized)
    if mode == "off" or lang != "vi":
        return QueryTranslation(
            original_query=normalized, translated_query=normalized,
            query_language=lang, engine="off" if mode == "off" else "passthrough",
        )
    # 1. Glossary trước: nếu kết quả đã hoàn toàn tiếng Anh thì dùng luôn.
    #    (MarianMT huấn luyện trên câu Việt đầy đủ; cho nó ăn text EN+VI trộn
    #    làm hỏng cả token Anh sẵn có, vd "sneakers" -> "soneers".)
    glossed, _ = apply_glossary(normalized)
    if not _has_vietnamese_remainder(glossed):
        return QueryTranslation(normalized, glossed, "vi", "glossary")
    # 2. Còn sót tiếng Việt -> dịch QUERY GỐC đầy đủ bằng MT
    #    (khớp phân phối huấn luyện), chỉ nhận khi đầu ra hết tiếng Việt.
    if mode == "google":
        timeout = translation_timeout()
        result = _google_translate(normalized, timeout)
        if result and not _has_vietnamese_remainder(result):
            return QueryTranslation(normalized, result, "vi", "google")
        return QueryTranslation(normalized, glossed, "vi", "fallback")
    # offline (mặc định): lỗi/timeout/MT vẫn còn Việt -> glossary, không 500.
    result = _marian_translate(normalized, translation_timeout())
    if result and not _has_vietnamese_remainder(result):
        return QueryTranslation(normalized, result, "vi", "offline")
    return QueryTranslation(normalized, glossed, "vi", "fallback")


def translate_query(query: str) -> QueryTranslation:
    """Dịch query sang tiếng Anh cho CLIP. Không bao giờ raise (fallback query gốc)."""
    try:
        normalized = _normalize(query)
        if not normalized:
            return QueryTranslation(query or "", query or "", "en", "passthrough")
        return _translate_cached(normalized, translation_mode())
    except Exception as e:
        logger.warning(f"translate_query lỗi không lường trước ({e}); fallback query gốc")
        clean = _normalize(query)
        return QueryTranslation(clean, clean, "en", "fallback")


def translate_for_search(query: str, enabled: bool = True) -> str:
    """Text tiếng Anh dùng để encode CLIP (service layer gọi hàm này)."""
    if not enabled:
        return _normalize(query)
    return translate_query(query).translated_query
