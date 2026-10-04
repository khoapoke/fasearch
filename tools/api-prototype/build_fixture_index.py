"""Build a tiny deterministic fixture retrieval index for the API prototype demo.

Real pipeline code (ml.retrieval + FixtureEncoder + faiss), tiny synthetic catalog.
Not a research baseline; proves Boot -> FastAPI -> retrieval plumbing only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

AI_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ROOT))

from ml.retrieval.pipeline import build_index, create_encoder, encode_catalog
from ml.retrieval.utils import write_jsonl

OUT = Path("/private/tmp/fasearch-ai-fixture")
IMAGES = OUT / "images"
CATALOG_JSONL = OUT / "catalog.jsonl"
EMB_DIR = OUT / "embeddings"
INDEX_DIR = OUT / "index"

PRODUCTS = [
    ("f1", "Áo thun đỏ", "TOP", (200, 30, 30)),
    ("f2", "Váy xanh", "ONE_PIECE", (30, 90, 200)),
    ("f3", "Quần đen", "BOTTOM", (25, 25, 25)),
    ("f4", "Áo vàng", "TOP", (220, 180, 30)),
    ("f5", "Chân váy hồng", "BOTTOM", (220, 90, 150)),
    ("f6", "Áo trắng", "TOP", (235, 235, 235)),
]

INDEX_VERSION = "api-prototype-index-v1"


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    rows = []
    for pid, title, category, rgb in PRODUCTS:
        path = IMAGES / f"{pid}.jpg"
        Image.new("RGB", (96, 96), color=rgb).save(path, format="JPEG")
        rows.append(
            {
                "product_id": pid,
                "product_version_id": f"{pid}-v1",
                "product_group_id": f"group-{pid}",
                "image_path": str(path),
                "title": title,
                "category": category,
            }
        )
    write_jsonl(CATALOG_JSONL, rows)
    encoder = create_encoder("fixture", {"reproducibility": {"norm_tolerance": 1e-4}})
    encode_catalog(CATALOG_JSONL, EMB_DIR, encoder)
    manifest = build_index(CATALOG_JSONL, EMB_DIR, INDEX_DIR, INDEX_VERSION)
    boot_catalog = [
        {
            "product_id": r["product_id"],
            "product_version_id": r["product_version_id"],
            "title": r["title"],
            "category": r["category"],
            "image_path": r["image_path"],
        }
        for r in rows
    ]
    (OUT / "boot-catalog.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in boot_catalog) + "\n",
        encoding="utf-8",
    )
    print(f"MODEL_VERSION={encoder.manifest['model_version']}")
    print(f"INDEX_VERSION={INDEX_VERSION}")
    print(f"INDEX_MANIFEST_HASH={manifest.get('manifest_hash')}")
    print(f"CATALOG={CATALOG_JSONL}")
    print(f"BOOT_CATALOG={OUT / 'boot-catalog.jsonl'}")
    print(f"INDEX_DIR={INDEX_DIR}")


if __name__ == "__main__":
    main()
