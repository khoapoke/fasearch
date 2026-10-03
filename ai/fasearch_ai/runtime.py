from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from ml.retrieval.pipeline import load_engine

from .module import (
    ComposedSearchModule,
    ImageSearchModule,
    IndexUnavailableError,
    ModelUnavailableError,
    RetrievalComposedSearchModule,
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


def _engine_settings() -> tuple[Path, Path, str, str | None]:
    config_path = _resolve_path("FASEARCH_CONFIG_PATH", AI_ROOT / "configs/baseline.v1.yaml")
    index_dir = _resolve_path(
        "FASEARCH_INDEX_DIR",
        AI_ROOT / "artifacts/indexes/week4-baseline-20260908-v1",
    )
    encoder_kind = os.environ.get("FASEARCH_ENCODER", "hf_clip")
    snapshot_override = os.environ.get("FASEARCH_CATALOG_SNAPSHOT_ID")
    return config_path, index_dir, encoder_kind, snapshot_override


@lru_cache(maxsize=8)
def _cached_engine_bundle(
    config_path: Path,
    index_dir: Path,
    encoder_kind: str,
    snapshot_override: str | None,
) -> tuple[Any, str]:
    """Load the retrieval engine once per resolved settings key.

    Both search modules share one engine; the key includes every environment
    input so overrides (used by tests) never read a stale bundle.
    """
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
    catalog_snapshot_id = snapshot_override or f"sha256:{manifest['catalog_snapshot_sha256']}"
    return engine, catalog_snapshot_id


@lru_cache(maxsize=1)
def get_image_search_module() -> ImageSearchModule:
    engine, catalog_snapshot_id = _cached_engine_bundle(*_engine_settings())
    return RetrievalImageSearchModule(engine, catalog_snapshot_id)


@lru_cache(maxsize=1)
def get_composed_search_module() -> ComposedSearchModule:
    engine, catalog_snapshot_id = _cached_engine_bundle(*_engine_settings())
    return RetrievalComposedSearchModule(engine, catalog_snapshot_id)


def provide_image_search_module() -> ImageSearchModule:
    return get_image_search_module()


def provide_composed_search_module() -> ComposedSearchModule:
    return get_composed_search_module()
