"""Shared shadow identities: stable IDs and guarded collection names."""

from __future__ import annotations

import uuid

TASK_COLLECTIONS = frozenset({"fasearch_shadow_week4_v1", "fasearch_web_week4_v1"})
FORBIDDEN_TARGETS = frozenset({"image_gallery"})

UUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL,
                            "fasearch.ai-draft-hardening.shadow-v1")


def stable_point_id(catalog_snapshot_id: str, model_version: str,
                    product_version_id: str) -> str:
    seed = f"{catalog_snapshot_id}/{model_version}/{product_version_id}"
    return str(uuid.uuid5(UUID_NAMESPACE, seed))
