#!/usr/bin/env python3
"""Deterministic curation for the catalog candidate DB (candidate-only, no deletes).

Rules (ordered, first match wins). Each row keeps its id, media and order references;
only the public visibility flags change, so historical orders and drafts still resolve.

1. SOURCED      - has first-party source identity (source_host + source_product_id) -> PUBLISHED
2. CURATED_GLOBAL - branded row preserved from the reviewed global baseline, backfilled
                    with its Commons provenance -> PUBLISHED
3. BASELINE_FIXTURE - unbranded seed row without brand/model/source identity -> UNPUBLISHED
4. Anything else -> UNPUBLISHED with curation_class UNCLASSIFIED (reported, never guessed)

Usage: curate_catalog.py --db-env <env> --target-db <db> --attribution <parent manifest> --receipt <json>
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"


def psql(sql: str, target_db: str) -> str:
    if not target_db.startswith("fasearch_") or "@" in target_db or " " in target_db:
        raise SystemExit(f"refusing unsafe database name {target_db!r}")
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "sh", "-c",
         f'psql -U "$POSTGRES_USER" -d {target_db} -v ON_ERROR_STOP=1 -At'],
        input=sql.encode(), capture_output=True, check=False)
    if result.returncode != 0:
        raise SystemExit(result.stderr.decode(errors="replace")[:800])
    return result.stdout.decode(errors="replace").strip()


# Must stay in sync with common/enums/ProductStatus.java. A status outside this set makes
# Hibernate throw on hydration and surfaces as an anonymous HTTP 500, so curation fails instead.
ALLOWED_PRODUCT_STATUS = ("DRAFT", "ACTIVE", "OUT_OF_STOCK", "DISCONTINUED")
ENUM_GUARD_SQL = (
    "DO $$ DECLARE bad int; BEGIN "
    "SELECT count(*) INTO bad FROM san_pham WHERE trang_thai NOT IN ("
    + ", ".join("'" + status + "'" for status in ALLOWED_PRODUCT_STATUS) + "); "
    "IF bad > 0 THEN RAISE EXCEPTION 'curation produced % row(s) with a status outside ProductStatus', bad; "
    "END IF; END $$;")


def lit(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-db", required=True)
    parser.add_argument("--attribution", required=True, help="parent PRODUCT-MEDIA-MANIFEST.json")
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    db = args.target_db

    parent = json.loads(Path(args.attribution).read_text(encoding="utf-8"))
    statements = ["BEGIN;"]
    backfilled = []
    for product in parent.get("products", []):
        source_url = product.get("sourceUrl")
        if not source_url:
            continue
        host = source_url.split("/")[2].lower() if source_url.startswith("http") else None
        if not host:
            continue
        # deterministic identity: host + the Commons file title (stable, human-checkable)
        file_title = source_url.split("File%3A")[-1] if "File%3A" in source_url else None
        if not file_title:
            continue
        source_product_id = file_title.replace("_", " ")[:90]
        statements.append(
            "UPDATE san_pham p SET source_host=" + lit(host) + ", source_product_id=" + lit(source_product_id)
            + ", source_url=" + lit(source_url) + ", source_fetched_at=NULL, source_currency='VND'"
            + " FROM thuong_hieu b WHERE b.ma_thuong_hieu=p.ma_thuong_hieu AND b.slug="
            + lit(product["brandSlug"]) + " AND p.model_code=" + lit(product["model"])
            + " AND p.source_host IS NULL;")
        statements.append(
            "UPDATE san_pham p SET curation_class='CURATED_GLOBAL' FROM thuong_hieu b "
            "WHERE b.ma_thuong_hieu=p.ma_thuong_hieu AND b.slug=" + lit(product["brandSlug"])
            + " AND p.model_code=" + lit(product["model"]) + ";")
        backfilled.append({"brandSlug": product["brandSlug"], "model": product["model"], "host": host})

    # 1. SOURCED -> published
    statements.append("UPDATE san_pham SET curation_class='SOURCED', publication_status='PUBLISHED', trang_thai='ACTIVE' "
                      "WHERE source_host IS NOT NULL AND source_product_id IS NOT NULL AND curation_class IS NULL;")
    # 2. publish curated rows (global baseline was tagged CURATED_GLOBAL during backfill)
    statements.append("UPDATE san_pham SET publication_status='PUBLISHED', trang_thai='ACTIVE' "
                      "WHERE curation_class IN ('SOURCED','CURATED_GLOBAL');")
    # 3. unbranded seed fixtures -> hidden, preserved
    statements.append("UPDATE san_pham SET curation_class='BASELINE_FIXTURE', publication_status='UNPUBLISHED', trang_thai='DISCONTINUED' "
                      "WHERE ma_thuong_hieu IS NULL AND model_code IS NULL;")
    # 4. anything unresolved stays hidden and is reported
    statements.append("UPDATE san_pham SET curation_class='UNCLASSIFIED', publication_status='UNPUBLISHED', trang_thai='DISCONTINUED' "
                      "WHERE curation_class IS NULL;")
    statements.append(ENUM_GUARD_SQL)
    statements.append("COMMIT;")
    psql("\n".join(statements), db)

    distribution = psql("SELECT COALESCE(curation_class,'-')||'|'||publication_status||'|'||count(*) "
                        "FROM (SELECT curation_class, publication_status FROM san_pham) s "
                        "GROUP BY curation_class, publication_status ORDER BY 1;", db)
    attributable = psql("SELECT count(*) FROM san_pham WHERE source_host IS NOT NULL;", db)
    receipt = {
        "targetDb": db,
        "parentAttributionManifest": args.attribution,
        "parentAttributionSha256": hashlib.sha256(Path(args.attribution).read_bytes()).hexdigest(),
        "backfilledGlobal": len(backfilled),
        "rowsWithSource": int(attributable or 0),
        "curation": [line.split("|") for line in distribution.splitlines() if line],
        "rules": [
            "SOURCED: first-party source identity -> PUBLISHED",
            "CURATED_GLOBAL: branded global baseline backfilled from Commons provenance -> PUBLISHED",
            "BASELINE_FIXTURE: unbranded seed row without brand/model/source -> UNPUBLISHED (ids/orders preserved)",
            "UNCLASSIFIED: unresolved -> UNPUBLISHED and reported",
        ],
        "deletes": 0,
    }
    out = Path(args.receipt)
    out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")
    out.chmod(0o600)
    print(json.dumps({"backfilled": len(backfilled), "withSource": receipt["rowsWithSource"],
                      "curation": receipt["curation"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
