#!/usr/bin/env python3
"""Deterministic, guarded brand catalog importer.

Plan mode validates a manifest and prints the deterministic mapping without DB writes.
Apply mode writes only the explicitly named candidate DB/media namespace, using the
existing PostgreSQL container superuser. It is idempotent by brand slug, product
(brand, model), variant barcode and stock SKU.

No secrets are printed. No source/old DB/media is touched.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

TARGET_DB = "fasearch_brand_catalog_payments_20261102"
CONTAINER = "fasearch-loyalty-s2-20261031-55442"
SAFE_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")
SAFE_FILE = re.compile(r"^[A-Za-z0-9._-]+$")


class ImportError(ValueError):
    pass


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def lit(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _opt_str(value: Any, label: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ImportError(f"{label} must be a string or null")
    return value.strip() or None


def _opt_host(value: Any, key: tuple[str, str]) -> str | None:
    host = _opt_str(value, f"{key} sourceHost")
    if host is None:
        return None
    if not re.match(r"^[a-z0-9.-]+$", host.lower()):
        raise ImportError(f"{key} sourceHost must be a bare hostname")
    return host.lower()


def _opt_sha(value: Any, label: str) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not HEX64.match(value):
        raise ImportError(f"{label} must be a 64-char lowercase hex digest")
    return value


def _opt_num(value: Any, label: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        raise ImportError(f"{label} must be a non-negative number or null")
    return value


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip()
    return values


def validate_manifest(manifest: dict[str, Any], media_root: Path, logo_root: Path | None = None) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        raise ImportError("manifest must be an object")
    manifest_id = manifest.get("manifestId")
    if not isinstance(manifest_id, str) or not manifest_id.strip():
        raise ImportError("manifestId is required")
    brands = manifest.get("brands")
    products = manifest.get("products")
    if not isinstance(brands, list) or not brands:
        raise ImportError("brands must be a non-empty list")
    if not isinstance(products, list) or not products:
        raise ImportError("products must be a non-empty list")
    logo_root = logo_root or media_root

    brand_slugs: set[str] = set()
    normalized_brands: list[dict[str, Any]] = []
    for brand in brands:
        if not isinstance(brand, dict):
            raise ImportError("brand entries must be objects")
        slug = brand.get("slug")
        name = brand.get("name")
        if not isinstance(slug, str) or not SAFE_SLUG.match(slug):
            raise ImportError(f"invalid brand slug: {slug!r}")
        if slug in brand_slugs:
            raise ImportError(f"duplicate brand slug: {slug}")
        brand_slugs.add(slug)
        if not isinstance(name, str) or not name.strip():
            raise ImportError(f"brand {slug} missing name")
        official_url = brand.get("officialUrl")
        if official_url is not None and not isinstance(official_url, str):
            raise ImportError(f"brand {slug} officialUrl must be a string or null")
        official_url = official_url.strip() if isinstance(official_url, str) and official_url.strip() else None

        logo = brand.get("logo")
        flat_logo = None
        if brand.get("logoFile") is not None:
            flat_logo = {
                "file": Path(str(brand.get("logoFile"))).name,
                "sourceUrl": brand.get("logoSourceUrl"),
                "sha256": brand.get("logoSourceSha256"),
            }
        if logo is not None and flat_logo is not None:
            if (Path(str(logo.get("file"))).name != flat_logo["file"]
                    or logo.get("sourceUrl") != flat_logo["sourceUrl"]
                    or logo.get("sha256") != flat_logo["sha256"]):
                raise ImportError(f"brand {slug} conflicting nested/flat logo metadata")
        logo = logo or flat_logo
        normalized_logo = None
        if logo is not None:
            if not isinstance(logo, dict):
                raise ImportError(f"brand {slug} logo must be an object")
            file_name = Path(str(logo.get("file"))).name
            source_url = logo.get("sourceUrl")
            source_sha = logo.get("sha256")
            if not SAFE_FILE.match(file_name):
                raise ImportError(f"brand {slug} unsafe logo file")
            if not isinstance(source_url, str) or not source_url.strip():
                raise ImportError(f"brand {slug} logo missing sourceUrl")
            if not isinstance(source_sha, str) or not HEX64.match(source_sha):
                raise ImportError(f"brand {slug} logo missing sha256")
            source = logo_root / file_name
            if not source.is_file():
                raise ImportError(f"brand {slug} logo file missing: {file_name}")
            if sha256(source) != source_sha:
                raise ImportError(f"brand {slug} logo hash mismatch")
            normalized_logo = {"source": source, "sha256": source_sha, "file": file_name,
                               "sourceUrl": source_url.strip()}
        provenance_url = brand.get("provenanceUrl") or brand.get("logoSourcePage") or (normalized_logo["sourceUrl"] if normalized_logo else None)
        provenance_sha = brand.get("provenanceSha256") or (normalized_logo["sha256"] if normalized_logo else None)
        normalized_brands.append({
            "slug": slug, "name": name.strip(), "country": brand.get("country"),
            "officialUrl": official_url,
            "provenanceUrl": provenance_url,
            "provenanceSha256": provenance_sha,
            "logo": normalized_logo,
        })

    product_keys: set[tuple[str, str]] = set()
    barcodes: set[str] = set()
    normalized_products: list[dict[str, Any]] = []
    for product in products:
        if not isinstance(product, dict):
            raise ImportError("product entries must be objects")
        brand_slug = product.get("brandSlug")
        model = product.get("model")
        name = product.get("name")
        category = product.get("categoryName")
        if brand_slug not in brand_slugs:
            raise ImportError(f"product references unknown brand: {brand_slug!r}")
        if not isinstance(model, str) or not model.strip():
            raise ImportError(f"product {brand_slug} missing model")
        key = (brand_slug, model.strip())
        if key in product_keys:
            raise ImportError(f"duplicate product model: {key}")
        product_keys.add(key)
        if not isinstance(name, str) or not name.strip():
            raise ImportError(f"product {key} missing name")
        if not isinstance(category, str) or not category.strip():
            raise ImportError(f"product {key} missing categoryName")
        price = product.get("demoPriceVnd")
        if isinstance(price, bool) or not isinstance(price, int) or price <= 0:
            raise ImportError(f"product {key} demoPriceVnd must be a positive integer")
        if not isinstance(product.get("sourceUrl"), str) or not product["sourceUrl"].strip():
            raise ImportError(f"product {key} missing sourceUrl")
        source_sha = product.get("sourceSha256")
        source_hash = product.get("sourceHash")
        if source_sha is not None and source_hash is not None and source_sha != source_hash:
            raise ImportError(f"product {key} conflicting sourceSha256/sourceHash")
        source_sha = source_sha or source_hash
        if not isinstance(source_sha, str) or not HEX64.match(source_sha):
            raise ImportError(f"product {key} missing sourceSha256/sourceHash")
        media = product.get("media")
        if not isinstance(media, list) or not media:
            raise ImportError(f"product {key} needs at least one media item")
        normalized_media = []
        media_hashes: set[str] = set()
        for item in media:
            if not isinstance(item, dict):
                raise ImportError(f"product {key} media must be objects")
            file_name = Path(str(item.get("file"))).name
            source_url = item.get("sourceUrl")
            media_sha = item.get("sha256")
            if not SAFE_FILE.match(file_name):
                raise ImportError(f"product {key} unsafe media file")
            if not isinstance(source_url, str) or not source_url.strip():
                raise ImportError(f"product {key} media missing sourceUrl")
            if not isinstance(media_sha, str) or not HEX64.match(media_sha):
                raise ImportError(f"product {key} media missing sha256")
            source = media_root / file_name
            if not source.is_file():
                raise ImportError(f"product {key} media missing: {file_name}")
            if sha256(source) != media_sha:
                raise ImportError(f"product {key} media hash mismatch: {file_name}")
            header = source.read_bytes()[:12]
            if not (header.startswith(b"\xff\xd8\xff") or header.startswith(b"\x89PNG\r\n\x1a\n") or header[:4] == b"RIFF"):
                raise ImportError(f"product {key} media is not a supported image: {file_name}")
            media_hashes.add(media_sha)
            normalized_media.append({"source": source, "sha256": media_sha, "file": file_name,
                                     "sourceUrl": source_url.strip(),
                                     "license": item.get("license"), "artist": item.get("artist")})
        if source_sha not in media_hashes:
            raise ImportError(f"product {key} source hash does not match any media hash")
        variants = product.get("variants")
        if not isinstance(variants, list) or not variants:
            raise ImportError(f"product {key} needs variants")
        normalized_variants = []
        for variant in variants:
            if not isinstance(variant, dict):
                raise ImportError(f"product {key} variant must be objects")
            color = variant.get("color")
            if color is not None and not isinstance(color, str):
                raise ImportError(f"product {key} variant color must be string or null")
            color = color.strip() if isinstance(color, str) and color.strip() else None
            size = variant.get("size")
            if isinstance(size, int) and not isinstance(size, bool):
                size = str(size)
            stock = variant.get("stock")
            barcode_color = color if color else "UNK"
            barcode = variant.get("barcode") or f"BR-{brand_slug.upper()}-{model.upper()}-{barcode_color.upper()}-{str(size).upper()}"
            barcode = re.sub(r"[^A-Z0-9-]", "-", str(barcode).upper())
            if not isinstance(size, str) or not size.strip():
                raise ImportError(f"product {key} variant needs size")
            if isinstance(stock, bool) or not isinstance(stock, int) or stock < 0:
                raise ImportError(f"product {key} variant stock must be non-negative")
            if barcode in barcodes:
                raise ImportError(f"duplicate barcode: {barcode}")
            barcodes.add(barcode)
            normalized_variants.append({"color": color, "size": size.strip(),
                                    "stock": stock, "barcode": barcode,
                                    "sourceVariantId": _opt_str(variant.get("sourceVariantId"), f"{key} variant sourceVariantId"),
                                    "sourceSku": _opt_str(variant.get("sourceSku"), f"{key} variant sourceSku"),
                                    "sourcePrice": _opt_num(variant.get("sourcePrice"), f"{key} variant sourcePrice"),
                                    "sourceAvailable": variant.get("sourceAvailable") if isinstance(variant.get("sourceAvailable"), bool) else None})
        normalized_products.append({
            "brandSlug": brand_slug, "model": model.strip(), "name": name.strip(),
            "categoryName": category.strip(), "description": product.get("description"),
            "demoPriceVnd": price, "sourceUrl": product["sourceUrl"].strip(),
            "sourceSha256": source_sha, "media": normalized_media,
            "variants": normalized_variants,
            "material": product.get("material"), "style": product.get("style"),
            "sourceHost": _opt_host(product.get("sourceHost"), key),
            "sourcePayloadSha256": _opt_sha(product.get("sourcePayloadSha256"), f"{key} sourcePayloadSha256"),
            "sourceProductId": _opt_str(product.get("sourceProductId"), f"{key} sourceProductId"),
            "sourceFetchedAt": _opt_str(product.get("sourceFetchedAt"), f"{key} sourceFetchedAt"),
            "sourcePrice": _opt_num(product.get("sourcePrice"), f"{key} sourcePrice"),
            "sourceCurrency": _opt_str(product.get("sourceCurrency"), f"{key} sourceCurrency"),
            "sourceBrand": _opt_str(product.get("sourceBrand"), f"{key} sourceBrand"),
            "curationClass": _opt_str(product.get("curationClass"), f"{key} curationClass") or "SOURCED",
        })
    return {
        "manifestId": manifest_id.strip(),
        "manifestSha256": hashlib.sha256(json.dumps(manifest, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
        "brands": normalized_brands, "products": normalized_products,
    }


def deterministic_name(brand_slug: str, model: str, file_sha: str, suffix: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"brand-catalog:{brand_slug}:{model}:{file_sha}")) + suffix


def plan(validated: dict[str, Any], target_db: str = TARGET_DB) -> dict[str, Any]:
    brands = []
    for brand in validated["brands"]:
        logo = None
        if brand["logo"]:
            logo = deterministic_name(brand["slug"], "logo", brand["logo"]["sha256"],
                                      Path(brand["logo"]["file"]).suffix.lower())
        brands.append({"slug": brand["slug"], "name": brand["name"], "logoFileName": logo})
    products = []
    for product in validated["products"]:
        media = []
        for item in product["media"]:
            name = deterministic_name(product["brandSlug"], product["model"], item["sha256"],
                                      Path(item["file"]).suffix.lower())
            media.append({"targetFileName": name, "sha256": item["sha256"], "imageUrl": f"/api/v1/products/images/{name}"})
        products.append({
            "brandSlug": product["brandSlug"], "model": product["model"], "name": product["name"],
            "categoryName": product["categoryName"], "demoPriceVnd": product["demoPriceVnd"],
            "variants": len(product["variants"]), "media": media,
        })
    return {
        "manifestId": validated["manifestId"],
        "manifestSha256": validated["manifestSha256"],
        "targetDb": target_db,
        "counts": {"brands": len(brands), "products": len(products),
                   "variants": sum(p["variants"] for p in products),
                   "media": sum(len(p["media"]) for p in products),
                   "unknownColorVariants": sum(1 for p in validated["products"] for v in p["variants"] if v["color"] is None)},
        "brands": brands, "products": products,
    }


def psql(sql: str, target_db: str = TARGET_DB) -> str:
    if not re.match(r"^[a-z0-9_]{1,63}$", target_db) or not target_db.startswith("fasearch_"):
        raise ImportError(f"refusing unsafe database name {target_db!r}")
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c",
         f'psql -U "$POSTGRES_USER" -d {target_db} -v ON_ERROR_STOP=1 -At'],
        input=sql.encode(), capture_output=True, check=False)
    if result.returncode != 0:
        raise ImportError(result.stderr.decode(errors="replace")[:600])
    return result.stdout.decode(errors="replace").strip()


def copy_asset(source: Path, target_dir: Path, name: str, expected_sha: str) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    target_dir.chmod(0o700)
    target = target_dir / name
    if target.exists():
        if sha256(target) != expected_sha:
            raise ImportError(f"target media collision: {target}")
        return target
    shutil.copyfile(source, target)
    target.chmod(0o600)
    if sha256(target) != expected_sha:
        target.unlink(missing_ok=True)
        raise ImportError(f"copied media hash mismatch: {target}")
    return target


def build_sql(validated: dict[str, Any], media_map: dict[tuple[str, str], list[dict[str, Any]]], update_stock: bool) -> str:
    statements: list[str] = ["BEGIN;"]
    for brand in validated["brands"]:
        logo_name = None
        if brand["logo"]:
            logo_name = deterministic_name(brand["slug"], "logo", brand["logo"]["sha256"],
                                           Path(brand["logo"]["file"]).suffix.lower())
        statements.append(
            "INSERT INTO thuong_hieu (ten_thuong_hieu, slug, quoc_gia, logo_file_name, official_url, provenance_url, provenance_sha256, da_xoa) "
            f"VALUES ({lit(brand['name'])}, {lit(brand['slug'])}, {lit(brand['country'])}, {lit(logo_name)}, "
            f"{lit(brand['officialUrl'])}, {lit(brand['provenanceUrl'])}, {lit(brand['provenanceSha256'])}, FALSE) "
            "ON CONFLICT (slug) DO UPDATE SET ten_thuong_hieu=EXCLUDED.ten_thuong_hieu, quoc_gia=EXCLUDED.quoc_gia, "
            # A manifest brand without a logo must never wipe a verified logo that is already stored.
            "logo_file_name=COALESCE(EXCLUDED.logo_file_name, thuong_hieu.logo_file_name), "
            "official_url=COALESCE(EXCLUDED.official_url, thuong_hieu.official_url), "
            "provenance_url=EXCLUDED.provenance_url, provenance_sha256=EXCLUDED.provenance_sha256, da_xoa=FALSE;"
        )
    for product in validated["products"]:
        key = (product["brandSlug"], product["model"])
        media = media_map[key]
        image_url = media[0]["imageUrl"]
        category = product["categoryName"]
        statements.append(
            "INSERT INTO danh_muc (ten_danh_muc, da_xoa) SELECT "
            f"{lit(category)}, FALSE WHERE NOT EXISTS (SELECT 1 FROM danh_muc WHERE ten_danh_muc={lit(category)} AND da_xoa=false);"
        )
        statements.append(
            "INSERT INTO san_pham (ten_sp, ma_danh_muc, ma_thuong_hieu, model_code, chat_lieu, kieu_dang, mo_ta, gia_ban, trang_thai, hinh_anh_sp, da_xoa, "
            "source_host, source_product_id, source_url, source_payload_sha256, source_fetched_at, source_price, source_currency, source_brand, curation_class) "
            f"SELECT {lit(product['name'])}, "
            f"(SELECT ma_danh_muc FROM danh_muc WHERE ten_danh_muc={lit(category)} AND da_xoa=false ORDER BY ma_danh_muc LIMIT 1), "
            f"(SELECT ma_thuong_hieu FROM thuong_hieu WHERE slug={lit(product['brandSlug'])}), "
            f"{lit(product['model'])}, {lit(product['material'])}, {lit(product['style'])}, "
            f"{lit(product['description'])}, {product['demoPriceVnd']}, 'ACTIVE', {lit(image_url)}, FALSE, "
            f"{lit(product.get('sourceHost'))}, {lit(product.get('sourceProductId'))}, {lit(product['sourceUrl'])}, "
            f"{lit(product.get('sourcePayloadSha256') or product['sourceSha256'])}, {lit(product.get('sourceFetchedAt'))}, {lit(product.get('sourcePrice'))}, "
            f"{lit(product.get('sourceCurrency'))}, {lit(product.get('sourceBrand'))}, {lit(product.get('curationClass') or 'SOURCED')} "
            "ON CONFLICT (ma_thuong_hieu, model_code) DO UPDATE SET ten_sp=EXCLUDED.ten_sp, ma_danh_muc=EXCLUDED.ma_danh_muc, "
            "chat_lieu=EXCLUDED.chat_lieu, kieu_dang=EXCLUDED.kieu_dang, mo_ta=EXCLUDED.mo_ta, gia_ban=EXCLUDED.gia_ban, "
            "trang_thai=EXCLUDED.trang_thai, hinh_anh_sp=EXCLUDED.hinh_anh_sp, da_xoa=FALSE, "
            "source_host=EXCLUDED.source_host, source_product_id=EXCLUDED.source_product_id, "
            "source_url=EXCLUDED.source_url, source_payload_sha256=EXCLUDED.source_payload_sha256, "
            "source_fetched_at=EXCLUDED.source_fetched_at, source_price=EXCLUDED.source_price, "
            "source_currency=EXCLUDED.source_currency, source_brand=EXCLUDED.source_brand, "
            "curation_class=EXCLUDED.curation_class;"
        )
        for variant in product["variants"]:
            statements.append(
                "INSERT INTO bien_the_sp (ma_sp, mau_sac, kich_co, ma_vach, da_xoa, gia_phu_thu, "
                "source_variant_id, source_sku, source_price, source_available) "
                f"SELECT p.ma_sp, {lit(variant['color'])}, {lit(variant['size'])}, {lit(variant['barcode'])}, FALSE, 0, "
                f"{lit(variant.get('sourceVariantId'))}, {lit(variant.get('sourceSku'))}, "
                f"{lit(variant.get('sourcePrice'))}, {lit(variant.get('sourceAvailable'))} "
                "FROM san_pham p JOIN thuong_hieu b ON b.ma_thuong_hieu=p.ma_thuong_hieu "
                f"WHERE b.slug={lit(product['brandSlug'])} AND p.model_code={lit(product['model'])} "
                "ON CONFLICT (ma_vach) DO UPDATE SET ma_sp=EXCLUDED.ma_sp, mau_sac=EXCLUDED.mau_sac, "
                "kich_co=EXCLUDED.kich_co, da_xoa=FALSE, gia_phu_thu=0, "
                "source_variant_id=EXCLUDED.source_variant_id, source_sku=EXCLUDED.source_sku, "
                "source_price=EXCLUDED.source_price, source_available=EXCLUDED.source_available;"
            )
            stock_update = "nguong_toi_thieu=2, ngay_cap_nhat=NOW(), da_xoa=FALSE"
            if update_stock:
                stock_update += ", so_luong_vat_ly=EXCLUDED.so_luong_vat_ly, so_luong_tam_giu=0, so_luong_kha_dung=EXCLUDED.so_luong_kha_dung"
            statements.append(
                "INSERT INTO ton_kho (ma_sku, so_luong_vat_ly, so_luong_tam_giu, so_luong_kha_dung, nguong_toi_thieu, ngay_cap_nhat, da_xoa) "
                f"SELECT v.ma_sku, {variant['stock']}, 0, {variant['stock']}, 2, NOW(), FALSE "
                f"FROM bien_the_sp v WHERE v.ma_vach={lit(variant['barcode'])} "
                f"ON CONFLICT (ma_sku) DO UPDATE SET {stock_update};"
            )
    statements.append("COMMIT;")
    return "\n".join(statements) + "\n"


def apply(validated: dict[str, Any], media_dir: Path, logo_dir: Path, out: Path, env_file: Path,
          update_stock: bool = False, target_db: str = TARGET_DB) -> dict[str, Any]:
    env = read_env(env_file)
    if env.get("DB_NAME") != target_db:
        raise ImportError(f"target guard failed: env DB_NAME is not {target_db}")
    current = psql("SELECT current_database();", target_db)
    if current != target_db:
        raise ImportError(f"connected DB {current!r} is not {target_db}")

    barcodes = [v["barcode"] for p in validated["products"] for v in p["variants"]]
    if update_stock and barcodes:
        in_list = ", ".join(lit(code) for code in barcodes)
        held = psql(
            "SELECT v.ma_vach FROM bien_the_sp v JOIN ton_kho t ON t.ma_sku=v.ma_sku "
            f"WHERE v.ma_vach IN ({in_list}) AND t.so_luong_tam_giu > 0;", target_db
        )
        if held:
            raise ImportError("explicit stock update refused: active reserved stock exists")

    created: list[Path] = []
    media_map: dict[tuple[str, str], list[dict[str, Any]]] = {}
    try:
        for brand in validated["brands"]:
            if brand["logo"]:
                name = deterministic_name(brand["slug"], "logo", brand["logo"]["sha256"],
                                          Path(brand["logo"]["file"]).suffix.lower())
                target = logo_dir / name
                if not target.exists():
                    copy_asset(brand["logo"]["source"], logo_dir, name, brand["logo"]["sha256"])
                    created.append(target)
        for product in validated["products"]:
            key = (product["brandSlug"], product["model"])
            media_map[key] = []
            for item in product["media"]:
                name = deterministic_name(product["brandSlug"], product["model"], item["sha256"],
                                          Path(item["file"]).suffix.lower())
                target = media_dir / name
                if not target.exists():
                    copy_asset(item["source"], media_dir, name, item["sha256"])
                    created.append(target)
                media_map[key].append({"fileName": name, "sha256": item["sha256"],
                                       "imageUrl": f"/api/v1/products/images/{name}"})
        psql(build_sql(validated, media_map, update_stock), target_db)
    except Exception:
        for target in created:
            target.unlink(missing_ok=True)
        raise

    brand_rows = psql("SELECT slug, ma_thuong_hieu FROM thuong_hieu WHERE slug IN (" +
                      ", ".join(lit(b["slug"]) for b in validated["brands"]) + ");", target_db)
    brand_ids = {}
    for line in brand_rows.splitlines():
        if "|" in line:
            slug, value = line.split("|", 1)
            brand_ids[slug] = int(value)
    product_rows = psql(
        "SELECT b.slug, p.model_code, p.ma_sp FROM san_pham p JOIN thuong_hieu b ON b.ma_thuong_hieu=p.ma_thuong_hieu "
        "WHERE b.slug IN (" + ", ".join(lit(b["slug"]) for b in validated["brands"]) + ");", target_db
    )
    product_ids = []
    for line in product_rows.splitlines():
        parts = line.split("|")
        if len(parts) == 3:
            product_ids.append({"brandSlug": parts[0], "model": parts[1], "productId": int(parts[2])})
    receipt = plan(validated, target_db)
    receipt["applied"] = True
    receipt["stockUpdateMode"] = "explicit" if update_stock else "seed-only"
    receipt["brandIds"] = brand_ids
    receipt["productIds"] = product_ids
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    out.chmod(0o600)
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--media-root", required=True)
    parser.add_argument("--logo-root", default=None)
    parser.add_argument("--media-dir", default="/home/dolakhoa/projects/fasearch-migration/runtime/private/brand-catalog-payments/media/products")
    parser.add_argument("--logo-dir", default="/home/dolakhoa/projects/fasearch-migration/runtime/private/brand-catalog-payments/media/brands")
    parser.add_argument("--db-env", default="/home/dolakhoa/.config/fasearch/brand-payments-sandbox.env")
    parser.add_argument("--out", default="/home/dolakhoa/projects/fasearch-migration/runtime/private/brand-catalog-payments/import-receipt.json")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--target-db", default=TARGET_DB)
    parser.add_argument("--update-stock", action="store_true", help="explicitly update stock quantities; refused if reserved stock exists")
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    validated = validate_manifest(manifest, Path(args.media_root), Path(args.logo_root) if args.logo_root else None)
    if not args.apply:
        print(json.dumps(plan(validated, args.target_db), ensure_ascii=False, indent=2))
        return 0
    receipt = apply(validated, Path(args.media_dir), Path(args.logo_dir), Path(args.out), Path(args.db_env), args.update_stock, args.target_db)
    print(json.dumps({"applied": True, "counts": receipt["counts"], "out": args.out}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportError as error:
        print(json.dumps({"status": "REJECTED", "reason": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
