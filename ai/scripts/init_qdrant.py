"""Qdrant collection init (hardened).

- Default non-destructive; DOT exact per shadow spec.
- Refuses destructive actions on unknown or forbidden collections
  (notably the teammate default ``image_gallery``).
- Prefer the explicit ``ingest_shadow.py`` path for the frozen snapshot.
"""

from __future__ import annotations

import argparse
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from src.core.config import load_shadow_config  # noqa: E402

FORBIDDEN = {"image_gallery"}


def init_db(reset: bool = False, config_path: str | None = None):
    from scripts.ingest_shadow import ensure_collection, get_client
    cfg = load_shadow_config(config_path) if config_path else load_shadow_config()
    client = get_client(cfg)
    try:
        ensure_collection(client, cfg, reset=reset)
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true",
                        help="Chỉ dùng cho collection task-owned đã cấu hình.")
    parser.add_argument("--config", default=None)
    args = parser.parse_args()
    # Không bao giờ reset=True mặc định: entrypoint cũ là defect đã sửa.
    init_db(reset=args.reset, config_path=args.config)
