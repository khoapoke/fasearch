"""Legacy raw-image seeding (bounded fix; prefer ingest_shadow.py).

Fixes vs the teammate draft: honors the configured ``raw_data_dir``,
reuses the pinned singleton model (no second load), deterministic UUID5
identities (repeat-safe), provenance payload, and refuses unknown targets.
The frozen-snapshot path remains ``ingest_shadow.py``.
"""

from __future__ import annotations

import argparse
import os
import sys

import torch
from PIL import Image
from qdrant_client.models import PointStruct

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src.core.ai_model import get_ai_model  # noqa: E402
from src.core.config import load_shadow_config  # noqa: E402
from src.core.shadow_ids import (  # noqa: E402
    FORBIDDEN_TARGETS,
    TASK_COLLECTIONS,
    stable_point_id,
)

VALID_EXTENSIONS = (".png", ".jpg", ".jpeg")


def get_client(cfg):
    from qdrant_client import QdrantClient
    q = cfg["qdrant"]
    if q.get("prefer_grpc"):
        return QdrantClient(host=q["host"], grpc_port=q["grpc_port"],
                            prefer_grpc=True)
    return QdrantClient(url=f"http://{q['host']}:{q['http_port']}")


def resolve_raw_dir(cfg) -> str:
    try:
        from src.core.config import ai_root
        rel = cfg.get("app", {}).get("raw_data_dir", "dataset/test")
        return os.path.normpath(os.path.join(ai_root(), "..", "..", rel))
    except Exception:
        return ""


def seed_data(batch_size: int = 32, dry_run: bool = False,
              config_path: str | None = None) -> int:
    cfg = load_shadow_config(config_path) if config_path else load_shadow_config()
    if not dry_run:
        raise ValueError("Raw seed disabled for frozen shadow; use ingest_shadow.py")
    name = cfg["qdrant"]["collection_name"]
    if name in FORBIDDEN_TARGETS or name not in TASK_COLLECTIONS:
        raise ValueError(f"Từ chối seed lên collection '{name}'.")
    raw_dir = resolve_raw_dir(cfg)
    if not raw_dir or not os.path.isdir(raw_dir):
        print(f"[!] Lỗi: Không tìm thấy thư mục {raw_dir}.")
        return 1
    image_paths = sorted(
        os.path.join(raw_dir, f) for f in os.listdir(raw_dir)
        if f.lower().endswith(VALID_EXTENSIONS))
    print(f"[*] Tìm thấy {len(image_paths)} ảnh thô trong '{raw_dir}'")
    if not image_paths:
        return 0

    device, model, processor = get_ai_model()
    client = get_client(cfg)
    pub = cfg["publication"]
    total = 0
    try:
        for i in range(0, len(image_paths), batch_size):
            batch_paths = image_paths[i:i + batch_size]
            batch_images = []
            for p in batch_paths:
                with Image.open(p) as img:
                    batch_images.append(img.convert("RGB"))
            inputs = processor(images=batch_images, return_tensors="pt").to(device)
            with torch.no_grad():
                features = model.get_image_features(**inputs)
                features = features / features.norm(p=2, dim=-1, keepdim=True)
                vectors = features.cpu().numpy().tolist()
            points = []
            for j, vector in enumerate(vectors):
                file_name = os.path.basename(batch_paths[j])
                product_id = os.path.splitext(file_name)[0]
                pvid = f"legacy-seed-{product_id}-v1"
                points.append(PointStruct(
                    id=stable_point_id(pub["catalog_snapshot_id"],
                                       pub["model_version"], pvid),
                    vector=vector,
                    payload={
                        "product_id": product_id,
                        "product_version_id": pvid,
                        "catalog": pub["catalog_snapshot_id"],
                        "model_version": pub["model_version"],
                        "source_index_version": "legacy-seed",
                        "file_name": file_name,
                        "status": "seeded",
                    },
                ))
            if not dry_run:
                client.upsert(collection_name=name, points=points)
            total += len(points)
            print(f"  -> batch {i // batch_size + 1}: {len(points)} ảnh")
            del inputs, features, vectors, batch_images, points
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
    finally:
        try:
            client.close()
        except Exception:
            pass
    print(f"\n[*] HOÀN TẤT SEEDING: {total} ảnh.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--config", default=None)
    args = parser.parse_args()
    raise SystemExit(seed_data(batch_size=args.batch_size,
                               dry_run=args.dry_run,
                               config_path=args.config))
