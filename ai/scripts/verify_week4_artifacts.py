from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import faiss
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ml.retrieval.utils import read_jsonl, sha256_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Week 4 catalog/embedding/index provenance")
    parser.add_argument(
        "--catalog",
        default="data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl",
    )
    parser.add_argument(
        "--embeddings-dir", default="artifacts/embeddings/week4-baseline-20260908-v1"
    )
    parser.add_argument(
        "--index-dir", default="artifacts/indexes/week4-baseline-20260908-v1"
    )
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    embeddings_dir = Path(args.embeddings_dir)
    index_dir = Path(args.index_dir)
    vectors = np.load(embeddings_dir / "catalog-image-embeddings.v1.npy", allow_pickle=False)
    embedding_manifest = json.loads((embeddings_dir / "embeddings-manifest.v1.json").read_text())
    model_manifest = json.loads((embeddings_dir / "model-manifest.v1.json").read_text())
    index_manifest = json.loads((index_dir / "index-manifest.v1.json").read_text())
    mapping = read_jsonl(index_dir / "row-to-product.v1.jsonl")
    index = faiss.read_index(str(index_dir / "index.faiss"))

    assert np.isfinite(vectors).all(), "NaN or infinity in catalog embeddings"
    assert vectors.shape == (600, 512), vectors.shape
    assert np.allclose(np.linalg.norm(vectors, axis=1), 1.0, atol=1e-4, rtol=0.0)
    assert index.ntotal == len(mapping) == vectors.shape[0]
    assert index.d == vectors.shape[1]
    assert all(int(row["row"]) == position for position, row in enumerate(mapping))
    assert embedding_manifest["catalog_sha256"] == sha256_file(catalog_path)
    assert index_manifest["catalog_snapshot_sha256"] == sha256_file(catalog_path)
    assert index_manifest["model_config_hash"] == model_manifest["config_hash"]
    assert index_manifest["index_sha256"] == sha256_file(index_dir / "index.faiss")
    assert index_manifest["mapping_sha256"] == sha256_file(index_dir / "row-to-product.v1.jsonl")

    print(json.dumps({
        "status": "PASS",
        "rows": int(index.ntotal),
        "dimension": int(index.d),
        "catalog_sha256": sha256_file(catalog_path),
        "model_version": model_manifest["model_version"],
        "index_version": index_manifest["index_version"],
        "norm_min": float(np.linalg.norm(vectors, axis=1).min()),
        "norm_max": float(np.linalg.norm(vectors, axis=1).max()),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
