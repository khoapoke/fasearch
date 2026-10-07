"""Immutable frozen publication identity, shared by ingest and serving."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

from src.core.config import load_shadow_config, task_repo_root
from src.core.shadow_ids import stable_point_id

FROZEN_HASHES = {
    "embeddings": "9aed8c74caa18d1e4f0b61d840195a503a6c6fc8d4b3141336b1de59ff74581e",
    "mapping": "4ef3bb9ceb69955f02a1ca3347f000194e1d5fe027115e24ca38cb3f61decf6b",
    "catalog": "82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44",
}
MODEL_CONFIG_HASH = "a6a0317b924b6bece0b9cc8887d0ee53c1bf4ac51c00797f7514dce3e0bfeac8"


def asset_path(root, rel):
    root = Path(root).resolve()
    path = (root / rel).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError("Frozen asset unavailable or outside configured root")
    return path


def file_hash(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_frozen_inputs(root, cfg):
    import numpy as np
    paths = {key: asset_path(root, cfg["assets"][key]) for key in FROZEN_HASHES}
    for key, path in paths.items():
        if file_hash(path) != FROZEN_HASHES[key]:
            raise ValueError("Frozen asset hash mismatch: " + key)
    manifest = json.loads(asset_path(root, cfg["assets"]["embeddings_manifest"]).read_text())
    if (manifest.get("embedding_sha256") != FROZEN_HASHES["embeddings"] or
        manifest.get("mapping_sha256") != FROZEN_HASHES["mapping"] or
        manifest.get("catalog_sha256") != FROZEN_HASHES["catalog"] or
        manifest.get("row_count") != 600 or manifest.get("embedding_dimension") != 512 or
        manifest.get("model_version") != cfg["publication"]["model_version"] or
        manifest.get("model_config_hash") != MODEL_CONFIG_HASH or
        cfg["publication"]["catalog_snapshot_id"] != "catalog-20260908-pilot-v1" or
        cfg["publication"]["source_index_version"] != "faiss-flatip-week4-v1"):
        raise ValueError("Frozen manifest/publication mismatch")
    vectors = np.load(paths["embeddings"], allow_pickle=False)
    rows = [json.loads(line) for line in paths["mapping"].read_text().splitlines() if line]
    if (vectors.dtype != np.float32 or vectors.shape != (600, 512) or len(rows) != 600 or
        not np.isfinite(vectors).all() or
        not np.all(np.abs(np.linalg.norm(vectors, axis=1) - 1) <= 1e-3)):
        raise ValueError("Invalid frozen vectors/mapping")
    pairs = [(row.get("product_id"), row.get("product_version_id")) for row in rows]
    if len(set(pairs)) != 600 or len({p[1] for p in pairs}) != 600 or any(
        not isinstance(v, str) or not v for p in pairs for v in p):
        raise ValueError("Invalid frozen business identities")
    return vectors, rows, manifest


def expected_payload(row, cfg):
    pub = cfg["publication"]
    return {"product_id": row["product_id"], "product_version_id": row["product_version_id"],
            "catalog": pub["catalog_snapshot_id"], "model_version": pub["model_version"],
            "source_index_version": pub["source_index_version"],
            "category": row.get("category", ""), "title": row.get("title", ""),
            "file_name": row["product_id"] + ".jpg"}


@lru_cache(maxsize=1)
def expected_inventory():
    cfg = load_shadow_config()
    _, rows, _ = load_frozen_inputs(task_repo_root(), cfg)
    pub = cfg["publication"]
    return {stable_point_id(pub["catalog_snapshot_id"], pub["model_version"], row["product_version_id"]):
            expected_payload(row, cfg) for row in rows}


def publication_filter(exclude=None):
    from qdrant_client.models import FieldCondition, Filter, MatchValue
    pub = load_shadow_config()["publication"]
    must = [FieldCondition(key=k, match=MatchValue(value=v)) for k, v in (
        ("catalog", pub["catalog_snapshot_id"]), ("model_version", pub["model_version"]),
        ("source_index_version", pub["source_index_version"]))]
    return Filter(must=must, must_not=[FieldCondition(key="product_id", match=MatchValue(value=exclude))]
                  if exclude else None)


def validate_records(records, inventory=None):
    expected = expected_inventory() if inventory is None else inventory
    seen = set()
    for record in records:
        key = str(record.id)
        if key in seen or key not in expected or record.payload != expected[key]:
            raise ValueError("Foreign or mismatched publication point")
        seen.add(key)
    return seen
