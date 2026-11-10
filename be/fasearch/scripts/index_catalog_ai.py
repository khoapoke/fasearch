#!/usr/bin/env python3
"""Index the published catalog candidate with the existing CLIP pipeline.

Reuses the same model id / processor / cached weights as the running AI service by importing
`src.core.ai_model` from the AI source tree (PYTHONPATH). No training, no fine-tuning and no
second model download. Point ids are deterministic per product so a rerun overwrites instead
of duplicating; `--rebuild` recreates only this candidate collection.

Usage: index_catalog_ai.py --ai-src <ai dir> --collection brand_catalog_complete_v1 \
       --media-dir <products media> --receipt <json> [--rebuild] [--limit N]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
DB = "fasearch_brand_catalog_ai_20261102"
NAMESPACE = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")


def psql(sql: str, db: str | None = None) -> str:
    target = db or DB
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c",
         f'psql -U "$POSTGRES_USER" -d {target} -v ON_ERROR_STOP=1 -At -F "|"'],
        input=sql.encode(), capture_output=True, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stderr.decode(errors="replace")[:600])
    return result.stdout.decode(errors="replace").strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ai-src", required=True)
    parser.add_argument("--collection", default="brand_catalog_complete_v1")
    parser.add_argument("--db", default=DB, help="candidate database to read published products from")
    parser.add_argument("--media-dir", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--batch", type=int, default=16)
    args = parser.parse_args()

    sys.path.insert(0, args.ai_src)
    os.environ.setdefault("QDRANT_COLLECTION", args.collection)
    import torch  # noqa: E402
    from PIL import Image  # noqa: E402
    from qdrant_client import QdrantClient  # noqa: E402
    from qdrant_client.models import Distance, PointStruct, VectorParams  # noqa: E402
    from src.core.ai_model import get_ai_model  # noqa: E402

    media_dir = Path(args.media_dir)
    rows = psql(
        "SELECT p.ma_sp, p.ten_sp, b.slug, b.ten_thuong_hieu, p.model_code, p.hinh_anh_sp, "
        "COALESCE(p.source_host,'') FROM san_pham p LEFT JOIN thuong_hieu b ON b.ma_thuong_hieu=p.ma_thuong_hieu "
        "WHERE p.publication_status='PUBLISHED' AND p.da_xoa=false AND p.hinh_anh_sp IS NOT NULL "
        "ORDER BY p.ma_sp;", args.db)
    entries = []
    for line in rows.splitlines():
        parts = line.split("|")
        if len(parts) < 7:
            continue
        product_id, name, slug, brand_name, model, image_url, source_host = parts[:7]
        file_name = image_url.rsplit("/", 1)[-1]
        path = media_dir / file_name
        if not path.is_file():
            entries.append({"productId": int(product_id), "skipped": "missing media", "file": file_name})
            continue
        entries.append({
            "productId": int(product_id), "name": name, "brandSlug": slug, "brandName": brand_name,
            "model": model, "file": file_name, "sourceHost": source_host, "path": path,
        })
    if args.limit:
        entries = entries[: args.limit]
    eligible = [e for e in entries if "path" in e]

    device, model, processor = get_ai_model()
    client = QdrantClient(host="127.0.0.1", grpc_port=6334, prefer_grpc=True)
    if args.rebuild and client.collection_exists(args.collection):
        client.delete_collection(collection_name=args.collection)
    if not client.collection_exists(args.collection):
        client.create_collection(
            collection_name=args.collection,
            vectors_config=VectorParams(size=512, distance=Distance.COSINE))

    indexed, failed = [], []
    for start in range(0, len(eligible), args.batch):
        chunk = eligible[start:start + args.batch]
        tensors, keep = [], []
        for entry in chunk:
            try:
                with Image.open(entry["path"]) as image:
                    inputs = processor(images=image.convert("RGB"), return_tensors="pt").to(device)
                with torch.no_grad():
                    features = model.get_image_features(**inputs)
                features = features / features.norm(p=2, dim=-1, keepdim=True)
                tensors.append(features.cpu().numpy()[0].tolist())
                keep.append(entry)
            except Exception as error:  # noqa: BLE001 - reported per item, never fatal
                failed.append({"productId": entry["productId"], "error": str(error)[:120]})
        points = []
        for entry, vector in zip(keep, tensors):
            digest = hashlib.sha256(entry["path"].read_bytes()).hexdigest()
            point_id = str(uuid.uuid5(NAMESPACE, f"catalog:{entry['productId']}:{digest}"))
            points.append(PointStruct(
                id=point_id, vector=vector,
                payload={
                    # AI response schema types product_id as string; keep the numeric copy in metadata.
                    "product_id": str(entry["productId"]), "file_name": entry["file"],
                    # Empty image_path makes the BE resolve a same-origin proxy route
                    # (/api/v1/search/images/{file}) instead of leaking the AI port.
                    "image_path": "", "catalog": entry["brandSlug"] or "",
                    "status": "ACTIVE",
                    "metadata": {"product_id": entry["productId"], "brand_slug": entry["brandSlug"],
                                 "brand_name": entry["brandName"], "model": entry["model"],
                                 "source_host": entry["sourceHost"], "image_sha256": digest},
                }))
            indexed.append({"productId": entry["productId"], "pointId": point_id, "imageSha256": digest})
        if points:
            client.upsert(collection_name=args.collection, points=points)
    count = client.count(collection_name=args.collection).count

    receipt = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "collection": args.collection,
        "model": "openai/clip-vit-base-patch32 (reused cached weights, no training)",
        "vectorSize": 512,
        "distance": "COSINE",
        "db": args.db,
        "candidates": len(entries),
        "indexedThisRun": len(indexed),
        "pointsInCollection": count,
        "failed": failed,
        "skipped": [e for e in entries if "skipped" in e],
        "rebuild": bool(args.rebuild),
        "items": indexed,
    }
    out = Path(args.receipt)
    out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    out.chmod(0o600)
    print(json.dumps({"collection": args.collection, "indexed": len(indexed), "points": count,
                      "failed": len(failed), "skipped": len(receipt["skipped"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
