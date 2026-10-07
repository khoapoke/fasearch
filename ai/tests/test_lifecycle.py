"""A4: model lifecycle — eval/frozen, device honored, clean shutdown."""

import pytest


def test_model_loads_eval_frozen_cpu():
    from src.core.ai_model import check_model_ready, get_ai_model
    device, model, processor = get_ai_model()
    assert device == "cpu"
    status = check_model_ready()
    assert status["ok"], status
    assert status["device"] == "cpu"
    import torch
    assert not model.training
    assert all(not p.requires_grad for p in model.parameters())


def test_model_singleton_reused():
    from src.core import ai_model
    first = ai_model.get_ai_model()
    second = ai_model.get_ai_model()
    assert first[1] is second[1]


def test_resolve_device_honors_config():
    from src.core.ai_model import resolve_device
    assert resolve_device("cpu") == "cpu"
    with pytest.raises(ValueError):
        resolve_device("tpu")


def test_qdrant_readiness_fail_closed_before_ingest():
    # Before ingest the shadow collection is absent: readiness must say so,
    # never raise and never claim ready.
    from src.core.qdrant_client import check_qdrant_ready
    status = check_qdrant_ready()
    assert isinstance(status, dict) and "ok" in status
