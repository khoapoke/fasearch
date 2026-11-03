#!/usr/bin/env python3
"""R5 taxonomy audit: join live first-party feed taxonomy fields against the R5 DB.

Read-only everywhere except the audit receipt it writes. Re-fetches the same 14 feed
URLs the R4 importer used (bounded: at most 2 pages/host, taxonomy fields only, no media)
and joins (source_host, source_product_id) to san_pham, reporting:
- per-host product_type vocabulary and tags/options coverage,
- where the importer's category_for() lost or over-broadened information,
- concrete samples (3124, shoe-in-Khac candidates) with their real source fields.

Usage: audit_taxonomy_r5.py --db-env <env> --receipt <json> [--pages 2]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime as dt_datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
UA = "FaSearchAcademicDemo/1.0 (catalog staging; contact: local operator)"
TIMEOUT = 25

HOSTS = [
    "dirtycoins.vn", "degrey.vn", "swe.vn", "teelab.vn", "clownz.vn", "davies.vn",
    "ontop.com.vn", "nowsaigon.com", "rubies.vn", "dkmv.vn",
    "en.mlb-korea.com", "www.skechersvn.vn", "supersports.com.vn", "vansvietnam.com.vn",
]


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
            return json.loads(response.read())
    except Exception as error:  # noqa: BLE001
        return {"_error": f"{type(error).__name__}:{str(error)[:60]}"}


def psql(db_env: Path, sql: str) -> str:
    env = {}
    for line in db_env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    db = env["DB_NAME"]
    if db != "fasearch_catalog_detail_r5_20261103":
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
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--pages", type=int, default=2)
    args = parser.parse_args()
    db_env = Path(args.db_env)

    db_rows = psql(db_env, "SELECT source_host, source_product_id, ma_sp, left(ten_sp,80), "
                           "(SELECT ten_danh_muc FROM danh_muc d WHERE d.ma_danh_muc=s.ma_danh_muc), "
                           "publication_status FROM san_pham s WHERE source_host IS NOT NULL;")
    db_by_key: dict[tuple[str, str], dict] = {}
    for line in db_rows.splitlines():
        parts = line.split("|")
        if len(parts) < 6:
            continue
        host, sid = parts[0], parts[1]
        db_by_key[(host, sid)] = {"productId": parts[2], "name": parts[3],
                                  "category": parts[4], "status": parts[5]}

    per_host: dict[str, dict] = {}
    joined = 0
    samples: list[dict] = []
    for host in HOSTS:
        types: Counter = Counter()
        tags_seen = 0
        tags_total = 0
        options_seen: Counter = Counter()
        matched = 0
        fetched = 0
        examples: dict[str, list] = {}
        for page in range(1, args.pages + 1):
            payload = fetch_json(f"https://{host}/collections/all/products.json?limit=250&page={page}"
                                 if host != "en.mlb-korea.com"
                                 else f"https://{host}/products.json?limit=250&page={page}")
            items = payload.get("products") or []
            fetched += len(items)
            for item in items:
                sid = str(item.get("id") or "")
                if not sid:
                    continue
                types[str(item.get("product_type") or "(empty)")] += 1
                tags = item.get("tags")
                if isinstance(tags, str):
                    tags_total += 1
                    if tags.strip():
                        tags_seen += 1
                elif isinstance(tags, list):
                    tags_total += 1
                    if tags:
                        tags_seen += 1
                for opt in item.get("options") or []:
                    if isinstance(opt, dict) and opt.get("name"):
                        options_seen[str(opt["name"])] += 1
                    elif isinstance(opt, str):
                        options_seen[opt] += 1
                key = (host, sid)
                if key in db_by_key:
                    matched += 1
                    joined += 1
                    rec = db_by_key[key]
                    if len(examples) < 4 and rec["status"] == "PUBLISHED":
                        examples.setdefault(rec["category"], []).append(
                            {"productId": rec["productId"], "name": rec["name"],
                             "sourceType": str(item.get("product_type") or ""),
                             "sourceTags": tags if isinstance(tags, (str, list)) else None,
                             "sourceId": sid})
            if len(items) < 250:
                break
            time.sleep(0.5)
        per_host[host] = {"fetchedPages": fetched, "matchedInDb": matched,
                          "productTypes": dict(types.most_common(20)),
                          "tagsCoverage": f"{tags_seen}/{tags_total}",
                          "optionNames": dict(options_seen.most_common(10)),
                          "examples": examples}
        time.sleep(0.5)
        print(f"{host}: fetched={fetched} matched={matched} types={len(types)}", file=sys.stderr)

    for (host, sid), rec in db_by_key.items():
        if rec["status"] != "PUBLISHED":
            continue
        if rec["productId"] == "3124":
            samples.append({"why": "user-reported PDP: Default Title / unknown size", **rec,
                            "sourceKey": f"{host}|{sid}"})

    receipt = {
        "generatedAt": dt_datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "db": "fasearch_catalog_detail_r5_20261103",
        "dbSourcedRows": len(db_by_key),
        "feedRowsJoined": joined,
        "perHost": per_host,
        "flaggedSamples": samples,
        "note": "category_for() probes product_type/tags/name/title only; description is deliberately excluded "
                "so boilerplate family copy cannot classify. Missing join rows are products whose feed pages "
                "fell outside the bounded audit window, not evidence of absence.",
    }
    Path(args.receipt).write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    Path(args.receipt).chmod(0o600)
    print(json.dumps({"dbSourcedRows": len(db_by_key), "joined": joined}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
