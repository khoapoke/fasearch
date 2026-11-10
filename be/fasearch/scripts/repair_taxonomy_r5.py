#!/usr/bin/env python3
"""Deterministic taxonomy repair for the R5 candidate DB (new DB only, idempotent).

Reads live first-party feed taxonomy fields (bounded re-fetch, no media), joins
(source_host, source_product_id), and:
1. stores raw provenance in san_pham.source_product_type / san_pham.source_tags (V20),
2. remaps san_pham.ma_danh_muc to the canonical set via an explicit reviewed table,
3. renames 4 existing category labels and creates the Set/Bộ row (ids otherwise stable),
4. writes a before/after manifest + sha256; --apply runs one transaction; reruns are no-ops.

Unmatched/empty/singleton-uncertain rows stay Khác (honest). Fixtures (source_host NULL)
are never touched. No product/SKU/stock/price/order/media/id change, no row deletes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
DB = "fasearch_catalog_detail_r5_20261103"
UA = "FaSearchAcademicDemo/1.0 (catalog staging; contact: local operator)"
TIMEOUT = 25

CANONICAL = {
    "ao-kieu": "Áo kiểu",
    "ao-thun": "Áo thun",
    "ao-somi-polo": "Áo sơ mi & Polo",
    "ao-khoac-hoodie": "Áo khoác & Hoodie",
    "quan": "Quần",
    "vay": "Váy",
    "giay": "Giày",
    "non": "Nón",
    "tui-balo": "Túi & Balo",
    "phu-kien": "Phụ kiện",
    "set-bo": "Set/Bộ",
    "khac": "Khác",
}
REUSE_IDS = {"ao-kieu": 12, "ao-thun": 15, "ao-somi-polo": 8, "ao-khoac-hoodie": 5, "quan": 73,
             "vay": 92, "giay": 107, "non": 54, "tui-balo": 105, "phu-kien": 103, "khac": 106}
LABEL_RENAMES = {8: "Áo sơ mi & Polo", 5: "Áo khoác & Hoodie", 54: "Nón", 105: "Túi & Balo"}

# normalized source product_type -> canonical key (exact match after fold)
TYPE_MAP = {
    # teelab
    "ao thun (ts)": "ao-thun", "ao khoac (ak)": "ao-khoac-hoodie", "quan dai (ps)": "quan",
    "hoodie sweater (hd)": "ao-khoac-hoodie", "phu kien (ac)": "phu-kien",
    "quan short (sh)": "quan", "ao so mi (ss)": "ao-somi-polo", "ao polo (ap)": "ao-somi-polo",
    # clownz
    "tees & polo shirts": "ao-thun", "tees & polo": "ao-thun", "caps": "non", "cap": "non",
    "jackets & vests": "ao-khoac-hoodie", "hoodie": "ao-khoac-hoodie", "accessory": "phu-kien",
    "tui cheo": "tui-balo", "so mi & flannel shirts": "ao-somi-polo",
    "short & trunks": "quan", "pants & jeans": "quan",
    # davies
    "ao thun": "ao-thun", "ao thun nu": "ao-thun", "ao thun nam": "ao-thun",
    "ao khoac": "ao-khoac-hoodie", "ao khoac nu": "ao-khoac-hoodie",
    "phu kien nam": "phu-kien", "phu kien nu": "phu-kien",
    "quan nam": "quan", "quan": "quan", "ao hoodie": "ao-khoac-hoodie", "hoodie nam": "ao-khoac-hoodie",
    "so mi nam": "ao-somi-polo", "ao so mi": "ao-somi-polo", "mu": "non",
    "ao khoac ni": "ao-khoac-hoodie", "ao khoac nam": "ao-khoac-hoodie",
    "shorts & trunks": "quan",
    # ontop
    "phu kien": "phu-kien", "ao khoac du": "ao-khoac-hoodie", "hoodie nam": "ao-khoac-hoodie",
    "polo nam": "ao-somi-polo", "tui": "tui-balo", "balo": "tui-balo", "quan nam": "quan",
    "baby tee": "ao-thun",
    # nowsaigon (specific only; bare "ao" is generic -> name-first, fallback ao-kieu)
    "quan": "quan", "jacket": "ao-khoac-hoodie", "baby tee": "ao-thun",
    "hoodie": "ao-khoac-hoodie", "socks": "phu-kien", "sweater": "ao-khoac-hoodie",
    "non": "non", "accessories": "phu-kien",
    # rubies (2-letter family codes, decoded against live titles 2026-11-03).
    # AK = Ao Kieu (own bucket). DK knitwear is NOT in this table: classify() decides
    # polo vs cardigan vs generic knit by name. AD (Ao Dai) has no DB evidence -> Khac.
    "as": "ao-somi-polo", "at": "ao-thun", "dd": "vay",
    "dn": "vay", "kb": "ao-khoac-hoodie", "kk": "ao-khoac-hoodie", "pc": "phu-kien",
    "qd": "quan", "qj": "quan", "qn": "quan", "sq": "set-bo", "sv": "set-bo",
    "vd": "vay", "vn": "vay", "vq": "vay", "ak": "ao-kieu",
    # dkmv (DK knitwear is classified by name: polo vs cardigan vs generic knit top)
    "vay": "vay", "croptop": "ao-thun", "set ao vay": "set-bo", "set vay": "set-bo",
    "set ao quan": "set-bo", "set": "set-bo", "chan vay": "vay", "baby tee": "ao-thun",
    "ao kieu": "ao-kieu",
    # dirtycoins
    "t-shirt": "ao-thun", "t-shirts": "ao-thun", "longsleeves": "ao-thun", "tank top": "ao-thun",
    "pants": "quan", "jersey": "ao-thun", "hoodies": "ao-khoac-hoodie", "shorts": "quan",
    "polos": "ao-somi-polo", "backpacks": "tui-balo", "socks": "phu-kien", "shirts": "ao-somi-polo",
    # degrey (specific only; bare "ao" is generic -> name-first, fallback ao-kieu)
    "quan": "quan", "phu kien": "phu-kien",
    # swe (specific only; TOPS/BOTTOMS are generic -> name-first)
    "accessories": "phu-kien", "jacket": "ao-khoac-hoodie",
    # skechers (specific only; "apparel" is generic -> name-first, fallback ao-kieu)
    "footwear": "giay",
    "ao ba lo": "ao-thun", "ao boi": "ao-thun", "ao tap nu / ao bra": "ao-thun",
    "ao khoac": "ao-khoac-hoodie", "ao crop-top": "ao-thun", "ao hoodie": "ao-khoac-hoodie",
    "ao thun": "ao-thun", "ao bong ro": "ao-thun", "dung cu tap gym": "phu-kien",
    # vans model lines are NOT categories (handled by name rules)
}
# Canonical labels map to themselves so a recompute after repair is a no-op
# (a product already sitting in "Giày" with no source type must not drift to Khác).
LEGACY_LABEL_FALLBACK = {
    "ao kieu": "ao-kieu", "ao thun": "ao-thun", "ao so mi & polo": "ao-somi-polo",
    "ao khoac & hoodie": "ao-khoac-hoodie", "quan": "quan", "vay": "vay", "giay": "giay",
    "non": "non", "tui & balo": "tui-balo", "phu kien": "phu-kien", "set/bo": "set-bo",
    "khac": "khac",
    "giay the thao": "giay", "mu / non": "non",
    "tui": "tui-balo", "balo": "tui-balo",
    "phu kien (ac)": "phu-kien",
    "ao thun (ts)": "ao-thun", "tees & polo": "ao-thun", "tees & polo shirts": "ao-thun",
    "quan dai (ps)": "quan", "pants & jeans": "quan", "short & trunks": "quan",
    "hoodie sweater (hd)": "ao-khoac-hoodie", "ao khoac (ak)": "ao-khoac-hoodie",
    "hoodie": "ao-khoac-hoodie", "hoodies": "ao-khoac-hoodie",
    "jackets & vests": "ao-khoac-hoodie", "ao khoac du": "ao-khoac-hoodie",
    "ao so mi (ss)": "ao-somi-polo", "ao polo (ap)": "ao-somi-polo",
    "so mi & flannel shirts": "ao-somi-polo", "caps": "non", "cap": "non",
    "accessory": "phu-kien", "tui cheo": "tui-balo", "vay": "vay",
}

# Source types too generic to prove a subtype (generic top / bottom). Name rules run first;
# whatever is left falls back to a broad honest bucket, never a fabricated subtype.
GENERIC_TOP_TYPES = {"apparel", "tops", "ao"}
GENERIC_BOTTOM_TYPES = {"bottoms"}

# hosts whose types are model lines / empty -> classify by folded product name (ordered rules)
NAME_RULES = [
    # (canonical, keywords, unless-keywords, excluded-hosts)
    ("set-bo", ["set", "bo"], ["pair", "pairs", "pack", "pcs", "piece"], set()),
    ("tui-balo", ["backpack", "rucksack", "balo", "tui", "bag", "hobo", "tote",
                 "cross bag", "school bag", "vi"], [], set()),
    ("non", ["ballcap", "cap", "beanie", "hat", "trooper", "bucket hat", "non", "mu",
            "khan dong"], [], set()),
    ("giay-explicit", ["giay", "sneaker", "sandal", "dep", "slipper", "boot", "loafer",
                      "maryjane", "base low",
                      # catalog-scoped: all 10 *court* names in R5 are court shoes (verified 2026-11-03)
                      "court"], [], set()),
    ("ao-somi-polo", ["ao so mi", "so mi", "somi", "polo", "flannel", "shirt", "shirts"],
     ["t-shirt", "tshirt", "t shirt", "t-shirts", "t shirts", "tee"], set()),
    ("ao-thun", ["ao thun", "t-shirt", "t shirt", "tshirt", "t-shirts", "t shirts",
                "tee", "baby tee", "croptop", "tank top", "jersey", "top",
                "henley", "ringer", "ringer tee", "semi crop", "crop top",
                "crop comfortable"], ["polo"], set()),
    ("ao-khoac-hoodie", ["ao khoac", "khoac", "hoodie", "jacket", "cardigan", "blazer",
                        "coat", "trench", "vest", "sweater", "windbreaker"], [], set()),
    ("vay", ["vay", "dam", "dress", "skirt", "jupe", "chan vay", "skort"], [],
     {"vansvietnam.com.vn"}),
    ("quan", ["quan", "jean", "jeans", "pant", "pants", "trouser", "short", "shorts",
            "jorts", "bottom"], [], set()),
    ("phu-kien", ["phu kien", "sock", "socks", "vo", "tat", "scarf", "keyring", "pouch",
                 "belt", "khan", "that lung", "kinh", "dung cu"], [], set()),
    ("giay-model", ["skate", "old skool", "authentic", "slip-on", "slip on", "sk8",
                   "knu skool", "era", "runner", "run", "chunky"], [], set()),
]
NAME_RULE_CANONICAL = {"giay-explicit": "giay", "giay-model": "giay"}

HOSTS = [
    "dirtycoins.vn", "degrey.vn", "swe.vn", "teelab.vn", "clownz.vn", "davies.vn",
    "ontop.com.vn", "nowsaigon.com", "rubies.vn", "dkmv.vn",
    "en.mlb-korea.com", "www.skechersvn.vn", "supersports.com.vn", "vansvietnam.com.vn",
]


def fold(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "").lower().replace("đ", "d")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip()


def word_hit(folded: str, key: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(key) + r"(?![a-z0-9])", folded) is not None


def psql(sql: str) -> str:
    r = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                        f'psql -U "$POSTGRES_USER" -d {DB} -v ON_ERROR_STOP=1 -At -F "|"'],
                       input=sql.encode(), capture_output=True, check=False)
    if r.returncode != 0:
        raise SystemExit(r.stderr.decode(errors="replace")[:400])
    return r.stdout.decode(errors="replace").strip()


def psql_json(sql: str) -> list:
    """row_to_json transport: immune to delimiter collisions in product names."""
    wrapped = f"SELECT row_to_json(t) FROM ({sql}) t;"
    r = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                        f'psql -U "$POSTGRES_USER" -d {DB} -v ON_ERROR_STOP=1 -At'],
                       input=wrapped.encode(), capture_output=True, check=False)
    if r.returncode != 0:
        raise SystemExit(r.stderr.decode(errors="replace")[:400])
    return [json.loads(line) for line in r.stdout.decode(errors="replace").splitlines() if line.strip()]


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.loads(response.read())
    except Exception:
        return {}


def name_pass(host: str, folded_name: str) -> tuple[str, str] | None:
    """Ordered name rules with unless-guards and host exclusions. Strong accessory/bag/hat
    and explicit-garment signals win over generic model-line words (skate/era/...)."""
    for key, keys, unless, excluded in NAME_RULES:
        if host in excluded:
            continue
        if unless and any(word_hit(folded_name, u) for u in unless):
            continue
        if key == "set-bo" and any(u in folded_name for u in ("pair", "pack", "pcs", "piece")):
            # multi-packs ("3Pairs Set") are not outfit sets; fall through to content rules
            continue
        if any(word_hit(folded_name, k) for k in keys):
            canon = NAME_RULE_CANONICAL.get(key, key)
            return canon, f"name:{key}"
    return None


def classify(host: str, source_type: str, name: str, legacy_label: str = "") -> tuple[str, str]:
    """Return (canonical_key, reason). Host-aware precedence:
    exact specific type -> DK knit special-case -> name rules (model-line/empty/generic
    types) -> generic-top/bottom fallback or legacy label -> Khac (honest)."""
    norm = fold(source_type)
    if norm and norm in TYPE_MAP:
        return TYPE_MAP[norm], f"type:{source_type}"
    folded_name = fold(name)
    if norm == "dk":
        # DK knitwear: polo vs cardigan decided by name; generic knit top otherwise.
        if word_hit(folded_name, "polo"):
            return "ao-somi-polo", "type:DK+name:polo"
        if word_hit(folded_name, "cardigan"):
            return "ao-khoac-hoodie", "type:DK+name:cardigan"
        return "ao-kieu", "type:DK-generic-knit"
    hit = name_pass(host, folded_name)
    if hit:
        return hit[0], f"{hit[1]}:{name[:40]}"
    if norm in GENERIC_TOP_TYPES:
        return "ao-kieu", "generic-top"
    if norm in GENERIC_BOTTOM_TYPES:
        return "khac", "generic-bottom"
    legacy = LEGACY_LABEL_FALLBACK.get(fold(legacy_label))
    if legacy:
        return legacy, f"legacy-label:{legacy_label}"
    return "khac", "unmatched-or-empty-type"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--snapshot-out", default="",
                        help="write immutable feed-taxonomy input snapshot here")
    parser.add_argument("--snapshot-in", default="",
                        help="replay a saved snapshot instead of fetching (deterministic rerun)")
    args = parser.parse_args()

    current = {}
    for line in psql("SELECT ma_danh_muc, ten_danh_muc FROM danh_muc;").splitlines():
        if "|" in line:
            cid, label = line.split("|", 1)
            current[int(cid)] = label

    feed: dict[tuple[str, str], dict] = {}
    snapshot_missing: list[str] = []
    if args.snapshot_in:
        saved = json.loads(Path(args.snapshot_in).read_text(encoding="utf-8"))
        for row in saved["entries"]:
            feed[(row["host"], row["sid"])] = {"type": row["type"], "tags": row["tags"]}
        snapshot_sha = saved["sha256"]
    else:
        for host in HOSTS:
            for page in (1, 2):
                url = (f"https://{host}/products.json?limit=250&page={page}"
                       if host == "en.mlb-korea.com"
                       else f"https://{host}/collections/all/products.json?limit=250&page={page}")
                items = fetch_json(url).get("products") or []
                for item in items:
                    sid = str(item.get("id") or "")
                    if sid:
                        feed[(host, sid)] = {"type": str(item.get("product_type") or ""),
                                             "tags": item.get("tags")}
                if len(items) < 250:
                    break
                time.sleep(0.4)
            time.sleep(0.4)
        entries = [{"host": h, "sid": sid, "type": v["type"], "tags": v["tags"]}
                   for (h, sid), v in sorted(feed.items())]
        snapshot_sha = hashlib.sha256(json.dumps(entries, sort_keys=True,
                                                 ensure_ascii=False).encode()).hexdigest()
        if args.snapshot_out:
            out = Path(args.snapshot_out)
            out.write_text(json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat(),
                                       "entries": entries, "sha256": snapshot_sha},
                                      ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            out.chmod(0o600)

    products = []
    for row in psql_json("SELECT ma_sp AS id, coalesce(source_host,'') AS host, "
                         "coalesce(source_product_id,'') AS sid, ten_sp AS name, "
                         "ma_danh_muc AS cat, publication_status AS status FROM san_pham"):
        products.append({"id": row["id"], "host": row["host"], "sid": row["sid"],
                         "name": row["name"], "catId": row["cat"],
                         "status": row["status"],
                         "legacyLabel": current.get(row["cat"], "")})

    set_bo_id = None
    for line in psql("SELECT ma_danh_muc FROM danh_muc WHERE ten_danh_muc='Set/Bộ';").splitlines():
        if line.strip().isdigit():
            set_bo_id = int(line.strip())

    decisions = []
    provenance_updates = []
    unmatched = Counter()
    coverage_gaps = []
    for p in products:
        if not p["host"]:
            continue  # fixtures: never touched
        if p["host"] in HOSTS and (p["host"], p["sid"]) not in feed:
            # Feed row missing from the bounded replay input (pagination gap, no retry storm):
            # classify by local name + legacy parent label, but NEVER degrade a good FK to Khac.
            coverage_gaps.append({"productId": p["id"], "host": p["host"], "sid": p["sid"]})
            info = {"type": "", "tags": None}
            gkey, greason = classify(p["host"], "", p["name"], p.get("legacyLabel", ""))
            if gkey == "khac" and p["catId"] != REUSE_IDS["khac"]:
                key, reason = "KEEP", "source-missing-keep-good-fk"
                target_id = p["catId"]
            else:
                key, reason = gkey, "gap-" + greason
                target_id = REUSE_IDS[key] if key != "set-bo" else set_bo_id
        else:
            # Non-feed hosts (commons uploads) and replay hits both flow through classify():
            # empty type falls back to name rules, then the legacy parent label.
            info = feed.get((p["host"], p["sid"]), {"type": "", "tags": None})
            key, reason = classify(p["host"], info["type"], p["name"], p.get("legacyLabel", ""))
            target_id = REUSE_IDS[key] if key != "set-bo" else set_bo_id
        decisions.append({"productId": p["id"], "sourceType": info["type"],
                          "fromCategoryId": p["catId"], "toKey": key, "toCategoryId": target_id,
                          "reason": reason, "status": p["status"]})
        tags = info["tags"]
        tags_str = json.dumps(tags, ensure_ascii=False) if isinstance(tags, list) else (str(tags or "")[:500])
        provenance_updates.append((p["id"], info["type"][:200], tags_str))
        if key == "khac":
            unmatched[(p["host"], info["type"])] += 1

    semantic_pairs = sorted((d["productId"], d["toKey"]) for d in decisions)
    mapping_table_sha = hashlib.sha256(json.dumps(
        {"canonical": CANONICAL, "typeMap": TYPE_MAP,
         "nameRules": [[k, v, u, sorted(e)] for k, v, u, e in NAME_RULES],
         "genericTop": sorted(GENERIC_TOP_TYPES), "genericBottom": sorted(GENERIC_BOTTOM_TYPES),
         "legacyFallback": LEGACY_LABEL_FALLBACK},
        sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    semantic_sha = hashlib.sha256(json.dumps(
        {"mappingTable": mapping_table_sha, "pairs": semantic_pairs},
        sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    manifest = {
        "manifestId": f"r5-taxonomy-{datetime.now(timezone.utc).isoformat(timespec='seconds')}",
        "generator": "scripts/repair_taxonomy_r5.py",
        "canonical": CANONICAL, "labelRenames": LABEL_RENAMES,
        "mappingTableSha256": mapping_table_sha, "semanticSha256": semantic_sha,
        "inputSnapshotSha256": snapshot_sha,
        "coverageGaps": coverage_gaps,
        "counts": {"products": len(decisions),
                   "moves": sum(1 for d in decisions if d["fromCategoryId"] != d["toCategoryId"]),
                   "alreadyCorrect": sum(1 for d in decisions if d["fromCategoryId"] == d["toCategoryId"]),
                   "unmatchedKhac": sum(1 for d in decisions if d["toKey"] == "khac")},
        "unmatchedTypes": sorted([{"host": h, "type": t, "n": n} for (h, t), n in unmatched.items()],
                                 key=lambda x: -x["n"]),
        "decisions": decisions,
    }
    manifest["sha256"] = hashlib.sha256(json.dumps(manifest, sort_keys=True,
                                                   ensure_ascii=False).encode()).hexdigest()
    print("semantic:", semantic_sha[:16], "| mapping:", mapping_table_sha[:16],
          "| snapshot:", snapshot_sha[:16], "| gaps:", len(coverage_gaps))
    receipt_path = Path(args.receipt)
    receipt_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    receipt_path.chmod(0o600)
    print(json.dumps(manifest["counts"], ensure_ascii=False))
    print("unmatched:", json.dumps(manifest["unmatchedTypes"][:12], ensure_ascii=False))

    if args.apply:
        if set_bo_id is None:
            created = psql("INSERT INTO danh_muc (ten_danh_muc, da_xoa) VALUES ('Set/Bộ', FALSE) "
                           "RETURNING ma_danh_muc;")
            set_bo_id = int(created.strip().splitlines()[0])
            for d in decisions:
                if d["toKey"] == "set-bo":
                    d["toCategoryId"] = set_bo_id
        statements = ["BEGIN;"]
        for cid, label in LABEL_RENAMES.items():
            statements.append(f"UPDATE danh_muc SET ten_danh_muc='{label}' WHERE ma_danh_muc={cid};")
        for pid, stype, stags in provenance_updates:
            statements.append("UPDATE san_pham SET source_product_type="
                              f"'{stype.replace(chr(39), chr(39)*2)}', source_tags="
                              f"'{stags.replace(chr(39), chr(39)*2)}' WHERE ma_sp={pid};")
        for d in decisions:
            if d["fromCategoryId"] != d["toCategoryId"]:
                statements.append(f"UPDATE san_pham SET ma_danh_muc={d['toCategoryId']} "
                                  f"WHERE ma_sp={d['productId']};")
        statements.append("COMMIT;")
        psql("\n".join(statements))
        moved = sum(1 for d in decisions if d["fromCategoryId"] != d["toCategoryId"])
        print(f"applied: {moved} FK moves, {len(provenance_updates)} provenance rows, Set/Bộ id={set_bo_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
