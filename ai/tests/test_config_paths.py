"""A1/A5: config is cwd-independent; unknown targets refuse destruction."""

import os

import pytest

from src.core.config import (
    ai_root,
    load_shadow_config,
    resolve_under_ai_root,
)


def test_config_loads_outside_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    cfg = load_shadow_config()
    assert cfg["schema_version"] == "1.0.0"
    assert cfg["qdrant"]["collection_name"] == "fasearch_shadow_week4_v1"


def test_asset_paths_stay_under_ai_root():
    assert resolve_under_ai_root("configs/shadow.v1.yaml").startswith(ai_root())
    with pytest.raises(ValueError):
        resolve_under_ai_root("../../etc/passwd")


def test_init_refuses_forbidden_collection():
    from scripts.init_qdrant import FORBIDDEN
    assert "image_gallery" in FORBIDDEN


def test_init_refuses_unknown_target(monkeypatch):
    import scripts.init_qdrant as init_mod
    cfg = load_shadow_config()
    cfg = {**cfg, "qdrant": {**cfg["qdrant"],
                             "collection_name": "some_random_collection"}}
    monkeypatch.setattr(init_mod, "load_shadow_config", lambda *a, **k: cfg)

    class _Client:
        def collection_exists(self, name):
            return True
        def delete_collection(self, collection_name):
            raise AssertionError("must not delete unknown target")
        def close(self):
            pass

    import qdrant_client
    monkeypatch.setattr(qdrant_client, "QdrantClient", lambda **k: _Client())
    with pytest.raises(ValueError):
        init_mod.init_db(reset=True)
