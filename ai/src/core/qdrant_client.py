"""Qdrant client singleton with real readiness validation.

Construction alone never means "ready": ``check_qdrant_ready()`` verifies the
configured collection exists with the expected dimension/metric and a
non-zero point count. ``close_qdrant()`` releases the client on shutdown.
"""

from __future__ import annotations

import threading
from typing import Any

from qdrant_client import QdrantClient

from src.core.config import load_shadow_config, settings
from src.core.shadow_ids import TASK_COLLECTIONS, stable_point_id

_frozen_vectors_cache: dict = {}
_frozen_vectors_lock = threading.Lock()

_client = None
_lock = threading.Lock()

HOST = settings["qdrant"]["host"]
PORT = settings["qdrant"]["grpc_port"]
PERFECT_GPRC = settings["qdrant"]["prefer_grpc"]


def _shadow() -> dict[str, Any]:
    # Missing shadow config must never send traffic to the legacy shared server.
    return load_shadow_config()


def get_qdrant_client() -> QdrantClient:
    """Single shared client for the whole application lifetime."""
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is not None:
            return _client
        shadow = _shadow().get("qdrant", {})
        host = shadow.get("host", HOST)
        prefer_grpc = shadow.get("prefer_grpc", PERFECT_GPRC)
        if host != "127.0.0.1" or shadow.get("http_port") != 16333 or shadow.get("grpc_port") != 16334:
            raise ValueError("Qdrant restricted to task loopback ports")
        print("[*] Đang thiết lập kết nối tới Qdrant...")
        if prefer_grpc:
            grpc_port = shadow.get("grpc_port", PORT)
            _client = QdrantClient(host=host, grpc_port=grpc_port, prefer_grpc=True, timeout=5)
        else:
            http_port = shadow.get("http_port", 6333)
            _client = QdrantClient(url=f"http://{host}:{http_port}", timeout=5)
        print("[*] Đã tạo Qdrant client (chưa xác thực readiness).")
        return _client


def _frozen_id_vectors() -> dict[str, Any]:
    """Hash-verified frozen point-id -> float32 vector map (EXPECTED side).

    Only the frozen expectation is cached (immutable pinned files,
    hash-verified on load); live points are always re-read from the
    server, so caching can never bless altered stored data.
    """
    from src.core.config import task_repo_root
    from src.core.publication import load_frozen_inputs
    shadow = _shadow()
    pub = shadow["publication"]
    root = task_repo_root()
    key = (root, pub["catalog_snapshot_id"], pub["model_version"])
    with _frozen_vectors_lock:
        hit = _frozen_vectors_cache.get(key)
        if hit is not None:
            return hit
        vectors, rows, _ = load_frozen_inputs(root, shadow)
        import numpy as _np
        mapping = {}
        for i, row in enumerate(rows):
            pid = stable_point_id(pub["catalog_snapshot_id"],
                                  pub["model_version"],
                                  str(row["product_version_id"]))
            mapping[pid] = _np.asarray(vectors[i], dtype=_np.float32)
        _frozen_vectors_cache[key] = mapping
        return mapping


def _stored_vectors_match(points, expected: dict[str, Any]) -> bool:
    import numpy as _np
    for point in points:
        want = expected.get(str(point.id))
        vec = getattr(point, "vector", None)
        if want is None or not isinstance(vec, (list, tuple)):
            return False
        try:
            arr = _np.asarray(vec, dtype=_np.float32)
        except (TypeError, ValueError):
            return False
        if arr.shape != (512,) or not _np.array_equal(arr, want):
            return False
    return True


def check_qdrant_ready() -> dict[str, Any]:
    """Validate collection identity/dimension/metric/count for the shadow."""
    try:
        shadow = _shadow()["qdrant"]
        collection = shadow["collection_name"]
        if collection not in TASK_COLLECTIONS:
            return {"ok": False, "reason": "unexpected-collection"}
        want_dim = int(shadow["vector_size"])
        want_distance = str(shadow["distance"]).upper()
        client = get_qdrant_client()
        if not client.collection_exists(collection):
            return {"ok": False, "reason": "collection-missing",
                    "collection": collection}
        info = client.get_collection(collection)
        params = info.config.params.vectors
        if isinstance(params, dict):
            return {"ok": False, "reason": "unexpected-named-vectors"}
        if info.config.quantization_config is not None:
            return {"ok": False, "reason": "unexpected-quantization"}
        got_dim = int(getattr(params, "size", -1))
        got_dist = str(getattr(getattr(params, "distance", ""), "value",
                               getattr(params, "distance", ""))).upper()
        if got_dim != want_dim:
            return {"ok": False, "reason": "dimension-mismatch",
                    "want": want_dim, "got": got_dim}
        if got_dist != want_distance:
            return {"ok": False, "reason": "metric-mismatch",
                    "want": want_distance, "got": got_dist}
        count = client.count(collection, exact=True).count
        if count != 600:
            return {"ok": False, "reason": "collection-count-mismatch",
                    "collection": collection}
        from src.core.publication import expected_inventory, validate_records
        expected = expected_inventory()
        points, cursor = client.scroll(collection, limit=601, with_payload=True,
                                       with_vectors=True)
        if cursor is not None or validate_records(points, expected) != set(expected):
            return {"ok": False, "reason": "publication-coverage-mismatch"}
        if not _stored_vectors_match(points, _frozen_id_vectors()):
            return {"ok": False, "reason": "stored-vector-mismatch"}
        return {"ok": True, "collection": collection, "points": count,
                "dim": got_dim, "distance": got_dist,
                "vectors": "frozen-exact"}
    except Exception as exc:  # readiness must fail closed, never raise
        return {"ok": False, "reason": f"qdrant-error: {type(exc).__name__}"}


def close_qdrant() -> None:
    global _client
    with _lock:
        client, _client = _client, None
    if client is not None:
        try:
            client.close()
        except Exception:
            pass
