from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import numpy as np

from .utils import assert_unit_norm, canonical_json_hash, read_jsonl, sha256_file, write_json, write_jsonl


@dataclass(frozen=True)
class SearchHit:
    row: int
    score: float


class FaissFlatIPIndex:
    def __init__(self, dimension: int, mapping: Sequence[dict[str, Any]], index: Any) -> None:
        self.dimension = dimension
        self.mapping = list(mapping)
        self.index = index
        self._assert_mapping()

    @classmethod
    def build(cls, embeddings: np.ndarray, mapping: Sequence[dict[str, Any]]) -> "FaissFlatIPIndex":
        try:
            import faiss
        except ImportError as exc:
            raise RuntimeError("faiss-cpu is required; install requirements.lock") from exc
        vectors = np.ascontiguousarray(embeddings, dtype=np.float32)
        if vectors.ndim != 2:
            raise ValueError("Expected a 2D embedding matrix")
        assert_unit_norm(vectors, 1e-4)
        if len(mapping) != len(vectors):
            raise ValueError("Mapping length does not match embedding row count")
        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)
        return cls(vectors.shape[1], mapping, index)

    @classmethod
    def load(cls, artifact_dir: Path) -> "FaissFlatIPIndex":
        try:
            import faiss
        except ImportError as exc:
            raise RuntimeError("faiss-cpu is required; install requirements.lock") from exc
        manifest = json.loads((artifact_dir / "index-manifest.v1.json").read_text(encoding="utf-8"))
        index = faiss.read_index(str(artifact_dir / "index.faiss"))
        mapping = read_jsonl(artifact_dir / "row-to-product.v1.jsonl")
        instance = cls(int(manifest["embedding_dimension"]), mapping, index)
        if index.d != instance.dimension or index.ntotal != len(mapping):
            raise ValueError("Persisted FAISS index/mapping manifest mismatch")
        return instance

    def _assert_mapping(self) -> None:
        if self.index.ntotal != len(self.mapping):
            raise ValueError("FAISS rows and product mapping are misaligned")
        for expected_row, record in enumerate(self.mapping):
            if int(record["row"]) != expected_row:
                raise ValueError(f"Mapping row mismatch at {expected_row}: {record}")

    def search(self, query: np.ndarray, k: int) -> list[SearchHit]:
        vector = np.ascontiguousarray(query, dtype=np.float32)
        if vector.ndim == 1:
            vector = vector[None, :]
        if vector.shape != (1, self.dimension):
            raise ValueError(f"Query dimension {vector.shape} does not match index {self.dimension}")
        assert_unit_norm(vector, 1e-4)
        scores, rows = self.index.search(vector, min(k, self.index.ntotal))
        return [SearchHit(int(row), float(score)) for row, score in zip(rows[0], scores[0]) if row >= 0]

    def save(
        self,
        artifact_dir: Path,
        catalog_path: Path,
        model_manifest: dict[str, Any],
        index_version: str,
    ) -> dict[str, Any]:
        import faiss

        artifact_dir.mkdir(parents=True, exist_ok=True)
        index_path = artifact_dir / "index.faiss"
        mapping_path = artifact_dir / "row-to-product.v1.jsonl"
        faiss.write_index(self.index, str(index_path))
        write_jsonl(mapping_path, self.mapping)
        manifest = {
            "schema_version": "1.0.0",
            "index_version": index_version,
            "backend": "faiss",
            "index_type": "IndexFlatIP",
            "metric": "cosine via L2-normalized inner product",
            "embedding_dimension": self.dimension,
            "row_count": len(self.mapping),
            "catalog_snapshot_sha256": sha256_file(catalog_path),
            "model_version": model_manifest["model_version"],
            "model_config_hash": model_manifest["config_hash"],
            "preprocessing": model_manifest["preprocessing"],
            "mapping_sha256": sha256_file(mapping_path),
            "index_sha256": sha256_file(index_path),
        }
        manifest["manifest_hash"] = canonical_json_hash(manifest)
        write_json(artifact_dir / "index-manifest.v1.json", manifest)
        return manifest


class IsolatedFaissFlatIPIndex:
    """FAISS lookup in a short-lived worker to avoid macOS PyTorch/libomp conflicts."""

    def __init__(self, artifact_dir: Path) -> None:
        self.artifact_dir = artifact_dir
        manifest = json.loads((artifact_dir / "index-manifest.v1.json").read_text(encoding="utf-8"))
        self.dimension = int(manifest["embedding_dimension"])
        self.mapping = read_jsonl(artifact_dir / "row-to-product.v1.jsonl")
        if len(self.mapping) != int(manifest["row_count"]):
            raise ValueError("Persisted isolated FAISS mapping row count mismatch")
        for expected_row, record in enumerate(self.mapping):
            if int(record["row"]) != expected_row:
                raise ValueError(f"Mapping row mismatch at {expected_row}")

    def search(self, query: np.ndarray, k: int) -> list[SearchHit]:
        vector = np.asarray(query, dtype=np.float32)
        if vector.ndim == 2:
            vector = vector[0]
        if vector.shape != (self.dimension,):
            raise ValueError(f"Query dimension {vector.shape} does not match index {self.dimension}")
        assert_unit_norm(vector[None, :], 1e-4)
        process = subprocess.run(
            [sys.executable, "-m", "ml.retrieval.faiss_worker", str(self.artifact_dir), str(k)],
            input=json.dumps(vector.tolist()),
            text=True,
            capture_output=True,
            check=True,
        )
        payload = json.loads(process.stdout)
        return [SearchHit(int(item["row"]), float(item["score"])) for item in payload]
