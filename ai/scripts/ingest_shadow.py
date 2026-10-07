"""Deterministic shadow ingest: frozen 600 vectors, stable UUID5 identities.

- Reads EXISTING frozen artifacts (no re-embedding, no second model load).
- Collection/metric/dimension preflight BEFORE any write; hash verification
  against the embeddings manifest.
- Stable point IDs: UUID5(namespace, catalog/model/product-version); repeat
  ingest upserts the same 600 points (no duplicates).
- Default non-destructive: refuses to create/reset unknown collections;
  `--reset` refuses in-place destructive operations.
- Never touches `image_gallery` or any non-task collection.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import numpy as np

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src.core.config import load_shadow_config, task_repo_root  # noqa: E402
from src.core.shadow_ids import (  # noqa: E402
    FORBIDDEN_TARGETS,
    TASK_COLLECTIONS,
    stable_point_id,
)


def load_inputs(repo_root: str, cfg: dict[str, Any], verify_hash: bool = True):
    from src.core.publication import load_frozen_inputs
    if not verify_hash:
        raise ValueError("Frozen hash checks cannot be disabled")
    return load_frozen_inputs(repo_root, cfg)


def build_points(vectors, rows, cfg):
    from qdrant_client.models import PointStruct
    from src.core.publication import expected_payload
    pub = cfg["publication"]
    points = []
    for i, row in enumerate(rows):
        pvid = str(row.get("product_version_id", ""))
        pid = str(row.get("product_id", ""))
        if not pvid or not pid:
            raise ValueError(f"Hàng {i} thiếu product identity.")
        point_id = stable_point_id(pub["catalog_snapshot_id"],
                                   pub["model_version"], pvid)
        points.append(PointStruct(
            id=point_id,
            vector=[float(v) for v in vectors[i].tolist()],
            payload=expected_payload(row, cfg),
        ))
    return points


def get_client(cfg):
    from qdrant_client import QdrantClient
    q = cfg["qdrant"]
    if q.get("prefer_grpc"):
        return QdrantClient(host=q["host"], grpc_port=q["grpc_port"],
                            prefer_grpc=True, timeout=5)
    return QdrantClient(url=f"http://{q['host']}:{q['http_port']}", timeout=5)


def ensure_collection(client, cfg, reset: bool = False):
    from qdrant_client.models import Distance, VectorParams
    q = cfg["qdrant"]
    name = q["collection_name"]
    if name in FORBIDDEN_TARGETS:
        raise ValueError(f"Từ chối thao tác destructive trên '{name}'.")
    if name not in TASK_COLLECTIONS:
        raise ValueError(f"Collection chưa đăng ký cho task: '{name}' "
                         "(unknown target refuses reset/create).")
    if q["host"] != "127.0.0.1" or q["http_port"] != 16333:
        raise ValueError("Ingest restricted to task loopback Qdrant")
    if q["vector_size"] != 512 or q["distance"] != "DOT":
        raise ValueError("Frozen shadow requires512/DOT")
    if reset:
        raise ValueError("In-place reset disabled; use isolated snapshot drill")
    exists = client.collection_exists(name)
    if not exists:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=int(q["vector_size"]),
                                        distance=Distance[q["distance"]]),
        )
    info = client.get_collection(name)
    params = info.config.params.vectors
    if isinstance(params, dict):
        raise ValueError("Named vectors unsupported in frozen shadow")
    if info.config.quantization_config is not None:
        raise ValueError("Quantized collection unsupported in exact shadow")
    if int(params.size) != 512 or str(params.distance.value).upper() != "DOT":
        raise ValueError("Collection hiện có sai dim/metric; từ chối ingest.")
    from src.core.publication import expected_inventory, validate_records
    existing, cursor = client.scroll(name, limit=601, with_payload=True, with_vectors=True)
    if cursor is not None:
        raise ValueError("Existing collection exceeds frozen inventory")
    validate_records(existing, expected_inventory())
    if existing:
        vectors, rows, _ = load_inputs(task_repo_root(), cfg)
        expected = {p.id: p for p in build_points(vectors, rows, cfg)}
        for point in existing:
            if not np.array_equal(np.asarray(point.vector, dtype=np.float32),
                                  np.asarray(expected[str(point.id)].vector, dtype=np.float32)):
                raise ValueError("Existing foreign vector; refusing overwrite")


def ingest(client, cfg, points, batch_size: int = 64) -> int:
    name = cfg["qdrant"]["collection_name"]
    if type(batch_size) is not int or batch_size < 1 or batch_size > 600:
        raise ValueError("Invalid batch size")
    total = 0
    for i in range(0, len(points), batch_size):
        client.upsert(collection_name=name, points=points[i:i + batch_size], wait=True)
        total += len(points[i:i + batch_size])
    verify_ingested(client, cfg, points)
    return total


def verify_ingested(client, cfg, points):
    name = cfg["qdrant"]["collection_name"]
    actual, cursor = client.scroll(name, limit=601, with_payload=True, with_vectors=True)
    expected = {str(point.id): point for point in points}
    if cursor is not None or len(actual) != len(expected) or client.count(name, exact=True).count != len(expected):
        raise ValueError("Incomplete collection inventory")
    seen = set()
    for point in actual:
        key = str(point.id)
        want = expected.get(key)
        if want is None or key in seen or point.payload != want.payload or not np.array_equal(
            np.asarray(point.vector, dtype=np.float32), np.asarray(want.vector, dtype=np.float32)):
            raise ValueError("Stored point/vector/payload mismatch")
        seen.add(key)
    return len(seen)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Ingest frozen shadow vectors.")
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--config", default=None)
    parser.add_argument("--reset", action="store_true",
                        help="Xóa collection task-owned trước khi nạp.")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=64)
    args = parser.parse_args(argv)

    repo_root = args.repo_root or os.environ.get(
        "FASEARCH_REPO_ROOT") or task_repo_root()
    cfg = load_shadow_config(args.config) if args.config else load_shadow_config()
    vectors, rows, _manifest = load_inputs(repo_root, cfg)
    points = build_points(vectors, rows, cfg)
    ids = [p.id for p in points]
    if len(set(ids)) != len(ids):
        raise ValueError("Point ID không ổn định/duy nhất.")
    print(f"[*] {len(points)} points, UUID5 ổn định, dim=512 DOT.")

    if args.dry_run:
        print("[*] dry-run: không ghi gì cả.")
        return 0
    client = get_client(cfg)
    try:
        ensure_collection(client, cfg, reset=args.reset)
        total = ingest(client, cfg, points, batch_size=args.batch_size)
        count = client.count(cfg["qdrant"]["collection_name"], exact=True).count
        print(f"[*] upsert {total}; server count={count}.")
        if count != 600:
            print("[!] count != 600; kiểm tra lại ingest.")
            return 2
        print("[*] INGEST OK: 600/600, lặp lại không trùng (upsert cùng ID).")
        return 0
    finally:
        try:
            client.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
