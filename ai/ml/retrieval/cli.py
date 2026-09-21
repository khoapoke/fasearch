from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("HF_HOME", str(PROJECT_ROOT / ".cache/huggingface"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from .catalog import prepare_catalog
from .fixtures import create_dataset_a_fixture
from .pipeline import build_index, create_encoder, encode_catalog, load_engine, run_pilot_evaluation
from .utils import write_json


WEEK4_BUNDLE_ID = "week4-baseline-20260908-v1"
WEEK4_CATALOG_ID = "catalog-20260908-pilot-v1"


def _path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path


def _load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Week 4 multimodal fashion search baseline")
    parser.add_argument("--config", default="configs/baseline.v1.yaml")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fixture = subparsers.add_parser("fixture", help="Generate the 30-product offline Dataset A fixture")
    fixture.add_argument("--raw-dir", default="data/fixtures/generated/dataset_a")

    prepare = subparsers.add_parser("prepare", help="Join, audit, filter and sample Dataset A")
    prepare.add_argument("--raw-dir", default="data/raw/dataset_a")
    prepare.add_argument("--output-dir", default=f"data/processed/{WEEK4_CATALOG_ID}")
    prepare.add_argument("--pilot-size", type=int, default=None)
    prepare.add_argument("--snapshot-version", default=WEEK4_CATALOG_ID)

    encode = subparsers.add_parser("encode", help="Encode catalog images")
    encode.add_argument("--catalog", default=f"data/processed/{WEEK4_CATALOG_ID}/catalog.cleaned.v1.jsonl")
    encode.add_argument("--output-dir", default=f"artifacts/embeddings/{WEEK4_BUNDLE_ID}")
    encode.add_argument("--encoder", choices=("hf_clip", "fixture"), default="hf_clip")

    index = subparsers.add_parser("build-index", help="Build exact FAISS IndexFlatIP")
    index.add_argument("--catalog", default=f"data/processed/{WEEK4_CATALOG_ID}/catalog.cleaned.v1.jsonl")
    index.add_argument("--embeddings-dir", default=f"artifacts/embeddings/{WEEK4_BUNDLE_ID}")
    index.add_argument("--output-dir", default=f"artifacts/indexes/{WEEK4_BUNDLE_ID}")

    search = subparsers.add_parser("search", help="Run one text, image, or composed query")
    search.add_argument("--index-dir", default=f"artifacts/indexes/{WEEK4_BUNDLE_ID}")
    search.add_argument("--encoder", choices=("hf_clip", "fixture"), default="hf_clip")
    search.add_argument("--mode", choices=("text", "image", "composed"), required=True)
    search.add_argument("--text")
    search.add_argument("--image")
    search.add_argument("--exclude-product-id")
    search.add_argument("--top-k", type=int, default=10)

    evaluate = subparsers.add_parser("evaluate", help="Run the versioned pilot query set")
    evaluate.add_argument("--catalog", default=f"data/processed/{WEEK4_CATALOG_ID}/catalog.cleaned.v1.jsonl")
    evaluate.add_argument("--index-dir", default=f"artifacts/indexes/{WEEK4_BUNDLE_ID}")
    evaluate.add_argument("--queries", default="evaluation/pilot_queries.v1.jsonl")
    evaluate.add_argument("--output-dir", default=f"artifacts/reports/{WEEK4_BUNDLE_ID}")
    evaluate.add_argument("--encoder", choices=("hf_clip", "fixture"), default="hf_clip")

    smoke = subparsers.add_parser("smoke", help="Run the full offline CPU fixture vertical slice")
    smoke.add_argument("--work-dir", default="artifacts/smoke/week4-v1")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    config = _load_config(_path(args.config))
    seed = int(config.get("seed", 42))

    if args.command == "fixture":
        result = create_dataset_a_fixture(_path(args.raw_dir))
        print(json.dumps({"fixture_styles": str(result)}, ensure_ascii=False, indent=2))
        return 0
    if args.command == "prepare":
        size = args.pilot_size or int(config["dataset"]["pilot_size"])
        result = prepare_catalog(
            _path(args.raw_dir), _path(args.output_dir), size, seed, args.snapshot_version
        )
        print(json.dumps({
            "catalog": str(result.catalog_path), "catalog_sha256": result.catalog_hash,
            "product_count": result.product_count, "cleaning_report": str(result.report_path),
            "raw_manifest": str(result.raw_manifest_path), "gallery": str(result.gallery_path),
        }, ensure_ascii=False, indent=2))
        return 0
    if args.command == "encode":
        encoder = create_encoder(args.encoder, config)
        result = encode_catalog(_path(args.catalog), _path(args.output_dir), encoder)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.command == "build-index":
        result = build_index(
            _path(args.catalog), _path(args.embeddings_dir), _path(args.output_dir),
            str(config["index"]["version"]),
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.command == "search":
        engine = load_engine(config, args.encoder, _path(args.index_dir))
        if args.mode == "text":
            if not args.text:
                raise SystemExit("--text is required for text mode")
            result = engine.search_text(args.text, args.top_k)
        elif args.mode == "image":
            if not args.image:
                raise SystemExit("--image is required for image mode")
            result = engine.search_image(_path(args.image), args.top_k, args.exclude_product_id)
        else:
            if not args.image or not args.text:
                raise SystemExit("--image and --text are required for composed mode")
            result = engine.search_composed(
                _path(args.image), args.text, args.top_k, args.exclude_product_id
            )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.command == "evaluate":
        engine = load_engine(config, args.encoder, _path(args.index_dir))
        result = run_pilot_evaluation(
            engine, _path(args.queries), _path(args.catalog), _path(args.output_dir)
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    if args.command == "smoke":
        work_dir = _path(args.work_dir)
        fixture_dir = PROJECT_ROOT / "data/fixtures/generated/dataset_a"
        processed_dir = work_dir / "processed"
        embeddings_dir = work_dir / "embeddings"
        index_dir = work_dir / "index"
        report_dir = work_dir / "reports"
        create_dataset_a_fixture(fixture_dir)
        catalog = prepare_catalog(
            fixture_dir, processed_dir, pilot_size=30, seed=seed,
            snapshot_version="catalog-fixture-20260908-v1",
        )
        encoder = create_encoder("fixture", config)
        encode_catalog(catalog.catalog_path, embeddings_dir, encoder)
        build_index(
            catalog.catalog_path, embeddings_dir, index_dir,
            "faiss-flatip-fixture-week4-v1",
        )
        engine = load_engine(config, "fixture", index_dir)
        metrics = run_pilot_evaluation(
            engine, PROJECT_ROOT / "evaluation/pilot_queries.v1.jsonl",
            catalog.catalog_path, report_dir,
        )
        summary = {
            "status": "PASS",
            "scope": "offline fixture plumbing only",
            "scientific_claim_allowed": False,
            "catalog_count": catalog.product_count,
            "catalog_sha256": catalog.catalog_hash,
            "model_version": engine.encoder.manifest["model_version"],
            "index_version": engine.index_manifest["index_version"],
            "metrics": metrics,
        }
        write_json(work_dir / "smoke-summary.v1.json", summary)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0
    raise AssertionError("unreachable")


if __name__ == "__main__":
    raise SystemExit(main())
