#!/usr/bin/env python3
"""Dry-run regression against the actual FE brand/product manifests."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
FE = Path("/home/dolakhoa/projects/fasearch-migration/fasearch/.agent/tasks/brand-catalog-payments-sandbox/live/fe")
LOGO_ROOT = Path("/home/dolakhoa/projects/fasearch-migration/worktrees/brand-catalog-payments-fe/fe/public/brands")
MEDIA_ROOT = Path("/home/dolakhoa/projects/fasearch-migration/runtime/private/brand-catalog-payments/media")


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="fe-manifest-dryrun-") as tmp:
        out = Path(tmp) / "merged.json"
        result = subprocess.run([
            sys.executable, str(SCRIPT_DIR / "merge_fe_brand_manifests.py"),
            "--brands", str(FE / "BRAND-ASSET-MANIFEST.json"),
            "--products", str(FE / "PRODUCT-MEDIA-MANIFEST.json"),
            "--logo-root", str(LOGO_ROOT), "--media-root", str(MEDIA_ROOT),
            "--out", str(out),
        ], capture_output=True, text=True, check=False)
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            return 1
        summary = json.loads(result.stdout)
        counts = summary["counts"]
        logos = sum(1 for b in summary["brands"] if b.get("logoFileName"))
        assert counts["products"] == 16, counts
        assert counts["brands"] == 14, counts
        assert counts["variants"] == 46, counts
        assert counts["media"] == 16, counts
        assert counts["unknownColorVariants"] == 46, counts
        assert logos == 8, logos
        assert len(summary["normalizedManifestSha256"]) == 64
        print(json.dumps({"result": "PASS", "counts": counts, "logos": logos,
                          "normalizedManifestSha256": summary["normalizedManifestSha256"]}, ensure_ascii=False))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
