#!/usr/bin/env python3
"""Fetch verified first-party VN brand feeds and build an importer manifest for R3.

Read-only on the network and on the parent DB. Every record keeps its source identity
(host, product id, variant id/sku), the raw product payload hash, the fetch timestamp and the
matched photo hash, so the importer can be re-run idempotently and nothing is invented.
Two feed dialects are handled: Haravan/Shopify-style (`title`, `images[].src`) and
Bizweb/Sapo-style (`name`, `images[]` strings, `featured_image`).

Demo values are explicit and never presented as supplier facts:
- `demoPriceVnd`  = median variant price rounded up to 10.000 VND (snapshot, not a conversion);
- demo stock      = 2 when the feed marks the variant available, else 0; the feed's own flag is
                    preserved separately as `sourceAvailable`, and no supplier quantity is copied.

Usage: fetch_vn_feeds_r3.py --out manifest.json --media-dir media/products --receipt r.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
PARENT_DB = "fasearch_storefront_r3_20261102"
UA = "FaSearchAcademicDemo/1.0 (catalog staging; contact: local operator)"
TIMEOUT = 30
IMG_MAX_BYTES = 6 * 1024 * 1024

# host -> (brand slug, brand display name, country)
HOSTS = [
    ("dirtycoins.vn", "dirtycoins", "DirtyCoins", "VN"),
    ("degrey.vn", "degrey", "Degrey", "VN"),
    ("swe.vn", "swe", "SWE", "VN"),
    ("teelab.vn", "teelab", "Teelab", "VN"),
    ("clownz.vn", "clownz", "ClownZ", "VN"),
    ("davies.vn", "davies", "Davies", "VN"),
    ("ontop.com.vn", "ontop", "ONTOP", "VN"),
    ("nowsaigon.com", "nowsaigon", "NOWSAIGON", "VN"),
    ("rubies.vn", "rubies", "Rubies", "VN"),
    ("dkmv.vn", "dkmv", "DKMV", "VN"),
]

# Global feeds: brand comes from the feed vendor (retailers never become the brand).
GLOBAL_HOSTS = [
    ("en.mlb-korea.com", "/products.json?limit=250", "mlb-korea", "MLB", "KR"),
    ("www.skechersvn.vn", "/collections/all/products.json?limit=250", "skechers", "Skechers", "US"),
    ("supersports.com.vn", "/collections/all/products.json?limit=250", None, None, "VN"),
    ("vansvietnam.com.vn", "/collections/all/products.json?limit=250", "vans", "Vans", "US"),
]
# vendor string (normalized) -> existing brand slug in the candidate DB
VENDOR_BRANDS = {
    "adidas": ("adidas", "Adidas", "DE"), "asics": ("asics", "ASICS", "JP"),
    "puma": ("puma", "Puma", "DE"), "new balance": ("new-balance", "New Balance", "US"),
    "under armour": ("under-armour", "Under Armour", "US"), "vans": ("vans", "Vans", "US"),
    "skechers": ("skechers", "Skechers", "US"), "skechers vietnam online store": ("skechers", "Skechers", "US"),
    "mlb": ("mlb-korea", "MLB", "KR"), "dickies": ("dickies", "Dickies", "US"),
    "uniqlo": ("uniqlo", "UNIQLO", "JP"), "bape": ("bape", "BAPE", "JP"),
    "thisisneverthat": ("thisisneverthat", "thisisneverthat", "KR"),
    "mardi mercredi": ("mardi-mercredi", "Mardi Mercredi", "KR"),
    "onitsuka tiger": ("onitsuka-tiger", "Onitsuka Tiger", "JP"),
    "nike": ("nike", "Nike", "US"),
    "new era": ("new-era", "New Era", "US"),
}

SIZE_RE = re.compile(r"^(?:[2-5]?XL|XS|S|M|L|XXS|\d{2,3}(?:\.\d)?|FREE\s?SIZE|F)$", re.IGNORECASE)
CATEGORY_RULES = [
    ("Áo", ("ao", "shirt", "tee", "t-shirt", "hoodie", "sweater", "jacket", "khoac", "somi", "polo", "vest")),
    ("Quần", ("quan", "jean", "pant", "trouser", "short", "skirt", "vay")),
    ("Giày", ("giay", "shoe", "sneaker", "boot", "sandal", "dep", "slipper")),
    ("Túi & Ví", ("tui", "bag", "vi ", "wallet", "backpack", "balo")),
    ("Phụ kiện", ("non", "cap", "hat", "vo", "sock", "that lung", "belt", "kinh", "mat kinh", "phu kien", "accessor", "chain", "vong")),
]
UNKNOWN = "Không xác định"


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def psql(sql: str) -> str:
    if not re.match(r"^[a-z0-9_]{1,63}$", PARENT_DB):
        raise SystemExit("unsafe db name")
    r = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                        f'psql -U "$POSTGRES_USER" -d {PARENT_DB} -v ON_ERROR_STOP=1 -At'],
                       input=sql.encode(), capture_output=True, check=False)
    if r.returncode != 0:
        raise SystemExit(r.stderr.decode(errors="replace")[:400])
    return r.stdout.decode(errors="replace").strip()


def strip_html(value: str | None) -> str | None:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"&[a-z]+;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def fold(text: str) -> str:
    """Lowercase + strip Vietnamese diacritics for keyword matching only."""
    table = str.maketrans(
        "àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ",
        "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd")
    return text.lower().translate(table)


def category_for(product: dict) -> str:
    probe = " ".join(str(product.get(k) or "") for k in ("product_type", "tags", "name", "title"))
    folded = fold(probe)
    for label, keys in CATEGORY_RULES:
        if any(key in folded for key in keys):
            return label
    return "Khác"


def first_image(product: dict) -> str | None:
    featured = product.get("featured_image")
    images = product.get("images") or []
    candidates: list[str] = []
    if isinstance(featured, dict) and featured.get("src"):
        candidates.append(featured["src"])
    elif isinstance(featured, str):
        candidates.append(featured)
    if isinstance(product.get("image"), dict) and product["image"].get("src"):
        candidates.append(product["image"]["src"])
    for item in images:
        if isinstance(item, dict) and item.get("src"):
            candidates.append(item["src"])
        elif isinstance(item, str):
            candidates.append(item)
    for candidate in candidates:
        if candidate.startswith("https://"):
            return candidate
    return None


def variant_options(variant: dict) -> tuple[str | None, str]:
    """Return (color or None, size). Unknown sizes stay explicit instead of being fabricated."""
    raw = [variant.get(k) for k in ("option1", "option2", "option3")]
    values = [str(v).strip() for v in raw if isinstance(v, (str, int)) and str(v).strip()]
    size = None
    rest: list[str] = []
    for value in values:
        if size is None and SIZE_RE.match(value):
            size = value
        else:
            rest.append(value)
    color = rest[0] if rest else None
    return (color, size or UNKNOWN)


def demo_price(variants: list[dict]) -> int | None:
    prices = []
    for variant in variants:
        raw = variant.get("price")
        try:
            value = float(raw)
        except (TypeError, ValueError):
            continue
        if value > 0:
            prices.append(value)
    if not prices:
        return None
    median = int(statistics.median(prices))
    return int((median + 9_999) // 10_000 * 10_000)


def download_image(url: str, target_dir: Path, name_seed: str) -> tuple[Path, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        if response.headers.get("Content-Type", "").split(";")[0] not in (
                "image/jpeg", "image/png", "image/webp"):
            raise ValueError("unsupported content-type")
        data = response.read(IMG_MAX_BYTES + 1)
    if len(data) > IMG_MAX_BYTES:
        raise ValueError("image too large")
    header = data[:12]
    if header.startswith(b"\xff\xd8\xff"):
        suffix, ctype = ".jpg", "image/jpeg"
    elif header.startswith(b"\x89PNG\r\n\x1a\n"):
        suffix, ctype = ".png", "image/png"
    elif header[:4] == b"RIFF" and data[8:12] == b"WEBP":
        suffix, ctype = ".webp", "image/webp"
    else:
        raise ValueError("not an image")
    if ctype == "image/webp":
        raise ValueError("webp not decodable by the JDK validator")
    digest = sha256_bytes(data)
    name = str(uuid.uuid5(uuid.NAMESPACE_URL, f"r3:{name_seed}:{digest}")) + suffix
    target = target_dir / name
    if not target.exists():
        target.write_bytes(data)
        target.chmod(0o600)
    elif sha256_bytes(target.read_bytes()) != digest:
        raise ValueError("media collision")
    return target, digest


def fetch_page(host: str, page: int, path: str = "/collections/all/products.json?limit=250") -> tuple[dict | None, str]:
    url = f"https://{host}{path}&page={page}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        log(f"  {host} page {page}: HTTP {error.code}")
        return None, url
    except Exception as error:  # noqa: BLE001 - network failures are recorded, not retried blindly
        log(f"  {host} page {page}: {type(error).__name__}")
        return None, url
    try:
        return json.loads(raw), url
    except json.JSONDecodeError:
        log(f"  {host} page {page}: not JSON")
        return None, url


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--media-dir", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--group", choices=["vn", "global", "all"], default="vn")
    parser.add_argument("--global-cap", type=int, default=60)
    parser.add_argument("--pages", type=int, default=2)
    parser.add_argument("--per-host-cap", type=int, default=120)
    parser.add_argument("--sleep", type=float, default=0.8)
    args = parser.parse_args()

    media_dir = Path(args.media_dir)
    media_dir.mkdir(parents=True, exist_ok=True)
    media_dir.chmod(0o700)

    existing = set()
    rows = psql("SELECT coalesce(source_host,'')||'|'||coalesce(source_product_id,'') FROM san_pham WHERE source_host IS NOT NULL;")
    for line in rows.splitlines():
        if "|" in line:
            existing.add(tuple(line.split("|", 1)))
    log(f"parent source identities: {len(existing)}")

    existing_barcodes = set()
    for line in psql("SELECT ma_vach FROM bien_the_sp WHERE ma_vach IS NOT NULL;").splitlines():
        existing_barcodes.add(line.strip())

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    brands: dict[str, dict] = {}
    products: list[dict] = []
    barcodes: set[str] = set()
    stats: dict[str, dict] = {}
    media_hashes: list[str] = []
    failed_images = 0

    plan: list[tuple] = []
    if args.group in ("vn", "all"):
        plan += [(host, "/collections/all/products.json?limit=250", slug, brand_name, country, args.per_host_cap)
                 for host, slug, brand_name, country in HOSTS]
    if args.group in ("global", "all"):
        plan += [(host, path, slug, brand_name, country, args.global_cap)
                 for host, path, slug, brand_name, country in GLOBAL_HOSTS]

    for host, path, slug, brand_name, country, cap in plan:
        stats[host] = {"pages": 0, "fetched": 0, "alreadyPresent": 0, "ineligible": 0,
                       "imageFailed": 0, "accepted": 0, "capReached": False, "payloadSha": [],
                       "unmappedVendors": []}
        accepted = 0
        for page in range(1, args.pages + 1):
            payload, url = fetch_page(host, page, path)
            if payload is None:
                break
            stats[host]["pages"] += 1
            stats[host]["payloadSha"].append(sha256_bytes(json.dumps(payload, sort_keys=True).encode()))
            items = payload.get("products") or []
            stats[host]["fetched"] += len(items)
            for item in items:
                source_id = str(item.get("id") or "").strip()
                if not source_id:
                    continue
                if (host, source_id) in existing:
                    stats[host]["alreadyPresent"] += 1
                    continue
                name = (item.get("title") or item.get("name") or "").strip()
                variants = [v for v in (item.get("variants") or []) if isinstance(v, dict)]
                price = demo_price(variants)
                image_url = first_image(item)
                if not name or not variants or not price or not image_url:
                    stats[host]["ineligible"] += 1
                    continue
                host_slug, host_brand, host_country = slug, brand_name, country
                if host_slug is None:
                    vendor = fold(str(item.get("vendor") or "")).strip()
                    mapped = VENDOR_BRANDS.get(vendor)
                    if mapped is None:
                        stats[host]["ineligible"] += 1
                        if vendor not in stats[host]["unmappedVendors"]:
                            stats[host]["unmappedVendors"].append(vendor)
                        continue
                    host_slug, host_brand, host_country = mapped
                if accepted >= cap:
                    stats[host]["capReached"] = True
                    break
                model = f"SRC-{source_id}"
                try:
                    media_path, media_sha = download_image(image_url, media_dir, f"{host}:{source_id}")
                except Exception as error:  # noqa: BLE001 - recorded per product
                    log(f"  {host} {source_id}: image rejected ({type(error).__name__})")
                    stats[host]["imageFailed"] += 1
                    failed_images += 1
                    continue
                normalized_variants = []
                for variant in variants:
                    color, size = variant_options(variant)
                    raw_sku = variant.get("sku")
                    sku = str(raw_sku).strip() if raw_sku not in (None, "") else None
                    source_variant_id = str(variant.get("id") or "") or None
                    if sku and sku in existing_barcodes:
                        sku_unique = f"{sku}-{source_variant_id or ''}"[:100]
                    else:
                        sku_unique = sku
                    barcode_seed = sku_unique or f"R3-{host_slug.upper()}-{source_id}-{source_variant_id}"
                    barcode = re.sub(r"[^A-Z0-9-]", "-", barcode_seed.upper())[:100]
                    if barcode in barcodes or barcode in existing_barcodes:
                        barcode = f"{barcode}-{source_variant_id or uuid.uuid4().hex[:6]}"[:100]
                    barcodes.add(barcode)
                    available = variant.get("available")
                    normalized_variants.append({
                        "color": color, "size": size,
                        "stock": 2 if available is True else 0,
                        "barcode": barcode,
                        "sourceVariantId": source_variant_id,
                        "sourceSku": sku,
                        "sourcePrice": float(variant.get("price")) if str(variant.get("price") or "").replace(".", "", 1).isdigit() else None,
                        "sourceAvailable": available if isinstance(available, bool) else None,
                    })
                if not normalized_variants:
                    stats[host]["ineligible"] += 1
                    continue
                payload_sha = sha256_bytes(json.dumps(item, sort_keys=True, ensure_ascii=False).encode())
                brands.setdefault(host_slug, {"slug": host_slug, "name": host_brand, "country": host_country,
                                              "officialUrl": f"https://{host}", "logo": None})
                products.append({
                    "brandSlug": host_slug, "model": model, "name": name[:255],
                    "categoryName": category_for(item),
                    "description": strip_html(item.get("body_html") or item.get("content") or item.get("summary")),
                    "demoPriceVnd": price,
                    "sourceUrl": f"https://{host}/products/{item.get('handle') or item.get('alias') or source_id}",
                    "sourceSha256": media_sha,
                    "sourcePayloadSha256": payload_sha,
                    "sourceHost": host, "sourceProductId": source_id,
                    "sourceFetchedAt": fetched_at,
                    "sourcePrice": min(v["sourcePrice"] for v in normalized_variants if v["sourcePrice"]) if any(v["sourcePrice"] for v in normalized_variants) else float(price),
                    "sourceCurrency": "VND",
                    "sourceBrand": str(item.get("vendor") or host_brand)[:100],
                    "curationClass": "SOURCED",
                    "media": [{"file": media_path.name, "sha256": media_sha, "sourceUrl": image_url}],
                    "variants": normalized_variants,
                })
                media_hashes.append(media_sha)
                accepted += 1
                stats[host]["accepted"] = accepted
            if stats[host]["capReached"] or len(items) < 250:
                break
            time.sleep(args.sleep)
        log(f"{host}: fetched={stats[host]['fetched']} present={stats[host]['alreadyPresent']} "
            f"ineligible={stats[host]['ineligible']} imageFailed={stats[host]['imageFailed']} accepted={accepted}"
            + (f" unmappedVendors={stats[host]['unmappedVendors']}" if stats[host]["unmappedVendors"] else ""))
        stats[host]["payloadSha"] = stats[host]["payloadSha"][:2]
        time.sleep(args.sleep)

    manifest = {
        "manifestId": f"r3-vn-{fetched_at}",
        "generatedAt": fetched_at,
        "generator": "scripts/fetch_vn_feeds_r3.py",
        "policy": {
            "demoPrice": "median source variant price rounded up to 10.000 VND (snapshot)",
            "demoStock": "2 when the feed marks the variant available, else 0; supplier quantity is never copied",
            "unknownSize": UNKNOWN,
        },
        "brands": sorted(brands.values(), key=lambda b: b["slug"]),
        "products": products,
    }
    manifest_path = Path(args.out)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    manifest_path.chmod(0o600)

    receipt = {
        "generatedAt": fetched_at,
        "manifest": {"path": str(manifest_path), "sha256": sha256_bytes(manifest_path.read_bytes())},
        "counts": {"hosts": len(plan), "group": args.group, "brands": len(brands), "products": len(products),
                   "variants": sum(len(p["variants"]) for p in products),
                   "media": len(media_hashes), "imageFailures": failed_images,
                   "unknownSizeVariants": sum(1 for p in products for v in p["variants"] if v["size"] == UNKNOWN)},
        "perHost": stats,
        "mediaDir": str(media_dir),
        "mediaListSha256": sha256_bytes("".join(sorted(media_hashes)).encode()),
        "sourceWrites": 0,
    }
    receipt_path = Path(args.receipt)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    receipt_path.chmod(0o600)
    print(json.dumps(receipt["counts"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
