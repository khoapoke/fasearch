"""Real-HF tokenizer boundary for the composed token guard (Q3).

Runs in its OWN pytest process: importing transformers pulls torch native
libraries into the process, which aborts the FAISS index threads used by the
fixture parity tests (same OpenMP conflict class as the pilot runbook notes
for restricted sandboxes). Run standalone:

    ../.venv/bin/python -m pytest tests/test_composed_token_budget_hf.py

Requires the pinned checkpoint in the local HF cache (offline OK).
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from fasearch_ai.module import (
    EFFECTIVE_FUSION_VERSION,
    RetrievalComposedSearchModule,
    TokenBudgetExceededError,
)


HF_MODEL_ID = "openai/clip-vit-base-patch32"
HF_REVISION = "092a3b7e31726acc3a0207eea00f6040ac8b03a7"


def test_real_hf_tokenizer_boundary_rejects_before_encode() -> None:
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
        search_composed=forbidden,
    )
    module = RetrievalComposedSearchModule(engine, "snap")
    budget = module.token_budget()
    assert budget == 77
    short = "váy linen suông"
    assert module.count_model_tokens(short) <= budget
    overflowing = "áo dài tay cách tân phối nút ngọc trai " * 12
    assert module.count_model_tokens(overflowing) > budget
    with pytest.raises(TokenBudgetExceededError):
        module.search_composed(
            Path("/tmp/query.png"), overflowing, 5, module.publication, EFFECTIVE_FUSION_VERSION
        )
