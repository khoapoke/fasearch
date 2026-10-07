"""Configuration loading: cwd-independent, explicit, fail-closed.

Paths resolve from this file's location (``ai/src/core`` -> ``ai/`` root),
never from the process working directory. ``settings`` preserves the legacy
``database.yaml`` import for backward compatibility; new code should use
``load_shadow_config()``.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import yaml

# ai/src/core/config.py -> ai/ root
AI_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEGACY_CONFIG_PATH = os.path.join(AI_ROOT, "configs", "database.yaml")
SHADOW_CONFIG_PATH = os.path.join(AI_ROOT, "configs", "shadow.v1.yaml")


def load_config(path: str | None = None) -> dict[str, Any]:
    """Load a YAML config by explicit path (default: legacy database.yaml)."""
    cfg_path = path or os.environ.get("FASEARCH_AI_CONFIG", LEGACY_CONFIG_PATH)
    if not os.path.isfile(cfg_path):
        raise FileNotFoundError(f"Không tìm thấy file cấu hình tại {cfg_path}")
    with open(cfg_path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Cấu hình không hợp lệ tại {cfg_path}")
    return data


def ai_root() -> str:
    return AI_ROOT


# Named external asset root for the frozen week-4 publication (read-only).
# Overridable via FASEARCH_REPO_ROOT; the default is the canonical local
# checkout recorded in the task source pins.
DEFAULT_ASSET_ROOT = "/Users/khoado/Documents/ChatGPT/Graduate Bachelor"


def task_repo_root() -> str:
    root = os.environ.get("FASEARCH_REPO_ROOT", DEFAULT_ASSET_ROOT)
    marker = os.path.join(
        root, "artifacts/embeddings/week4-baseline-20260908-v1",
        "embeddings-manifest.v1.json")
    if not os.path.isfile(marker):
        raise FileNotFoundError(
            "Thiếu frozen publication manifest; đặt FASEARCH_REPO_ROOT "
            f"tới checkout chứa nó (thử {root}).")
    return root


def resolve_under_ai_root(relative: str) -> str:
    """Resolve a repo-relative asset path under the ai/ tree root."""
    candidate = os.path.normpath(os.path.join(AI_ROOT, relative))
    if candidate != AI_ROOT and not candidate.startswith(AI_ROOT + os.sep):
        raise ValueError(f"Đường dẫn tài sản ngoài phạm vi ai/: {relative!r}")
    return candidate


@lru_cache(maxsize=2)
def load_shadow_config(path: str | None = None) -> dict[str, Any]:
    """Load the shadow experiment config (cached; cwd-independent)."""
    cfg_path = path or os.environ.get("FASEARCH_SHADOW_CONFIG", SHADOW_CONFIG_PATH)
    if not os.path.isfile(cfg_path):
        raise FileNotFoundError(f"Không tìm thấy shadow config tại {cfg_path}")
    with open(cfg_path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict) or data.get("schema_version") != "1.0.0":
        raise ValueError(f"Shadow config không đúng schema 1.0.0: {cfg_path}")
    return data


# Biến global lưu trữ cấu hình legacy để import vào các file khác.
settings = load_config()
