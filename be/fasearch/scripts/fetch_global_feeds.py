#!/usr/bin/env python3
"""Fetch verified first-party global feeds and build a curated importer manifest.

Reuses only the four endpoints that previously returned HTTP 200 with 20 products
(`GLOBAL-ADDITIONAL-SOURCE-PROBES.json`). ABC-MART returned HTTP 429 and is never retried
here. Brand is stored by the actual feed vendor, not the retailer. Media is downloaded into
the candidate private namespace and hashed; source price/currency is kept as a snapshot and
is never converted into the demo price.

Usage: fetch_global_feeds.py --out <manifest> --media-dir <dir> --receipt <json>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

UA = "FaSearchAcademicDemo/1.0 (catalog staging; contact: local operator)"
TIMEOUT = 25

FEEDS = [
    ("https://en.mlb-korea.com/products.json?limit=20", "https://en.mlb-korea.com"),
    ("https://www.skechersvn.vn/products.json?limit=20", "https://www.skechersvn.vn"),
    ("https://supersports.com.vn/products.json?limit=20", "https://supersports.com.vn"),
    ("https://vansvietnam.com.vn/products.json?limit=20", "https://vansvietnam.com.vn"),
]

# Actual vendor -> brand. Retailer hosts never become the brand.
BRAND_BY_VENDOR = {
    "MLB": {"slug": "mlb-korea", "name": "MLB", "country": "KR"},
    "SKECHERS VIETNAM ONLINE STORE": {"slug": "skechers", "name": "Skechers", "country": "US"},
    "VANS": {"slug": "vans", "name": "Vans", "country": "US"},
    "ADIDAS": {"slug": "adidas", "name": "Adidas", "country": "DE"},
    "NIKE": {"slug": "nike", "name": "Nike", "country": "US"},
    "UNDER ARMOUR": {"slug": "under-armour", "name": "Under Armour", "country": "US"},
}
# Fixed demo prices per brand (VND). Explicitly demo values, never a live/official price.
DEMO_PRICE = {
    "mlb-korea": 1_290_000, "skechers": 1_690_000, "vans": 1_590_000,
    "adidas": 1_990_000, "nike": 2_190_000, "under-armour": 1_490_000,
}
PER_HOST = 4          # keep the sample small and genuine
MAX_BYTES = 12 * 1024 * 1024
COLOR_KEYS = ("màu", "mau", "color", "colour")
SIZE_KEYS = ("size", "kích", "kich", "cỡ", "co")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str) -> tuple[int, bytes, str]:
    request = urllib.request.Request(url, headers={"user-agent": UA, "accept": "application/json"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("payload exceeds size bound")
        return response.status, body, response.geturl()


def slugify(value: str, limit: int = 60) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return (text[:limit].strip("-") or "item")


def classify_option(name: str) -> str | None:
    low = (name or "").lower()
    if any(key in low for key in COLOR_KEYS):
        return "color"
    if any(key in low for key in SIZE_KEYS):
        return "size"
    return None


def image_kind(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--media-dir", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--raw-dir", required=True)
    args = parser.parse_args()

    media_dir = Path(args.media_dir)
    raw_dir = Path(args.raw_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    raw_dir.mkdir(parents=True, exist_ok=True)
    media_dir.chmod(0o700)

    brands: dict[str, dict] = {}
    products: list[dict] = []
    probe_receipt: list[dict] = []
    dropped: list[dict] = []

    for feed_url, host_url in FEEDS:
        host = re.sub(r"^https?://", "", host_url).split("/")[0].lower()
        entry = {"endpoint": feed_url, "host": host}
        try:
            status, body, final_url = fetch(feed_url)
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, TimeoutError) as error:
            entry.update({"status": "BLOCKED", "error": str(error)[:160], "fetchedAt": datetime.now(timezone.utc).isoformat()})
            probe_receipt.append(entry)
            continue
        payload_sha = sha256_bytes(body)
        raw_name = f"{host}.products.limit20.json"
        (raw_dir / raw_name).write_bytes(body)
        (raw_dir / raw_name).chmod(0o600)
        entry.update({"status": status, "finalUrl": final_url, "payloadSha256": payload_sha,
                      "bytes": len(body), "fetchedAt": datetime.now(timezone.utc).isoformat()})
        try:
            data = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            entry["status"] = "INVALID_JSON"
            probe_receipt.append(entry)
            continue

        feed_products = data.get("products") if isinstance(data, dict) else None
        if not isinstance(feed_products, list) or not feed_products:
            entry["status"] = "NO_PRODUCTS"
            probe_receipt.append(entry)
            continue
        entry["productsInFeed"] = len(feed_products)
        entry["vendors"] = sorted({str(p.get("vendor") or "") for p in feed_products if p.get("vendor")})

        kept = 0
        for item in feed_products:
            if kept >= PER_HOST:
                break
            vendor = str(item.get("vendor") or "").strip()
            brand = BRAND_BY_VENDOR.get(vendor.upper())
            title = str(item.get("title") or item.get("name") or "").strip()
            product_id = str(item.get("id") or "").strip()
            variants = item.get("variants") if isinstance(item.get("variants"), list) else []
            if not brand or not title or not product_id or not variants:
                dropped.append({"host": host, "productId": product_id, "reason": "missing vendor/title/variants"})
                continue
            media_url = None
            # Two first-party schemas appear: Shopify (`images[].src`, `title`) and
            # Haravan/Bizweb (`images[]` plain URLs, `name`, `featured_image`).
            for image in (item.get("images") or []):
                candidate = image.get("src") if isinstance(image, dict) else image
                if isinstance(candidate, str) and candidate.startswith("http"):
                    media_url = candidate
                    break
            if media_url is None:
                featured = item.get("featured_image")
                if isinstance(featured, dict):
                    featured = featured.get("src")
                if isinstance(featured, str) and featured.startswith("http"):
                    media_url = featured
            if media_url is None:
                for variant in variants:
                    candidate = str((variant or {}).get("featured_image") or "")
                    if candidate.startswith("http"):
                        media_url = candidate
                        break
            if media_url is None:
                dropped.append({"host": host, "productId": product_id, "reason": "no first-party media"})
                continue
            prices = [float(v.get("price") or 0) for v in variants if isinstance(v, dict)]
            prices = [price for price in prices if price > 0]
            if not prices:
                dropped.append({"host": host, "productId": product_id, "reason": "no positive source price"})
                continue

            try:
                media_status, media_body, media_final = fetch(media_url)
            except (urllib.error.HTTPError, urllib.error.URLError, ValueError, TimeoutError) as error:
                dropped.append({"host": host, "productId": product_id, "reason": f"media fetch failed: {str(error)[:80]}"})
                continue
            kind = image_kind(media_body)
            if media_status != 200 or kind is None or len(media_body) < 2048:
                dropped.append({"host": host, "productId": product_id, "reason": "media not a supported image"})
                continue
            media_sha = sha256_bytes(media_body)
            suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[kind]
            file_name = f"{brand['slug']}-{product_id}-1{suffix}"
            target = media_dir / file_name
            if target.exists() and sha256_bytes(target.read_bytes()) != media_sha:
                dropped.append({"host": host, "productId": product_id, "reason": "media filename collision"})
                continue
            if not target.exists():
                target.write_bytes(media_body)
                target.chmod(0o600)

            option_names = [str(name) for name in (item.get("options") or []) if isinstance(name, str)]
            sequences = [p.strip() for p in [item.get("handle")] if isinstance(p, str)] or [product_id]
            model = re.sub(r"\s+", " ", title)[:180]
            # (brand, model) is the importer identity; identical feed titles are disambiguated by
            # their stable source product id instead of inventing a different product name.
            seen_models = {p["model"].lower() for p in products if p["brandSlug"] == brand["slug"]}
            if model.lower() in seen_models:
                model = f"{model} #{product_id}"
            styles = []
            for variant in variants[:12]:
                if not isinstance(variant, dict):
                    continue
                values = [variant.get("option1"), variant.get("option2"), variant.get("option3")]
                color = size = None
                for name, value in zip(option_names + [None, None, None], values):
                    mapped = classify_option(name or "")
                    if mapped == "color" and color is None and isinstance(value, str) and value.strip():
                        color = value.strip()
                    elif mapped == "size" and size is None and isinstance(value, str) and value.strip():
                        size = value.strip()
                sku = str(variant.get("sku") or "").strip() or None
                variant_id = str(variant.get("id") or "").strip()
                if not variant_id:
                    continue
                styles.append({
                    "color": color, "size": size or "Freesize",
                    "barcode": re.sub(r"[^A-Z0-9-]", "-", f"GL-{brand['slug'].upper()}-{variant_id}".upper()),
                    "stock": 3 if variant.get("available") else 0,
                    "sourceVariantId": variant_id, "sourceSku": sku,
                    "sourcePrice": float(variant.get("price") or 0) or None,
                    "sourceAvailable": bool(variant.get("available")),
                })
            if not styles:
                dropped.append({"host": host, "productId": product_id, "reason": "no usable variants"})
                continue
            products.append({
                "brandSlug": brand["slug"], "model": model, "name": title,
                "categoryName": str(item.get("product_type") or "").strip() or "Thời trang",
                "description": re.sub(r"<[^>]+>", " ", str(item.get("body_html") or ""))[:1000].strip() or None,
                "demoPriceVnd": DEMO_PRICE[brand["slug"]],
                "sourceUrl": f"{host_url}/products/{item.get('handle')}" if item.get("handle") else media_final,
                "sourceSha256": media_sha,
                "sourcePayloadSha256": payload_sha,
                "media": [{"file": file_name, "sha256": media_sha, "sourceUrl": media_final,
                           "license": "unknown", "artist": ""}],
                "variants": styles,
                "sourceHost": host, "sourceProductId": product_id,
                "sourceFetchedAt": entry["fetchedAt"],
                "sourcePrice": min(prices) if prices else None,
                "sourceCurrency": str(item.get("currency") or "VND"),
                "sourceBrand": vendor, "curationClass": "SOURCED",
            })
            brands.setdefault(brand["slug"], {
                "slug": brand["slug"], "name": brand["name"], "country": brand["country"],
                "officialUrl": host_url, "logo": None,
                "provenanceUrl": feed_url, "provenanceSha256": payload_sha,
            })
            kept += 1
            time.sleep(0.4)
        entry["curated"] = kept
        probe_receipt.append(entry)

    manifest = {
        "manifestId": "brand-catalog-global-feeds-v1",
        "revision": 1,
        "task": "brand-catalog-ai-completion",
        "note": "Curated first-party feed sample. Demo VND prices are assigned by the candidate importer, "
                "never converted from source currency; source price/currency is a capture-time snapshot.",
        "honesty": "No retailer partnership, official-price or live-stock claim. ABC-MART was HTTP 429 at probe time "
                   "and is not retried or fabricated.",
        "brands": sorted(brands.values(), key=lambda b: b["slug"]),
        "products": products,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    out.chmod(0o600)
    receipt = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "manifest": str(out),
        "manifestSha256": sha256_bytes(out.read_bytes()),
        "probes": probe_receipt,
        "counts": {"brands": len(brands), "products": len(products),
                   "variants": sum(len(p["variants"]) for p in products)},
        "dropped": dropped,
    }
    rp = Path(args.receipt)
    rp.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    rp.chmod(0o600)
    print(json.dumps({"counts": receipt["counts"], "probes": [(p["host"], p.get("status"), p.get("curated")) for p in probe_receipt],
                      "dropped": len(dropped)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
