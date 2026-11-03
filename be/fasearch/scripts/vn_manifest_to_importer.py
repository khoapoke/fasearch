#!/usr/bin/env python3
"""Convert the FE-owned VN staging manifest into the guarded importer shape.

Read-only on the staged manifest/media. Never invents colour, size, price or availability:
unknown option values stay unknown (`Không xác định`) and source price is kept as a snapshot.
The demo VND price is deterministic (median source price rounded up to 10.000 VND) and is
explicitly a demo value, not a converted or official price.

Usage: vn_manifest_to_importer.py --manifest <VN-PRODUCT-MEDIA-MANIFEST.json> \
       --raw-dir <vn-staging/raw> --media-root <vn-media> --out <manifest> [--media-dir <dir>]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

UNKNOWN = "Không xác định"
DEFAULT_DEMO_PRICE = 399_000
RAW_PREFIX = "vn-payloads/"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def classify(option_name: str) -> str | None:
    low = (option_name or "").lower()
    if any(key in low for key in ("màu", "mau", "color")):
        return "color"
    if any(key in low for key in ("kích", "kich", "size", "cỡ", "co")):
        return "size"
    return None


def demo_price(variants: list[dict]) -> int:
    prices = sorted(float(v["sourcePrice"]) for v in variants
                    if isinstance(v.get("sourcePrice"), (int, float)) and v["sourcePrice"] > 0)
    if not prices:
        return DEFAULT_DEMO_PRICE
    median = prices[len(prices) // 2]
    return max(99_000, int(-(-median // 10_000) * 10_000))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--raw-dir", required=True)
    parser.add_argument("--media-root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--media-dir", default=None, help="copy media here for the importer")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    raw_dir = Path(args.raw_dir)
    media_root = Path(args.media_root)
    media_dir = Path(args.media_dir) if args.media_dir else None
    if media_dir:
        media_dir.mkdir(parents=True, exist_ok=True)
        media_dir.chmod(0o700)

    payload_hash = {}
    for raw in sorted(raw_dir.glob("*.products.limit20.json")):
        payload_hash[raw.name.replace(".products.limit20.json", "")] = sha256(raw)

    brands = []
    for brand in manifest["brands"]:
        official = brand.get("officialUrl")
        if not official:
            raise SystemExit(f"brand {brand['slug']} has no verified officialUrl; refusing")
        payload = payload_hash.get(brand["slug"])
        if not payload:
            raise SystemExit(f"brand {brand['slug']} has no staged raw payload")
        official_url = official.rstrip("/")
        brands.append({
            "slug": brand["slug"], "name": brand["name"], "country": brand.get("country") or "VN",
            "officialUrl": official_url + "/",
            "provenanceUrl": f"{official_url}/products.json?limit=20",
            "provenanceSha256": payload,
        })

    products = []
    for product in manifest["products"]:
        brand_slug = product["brandSlug"]
        host = re.sub(r"^https?://", "", next(b["officialUrl"] for b in brands if b["slug"] == brand_slug)).split("/")[0].lower()
        variants = []
        for variant in product["variants"]:
            values = [variant.get("option1"), variant.get("option2"), variant.get("option3")]
            color = size = None
            for name, value in zip(product.get("optionNames") or [], values):
                mapped = classify(name)
                if mapped == "color" and color is None and isinstance(value, str) and value.strip():
                    color = value.strip()
                elif mapped == "size" and size is None and isinstance(value, str) and value.strip():
                    size = value.strip()
            variant_id = str(variant.get("sourceVariantId") or "").strip()
            if not variant_id:
                raise SystemExit(f"{product['model']}: variant without stable source id")
            variants.append({
                "color": color,
                "size": size or UNKNOWN,
                "barcode": re.sub(r"[^A-Z0-9-]", "-", f"VN-{brand_slug.upper()}-{variant_id}".upper()),
                "stock": 3 if variant.get("sourceAvailable") else 0,
                "sourceVariantId": variant_id,
                "sourceSku": (variant.get("sourceSku") or None),
                "sourcePrice": variant.get("sourcePrice"),
                "sourceAvailable": variant.get("sourceAvailable"),
            })
        if not variants:
            raise SystemExit(f"{product['model']}: no variants")

        media = []
        for item in product["media"]:
            source = media_root / item["file"]
            if not source.is_file():
                raise SystemExit(f"missing staged media {source}")
            actual = sha256(source)
            if actual != item["sha256"]:
                raise SystemExit(f"media hash mismatch {source}")
            if media_dir and not (media_dir / item["file"]).exists():
                shutil.copyfile(source, media_dir / item["file"])
                (media_dir / item["file"]).chmod(0o600)
            media.append({"file": item["file"], "sha256": actual,
                          "sourceUrl": item["sourceUrl"], "license": item.get("license") or "unknown",
                          "artist": item.get("artist") or ""})
        products.append({
            "brandSlug": brand_slug,
            "model": product["model"][:200],
            "name": product["name"],
            "categoryName": product.get("productType") or "Thời trang",
            "description": (product.get("description") or None),
            "demoPriceVnd": demo_price(product["variants"]),
            "sourceUrl": (brands[[b["slug"] for b in brands].index(brand_slug)]["officialUrl"].rstrip("/")
                          + (product.get("sourceProductUrl") or "")),
            "sourceSha256": media[0]["sha256"],
            "sourcePayloadSha256": payload_hash[brand_slug],
            "sourceHost": host,
            "sourceProductId": str(product["sourceProductId"]),
            "sourceFetchedAt": None,
            "sourcePrice": min([v["sourcePrice"] for v in variants if isinstance(v.get("sourcePrice"), (int, float))] or [None]) or None,
            "sourceCurrency": "VND",
            "sourceBrand": product.get("vendor") or product.get("brandName"),
            "curationClass": "SOURCED",
            "media": media,
            "variants": variants,
        })

    out = {
        "manifestId": "vn-catalog-import-v1",
        "revision": manifest.get("revision"),
        "task": "brand-catalog-ai-completion",
        "note": "Converted from FE VN staging rev2; demo VND price is deterministic from the median "
                "source price, never a converted or official price.",
        "brands": brands,
        "products": products,
    }
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    path.chmod(0o600)
    print(json.dumps({"brands": len(brands), "products": len(products),
                      "variants": sum(len(p["variants"]) for p in products),
                      "unknownSize": sum(1 for p in products for v in p["variants"] if v["size"] == UNKNOWN),
                      "sha256": sha256(path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
