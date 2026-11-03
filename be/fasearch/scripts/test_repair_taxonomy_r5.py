#!/usr/bin/env python3
"""Focused tests for the R5 taxonomy repair: real raw types + names, not dictionary mirrors.

Each case uses an actual observed feed value (audit receipt / live fetch 2026-11-03).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

MODULE = Path(__file__).with_name("repair_taxonomy_r5.py")
spec = importlib.util.spec_from_file_location("repair_r5", MODULE)
tax = importlib.util.module_from_spec(spec)
sys.modules["repair_r5"] = tax
spec.loader.exec_module(tax)

PASS = 0
FAIL: list[str] = []


def check(name: str, actual, expected) -> None:
    global PASS
    if actual == expected:
        PASS += 1
    else:
        FAIL.append(f"{name}: got {actual!r}, want {expected!r}")


C = tax.classify
# real raw types (exact strings observed in feeds)
check("teelab AO Thun (TS)", C("teelab.vn", "Áo Thun (TS)", "Teelab A")[0], "ao-thun")
check("davies ao thun", C("davies.vn", "Áo thun", "X")[0], "ao-thun")
check("davies Mu (hat, not ao)", C("davies.vn", "Mũ", "Non X")[0], "non")
check("davies Ao so mi plain", C("davies.vn", "Áo sơ mi", "So Mi X")[0], "ao-somi-polo")
check("davies Ao khoac ni", C("davies.vn", "Áo khoác nỉ", "Ni X")[0], "ao-khoac-hoodie")
check("clownz Shorts & Trunks plural", C("clownz.vn", "Shorts & Trunks", "Short X")[0], "quan")
check("rubies AK is Ao Kieu", C("rubies.vn", "AK", "Áo Kiểu Nữ Jenner Top RR26AK111")[0], "ao-kieu")
check("rubies AS is somi", C("rubies.vn", "AS", "Áo Sơ Mi Nữ Minor Shirt")[0], "ao-somi-polo")
check("rubies DD is vay", C("rubies.vn", "DD", "Đầm Dài Olaf Dress")[0], "vay")
check("rubies DK cardigan by name", C("rubies.vn", "DK", "Áo Dệt Kim Bambi Cardigan")[0], "ao-khoac-hoodie")
check("rubies DK polo by name", C("rubies.vn", "DK", "Áo Dệt Kim Nichi Polo")[0], "ao-somi-polo")
check("rubies DK generic knit", C("rubies.vn", "DK", "Áo Dệt Kim Wool")[0], "ao-kieu")
check("rubies JN jumpsuit honest Khac", C("rubies.vn", "JN", "Jumpsuit Ngắn Mika Bodysuit")[0], "khac")
check("swe TOPS halter", C("swe.vn", "TOPS", "SWE HALTER MESH TOP - RED")[0], "ao-thun")
check("skechers Apparel run shoe", C("www.skechersvn.vn", "Apparel", "GO RUN RAZOR")[0], "giay")
check("degrey AO vietnamese name", C("degrey.vn", "ÁO", "Áo Thun Degrey")[0], "ao-thun")
check("nowsaigon AO english tee", C("nowsaigon.com", "ÁO", "LETTERS TEE - BLACK")[0], "ao-thun")
check("nowsaigon AO hoodie", C("nowsaigon.com", "ÁO", "2WAY ZIP WASHED HOODIE - GREY")[0], "ao-khoac-hoodie")
check("dirtycoins HOODIES not thun", C("dirtycoins.vn", "HOODIES", "Hoodie X")[0], "ao-khoac-hoodie")
check("vans backpack beats shoe words", C("vansvietnam.com.vn", "VANS BACKPACK", "VANS SNAG BACKPACK YELLOW")[0], "tui-balo")
check("vans DRESS BLUE is shoe", C("vansvietnam.com.vn", "VANS OLD SKOOL", "VANS OLD SKOOL STYLE 36 MARSHMALLOW DRESS BLUE")[0], "giay")
check("vans slip-on is shoe", C("vansvietnam.com.vn", "VANS SLIP ON", "VANS CLASSIC SLIP-ON CHECKERBOARD")[0], "giay")
check("mlb cap before model words", C("en.mlb-korea.com", "", "Rookie Slider Cap (CP77)")[0], "non")
check("mlb runner is shoe", C("en.mlb-korea.com", "", "Winner Runner Synthetic")[0], "giay")
check("mlb socks", C("en.mlb-korea.com", "", "Small Logo Embroidery Socks")[0], "phu-kien")
check("mlb windbreaker", C("en.mlb-korea.com", "", "Basic Outdoor Windbreaker")[0], "ao-khoac-hoodie")
check("mlb RUNNY honest Khac", C("en.mlb-korea.com", "", "RUNNY")[0], "khac")
check("combining-mark AO", C("nowsaigon.com", "ÁO", "ÁO KHOÁC X")[0], "ao-khoac-hoodie")
check("dam with đ is vay", C("dkmv.vn", "", "Đầm Ngắn Soyo Dress")[0], "vay")
check("dkmv set stays set", C("dkmv.vn", "Set áo váy", "Set Ao Vay X")[0], "set-bo")
check("dkmv Gina Set empty type", C("dkmv.vn", "", "DKMV Gina Set")[0], "set-bo")
check("dkmv jumpsuit honest Khac", C("dkmv.vn", "Jump", "DKMV Se Na Jumpsuit")[0], "khac")
check("soldout collection honest Khac", C("nowsaigon.com", "SẢN PHẨM SOLDOUT SG", "X")[0], "khac")
check("supersports Ao Boi", C("supersports.com.vn", "Áo Bơi", "Boi X")[0], "ao-thun")
check("QC legacy giay-the-thao", C("commons.wikimedia.org", "", "Nike Dunk Low", "Giày thể thao")[0], "giay")
check("shirt not stolen by polo rule", C("supersports.com.vn", "", "S/S RAGLAN RIBBED SHIRTS")[0], "ao-somi-polo")
check("t-shirt beats shirt", C("en.mlb-korea.com", "", "Basic Heavy Weight Over Fit T-Shirt")[0], "ao-thun")
check("polo shirt", C("www.skechersvn.vn", "Apparel", "Polo Shirt X")[0], "ao-somi-polo")

check("henley is thun-family", C("en.mlb-korea.com", "", "Women's Basic Henley Neck")[0], "ao-thun")
check("ringer is thun-family", C("en.mlb-korea.com", "", "Women's Basic Ringer Ops")[0], "ao-thun")
check("t-shirts plural beats shirt", C("en.mlb-korea.com", "", "Women's Basic Crop Comfortable T-shirts")[0], "ao-thun")
check("9in shorts", C("en.mlb-korea.com", "", "BASIC COTTON TOUCH RIPSTOP 9in Shorts")[0], "quan")
check("socks plural", C("en.mlb-korea.com", "", "Small Logo Low Socks 3Pairs Set")[0], "phu-kien")
check("explicit Set type beats name", C("dkmv.vn", "Set", "Semi Crop Top")[0], "set-bo")
check("multipack socks not an outfit set",
      C("en.mlb-korea.com", "", "Small Logo Low Socks 3Pairs Set")[0], "phu-kien")

check("pants plural", C("en.mlb-korea.com", "", "Street Sportvie Taping Wide Pants")[0], "quan")
check("jeans plural", C("x", "", "Blue Jeans Classic")[0], "quan")

print(f"checks passed: {PASS}")
if FAIL:
    print("FAILURES:")
    for item in FAIL:
        print(" -", item)
    raise SystemExit(1)
print("all taxonomy repair checks passed")
