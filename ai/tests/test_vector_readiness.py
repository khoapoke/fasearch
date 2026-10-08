"""R2-S3: stored-vector readiness must reject corrupted inventories.

RED-first: a read-only fake view with one zeroed / nonfinite / foreign
vector must fail readiness; the exact frozen 600 must pass. Never touches
the live collection.
"""
from __future__ import annotations

import copy
import os
from types import SimpleNamespace

import numpy as np
import pytest

REPO_ROOT = "/Users/khoado/Documents/ChatGPT/Graduate Bachelor"


def _params():
    return SimpleNamespace(
        config=SimpleNamespace(
            params=SimpleNamespace(
                vectors=SimpleNamespace(size=512, distance="DOT")),
            quantization_config=None))


class FakeClient:
    def __init__(self, points):
        self._points = points

    def collection_exists(self, name):
        return True

    def get_collection(self, name):
        return _params()

    def count(self, name, exact=True):
        return SimpleNamespace(count=len(self._points))

    def scroll(self, name, limit=601, with_payload=True, with_vectors=False):
        self.seen_vectors_flag = with_vectors
        return list(self._points), None


def _exact_points():
    import sys
    ai_dir = os.path.join("/tmp", "fasearch-ai-qdrant-web", "ai")
    if ai_dir not in sys.path:
        sys.path.insert(0, ai_dir)
    os.environ["FASEARCH_REPO_ROOT"] = REPO_ROOT
    from src.core.config import load_shadow_config
    from src.core.publication import load_frozen_inputs
    from scripts.ingest_shadow import build_points
    cfg = load_shadow_config()
    vectors, rows, _ = load_frozen_inputs(REPO_ROOT, cfg)
    return cfg, build_points(vectors, rows, cfg)


@pytest.fixture(scope="module")
def exact():
    return _exact_points()


def _ready(monkeypatch, points):
    from src.core import qdrant_client as mod
    fake = FakeClient(points)
    monkeypatch.setattr(mod, "get_qdrant_client", lambda: fake)
    monkeypatch.setenv("FASEARCH_REPO_ROOT", REPO_ROOT)
    return mod.check_qdrant_ready(), fake


def test_zeroed_vector_fails(monkeypatch, exact):
    _, points = exact
    bad = copy.deepcopy(points)
    bad[0] = copy.copy(bad[0])
    bad[0].vector = [0.0] * 512
    result, _ = _ready(monkeypatch, bad)
    assert result["ok"] is False


def test_nonfinite_vector_fails(monkeypatch, exact):
    _, points = exact
    bad = copy.deepcopy(points)
    bad[5] = copy.copy(bad[5])
    vec = list(bad[5].vector)
    vec[7] = float("nan")
    bad[5].vector = vec
    result, _ = _ready(monkeypatch, bad)
    assert result["ok"] is False


def test_foreign_vector_fails(monkeypatch, exact):
    _, points = exact
    bad = copy.deepcopy(points)
    bad[9] = copy.copy(bad[9])
    rng = np.random.default_rng(7)
    vec = rng.normal(size=512).astype(np.float32)
    vec /= np.linalg.norm(vec)
    bad[9].vector = [float(v) for v in vec]
    result, _ = _ready(monkeypatch, bad)
    assert result["ok"] is False


def test_exact_frozen_600_passes(monkeypatch, exact):
    _, points = exact
    result, fake = _ready(monkeypatch, points)
    assert fake.seen_vectors_flag is True, "readiness must fetch stored vectors"
    assert result == {"ok": True, "collection": result["collection"],
                      "points": 600, "dim": 512, "distance": "DOT",
                      "vectors": "frozen-exact"}
