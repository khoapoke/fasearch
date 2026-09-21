from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np

from .encoders import FixtureEncoder, HFClipEncoder, MultimodalEncoder
from .metrics import evaluate_queries
from .search import SearchEngine
from .utils import canonical_json_hash, read_jsonl, sha256_file, write_json, write_jsonl
from .vector_index import FaissFlatIPIndex, IsolatedFaissFlatIPIndex


def create_encoder(kind: str, config: dict[str, Any]) -> MultimodalEncoder:
    model = config.get("model", {})
    reproducibility = config.get("reproducibility", {})
    if kind == "fixture":
        return FixtureEncoder(float(reproducibility.get("norm_tolerance", 1e-4)))
    if kind == "hf_clip":
        return HFClipEncoder(
            model_id=model["model_id"],
            revision=model["revision"],
            device=os.environ.get("FASHION_SEARCH_DEVICE", model.get("device", "cpu")),
            precision=os.environ.get("FASHION_SEARCH_PRECISION", model.get("precision", "float32")),
            batch_size=int(model.get("batch_size", 16)),
            norm_tolerance=float(reproducibility.get("norm_tolerance", 1e-4)),
        )
    raise ValueError(f"Unknown encoder kind: {kind}")


def encode_catalog(
    catalog_path: Path,
    artifact_dir: Path,
    encoder: MultimodalEncoder,
) -> dict[str, Any]:
    catalog = read_jsonl(catalog_path)
    if not catalog:
        raise ValueError("Catalog is empty")
    image_paths = [Path(str(item["image_path"])) for item in catalog]
    embeddings = encoder.encode_images(image_paths)
    if embeddings.shape != (len(catalog), encoder.dimension):
        raise AssertionError("Unexpected embedding shape")
    artifact_dir.mkdir(parents=True, exist_ok=True)
    embeddings_path = artifact_dir / "catalog-image-embeddings.v1.npy"
    np.save(embeddings_path, embeddings, allow_pickle=False)
    mapping = [
        {
            "row": row,
            "product_id": item["product_id"],
            "product_version_id": item["product_version_id"],
            "product_group_id": item["product_group_id"],
            "image_path": item["image_path"],
            "title": item["title"],
            "category": item["category"],
        }
        for row, item in enumerate(catalog)
    ]
    mapping_path = artifact_dir / "embedding-row-to-product.v1.jsonl"
    write_jsonl(mapping_path, mapping)
    model_manifest_path = artifact_dir / "model-manifest.v1.json"
    write_json(model_manifest_path, encoder.manifest)
    manifest = {
        "schema_version": "1.0.0",
        "artifact_version": "catalog-image-embeddings-v1",
        "catalog_sha256": sha256_file(catalog_path),
        "embedding_sha256": sha256_file(embeddings_path),
        "mapping_sha256": sha256_file(mapping_path),
        "model_version": encoder.manifest["model_version"],
        "model_config_hash": encoder.manifest["config_hash"],
        "embedding_dimension": encoder.dimension,
        "row_count": len(mapping),
        "normalization": "L2",
    }
    manifest["manifest_hash"] = canonical_json_hash(manifest)
    write_json(artifact_dir / "embeddings-manifest.v1.json", manifest)
    return manifest


def build_index(
    catalog_path: Path,
    embeddings_dir: Path,
    index_dir: Path,
    index_version: str,
) -> dict[str, Any]:
    embeddings = np.load(embeddings_dir / "catalog-image-embeddings.v1.npy", allow_pickle=False)
    mapping = read_jsonl(embeddings_dir / "embedding-row-to-product.v1.jsonl")
    model_manifest = json.loads((embeddings_dir / "model-manifest.v1.json").read_text(encoding="utf-8"))
    index = FaissFlatIPIndex.build(embeddings, mapping)
    return index.save(index_dir, catalog_path, model_manifest, index_version)


def load_engine(config: dict[str, Any], encoder_kind: str, index_dir: Path) -> SearchEngine:
    encoder = create_encoder(encoder_kind, config)
    # macOS wheels for PyTorch and FAISS may carry incompatible libomp runtimes.
    # The scientific encoder/index stay unchanged; only the process boundary differs.
    index = (
        IsolatedFaissFlatIPIndex(index_dir)
        if encoder_kind == "hf_clip"
        else FaissFlatIPIndex.load(index_dir)
    )
    manifest = json.loads((index_dir / "index-manifest.v1.json").read_text(encoding="utf-8"))
    return SearchEngine(encoder, index, manifest)


def run_pilot_evaluation(
    engine: SearchEngine,
    query_path: Path,
    catalog_path: Path,
    output_dir: Path,
    ks: tuple[int, ...] = (1, 5, 10),
) -> dict[str, Any]:
    catalog = read_jsonl(catalog_path)
    by_id = {str(item["product_id"]): item for item in catalog}
    queries = read_jsonl(query_path)
    outputs: list[dict[str, Any]] = []
    qrels: dict[str, dict[str, int]] = {}
    targets: dict[str, str | None] = {}

    for query in queries:
        mode = query["mode"]
        image_reference = query.get("image_reference")
        exclude_product_id = query.get("exclude_product_id")
        if image_reference and image_reference.startswith("product:"):
            image_product_id = image_reference.split(":", 1)[1]
            image_path = Path(str(by_id[image_product_id]["image_path"]))
        elif image_reference:
            image_path = Path(image_reference)
        else:
            image_path = None
        if mode == "TEXT":
            response = engine.search_text(query["raw_text"], k=max(ks))
        elif mode == "IMAGE":
            assert image_path is not None
            response = engine.search_image(image_path, k=max(ks), exclude_product_id=exclude_product_id)
        elif mode == "COMPOSED":
            assert image_path is not None
            response = engine.search_composed(
                image_path,
                query["raw_text"],
                k=max(ks),
                exclude_product_id=exclude_product_id,
            )
        else:
            raise ValueError(f"Unsupported query mode: {mode}")
        response["query_id"] = query["query_id"]
        outputs.append(response)
        targets[query["query_id"]] = query.get("designated_target_product_id")
        expected_category = query.get("expected_category")
        expected_color = query.get("expected_attribute", {}).get("base_colour")
        synthetic_grades: dict[str, int] = {}
        for product_id, product in by_id.items():
            category_match = not expected_category or product["category"] == expected_category
            color_match = not expected_color or str(product.get("base_colour", "")).lower() == expected_color.lower()
            if category_match and color_match:
                synthetic_grades[product_id] = 3
            elif category_match:
                synthetic_grades[product_id] = 1
        qrels[query["query_id"]] = synthetic_grades

    metric_payload = evaluate_queries(outputs, qrels, targets, ks)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(output_dir / "per-query-results.v1.jsonl", outputs)
    write_json(output_dir / "pilot-metrics.v1.json", metric_payload)
    _write_report(output_dir / "pilot-report.v1.md", metric_payload, outputs, queries, engine)
    return metric_payload


def _write_report(
    path: Path,
    metrics: dict[str, Any],
    outputs: list[dict[str, Any]],
    queries: list[dict[str, Any]],
    engine: SearchEngine,
) -> None:
    query_map = {query["query_id"]: query for query in queries}
    per_query = sorted(
        metrics["per_query"],
        key=lambda row: (row.get("target_recall@10", 0.0), row.get("mrr_relaxed@10", 0.0)),
        reverse=True,
    )
    successes = per_query[:5]
    failures = sorted(per_query, key=lambda row: (row.get("target_recall@10", 0.0), row.get("mrr_relaxed@10", 0.0)))[:5]
    label_note = (
        "Synthetic fixture qrels validate plumbing only"
        if engine.encoder.manifest["adapter"] == "fixture_encoder"
        else "Weak metadata-derived pilot labels validate the real CLIP run"
    )
    lines = [
        "# Week 4 pilot evaluation report v1",
        "",
        f"> PILOT ONLY. {label_note}; this is not a final benchmark or a model-quality claim.",
        "",
        "## Model and index",
        "",
        f"- Model: `{engine.encoder.manifest['model_version']}`",
        f"- Adapter: `{engine.encoder.manifest['adapter']}`",
        f"- Dimension: `{engine.encoder.dimension}`",
        f"- Index: `{engine.index_manifest['index_version']}` (`IndexFlatIP`)",
        "- Fusion: `L2Norm(0.5 * image + 0.5 * text)`",
        "- K: `1, 5, 10`",
        "",
        "## Aggregate metrics",
        "",
    ]
    for name, value in metrics["overall"].items():
        lines.append(f"- {name}: {value:.4f}")
    lines.extend(["", "## Metrics by search mode", ""])
    for mode, values in metrics["by_mode"].items():
        lines.append(f"### {mode}")
        lines.append("")
        for name, value in values.items():
            lines.append(f"- {name}: {value:.4f}")
        lines.append("")
    lines.extend([
        "## End-to-end latency",
        "",
        f"- p50: {metrics['latency']['p50_ms']:.3f} ms",
        f"- p95: {metrics['latency']['p95_ms']:.3f} ms",
        "",
        "## Five strongest plumbing cases",
        "",
    ])
    for row in successes:
        query = query_map[row["query_id"]]
        lines.append(f"- `{row['query_id']}` ({row['mode']}): {query.get('raw_text') or query.get('image_reference')} — target_recall@10={row['target_recall@10']:.0f}")
    lines.extend(["", "## Five failure/weakest cases", ""])
    for row in failures:
        query = query_map[row["query_id"]]
        lines.append(f"- `{row['query_id']}` ({row['mode']}): {query.get('raw_text') or query.get('image_reference')} — target_recall@10={row['target_recall@10']:.0f}; inspect ranked IDs in per-query output.")
    lines.extend([
        "",
        "## Limitations",
        "",
        "- Queries and relevance labels are pilot-only and cannot enter the frozen final test.",
        "- Relevance grades are weak category/color labels, not independent human judgments.",
        "- Exact self-retrieval is excluded from image/composed pilot queries; a distinct variant is the target.",
        "- Product titles are retained only as returned catalog metadata and are not copied into pilot text queries.",
        "- Negation is represented in the query set but a frozen dense CLIP baseline is not expected to enforce hard logical constraints.",
        "- Scientific claims require Dataset A or another accepted catalog, a real frozen model, independently authored judgments, and pooled qrels.",
    ])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
