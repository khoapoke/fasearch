#!/usr/bin/env python3
"""Seed exactly 60 real order journeys on the NEW admin-linked-demo candidate DB.

Guards: --target-db must be fasearch_admin_linked_demo_20261103 (read from --db-env);
refuses any other database. Default dry-run (no writes). Apply only with --apply.
All state changes go through the existing HTTP APIs / business services so lifecycle,
stock, invoice, ledger and voucher rules execute — never ad-hoc PAID/stock SQL and
never backdated timestamps. Reruns reuse completed run-key indexes from the manifest.

Mix (60 new orders): 36 COMPLETED+CASH/PAID, 8 SHIPPING unpaid, 4 CONFIRMED unpaid,
4 PACKING unpaid, 4 PENDING unpaid, 4 CANCELLED-before-handoff unpaid.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CONTAINER = "fasearch-loyalty-s2-20261031-55442"
DB = "fasearch_admin_linked_demo_20261103"
RUN_KEY_DEFAULT = "ABR-DEMO-20261103-v1"
TIMEOUT = 60

MIX: list[tuple[str, int]] = [
    ("COMPLETED_PAID", 36),
    ("SHIPPING_UNPAID", 8),
    ("CONFIRMED_UNPAID", 4),
    ("PACKING_UNPAID", 4),
    ("PENDING_UNPAID", 4),
    ("CANCELLED_UNPAID", 4),
]
assert sum(n for _, n in MIX) == 60

TRANSITIONS = {
    "SUPPL_VOUCHER_PAID": ["CONFIRMED", "PACKING", "SHIPPING"],
    "SUPPL_VOUCHER_CANCELLED": [],
    "COMPLETED_PAID": ["CONFIRMED", "PACKING", "SHIPPING"],
    "SHIPPING_UNPAID": ["CONFIRMED", "PACKING", "SHIPPING"],
    "CONFIRMED_UNPAID": ["CONFIRMED"],
    "PACKING_UNPAID": ["CONFIRMED", "PACKING"],
    "PENDING_UNPAID": [],
    "CANCELLED_UNPAID": [],
}


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


class ApiError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:200]}")
        self.status = status
        self.body = body


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")

    def call(self, method: str, path: str, token: str | None = None, body: dict | None = None):
        data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        if token:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(self.base + path, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return resp.status, json.load(resp)
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.load(e)
            except Exception:
                return e.code, {"raw": e.read()[:200].decode(errors="replace")}


def psql(db_env: dict, sql: str) -> str:
    if db_env["DB_NAME"] != DB:
        raise SystemExit(f"refusing unexpected database {db_env.get('DB_NAME')!r}")
    r = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                        f'psql -U "$POSTGRES_USER" -d {DB} -v ON_ERROR_STOP=1 -At'],
                       input=sql.encode(), capture_output=True, check=False)
    if r.returncode != 0:
        raise SystemExit(r.stderr.decode(errors="replace")[:400])
    return r.stdout.decode(errors="replace").strip()


def read_env(path: Path) -> dict:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    if env.get("DB_NAME") != DB:
        raise SystemExit(f"env points at {env.get('DB_NAME')!r}, expected {DB!r}")
    return env



def ensure_customer(api: Api, username: str, password: str, profile: dict) -> tuple[str, int | None]:
    """Register-or-login. Returns (token, customerId or None)."""
    st, r = api.call("POST", "/api/v1/auth/login", None,
                     {"username": username, "password": password})
    if st != 200:
        st, r = api.call("POST", "/api/v1/auth/register", None,
                         {"username": username, "password": password,
                          "email": profile["email"], "firstName": profile["first"],
                          "lastName": profile["last"], "phoneNumber": profile["phone"]})
        if st not in (200, 201):
            raise ApiError(st, json.dumps(r, ensure_ascii=False))
    tok = r["result"]["accessToken"]
    _, me = api.call("GET", "/api/v1/auth/my-info", tok)
    return tok, (me.get("result") or {}).get("customerId")


def stock_snapshot(env: dict, sku_ids: list[int]) -> dict[int, dict]:
    out: dict[int, dict] = {}
    if not sku_ids:
        return out
    rows = psql(env, f"select ma_sku, so_luong_vat_ly, so_luong_tam_giu, so_luong_kha_dung "
                     f"from ton_kho where ma_sku in ({','.join(map(str, sku_ids))});")
    for line in rows.splitlines():
        p = line.split("|")
        out[int(p[0])] = {"physical": int(p[1]), "reserved": int(p[2]), "available": int(p[3])}
    return out


def voucher_usage_for_order(env: dict, order_id: int) -> list:
    rows = psql(env, f"select ma_voucher, tien_giam, trang_thai from su_dung_voucher where ma_don_hang = {order_id} order by ma_voucher;")
    return [line.split("|") for line in rows.splitlines() if line]


def ledger_for_order(env: dict, order_id: int) -> list:
    rows = psql(env, f"select entry_id, entry_type, points, source_key from loyalty_ledger_entry "
                     f"where order_id = {order_id} order by entry_id;")
    return [line.split("|") for line in rows.splitlines() if line]


def run_order(api: Api, env: dict, admin_tok: str, cust_tok: str, p: dict,
              voucher: str | None, run_key: str) -> dict:
    """One full journey through real APIs. Returns the audit record."""
    rec: dict = {"index": p["index"], "target": p["target"], "customer": p["customer"],
                 "lines": p["lines"], "voucher": voucher, "steps": []}

    def step(name: str, status: int, body: dict) -> dict:
        result = body.get("result") if isinstance(body, dict) else None
        rec["steps"].append({"step": name, "status": status})
        return result or {}

    api.call("DELETE", "/api/v1/cart", cust_tok)
    for line in p["lines"]:
        st, b = api.call("POST", "/api/v1/cart/items", cust_tok,
                         {"skuId": line["sku"], "quantity": line["qty"]})
        if st != 200:
            raise ApiError(st, json.dumps(b, ensure_ascii=False))
    st, q = api.call("POST", "/api/v1/cart/quote", cust_tok,
                     {"voucherCode": voucher} if voucher else {})
    if st != 200:
        raise ApiError(st, json.dumps(q, ensure_ascii=False))
    quote = q["result"] or {}
    body = {"deliveryAddress": "So 1 Dai lo ABR, Quan 1, TP.HCM", "receiverName": "ABR Demo",
            "receiverPhone": "0900000001", "checkoutKey": f"{run_key}-{p['index']:03d}",
            "note": f"ABR-DEMO run {run_key} order {p['index']}"}
    if voucher:
        # The voucher only settles if the SAME quoted fingerprint + expected amount travel
        # with the checkout (server recomputes and rejects mismatches with QUOTE_CHANGED).
        body["voucherCode"] = voucher
        body["quoteFingerprint"] = quote.get("quoteFingerprint")
        body["expectedMerchandiseAmountDue"] = str(quote.get("merchandiseAmountDue"))
        if not body["quoteFingerprint"] or quote.get("merchandiseAmountDue") is None:
            raise ApiError(st, "quote missing fingerprint/amount for voucher checkout")
    st, c = api.call("POST", "/api/v1/orders/checkout", cust_tok, body)
    if st == 409 and "Checkout key was reused" in json.dumps(c, ensure_ascii=False):
        # A previous buggy attempt burned this key with different inputs (its order was
        # cancelled and superseded). Retry once with an explicit attempt suffix; the used
        # key is recorded in the manifest.
        body["checkoutKey"] = body["checkoutKey"] + "-r2"
        body["note"] = body.get("note", "") + " (retry r2 after superseded attempt)"
        st, c = api.call("POST", "/api/v1/orders/checkout", cust_tok, body)
    if st not in (200, 201):
        raise ApiError(st, json.dumps(c, ensure_ascii=False))
    if st == 200 and (c.get("result") or {}).get("replayed"):
        # Idempotency replay would hand back an already-finished order; never drive
        # transitions on it. The manifest is the record of what was actually created.
        raise ApiError(st, "checkout replayed a previous order; refusing to drive it again")
    rec["checkoutKeyUsed"] = body["checkoutKey"]
    order = c["result"] or {}
    rec["orderId"] = order.get("orderId")
    rec["orderCode"] = order.get("orderCode")
    rec["checkoutTotal"] = str(order.get("totalAmount") or order.get("subTotal") or 0)
    if voucher:
        st, det = api.call("GET", f"/api/v1/orders/{rec['orderId']}", admin_tok)
        if st != 200:
            raise ApiError(st, json.dumps(det, ensure_ascii=False))
        persisted = det.get("result") or {}
        rec["persistedVoucherCode"] = persisted.get("voucherCode")
        rec["persistedDiscount"] = persisted.get("discountAmount")
        got_code = persisted.get("voucherCode")
        got_discount = persisted.get("discountAmount")
        try:
            discount_ok = got_discount is not None and float(got_discount) > 0
        except (TypeError, ValueError):
            discount_ok = False
        if got_code != voucher or not discount_ok:
            raise ApiError(200, f"voucher not persisted: code={got_code} discount={got_discount}")
        rec["appliedVoucherCode"] = got_code
        rec["appliedDiscount"] = str(got_discount)
    for target_status in TRANSITIONS[p["target"]]:
        st, u = api.call("PATCH", f"/api/v1/orders/{rec['orderId']}/status", admin_tok,
                         {"status": target_status,
                          "note": f"ABR-DEMO {RUN_KEY_DEFAULT} order {p['index']} -> {target_status}"})
        if st != 200:
            raise ApiError(st, json.dumps(u, ensure_ascii=False))
    if p["target"] in ("COMPLETED_PAID", "SUPPL_VOUCHER_PAID"):
        st, d = api.call("GET", f"/api/v1/orders/{rec['orderId']}", admin_tok)
        total = str((d.get("result") or {}).get("totalAmount") or rec["checkoutTotal"])
        st, inv = api.call("POST", "/api/v1/payments/process", admin_tok,
                           {"orderId": rec["orderId"], "paymentMethodCode": "CASH",
                            "amountPaid": total,
                            "note": f"ABR-DEMO cash settle {p['index']}"})
        if st not in (200, 201):
            raise ApiError(st, json.dumps(inv, ensure_ascii=False))
        receipt = inv.get("result") or {}
        rec["invoiceId"] = receipt.get("invoiceId")
        rec["invoiceCode"] = receipt.get("invoiceCode")
        rec["paidTotal"] = str(receipt.get("totalActualPaid"))
        st, u = api.call("PATCH", f"/api/v1/orders/{rec['orderId']}/status", admin_tok,
                         {"status": "COMPLETED",
                          "note": f"ABR-DEMO {RUN_KEY_DEFAULT} order {p['index']} -> COMPLETED"})
        if st != 200:
            raise ApiError(st, json.dumps(u, ensure_ascii=False))
    if p["target"] in ("CANCELLED_UNPAID", "SUPPL_VOUCHER_CANCELLED"):
        st, u = api.call("POST", f"/api/v1/orders/{rec['orderId']}/cancel", admin_tok,
                         {"reason": f"ABR-DEMO {RUN_KEY_DEFAULT} order {p['index']} cancelled before handoff"})
        if st != 200:
            raise ApiError(st, json.dumps(u, ensure_ascii=False))
    rec["ledger"] = ledger_for_order(env, rec["orderId"])
    rec["voucherUsage"] = voucher_usage_for_order(env, rec["orderId"])
    rec["status"] = "recorded"
    return rec

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-env", required=True)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--run-key", default=RUN_KEY_DEFAULT)
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="only plan/run the first N orders (validation)")
    parser.add_argument("--admin-user", default="chapter5_admin")
    args = parser.parse_args()

    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", args.run_key):
        raise SystemExit("unsafe run key")
    env = read_env(Path(args.db_env))
    api = Api(args.base_url)
    manifest_path = Path(args.manifest)
    manifest: dict = {"runKey": args.run_key, "orders": [], "customers": [], "importReceipts": []}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("runKey") != args.run_key:
            raise SystemExit("manifest run key mismatch")
    done_idx = {o["index"] for o in manifest.get("orders", []) if o.get("status") == "recorded"}

    accts = json.loads(Path("/home/dolakhoa/projects/fasearch-migration/runtime/private/chapter5-ui-evidence/accounts.json").read_text())["accounts"]
    admin_pw = [a["password"] for a in accts if a["role"] == "ADMIN"][0]
    _, r = api.call("POST", "/api/v1/auth/login", None, {"username": args.admin_user, "password": admin_pw})
    admin_tok = r["result"]["accessToken"]

    # SKU selection: ACTIVE published non-deleted variants with photos, spread across brands.
    # Current on-hand does NOT gate selection: the plan tops stock up through ONE real
    # multi-line import receipt (never ad-hoc stock SQL).
    sku_rows = psql(env, "select v.ma_sku, s.ten_sp, v.mau_sac, v.kich_co, th.slug, t.so_luong_kha_dung, s.gia_ban "
                         "from bien_the_sp v join san_pham s on s.ma_sp=v.ma_sp "
                         "left join thuong_hieu th on th.ma_thuong_hieu=s.ma_thuong_hieu "
                         "join ton_kho t on t.ma_sku=v.ma_sku "
                         "where v.da_xoa=false and s.publication_status='PUBLISHED' and s.da_xoa=false "
                         "and s.hinh_anh_sp is not null order by v.ma_sku;")
    skus = []
    for line in sku_rows.splitlines():
        parts = line.split("|")
        if len(parts) == 7:
            skus.append({"sku": int(parts[0]), "name": parts[1], "color": parts[2], "size": parts[3],
                         "brand": parts[4], "avail": int(parts[5]), "price": parts[6]})
    by_brand: dict[str, list] = {}
    for s in skus:
        by_brand.setdefault(s["brand"] or "none", []).append(s)
    picked = []
    brands = sorted(by_brand)
    i = 0
    while len(picked) < 18 and any(by_brand.values()):
        for b in brands:
            if by_brand[b]:
                picked.append(by_brand[b].pop(0))
                if len(picked) >= 18:
                    break
        i += 1
        if i > 40:
            break
    if len(picked) < 16:
        raise SystemExit(f"only {len(picked)} eligible published SKUs with photos; refusing to force it")
    log(f"eligible SKUs: {len(skus)} across {len(brands)} brands; picked {len(picked)}")

    # order plan: deterministic assignment of SKUs/customers/targets/vouchers
    plan = []
    idx = 0
    for target, count in MIX:
        for _ in range(count):
            ci = idx % 10
            lines = [{"sku": picked[(idx * 2) % len(picked)]["sku"], "qty": 1 + (idx % 2)},
                     {"sku": picked[(idx * 2 + 7) % len(picked)]["sku"], "qty": 1}]
            voucher = "ABR-DEMO-10" if (target == "COMPLETED_PAID" and idx % 6 == 0) else None
            plan.append({"index": idx, "customer": ci, "lines": lines, "target": target, "voucher": voucher})
            idx += 1
    suppl_defs = [
        ("SUPPL_VOUCHER_PAID", 3, [{"sku": picked[1]["sku"], "qty": 1},
                                  {"sku": picked[9]["sku"], "qty": 2}]),
        ("SUPPL_VOUCHER_PAID", 4, [{"sku": picked[4]["sku"], "qty": 1},
                                  {"sku": picked[12]["sku"], "qty": 1}]),
        ("SUPPL_VOUCHER_CANCELLED", 5, [{"sku": picked[6]["sku"], "qty": 1}]),
    ]
    for target, ci, lines in suppl_defs:
        plan.append({"index": idx, "customer": ci, "lines": lines, "target": target,
                     "voucher": "ABR-DEMO-10", "supplemental": True})
        idx += 1
    if args.limit:
        plan = plan[: args.limit]

    if not args.apply:
        need: dict[int, int] = {}
        for p in plan:
            for line in p["lines"]:
                need[line["sku"]] = need.get(line["sku"], 0) + line["qty"]
        short = [(s, need[s["sku"]], s["avail"]) for s in picked if need.get(s["sku"], 0) > s["avail"]]
        print(json.dumps({"dryRun": True, "orders": len(plan), "mix": {k: sum(1 for p in plan if p["target"] == k) for k, _ in MIX},
                          "customers": 10, "skus": len(picked), "stockShortfalls": short,
                          "importReceiptNeeded": bool(short)}, indent=1, ensure_ascii=False))
        return 0

    run_key = args.run_key
    for p in plan:
        for line in p["lines"]:
            pass
    # customers (register-or-login, passwords kept in the 0600 manifest for reruns)
    cust_toks: dict[int, str] = {}
    cust_ids: dict[int, int | None] = {}
    saved_pw = {c.get("index"): c.get("password") for c in manifest.get("customers", [])}
    for ci in range(10):
        if ci in {c.get("index") for c in manifest.get("customers", [])} and ci in {
                c.get("index") for c in manifest.get("customers", [])}:
            pass
        uname = f"abr_demo_{ci:02d}"
        known = {c["index"]: c for c in manifest.get("customers", []) if "password" in c}
        pw = known[ci]["password"] if ci in known else secrets.token_urlsafe(12)
        tok, cid = ensure_customer(api, uname, pw,
                                   {"email": f"{uname}@example.test", "first": "ABR",
                                    "last": f"Demo {ci:02d}", "phone": f"09000000{ci:02d}"})
        cust_toks[ci] = tok
        cust_ids[ci] = cid
        if ci not in known:
            manifest.setdefault("customers", []).append(
                {"index": ci, "username": uname, "password": pw, "email": f"{uname}@example.test"})
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            manifest_path.chmod(0o600)

    # stock top-up via ONE real multi-line import receipt (ADMIN API, never direct SQL)
    need: dict[int, int] = {}
    for pl in plan:
        if pl["index"] in done_idx:
            continue
        for line in pl["lines"]:
            need[line["sku"]] = need.get(line["sku"], 0) + line["qty"]
    before = stock_snapshot(env, sorted(need))
    topup = [{"skuId": sku, "quantity": max(0, qty - before.get(sku, {}).get("available", 0)) + 4}
             for sku, qty in need.items()]
    topup = [t for t in topup if t["quantity"] > 0]
    if topup:
        st, b = api.call("POST", "/api/v1/inventory/import-receipts", admin_tok,
                         {"supplierName": f"ABR-DEMO run {run_key}",
                          "note": f"ABR-DEMO {run_key} stock top-up for 60-order journey",
                          "items": [{**t, "importPrice": next(s["price"] for s in picked if s["sku"] == t["skuId"])}
                                    for t in topup]})
        if st not in (200, 201):
            raise ApiError(st, json.dumps(b, ensure_ascii=False))
        manifest.setdefault("importReceipts", []).append(
            {"id": (b.get("result") or {}).get("id"), "lines": len(topup)})
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # voucher campaign + codes for the subset (existing APIs only)
    voucher_orders = [pl["index"] for pl in plan if pl["voucher"]]
    if manifest.get("voucherCampaign"):
        st, b = api.call("GET", f"/api/v1/khuyen-mai/{manifest['voucherCampaign']['campaignId']}", admin_tok)
        if st == 200 and (b.get("result") or {}).get("trangThai") != "HOAT_DONG":
            ver = (b.get("result") or {}).get("phienBan", 0)
            st, b = api.call("PUT", f"/api/v1/khuyen-mai/{manifest['voucherCampaign']['campaignId']}",
                             admin_tok, {"phienBan": ver, "trangThai": "HOAT_DONG"})
            if st != 200:
                raise ApiError(st, json.dumps(b, ensure_ascii=False))
            log("re-activated paused voucher campaign")
    if voucher_orders and not manifest.get("voucherCampaign"):
        st, b = api.call("POST", "/api/v1/khuyen-mai", admin_tok,
                         {"tenCtkm": f"[ABR-DEMO] {run_key}", "loaiGiam": "PHAN_TRAM",
                          "giaTriGiam": 10,
                          "ngayBatDau": datetime.now().replace(microsecond=0).isoformat(),
                          "ngayKetThuc": "2030-01-01T00:00:00",
                          "dieuKienApDung": "ABR-DEMO seeded campaign"})
        if st not in (200, 201):
            raise ApiError(st, json.dumps(b, ensure_ascii=False))
        cid = (b.get("result") or {}).get("maKm")
        st, b = api.call("POST", f"/api/v1/khuyen-mai/{cid}/codes", admin_tok,
                         {"maCode": "ABR-DEMO-10", "soLuong": 20})
        if st not in (200, 201):
            raise ApiError(st, json.dumps(b, ensure_ascii=False))
        st, b = api.call("GET", f"/api/v1/khuyen-mai/{cid}", admin_tok)
        ver = (b.get("result") or {}).get("phienBan", 0)
        st, b = api.call("PUT", f"/api/v1/khuyen-mai/{cid}", admin_tok,
                         {"phienBan": ver, "trangThai": "HOAT_DONG"})
        if st != 200:
            raise ApiError(st, json.dumps(b, ensure_ascii=False))
        manifest["voucherCampaign"] = {"campaignId": cid, "code": "ABR-DEMO-10"}
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # run the journeys with per-order resume
    before_all = stock_snapshot(env, sorted({l["sku"] for pl in plan for l in pl["lines"]}))
    for pl in plan:
        if pl["index"] in done_idx:
            continue
        sku_ids = sorted({l["sku"] for l in pl["lines"]})
        pre = stock_snapshot(env, sku_ids)
        rec = run_order(api, env, admin_tok, cust_toks[pl["customer"]], pl,
                        manifest.get("voucherCampaign", {}).get("code") if pl["voucher"] else None,
                        run_key)
        rec["runKey"] = run_key
        rec["stockBefore"] = pre
        rec["stockAfter"] = stock_snapshot(env, sku_ids)
        manifest["orders"].append(rec)
        done_idx.add(pl["index"])
        manifest["orders"].sort(key=lambda o: o["index"])
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        log(f"order {pl['index']:02d} {pl['target']:16s} id={rec.get('orderId')} "
            f"invoice={rec.get('invoiceCode')} paid={rec.get('paidTotal')}")
        time.sleep(0.2)
    after_all = stock_snapshot(env, sorted({l["sku"] for pl in plan for l in pl["lines"]}))
    receipt = {"runKey": run_key, "generatedAt": datetime.now(timezone.utc).isoformat(),
               "counts": {"planned": len(plan), "recorded": len(manifest["orders"])},
               "stockBefore": {str(k): v for k, v in before_all.items()},
               "stockAfter": {str(k): v for k, v in after_all.items()},
               "manifest": str(manifest_path),
               "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest()}
    Path(args.receipt).write_text(json.dumps(receipt, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    Path(args.receipt).chmod(0o600)
    print(json.dumps(receipt["counts"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
