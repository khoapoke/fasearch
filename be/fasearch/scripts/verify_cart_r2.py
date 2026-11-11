#!/usr/bin/env python3
"""Post-fix assertions for CART-500-R2 (runs against 18148 + new DB only)."""
import json, os, subprocess, sys, urllib.request

BE = "http://127.0.0.1:18148"
DB = "fasearch_brand_catalog_ai_20261102"
CONTAINER = "fasearch-loyalty-s2-20261031-55442"
fails = []


def disposable_credentials():
    """Read the disposable candidate account from env or a 0600 private file.

    No literal and no default: the run fails loudly when neither is provided, so a leak
    cannot happen through tracked source.
    """
    user = os.environ.get("CANDIDATE_CUSTOMER_USERNAME")
    password = os.environ.get("CANDIDATE_CUSTOMER_PASSWORD")
    if not user or not password:
        path = os.environ.get("CANDIDATE_ACCOUNT_FILE",
                              "/home/dolakhoa/projects/fasearch-migration/runtime/private/"
                              "brand-catalog-ai-completion/fixtures/disposable-account.env")
        try:
            st = os.stat(path)
            if st.st_mode & 0o077:
                raise SystemExit("refusing credential file with group/other permissions")
            for line in Path_read(path):
                key, _, value = line.strip().partition("=")
                if key == "CANDIDATE_CUSTOMER_USERNAME":
                    user = value
                elif key == "CANDIDATE_CUSTOMER_PASSWORD":
                    password = value
        except FileNotFoundError:
            pass
    if not user or not password:
        raise SystemExit("credentials unavailable: set CANDIDATE_CUSTOMER_USERNAME/PASSWORD "
                         "or provide a 0600 CANDIDATE_ACCOUNT_FILE")
    return user, password


def Path_read(path):
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read().splitlines()


def psql(sql):
    out = subprocess.run(["docker", "exec", "-i", CONTAINER, "sh", "-c",
                          f'psql -U "$POSTGRES_USER" -d {DB} -v ON_ERROR_STOP=1 -At'],
                         input=sql.encode(), capture_output=True)
    if out.returncode:
        raise SystemExit(out.stderr.decode()[:400])
    return out.stdout.decode().strip()


def call(path, body=None, token=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BE + path, data=data, method=method or ("POST" if data else "GET"))
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def check(name, ok, detail):
    print(("PASS " if ok else "FAIL ") + name + ": " + str(detail))
    if not ok:
        fails.append(name)


username, password = disposable_credentials()
st, body = call("/api/v1/auth/login", {"username": username, "password": password})
token = (body.get("result") or {}).get("accessToken")
check("login", st == 200 and bool(token), st)

check("no invalid status rows", psql(
    "SELECT count(*) FROM san_pham WHERE trang_thai NOT IN "
    "('DRAFT','ACTIVE','OUT_OF_STOCK','DISCONTINUED');") == "0",
    psql("SELECT string_agg(DISTINCT trang_thai, ',') FROM san_pham;"))
check("published still 211", psql("SELECT count(*) FROM san_pham WHERE publication_status='PUBLISHED';") == "211",
      psql("SELECT string_agg(publication_status, ',') FROM (SELECT DISTINCT publication_status FROM san_pham) x;"))
check("fixtures preserved, no deletes",
      psql("SELECT count(*) FROM san_pham WHERE curation_class='BASELINE_FIXTURE';") == "50", 50)

retired = psql("SELECT v.ma_sku FROM bien_the_sp v JOIN san_pham p ON p.ma_sp=v.ma_sp "
               "WHERE p.curation_class='BASELINE_FIXTURE' ORDER BY v.ma_sku LIMIT 1;")
st, body = call("/api/v1/cart/items", {"skuId": int(retired), "quantity": 1}, token)
check("retired sku -> 4xx business error", 400 <= st < 500, f"{st} {body.get('message')}")

st, body = call("/api/v1/cart/items", {"skuId": 1097, "quantity": 1}, token)
check("published 1097 -> 200", st == 200, st)

st, body = call("/api/v1/cart", None, token)
check("cart hydrates after add attempts", st == 200, st)

st, body = call("/api/v1/orders?page=0&size=5", None, token)
check("order list hydrates", st == 200, st)

sys.exit(1 if fails else 0)
