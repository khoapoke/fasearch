"""Candidate web serving config: truthful Qdrant exact-DOT website backend.

RED-first: fails until ai/configs/web.v1.yaml exists and the serving
modules honor the candidate-owned web collection/index identity.
"""
from __future__ import annotations

import os

import pytest
import yaml

AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_CONFIG = os.path.join(AI_DIR, "configs", "web.v1.yaml")
SHADOW_CONFIG = os.path.join(AI_DIR, "configs", "shadow.v1.yaml")

WEB_COLLECTION = "fasearch_web_week4_v1"
WEB_INDEX = "qdrant-dot-exact-web-v1"


def test_web_config_exists_with_candidate_identity():
    assert os.path.isfile(WEB_CONFIG), "missing ai/configs/web.v1.yaml"
    with open(WEB_CONFIG, encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    assert cfg["schema_version"] == "1.0.0"
    assert cfg["api"]["port"] == 18042
    assert cfg["qdrant"]["collection_name"] == WEB_COLLECTION
    assert cfg["qdrant"]["vector_size"] == 512
    assert cfg["qdrant"]["distance"] == "DOT"
    assert cfg["publication"]["serving_index_version"] == WEB_INDEX
    # Same frozen triple, no re-embedding or model change.
    with open(SHADOW_CONFIG, encoding="utf-8") as fh:
        shadow = yaml.safe_load(fh)
    for key in ("catalog_snapshot_id", "model_version", "source_index_version",
                "fusion_version"):
        assert cfg["publication"][key] == shadow["publication"][key]


def test_task_collections_include_web_candidate():
    from src.core.shadow_ids import TASK_COLLECTIONS
    assert WEB_COLLECTION in TASK_COLLECTIONS
    assert "fasearch_shadow_week4_v1" in TASK_COLLECTIONS


def test_publication_reports_web_serving_index(monkeypatch):
    monkeypatch.setenv("FASEARCH_SHADOW_CONFIG", WEB_CONFIG)
    from src.core import config as config_module
    config_module.load_shadow_config.cache_clear()
    try:
        from src.api.validation import shadow_publication
        pub = shadow_publication()
        assert pub["index_version"] == WEB_INDEX
        assert pub["catalog_snapshot_id"] == "catalog-20260908-pilot-v1"
        assert pub["source_index_version"] == "faiss-flatip-week4-v1"
    finally:
        config_module.load_shadow_config.cache_clear()


def test_shadow_collection_still_guarded():
    from src.core.shadow_ids import TASK_COLLECTIONS, FORBIDDEN_TARGETS
    assert "image_gallery" in FORBIDDEN_TARGETS
    assert len(TASK_COLLECTIONS) >= 2
