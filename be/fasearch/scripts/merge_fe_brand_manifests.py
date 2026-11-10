#!/usr/bin/env python3
"""Merge FE-owned brand + product manifests into a validated normalized manifest.

FE files are read-only. The normalized manifest is written outside Git and is the
only input to the guarded importer. Missing logos/official URLs are preserved as
null; no fake URL or color is invented.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_brand_catalog as importer  # noqa: E402


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def slugify(name: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    if not value:
        raise importer.ImportError(f"cannot derive brand slug from {name!r}")
    return value


def logo_fields(entry: dict) -> dict | None:
    if not entry.get("logoFile"):
        return None
    return {
        "file": Path(str(entry["logoFile"])).name,
        "sourceUrl": entry.get("logoSourceUrl"),
        "sha256": entry.get("logoSourceSha256"),
    }


def merge(brand_manifest: dict, product_manifest: dict) -> dict:
    if not isinstance(brand_manifest, dict) or not isinstance(product_manifest, dict):
        raise importer.ImportError("both manifests must be objects")
    for manifest, keys in ((brand_manifest, ("manifestId", "brandsWithLogo")),
                           (product_manifest, ("manifestId", "brands", "products"))):
        for key in keys:
            if key not in manifest:
                raise importer.ImportError(f"manifest missing {key}")
    brands: dict[str, dict] = {}

    def add_brand(entry: dict, source: str) -> None:
        name = entry.get("name") or entry.get("brand")
        slug = entry.get("slug") or slugify(name or "")
        if not isinstance(slug, str) or not importer.SAFE_SLUG.match(slug):
            raise importer.ImportError(f"{source}: invalid brand slug {slug!r}")
        if not isinstance(name, str) or not name.strip():
            raise importer.ImportError(f"{source}: brand {slug} missing name")
        current = brands.get(slug)
        if current is None:
            brands[slug] = {
                "slug": slug, "name": name.strip(), "country": entry.get("country"),
                "officialUrl": entry.get("officialUrl"), "logo": logo_fields(entry),
                "provenanceUrl": entry.get("logoSourcePage") or entry.get("logoSourceUrl"),
                "provenanceSha256": entry.get("logoSourceSha256"),
            }
            return
        if current["name"] != name.strip():
            raise importer.ImportError(f"brand {slug} name conflict between manifests")
        if entry.get("officialUrl"):
            if current["officialUrl"] and current["officialUrl"] != entry["officialUrl"]:
                raise importer.ImportError(f"brand {slug} officialUrl conflict between manifests")
            current["officialUrl"] = entry["officialUrl"]
        if entry.get("country") and not current["country"]:
            current["country"] = entry["country"]
        incoming = logo_fields(entry)
        if incoming:
            if current["logo"] and (current["logo"]["file"] != incoming["file"]
                                    or current["logo"]["sourceUrl"] != incoming["sourceUrl"]
                                    or current["logo"]["sha256"] != incoming["sha256"]):
                raise importer.ImportError(f"brand {slug} logo conflict between manifests")
            current["logo"] = current["logo"] or incoming
            current["provenanceUrl"] = current["provenanceUrl"] or entry.get("logoSourcePage") or incoming["sourceUrl"]
            current["provenanceSha256"] = current["provenanceSha256"] or incoming["sha256"]

    for entry in product_manifest.get("brands", []):
        add_brand(entry, "product manifest")
    for entry in brand_manifest.get("brandsWithLogo", []):
        add_brand(entry, "brand manifest")
    for entry in list(product_manifest.get("brandsTextOnly", [])) + list(brand_manifest.get("brandsPendingLogo", [])):
        name = entry.get("name") or entry.get("brand")
        slug = slugify(name or "")
        if slug in brands:
            if brands[slug]["name"] != name.strip():
                raise importer.ImportError(f"text-only brand {slug} name conflict")
            if entry.get("officialUrl"):
                if brands[slug]["officialUrl"] and brands[slug]["officialUrl"] != entry["officialUrl"]:
                    raise importer.ImportError(f"brand {slug} officialUrl conflict between manifests")
                brands[slug]["officialUrl"] = entry["officialUrl"]
            if entry.get("country") and not brands[slug]["country"]:
                brands[slug]["country"] = entry["country"]
            continue
        brands[slug] = {"slug": slug, "name": name.strip(), "country": entry.get("country"),
                        "officialUrl": entry.get("officialUrl"), "logo": None, "provenanceUrl": None, "provenanceSha256": None}

    products = []
    for product in product_manifest["products"]:
        brand_slug = product.get("brandSlug")
        if brand_slug not in brands:
            raise importer.ImportError(f"product references unknown brand {brand_slug!r}")
        source_sha = product.get("sourceSha256")
        source_hash = product.get("sourceHash")
        if source_sha is not None and source_hash is not None and source_sha != source_hash:
            raise importer.ImportError(f"product {brand_slug}/{product.get('model')} conflicting source hashes")
        source_sha = source_sha or source_hash
        if not isinstance(source_sha, str) or not importer.HEX64.match(source_sha):
            raise importer.ImportError(f"product {brand_slug}/{product.get('model')} missing source hash")
        products.append({
            "brandSlug": brand_slug, "model": product.get("model"), "name": product.get("name"),
            "categoryName": product.get("categoryName"), "description": product.get("description"),
            "demoPriceVnd": product.get("demoPriceVnd"), "sourceUrl": product.get("sourceUrl"),
            "sourceSha256": source_sha, "media": product.get("media"),
            "variants": product.get("variants"), "material": product.get("material"),
            "style": product.get("style"),
        })
    return {
        "manifestId": "brand-catalog-fe-merged-v1",
        "revision": product_manifest.get("revision"),
        "sourceManifests": {
            "brands": {"path": str(brand_manifest.get("_path", "")), "sha256": brand_manifest.get("_sha256"),
                       "manifestId": brand_manifest.get("manifestId"), "revision": brand_manifest.get("revision")},
            "products": {"path": str(product_manifest.get("_path", "")), "sha256": product_manifest.get("_sha256"),
                         "manifestId": product_manifest.get("manifestId"), "revision": product_manifest.get("revision")},
        },
        "brands": sorted(brands.values(), key=lambda b: b["slug"]),
        "products": products,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--brands", required=True)
    parser.add_argument("--products", required=True)
    parser.add_argument("--logo-root", required=True)
    parser.add_argument("--media-root", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    brand_path, product_path = Path(args.brands), Path(args.products)
    brand_manifest = json.loads(brand_path.read_text(encoding="utf-8"))
    product_manifest = json.loads(product_path.read_text(encoding="utf-8"))
    brand_manifest["_path"], brand_manifest["_sha256"] = str(brand_path), sha(brand_path)
    product_manifest["_path"], product_manifest["_sha256"] = str(product_path), sha(product_path)
    normalized = merge(brand_manifest, product_manifest)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out.chmod(0o600)
    normalized_sha = sha(out)
    validated = importer.validate_manifest(normalized, Path(args.media_root), Path(args.logo_root))
    summary = importer.plan(validated)
    summary["normalizedManifest"] = str(out)
    summary["normalizedManifestSha256"] = normalized_sha
    summary["sourceManifests"] = normalized["sourceManifests"]
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except importer.ImportError as error:
        print(json.dumps({"status": "REJECTED", "reason": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
