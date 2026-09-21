from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from ml.retrieval.pipeline import load_engine

from .module import (
    ImageSearchModule,
    IndexUnavailableError,
    ModelUnavailableError,
    RetrievalImageSearchModule,
)


AI_ROOT = Path(__file__).resolve().parents[1]


def _resolve_path(env_name: str, default: Path) -> Path:
    configured = Path(os.environ.get(env_name, str(default)))
    return configured if configured.is_absolute() else AI_ROOT / configured


def _load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        payload = yaml.safe_load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected an object in {path}")
    return payload


@lru_cache(maxsize=1)
def get_image_search_module() -> ImageSearchModule:
    config_path = _resolve_path("FASEARCH_CONFIG_PATH", AI_ROOT / "configs/baseline.v1.yaml")
    index_dir = _resolve_path(
        "FASEARCH_INDEX_DIR",
        AI_ROOT / "artifacts/indexes/week4-baseline-20260908-v1",
    )
    encoder_kind = os.environ.get("FASEARCH_ENCODER", "hf_clip")
    if not config_path.is_file():
        raise ModelUnavailableError("Configured model settings are unavailable")
    if not (index_dir / "index-manifest.v1.json").is_file():
        raise IndexUnavailableError("Configured index publication is unavailable")
    try:
        config = _load_yaml(config_path)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        raise ModelUnavailableError("Configured model settings cannot be loaded") from exc
    try:
        manifest = json.loads(
            (index_dir / "index-manifest.v1.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError, KeyError) as exc:
        raise IndexUnavailableError("Configured index publication is invalid") from exc
    try:
        engine = load_engine(config, encoder_kind, index_dir)
    except (FileNotFoundError, json.JSONDecodeError, KeyError, ValueError) as exc:
        raise IndexUnavailableError("Configured index publication is incomplete or incompatible") from exc
    except RuntimeError as exc:
        raise ModelUnavailableError("Configured model cannot be loaded") from exc
    catalog_snapshot_id = os.environ.get(
        "FASEARCH_CATALOG_SNAPSHOT_ID",
        f"sha256:{manifest['catalog_snapshot_sha256']}",
    )
    return RetrievalImageSearchModule(engine, catalog_snapshot_id)


def provide_image_search_module() -> ImageSearchModule:
    return get_image_search_module()
