#!/usr/bin/env python3
"""Pure validation/determinism tests; no DB or external service."""
from __future__ import annotations

import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

MODULE = Path(__file__).with_name("import_brand_catalog.py")
spec = importlib.util.spec_from_file_location("brand_import", MODULE)
brand_import = importlib.util.module_from_spec(spec)
spec.loader.exec_module(brand_import)


def jpeg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0" + b"brand-test-image" + b"\xff\xd9"


def manifest_for(media: Path, sha: str) -> dict:
    return {
        "manifestId": "test-brand-v1",
        "brands": [{
            "slug": "nike", "name": "Nike", "country": "US",
            "officialUrl": "https://www.nike.com/",
            "logo": {"file": "logo.jpg", "sourceUrl": "https://example.test/logo", "sha256": sha},
        }],
        "products": [{
            "brandSlug": "nike", "model": "air-test-1", "name": "Nike Air Test 1",
            "categoryName": "Giày Sneaker", "description": "demo",
            "demoPriceVnd": 1990000, "sourceUrl": "https://example.test/p/1",
            "sourceSha256": sha,
            "media": [{"file": "product.jpg", "sourceUrl": "https://example.test/p/1.jpg", "sha256": sha}],
            "variants": [{"color": "Đen", "size": "42", "stock": 5, "barcode": "TEST-NIKE-42"}],
        }],
    }


def main() -> int:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        data = jpeg_bytes()
        (root / "logo.jpg").write_bytes(data)
        (root / "product.jpg").write_bytes(data)
        sha = hashlib.sha256(data).hexdigest()
        manifest = manifest_for(root, sha)
        validated = brand_import.validate_manifest(manifest, root)
        planned = brand_import.plan(validated)
        assert planned["counts"]["brands"] == 1 and planned["counts"]["products"] == 1 and planned["counts"]["variants"] == 1 and planned["counts"]["media"] == 1
        assert planned["products"][0]["media"][0]["targetFileName"].endswith(".jpg")
        assert brand_import.deterministic_name("nike", "air-test-1", sha, ".jpg") == brand_import.deterministic_name("nike", "air-test-1", sha, ".jpg")

        media_map = {(p["brandSlug"], p["model"]): p["media"] for p in planned["products"]}
        sql_seed = brand_import.build_sql(validated, media_map, False)
        assert "so_luong_vat_ly=EXCLUDED.so_luong_vat_ly" not in sql_seed
        assert "BEGIN;" in sql_seed and "COMMIT;" in sql_seed
        sql_update = brand_import.build_sql(validated, media_map, True)
        assert "so_luong_vat_ly=EXCLUDED.so_luong_vat_ly" in sql_update

        bad_hash = manifest_for(root, "0" * 64)
        try:
            brand_import.validate_manifest(bad_hash, root)
            raise AssertionError("hash mismatch was accepted")
        except brand_import.ImportError:
            pass

        duplicate = json.loads(json.dumps(manifest))
        duplicate["products"].append(json.loads(json.dumps(duplicate["products"][0])))
        try:
            brand_import.validate_manifest(duplicate, root)
            raise AssertionError("duplicate model was accepted")
        except brand_import.ImportError:
            pass

        unsafe = json.loads(json.dumps(manifest))
        unsafe["products"][0]["media"][0]["file"] = "../escape.jpg"
        try:
            brand_import.validate_manifest(unsafe, root)
            raise AssertionError("unsafe path was accepted")
        except brand_import.ImportError:
            pass

        # FE-shaped aliases: sourceHash, flat logo, null color.
        fe_manifest = {
            "manifestId": "fe-shape-test",
            "brands": [{
                "slug": "nike", "name": "Nike", "country": "US",
                "logoFile": "logo.jpg", "logoSourceUrl": "https://example.test/logo",
                "logoSourceSha256": sha,
            }],
            "products": [{
                "brandSlug": "nike", "model": "air-test-1", "name": "Nike Air Test 1",
                "categoryName": "Giày Sneaker", "description": "demo",
                "demoPriceVnd": 1990000, "sourceUrl": "https://example.test/p/1",
                "sourceHash": sha,
                "media": [{"file": "product.jpg", "sourceUrl": "https://example.test/p/1.jpg", "sha256": sha}],
                "variants": [{"color": None, "size": "42", "stock": 5, "barcode": "TEST-NIKE-42"}],
            }],
        }
        fe_validated = brand_import.validate_manifest(fe_manifest, root)
        assert fe_validated["products"][0]["variants"][0]["color"] is None
        fe_plan = brand_import.plan(fe_validated)
        assert fe_plan["counts"]["unknownColorVariants"] == 1
        fe_media = {(p["brandSlug"], p["model"]): p["media"] for p in fe_plan["products"]}
        assert "NULL" in brand_import.build_sql(fe_validated, fe_media, False)

        conflicting = json.loads(json.dumps(fe_manifest))
        conflicting["products"][0]["sourceSha256"] = "f" * 64
        try:
            brand_import.validate_manifest(conflicting, root)
            raise AssertionError("conflicting source hash aliases accepted")
        except brand_import.ImportError:
            pass

        missing = json.loads(json.dumps(fe_manifest))
        del missing["products"][0]["sourceHash"]
        try:
            brand_import.validate_manifest(missing, root)
            raise AssertionError("missing source hash accepted")
        except brand_import.ImportError:
            pass

        print("PASS: 12 brand import validation/determinism assertions; no DB or external service")


if __name__ == "__main__":
    raise SystemExit(main())
