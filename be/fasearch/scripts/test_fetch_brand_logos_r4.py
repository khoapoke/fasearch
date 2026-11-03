#!/usr/bin/env python3
"""Focused regression tests for the R4 brand-logo importer.

Reproduces the control findings with synthetic data only (no network, no DB):
1. inline logo blocks must not leak across brands;
2. SVG validation must reject event attributes and external/protocol-relative references;
3. same-site matching must not equate unrelated hosts that share a multi-label suffix;
4. --apply must be pinned to the exact target database;
5. provenance must be reported honestly (secondary never labelled first-party).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).with_name("fetch_brand_logos_r4.py")
spec = importlib.util.spec_from_file_location("logos_r4", MODULE)
logos = importlib.util.module_from_spec(spec)
sys.modules["logos_r4"] = logos
spec.loader.exec_module(logos)

PASS = 0
FAIL: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS
    if condition:
        PASS += 1
    else:
        FAIL.append(f"{name} {detail}".strip())


LEGIT = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="#111"/></svg>'
LEGIT_GRADIENT = (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs>'
                  b'<linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>'
                  b'<path d="M0 0h10v10z" fill="url(#g)"/></svg>')


def svg_with(attr: str) -> bytes:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z" {attr}/></svg>'.encode()


# ---- 1. inline isolation -----------------------------------------------------
html_a = ('<div class="brand"><svg class="logo" viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg></div>'
          '<img class="site-logo" src="https://a.example.vn/cdn/logo-a.svg">')
html_b = ('<div class="brand"><svg class="logo" viewBox="0 0 9 9"><circle cx="1" cy="1" r="1"/></svg></div>'
          '<img class="site-logo" src="https://b.example.vn/cdn/logo-b.svg">')
cand_a, inline_a = logos.discover_candidates(html_a, "https://a.example.vn/")
cand_b, inline_b = logos.discover_candidates(html_b, "https://b.example.vn/")
check("inline-isolation:A-has-own", inline_a and inline_a[0].count("4 4") == 1, str(inline_a)[:60])
check("inline-isolation:B-has-own", inline_b and inline_b[0].count("9 9") == 1, str(inline_b)[:60])
check("inline-isolation:B-not-A", "4 4" not in inline_b[0] and inline_b[0] != inline_a[0])
check("inline-isolation:candidates-scoped",
      any("logo-a" in c for c in cand_a) and any("logo-b" in c for c in cand_b)
      and not any("logo-b" in c for c in cand_a))
check("inline-isolation:no-module-state", not hasattr(logos, "inline_blocks"))

# ---- 2. SVG validation -------------------------------------------------------
for bad_attr, label in [
    ('onfocus="alert(1)"', "onfocus"),
    ('onmouseover="alert(1)"', "onmouseover"),
    ('onbegin="x()"', "onbegin"),
    ('href="  https://evil.example/x.svg"', "whitespace-external-href"),
    ('href="//evil.example/x.svg"', "protocol-relative-href"),
    ('xlink:href="//evil.example/x.svg"', "protocol-relative-xlink"),
    ('style="fill:url(https://evil.example/a)"', "css-style"),
    ('fill="url(https://evil.example/a)"', "css-url-fill"),
    ('data-remote="javascript:alert(1)"', "javascript-attr"),
]:
    try:
        logos.validate_svg(svg_with(bad_attr))
        check(f"svg-reject:{label}", False, "accepted")
    except Exception:
        check(f"svg-reject:{label}", True)

for bad_doc, label in [
    (b'<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>', "doctype"),
    (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script><path d="M0 0h1v1z"/></svg>', "script"),
    (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><foreignObject/></svg>', "foreignObject"),
    (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><image href="https://evil/x.png"/></svg>', "image-tag"),
    (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><set attributeName="href" to="//evil"/></svg>', "active-set"),
    (b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>', "no-dimensions"),
    (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><g/></svg>', "no-shapes"),
]:
    try:
        logos.validate_svg(bad_doc)
        check(f"svg-reject:{label}", False, "accepted")
    except Exception:
        check(f"svg-reject:{label}", True)

check("svg-accept:plain", logos.validate_svg(LEGIT)["elements"] >= 2)
check("svg-accept:gradient-url-fragment", logos.validate_svg(LEGIT_GRADIENT)["attributes"] >= 4)
check("svg-accept:internal-href",
      logos.validate_svg(b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><defs><path id="p" d="M0 0h1v1z"/></defs><use href="#p"/></svg>')["elements"] >= 3
      if "use" in logos.SVG_ALLOWED_TAGS else True)

# ---- 3. site matching --------------------------------------------------------
check("site:com-vn-unrelated", not logos.allowed_host("https://unrelated.com.vn/logo.svg", "https://brand.com.vn/"))
check("site:com-vn-own", logos.allowed_host("https://brand.com.vn/logo.svg", "https://brand.com.vn/"))
check("site:com-vn-own-cdn", logos.allowed_host("https://cdn.brand.com.vn/logo.svg", "https://brand.com.vn/"))
check("site:co-kr-unrelated", not logos.allowed_host("https://evil.co.kr/l.svg", "https://mlb-korea.co.kr/"))
check("site:blocked-third-party", not logos.allowed_host("https://seeklogo.com/a.svg", "https://brand.com/"))
check("site:plain-tld-unrelated", not logos.allowed_host("https://other.com/l.svg", "https://brand.com/"))

# ---- 4. exact apply target ---------------------------------------------------
check("apply-db-constant", logos.TARGET_DB == "fasearch_storefront_r4_20261103")
try:
    logos.psql("SELECT 1;", "fasearch_storefront_r3_20261102")
    check("apply-db-guard", False, "wrong db accepted")
except SystemExit:
    check("apply-db-guard", True)

# ---- 5. identity / provenance honesty ---------------------------------------
check("identity:mlb-korea-needs-korea", not logos.identity_ok("mlb-korea", "MLB Korea", "https://x/MLB_logo.svg"))
check("identity:mlb-korea-accepts-korea", logos.identity_ok("mlb-korea", "MLB Korea", "https://x/mlb_korea_logo.svg"))
check("identity:mlb-league-ok", logos.identity_ok("mlb", "MLB", "https://x/Major_League_Baseball_logo.svg"))
check("identity:vans-ok", logos.identity_ok("vans", "Vans", "https://x/vans_logo.svg"))
check("identity:foreign-brand-rejected", not logos.identity_ok("vans", "Vans", "https://x/nike_logo.svg"))

# ---- 6. wrong-asset gate (Vans control finding) -------------------------------
HTML = ("<div class='header-main'><div class='logo logo_centers'><a class='logo-wrapper'>"
        "<img src='//cdn.example/assets/logo.png?v=1' alt='logo VANS Việt Nam'></a></div></div>"
        "<div class='footer-sign'><img src='//cdn.example/assets/new-arrival-family.png' alt='NEW ARRIVAL Family'></div>")
cands, _ = logos.discover_candidates(HTML, "https://vansvietnam.com.vn/")
header_ctx = logos.dom_context(HTML, "https://cdn.example/assets/logo.png?v=1")
footer_ctx = logos.dom_context(HTML, "https://cdn.example/assets/new-arrival-family.png")
check("gate:header-context-detected", any(t in header_ctx.lower() for t in ("header-main", "logo_centers", "logo-wrapper")))
check("gate:footer-context-detected", "footer" in footer_ctx.lower())
try:
    logos.asset_gate("https://cdn.example/assets/new-arrival-family.png", footer_ctx, 300, 80)
    check("gate:reject-marketing-banner", False, "accepted")
except ValueError:
    check("gate:reject-marketing-banner", True)
try:
    logos.asset_gate("https://x/assets/logo.png", "<div class='footer'>", 300, 80)
    check("gate:reject-non-header-placement", False, "accepted")
except ValueError:
    check("gate:reject-non-header-placement", True)
try:
    logos.asset_gate("https://x/apple-touch-icon-57x57.png", header_ctx, 57, 57)
    check("gate:reject-favicon", False, "accepted")
except ValueError:
    check("gate:reject-favicon", True)
try:
    logos.asset_gate("https://x/assets/logo.png", header_ctx, 32, 32)
    check("gate:reject-tiny", False, "accepted")
except ValueError:
    check("gate:reject-tiny", True)
try:
    logos.asset_gate("https://x/assets/logo-strip.png", header_ctx, 150, 14)
    check("gate:reject-strip", False, "accepted")
except ValueError:
    check("gate:reject-strip", True)
logos.asset_gate("https://x/assets/logo.png", header_ctx, 300, 80)
check("gate:accept-header-logo", True)
logos.asset_gate("https://x/assets/logo.png", header_ctx, 50, 50)   # nowsaigon-sized mark stays acceptable
check("gate:accept-small-boundary", True)

# ---- 7. ink contrast metadata (FE adaptive surface) --------------------------
from PIL import Image as _Image
import io as _io
buf = _io.BytesIO()
img = _Image.new("RGBA", (120, 40), (255, 255, 255, 0))
for x in range(20, 100):
    for y in range(12, 28):
        img.putpixel((x, y), (255, 255, 255, 255))
img.save(buf, format="PNG")
light = logos.ink_contrast(buf.getvalue(), ".png")
check("contrast:light-ink-on-transparent", light["kind"] == "light-ink-on-transparent", str(light))
check("contrast:hint-dark-surface", "dark surface" in light["hint"], light["hint"])

print(f"checks passed: {PASS}")
if FAIL:
    print("FAILURES:")
    for item in FAIL:
        print(" -", item)
    raise SystemExit(1)
print("all logo importer checks passed")
