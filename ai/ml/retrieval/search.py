from __future__ import annotations

import time
import unicodedata
from pathlib import Path
from typing import Any

import numpy as np

from .encoders import MultimodalEncoder
from .utils import l2_normalize
from .vector_index import FaissFlatIPIndex


def normalized_model_view(raw_text: str) -> str:
    """Conservative model view: NFC plus whitespace only; raw text remains preserved."""
    return " ".join(unicodedata.normalize("NFC", raw_text).split())


class SearchEngine:
    def __init__(
        self,
        encoder: MultimodalEncoder,
        index: FaissFlatIPIndex,
        index_manifest: dict[str, Any],
    ) -> None:
        self.encoder = encoder
        self.index = index
        self.index_manifest = index_manifest
        if encoder.dimension != index.dimension:
            raise ValueError("Encoder and index dimensions differ")
        if index_manifest["model_config_hash"] != encoder.manifest["config_hash"]:
            raise ValueError("Index was built from a different model/preprocessing configuration")

    def search_text(self, raw_text: str, k: int = 10) -> dict[str, Any]:
        started = time.perf_counter()
        model_view = normalized_model_view(raw_text)
        query = self.encoder.encode_texts([model_view])[0]
        results = self._rank(query, k, None)
        latency = (time.perf_counter() - started) * 1000.0
        return self._response("TEXT", results, latency, raw_text=raw_text, normalized_text=model_view)

    def search_image(
        self,
        image_path: Path,
        k: int = 10,
        exclude_product_id: str | None = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        query = self.encoder.encode_images([image_path])[0]
        results = self._rank(query, k, exclude_product_id)
        latency = (time.perf_counter() - started) * 1000.0
        return self._response("IMAGE", results, latency, image_path=str(image_path))

    def search_composed(
        self,
        image_path: Path,
        raw_text: str,
        k: int = 10,
        exclude_product_id: str | None = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        model_view = normalized_model_view(raw_text)
        image_vector = self.encoder.encode_images([image_path])[0]
        text_vector = self.encoder.encode_texts([model_view])[0]
        query = l2_normalize(0.5 * image_vector + 0.5 * text_vector)[0]
        results = self._rank(query, k, exclude_product_id)
        latency = (time.perf_counter() - started) * 1000.0
        return self._response(
            "COMPOSED",
            results,
            latency,
            image_path=str(image_path),
            raw_text=raw_text,
            normalized_text=model_view,
            fusion={"image_weight": 0.5, "text_weight": 0.5, "normalization": "L2"},
        )

    def _rank(
        self,
        query: np.ndarray,
        k: int,
        exclude_product_id: str | None,
    ) -> list[dict[str, Any]]:
        requested = k + 1 if exclude_product_id else k
        hits = self.index.search(query, requested)
        results: list[dict[str, Any]] = []
        for hit in hits:
            product = self.index.mapping[hit.row]
            if exclude_product_id and str(product["product_id"]) == str(exclude_product_id):
                continue
            results.append(
                {
                    "product_id": product["product_id"],
                    "product_version_id": product["product_version_id"],
                    "rank": len(results) + 1,
                    "similarity_score": hit.score,
                    "image_path": product["image_path"],
                    "product_title": product["title"],
                    "mapped_category": product["category"],
                    "model_version": self.encoder.manifest["model_version"],
                    "index_version": self.index_manifest["index_version"],
                }
            )
            if len(results) == k:
                break
        return results

    def _response(self, mode: str, results: list[dict[str, Any]], latency_ms: float, **query: Any) -> dict[str, Any]:
        for result in results:
            result["latency_ms"] = latency_ms
        return {
            "mode": mode,
            "query": query,
            "results": results,
            "model_version": self.encoder.manifest["model_version"],
            "index_version": self.index_manifest["index_version"],
            "latency_ms": latency_ms,
            "pilot_only": True,
        }
