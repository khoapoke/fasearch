"""Real-HF tokenizer boundary for the NEW TEXT token guard.

Runs in its OWN pytest process: importing transformers pulls torch native
libraries into the process, which aborts the FAISS index threads used by the
fixture parity tests. Run standalone:

    ../.venv/bin/python -m pytest tests/test_text_token_budget_hf.py

Requires the pinned checkpoint in the local HF cache (offline OK). Proves the
TEXT adapter rejects actual model-token overflow BEFORE the frozen core runs,
reusing the same loaded-tokenizer guard shape as composed.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from fasearch_ai.module import RetrievalTextSearchModule, TokenBudgetExceededError


HF_MODEL_ID = "openai/clip-vit-base-patch32"
HF_REVISION = "092a3b7e31726acc3a0207eea00f6040ac8b03a7"


def _module_with_real_tokenizer():
    transformers = pytest.importorskip("transformers")
    processor = transformers.AutoProcessor.from_pretrained(HF_MODEL_ID, revision=HF_REVISION)

    def forbidden(*args: object, **kwargs: object):
        raise AssertionError("core must not run on token overflow")

    engine = SimpleNamespace(
        encoder=SimpleNamespace(
            processor=SimpleNamespace(tokenizer=processor.tokenizer),
            manifest={"model_version": "hf-probe", "config_hash": "probehash"},
        ),
        index_manifest={"index_version": "probe-idx"},
        search_text=forbidden,
    )
    return RetrievalTextSearchModule(engine, "snap")


def test_real_hf_tokenizer_boundary_rejects_text_before_encode() -> None:
    module = _module_with_real_tokenizer()
    budget = module.token_budget()
    assert budget == 77
    short = "váy đỏ"
    assert module.count_model_tokens(short) <= budget
    overflowing = "áo dài tay cách tân phối nút ngọc trai " * 12
    assert module.count_model_tokens(overflowing) > budget
    with pytest.raises(TokenBudgetExceededError):
        module.search_text(overflowing, 5, module.publication)


def test_lone_surrogate_rejected_before_tokenizer_and_core() -> None:
    module = _module_with_real_tokenizer()
    with pytest.raises(ValueError):
        module.search_text("\ud800", 5, module.publication)
