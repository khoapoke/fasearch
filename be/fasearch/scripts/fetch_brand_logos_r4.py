#!/usr/bin/env python3
"""Fetch and strictly validate brand logos for the R4 candidate (own DB/media only).

Provenance is explicit and never overstated:
- `brand-homepage`: the asset is referenced by the brand's own official page (its own CDN
  subdomains are fine because the page itself points at them);
- `wikimedia-secondary`: official brand artwork published on Wikipedia/Commons, used only as a
  documented secondary source for brands whose site blocks or hides the file. The receipt always
  records the actual source host.

Safety rules: bounded fetches (no login, no paid provider, no retry storms), identity check per
brand (a rejected/mismatched identity is a miss, never a substitute), strict SVG allowlist
(tags/attributes parsed, no scripts/events/active content/external or protocol-relative refs),
raster decode via PIL, deterministic media names, exact target database for `--apply`.

Usage: fetch_brand_logos_r4.py --db-env <env> --media-dir <brands> --receipt <json> [--apply]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
TARGET_DB = "fasearch_storefront_r4_20261103"
UA = "FaSearchAcademicDemo/1.0 (catalog staging; contact: local operator)"
TIMEOUT = 20
PAGE_MAX = 3 * 1024 * 1024
SVG_MAX = 200 * 1024
RASTER_MAX = 1024 * 1024
NAMESPACE = uuid.UUID("3f2504e0-4f89-11d3-9a0c-0305e82c3301")

# Second-level public suffixes we actually meet; used instead of "last two labels".
SECOND_LEVEL = {"com.vn", "net.vn", "org.vn", "co.kr", "co.jp", "com.au", "co.uk", "com.sg", "com.tw"}
# Asset-path heuristics that catch "same site, valid image, wrong thing".
NON_LOGO_PATH = ("favicon", "apple-touch-icon", "icon-", "/icons/", "sprite", "placeholder", "noimage")
MARKETING_PATH = ("banner", "slider", "new-arrival", "newarrival", "new_arrival", "footer", "popup",
                  "quickview", "collection", "blog", "article", "testimonial", "sec_feed")
HEADER_CONTEXT = ("header", "navbar", "nav-", "logo-wrapper", "logo_centers", "topbar", "site-brand")

BLOCKED_HOST_HINTS = ("facebook", "twitter", "instagram", "wikimedia", "wikipedia", "google",
                      "gravatar", "linkedin", "youtube", "tiktok", "pinterest", "logo.clearbit",
                      "brandfetch", "seeklogo", "worldvectorlogo", "logodownload")

SVG_ALLOWED_TAGS = {
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
    "defs", "lineargradient", "radialgradient", "stop", "clippath", "title", "desc", "symbol",
}
SVG_ALLOWED_ATTRS = {
    "xmlns", "xmlns:xlink", "version", "viewbox", "width", "height", "preserveaspectratio",
    "id", "class", "role", "aria-label", "aria-hidden", "aria-labelledby",
    "d", "points", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
    "fill", "fill-rule", "fill-opacity", "clip-rule", "clip-path", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-opacity",
    "opacity", "transform", "offset", "stop-color", "stop-opacity", "gradientunits",
    "gradienttransform", "fx", "fy",
}
EXTERNAL_VALUE = re.compile(r"(?:https?:|//|data:|javascript:)", re.IGNORECASE)
CSS_URL = re.compile(r"url\(\s*['\"]?(?!#)([^)]*)\)", re.IGNORECASE)

# Wikimedia fallback is only used where the identity is unambiguous for the brand.
WIKI_FALLBACK = {
    "adidas": ("Adidas", ("adidas",)),
    "asics": ("Asics", ("asics",)),
    "dickies": ("Dickies", ("dickies",)),
    "new-era": ("New Era Cap Company", ("new era",)),
    "nike": ("Nike, Inc.", ("nike",)),
    "puma": ("Puma (brand)", ("puma",)),
    "skechers": ("Skechers", ("skechers",)),
    "thisisneverthat": ("Thisisneverthat", ("neverthat",)),
    "under-armour": ("Under Armour", ("under armour",)),
    "uniqlo": ("Uniqlo", ("uniqlo",)),
    "vans": ("Vans", ("vans",)),
    "onitsuka-tiger": ("Onitsuka Tiger", ("onitsuka",)),
    "new-balance": ("New Balance", ("new balance",)),
    "mardi-mercredi": ("Mardi Mercredi", ("mardi",)),
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def site_of(host: str) -> str:
    """Registrable site of a host, honoring the multi-label suffixes we actually meet."""
    parts = (host or "").lower().strip(".").split(".")
    if len(parts) < 2:
        return host or ""
    last_two = ".".join(parts[-2:])
    if last_two in SECOND_LEVEL and len(parts) >= 3:
        return ".".join(parts[-3:])
    return last_two


def allowed_host(url: str, official: str) -> bool:
    """Same site as the official page, or an explicit CDN host that the official page links to."""
    try:
        host = (urllib.parse.urlparse(url).hostname or "").lower()
        official_host = (urllib.parse.urlparse(official).hostname or "").lower()
    except ValueError:
        return False
    if not host or not official_host:
        return False
    if any(hint in host for hint in BLOCKED_HOST_HINTS):
        return False
    if site_of(host) != site_of(official_host):
        return False
    return True


def fetch(url: str, limit: int) -> tuple[bytes, str, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        final_url = response.geturl()
        ctype = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("payload too large")
    return data, ctype, final_url


def validate_svg(data: bytes) -> dict:
    text = data.decode("utf-8", errors="strict")
    lowered = text.lower()
    for banned in ("<!doctype", "<!entity", "<?xml-stylesheet"):
        if banned in lowered:
            raise ValueError(f"svg contains {banned}")
    root = ET.fromstring(text)
    tags_seen: set[str] = set()
    attr_count = 0
    for element in root.iter():
        tag = str(element.tag).split("}")[-1].lower()
        tags_seen.add(tag)
        if tag not in SVG_ALLOWED_TAGS:
            raise ValueError(f"svg tag not allowed: {tag}")
        for raw_name, raw_value in element.attrib.items():
            name = str(raw_name).split("}")[-1].lower()
            value = str(raw_value)
            if name.startswith("on"):
                raise ValueError(f"svg event attribute: {name}")
            if name in ("href", "xlink:href"):
                if not value.strip().startswith("#"):
                    raise ValueError("svg external href")
                continue
            if name == "style":
                raise ValueError("svg inline style not allowed")
            if name not in SVG_ALLOWED_ATTRS:
                raise ValueError(f"svg attribute not allowed: {name}")
            if EXTERNAL_VALUE.search(value) and not value.strip().startswith("#"):
                raise ValueError("svg external reference")
            if CSS_URL.search(value):
                raise ValueError("svg css url() reference")
            attr_count += 1
    drawable = tags_seen & {"path", "rect", "circle", "ellipse", "polygon", "polyline", "line"}
    if not drawable:
        raise ValueError("svg has no drawable shapes")
    if not (root.get("viewBox") or (root.get("width") and root.get("height"))):
        raise ValueError("svg lacks dimensions")
    return {"bytes": len(data), "elements": len(list(root.iter())), "attributes": attr_count,
            "viewBox": root.get("viewBox") or f"{root.get('width')}x{root.get('height')}"}


def asset_gate(url: str, context: str, width: int | None, height: int | None) -> None:
    """Reject valid-but-wrong assets: favicons, marketing banners, unreadably small marks, non-header placement."""
    low = url.lower()
    if any(token in low for token in NON_LOGO_PATH):
        raise ValueError("asset path is an icon/favicon, not a logo")
    if any(token in low for token in MARKETING_PATH):
        raise ValueError("asset path is marketing/banner artwork")
    if width is not None and height is not None:
        if min(width, height) < 48:
            raise ValueError(f"asset too small to be a logo ({width}x{height})")
        if height and width / height > 9:
            raise ValueError("asset is a banner strip, not a logo")
    folded = context.lower()
    if folded and not any(token in folded for token in HEADER_CONTEXT):
        raise ValueError("asset is not referenced from the page header/brand area")


def dom_context(html: str, url: str) -> str:
    """Snippet of markup immediately preceding the asset reference (header vs footer/banner proof)."""
    needle = urllib.parse.urlparse(url).path.rsplit("/", 1)[-1]
    if not needle:
        return ""
    idx = html.lower().find(needle.lower())
    if idx == -1:
        return ""
    return re.sub(r"\s+", " ", html[max(0, idx - 300):idx])[-200:]


def ink_contrast(data: bytes, suffix: str) -> dict:
    """Measure the artwork's own ink so FE can pick a readable surface (assets stay untouched)."""
    try:
        from PIL import Image
        if suffix == ".svg":
            return {"kind": "unknown-svg", "luminance": None,
                    "hint": "SVG ink colour is in the markup; FE applies an optical wrapper"}
        with Image.open(io.BytesIO(data)) as image:
            rgba = image.convert("RGBA")
            pixels = [px for px in rgba.getdata() if px[3] > 20]
            if not pixels:
                return {"kind": "empty", "luminance": None, "hint": "no visible ink"}
            luminance = sum(0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b, _ in pixels) / len(pixels)
            transparent = any(px[3] < 250 for px in rgba.getdata())
        kind = ("light-ink" if luminance > 140 else "dark-ink") + ("-on-transparent" if transparent else "-on-baked")
        hint = ("needs a dark surface" if luminance > 140 and transparent
                else "needs a light surface" if luminance <= 140 and transparent
                else "baked background: pair with a matching surface")
        return {"kind": kind, "luminance": round(luminance, 1), "transparent": transparent, "hint": hint}
    except Exception as error:  # noqa: BLE001
        return {"kind": "unmeasured", "luminance": None, "hint": type(error).__name__}


def validate_raster(data: bytes) -> dict:
    from PIL import Image
    with Image.open(io.BytesIO(data)) as image:
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        return {"bytes": len(data), "width": image.width, "height": image.height, "format": image.format}


def discover_candidates(html: str, official: str) -> tuple[list[str], list[str]]:
    """Return (asset candidates, inline logo blocks). Pure: no module-level state."""
    found: list[str] = []
    inline: list[str] = []

    for match in re.finditer(r"<img\b[^>]*>", html, flags=re.IGNORECASE):
        tag = match.group(0)
        if "logo" not in tag.lower():
            continue
        src = re.search(r'(?:src|data-src)\s*=\s*["\']([^"\']+)["\']', tag, flags=re.IGNORECASE)
        if not src:
            continue
        url = urllib.parse.urljoin(official, src.group(1))
        if allowed_host(url, official) and url not in found:
            found.append(url)

    for match in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html):
        url = urllib.parse.urljoin(official, match.group(1))
        low = url.lower()
        if "logo" not in low or not (low.endswith(".svg") or low.endswith(".png")):
            continue
        if allowed_host(url, official) and url not in found:
            found.append(url)

    for match in re.finditer(r"<svg[^>]*>", html, flags=re.IGNORECASE):
        tag = match.group(0).lower()
        if "logo" not in tag and "brand" not in tag:
            continue
        end = html.lower().find("</svg>", match.start())
        if end == -1:
            continue
        block = html[match.start():end + 6]
        if len(block) <= SVG_MAX and block not in inline:
            inline.append(block)
    return found, inline


def identity_ok(brand_slug: str, brand_display: str, source_url: str) -> bool:
    """Reject artwork whose file name clearly belongs to a different brand identity."""
    name = urllib.parse.unquote(source_url.rsplit("/", 1)[-1]).lower()
    name = re.sub(r"[^a-z0-9]+", " ", name)
    tokens = {t for t in re.split(r"[^a-z0-9]+", brand_display.lower()) if len(t) > 2}
    if brand_slug == "mlb-korea":
        return "korea" in name
    if brand_slug == "mlb":
        return "major league" in name or "mlb" in name
    return any(token in name for token in tokens) or not tokens


def psql(sql: str, db: str) -> str:
    if db != TARGET_DB:
        raise SystemExit(f"refusing unexpected database {db!r}")
    r = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                        f'psql -U "$POSTGRES_USER" -d {db} -v ON_ERROR_STOP=1 -At -F "|"'],
                       input=sql.encode(), capture_output=True, check=False)
    if r.returncode != 0:
        raise SystemExit(r.stderr.decode(errors="replace")[:400])
    return r.stdout.decode(errors="replace").strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-env", required=True)
    parser.add_argument("--media-dir", required=True)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--only", default="")
    parser.add_argument("--candidates", default="",
                        help="JSON from the read-only research lane with first-party-linked CDN logo assets")
    args = parser.parse_args()

    env = {}
    for line in Path(args.db_env).read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    db = env.get("DB_NAME", "")
    if db != TARGET_DB:
        raise SystemExit(f"--db-env points at {db!r}, expected {TARGET_DB!r}")

    media = Path(args.media_dir)
    media.mkdir(parents=True, exist_ok=True)
    media.chmod(0o700)
    rows = psql("SELECT slug, ten_thuong_hieu, coalesce(official_url,'') FROM thuong_hieu ORDER BY slug;", db)
    brands = [line.split("|") for line in rows.splitlines() if line.count("|") == 2]
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    if only:
        brands = [b for b in brands if b[0] in only]

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    results: list[dict] = []
    updates: list[tuple[str, str]] = []

    def apply_asset(slug: str, display: str, data: bytes, ctype: str, source_url: str,
                    provenance: str, identity_gate: bool) -> dict:
        """Validate one downloaded asset and store it; returns the entry fields."""
        if identity_gate and not identity_ok(slug, display, source_url):
            raise ValueError("identity mismatch")
        is_svg = "svg" in (ctype or "") or b"<svg" in data[:400]
        if is_svg:
            if len(data) > SVG_MAX:
                raise ValueError("svg too large")
            validation, suffix, mime = validate_svg(data), ".svg", "image/svg+xml"
        else:
            if len(data) > RASTER_MAX:
                raise ValueError("raster too large")
            validation = validate_raster(data)
            suffix = ".png" if "png" in (ctype or "") else ".jpg"
            mime = ctype or "image/png"
        digest = sha256(data)
        name = str(uuid.uuid5(NAMESPACE, f"r4-logo:{slug}:{digest}")) + suffix
        target = media / name
        if not target.exists():
            target.write_bytes(data)
            target.chmod(0o600)
        elif sha256(target.read_bytes()) != digest:
            raise ValueError("media collision")
        return {"status": "validated", "provenance": provenance, "ink": ink_contrast(data, suffix),
                "sourceUrl": source_url, "sourceHost": urllib.parse.urlparse(source_url).hostname or "",
                "sha256": digest, "mime": mime, "file": name, "validation": validation,
                "fetchedAt": fetched_at, "reason": None}

    if args.candidates:
        payload = json.loads(Path(args.candidates).read_text(encoding="utf-8"))
        raw_list = payload.get("candidates") if isinstance(payload, dict) else payload
        if raw_list is None and isinstance(payload, dict):
            raw_list = payload.get("brands") or payload.get("logos") or []
        by_slug = {b[0]: b for b in brands}

        def pick(item: dict, *names: str) -> str:
            lowered = {str(k).lower(): v for k, v in item.items()}
            for name in names:
                value = lowered.get(name.lower())
                if value:
                    return str(value)
            return ""

        cand_results: list[dict] = []
        for item in raw_list or []:
            if not isinstance(item, dict):
                continue
            slug = pick(item, "brandSlug", "slug", "brand", "canonicalBrandSlug").strip()
            url = pick(item, "assetUrl", "url", "logoUrl", "assetURL").strip()
            proof_page = pick(item, "firstPartyProofPage", "pageUrl", "firstPartyPage", "officialPageURL").strip()
            if slug not in by_slug or not url.startswith("https://"):
                continue
            display = by_slug[slug][1]
            entry = {"slug": slug, "displayName": display, "officialUrl": by_slug[slug][2],
                     "status": "missing", "provenance": None, "sourceUrl": url,
                     "proofPage": proof_page or None, "reason": None}
            try:
                # Independent verification of the research claim: the brand's own page must
                # actually reference this asset (normalized URL match), otherwise it is not
                # first-party-linked and the identity gate applies instead.
                linked = False
                if proof_page:
                    try:
                        page_bytes, page_type, final_page = fetch(proof_page, PAGE_MAX)
                        if allowed_host(final_page, proof_page) or site_of(
                                urllib.parse.urlparse(final_page).hostname or "") == site_of(
                                urllib.parse.urlparse(proof_page).hostname or ""):
                            html = page_bytes.decode("utf-8", errors="replace")
                            normalised = {urllib.parse.urljoin(proof_page, m) for m in
                                          re.findall(r'(?:src|href|data-src)\s*=\s*["\']([^"\']+)["\']', html)}
                            linked = url in normalised or any(
                                urllib.parse.urlparse(u).path == urllib.parse.urlparse(url).path for u in normalised)
                    except Exception as error:  # noqa: BLE001
                        entry["reason"] = f"proof page {type(error).__name__}"
                data, ctype, final_url = fetch(url, max(SVG_MAX, RASTER_MAX))
                provenance = "firstparty-linked-cdn" if linked else "research-secondary"
                entry.update(apply_asset(slug, display, data, ctype, final_url, provenance,
                                         identity_gate=(not linked)))
                entry["firstPartyLinkVerified"] = linked
                updates.append((slug, entry["file"]))
            except Exception as error:  # noqa: BLE001
                entry["reason"] = f"{type(error).__name__}:{str(error)[:70]}"
            log(f"candidate {slug}: {entry['status']}"
                + (f" {entry['reason']}" if entry['status'] != 'validated'
                   else f" [{entry['provenance']}, linkVerified={entry.get('firstPartyLinkVerified')}]"))
            cand_results.append(entry)
        results = cand_results
        validated = [r for r in results if r["status"] == "validated"]
        if args.apply and updates:
            statements = ["BEGIN;"]
            for slug, name in updates:
                statements.append(f"UPDATE thuong_hieu SET logo_file_name='{name}' WHERE slug='{slug}';")
            statements.append("COMMIT;")
            psql("\n".join(statements), db)
        receipt = {
            "generatedAt": fetched_at, "targetDatabase": db, "mode": "research-candidates",
            "candidatesFile": args.candidates,
            "policy": {"identity": "identity gate applies unless the brand's own page is re-verified to link the asset",
                       "validation": "same strict SVG allowlist / raster decode as discovery mode"},
            "counts": {"candidates": len(results), "validated": len(validated),
                       "firstPartyLinkedVerified": sum(1 for r in validated if r.get("firstPartyLinkVerified")),
                       "secondary": sum(1 for r in validated if r["provenance"] == "research-secondary"),
                       "missing": len(results) - len(validated)},
            "results": results,
            "updatesApplied": [{"slug": s, "logoFile": n} for s, n in updates] if args.apply else [],
        }
        Path(args.receipt).write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        Path(args.receipt).chmod(0o600)
        print(json.dumps(receipt["counts"]))
        return 0

    for slug, display, official in brands:
        entry = {"slug": slug, "displayName": display, "officialUrl": official, "status": "missing",
                 "provenance": None, "sourceUrl": None, "sourceHost": None, "sha256": None,
                 "mime": None, "file": None, "validation": None, "reason": None}
        html = ""
        if official:
            try:
                page, page_type, final_url = fetch(official, PAGE_MAX)
                if not allowed_host(final_url, official):
                    raise ValueError("redirected off-site")
                if "html" in page_type or "xml" in page_type:
                    html = page.decode("utf-8", errors="replace")
                else:
                    raise ValueError(f"unexpected page type {page_type}")
            except Exception as error:  # noqa: BLE001
                entry["reason"] = f"homepage {type(error).__name__}:{str(error)[:60]}"
                log(f"{slug}: {entry['reason']}")

        candidates, inline = discover_candidates(html, official) if html else ([], [])
        attempts: list[tuple[bytes, str, str]] = []
        for block in inline[:2]:
            attempts.append((block.encode("utf-8"), "image/svg+xml", official))
        for candidate in candidates[:3]:
            try:
                data, ctype, final_url = fetch(candidate, max(SVG_MAX, RASTER_MAX))
                if not allowed_host(final_url, official):
                    raise ValueError("redirected off-site")
                attempts.append((data, ctype, final_url))
            except Exception as error:  # noqa: BLE001
                entry["reason"] = f"asset {type(error).__name__}:{str(error)[:60]}"

        fallback_used = False
        if not any(True for _ in attempts) and slug in WIKI_FALLBACK:
            title, identity_tokens = WIKI_FALLBACK[slug]
            fallback = self_wiki_logo(slug, title, identity_tokens)
            if fallback is not None:
                attempts.append(fallback)
                fallback_used = True

        for data, ctype, source_url in attempts:
            try:
                is_svg = "svg" in (ctype or "") or b"<svg" in data[:400]
                # Identity is proven by the brand's own page for first-party assets; for the
                # secondary (Wikimedia) path the file name itself must identify the brand.
                if fallback_used and not identity_ok(slug, display, source_url):
                    raise ValueError("identity mismatch")
                if is_svg:
                    if len(data) > SVG_MAX:
                        raise ValueError("svg too large")
                    validation = validate_svg(data)
                    suffix, mime = ".svg", "image/svg+xml"
                else:
                    if len(data) > RASTER_MAX:
                        raise ValueError("raster too large")
                    validation = validate_raster(data)
                    suffix, mime = (".png" if "png" in (ctype or "") else ".jpg"), (ctype or "image/png")
                digest = sha256(data)
                name = str(uuid.uuid5(NAMESPACE, f"r4-logo:{slug}:{digest}")) + suffix
                target = media / name
                if not target.exists():
                    target.write_bytes(data)
                    target.chmod(0o600)
                elif sha256(target.read_bytes()) != digest:
                    raise ValueError("media collision")
                host = urllib.parse.urlparse(source_url).hostname or ""
                entry.update({"status": "validated",
                              "provenance": "wikimedia-secondary" if fallback_used else "brand-homepage",
                              "sourceUrl": source_url, "sourceHost": host, "sha256": digest,
                              "mime": mime, "file": name, "validation": validation,
                              "fetchedAt": fetched_at, "reason": None})
                updates.append((slug, name))
                break
            except Exception as error:  # noqa: BLE001
                entry["reason"] = f"{type(error).__name__}:{str(error)[:70]}"
                continue

        log(f"{slug}: {entry['status']} [{entry['provenance'] or '-'}]"
            + (f" {entry['reason']}" if entry["status"] != "validated" and entry["reason"] else ""))
        results.append(entry)
        time.sleep(1.0)

    validated = [r for r in results if r["status"] == "validated"]
    distinct_hashes = {r["sha256"] for r in validated}
    if args.apply and updates:
        statements = ["BEGIN;"]
        for slug, name in updates:
            statements.append(f"UPDATE thuong_hieu SET logo_file_name='{name}' WHERE slug='{slug}';")
        statements.append("COMMIT;")
        psql("\n".join(statements), db)
    receipt = {
        "generatedAt": fetched_at,
        "targetDatabase": db,
        "policy": {
            "firstParty": "asset referenced by the brand's own official page; same registrable site "
                          "(multi-label suffixes honored) and the final redirect host is re-checked",
            "secondary": "wikimedia-secondary = official brand artwork published on Wikipedia/Commons; "
                         "used only where the file name identifies the brand, reported with its real host, "
                         "never described as first-party",
            "svg": "parsed; tag/attribute allowlist; rejects on*/active tags/external, protocol-relative, "
                   "data:, javascript: and css url() references; internal #fragment refs allowed; max 200KB",
            "raster": "PIL verify+decode, max 1MB",
            "apply": bool(args.apply),
        },
        "counts": {"brands": len(results), "validated": len(validated),
                   "firstParty": sum(1 for r in validated if r["provenance"] == "brand-homepage"),
                   "secondary": sum(1 for r in validated if r["provenance"] == "wikimedia-secondary"),
                   "missing": len(results) - len(validated),
                   "distinctHashes": len(distinct_hashes)},
        "mediaDir": str(media),
        "results": results,
        "updatesApplied": [{"slug": s, "logoFile": n} for s, n in updates] if args.apply else [],
    }
    Path(args.receipt).write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    Path(args.receipt).chmod(0o600)
    print(json.dumps(receipt["counts"]))
    return 0


def self_wiki_logo(slug: str, title: str, identity_tokens: tuple[str, ...]) -> tuple[bytes, str, str] | None:
    """Official brand artwork from Wikipedia/Commons, identity-gated (secondary provenance)."""
    def search_commons() -> tuple[bytes, str, str] | None:
        api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search"
               f"&srnamespace=6&srlimit=10&srsearch={urllib.parse.quote(title + ' logo')}")
        raw, _, _ = fetch(api, 256 * 1024)
        for hit in (json.loads(raw).get("query") or {}).get("search") or []:
            name = str(hit.get("title") or "")
            low = name.lower()
            if not low.endswith(".svg") or "logo" not in low:
                continue
            if not any(token in low for token in identity_tokens):
                continue
            info = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
                    f"&iiprop=url&titles={urllib.parse.quote(name)}")
            raw2, _, _ = fetch(info, 256 * 1024)
            for page in ((json.loads(raw2).get("query") or {}).get("pages") or {}).values():
                for meta in page.get("imageinfo") or []:
                    url = meta.get("url")
                    if url:
                        blob, ctype, final_url = fetch(url, SVG_MAX)
                        return blob, ctype or "image/svg+xml", final_url
        return None

    try:
        raw, _, _ = fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages"
                         f"&piprop=original|name&titles={urllib.parse.quote(title)}", 256 * 1024)
        for page in ((json.loads(raw).get("query") or {}).get("pages") or {}).values():
            original = page.get("original") or {}
            source = original.get("source")
            name = str(page.get("pageimage") or "")
            if source and any(token in name.lower() for token in identity_tokens) and "logo" in name.lower():
                blob, ctype, final_url = fetch(source, max(SVG_MAX, RASTER_MAX))
                return blob, ctype, final_url
    except Exception as error:  # noqa: BLE001
        log(f"  wiki {slug}: {type(error).__name__}")
    try:
        return search_commons()
    except Exception as error:  # noqa: BLE001
        log(f"  commons {slug}: {type(error).__name__}")
        return None


if __name__ == "__main__":
    raise SystemExit(main())
