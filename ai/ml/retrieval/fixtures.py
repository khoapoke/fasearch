from __future__ import annotations

import csv
from pathlib import Path

from PIL import Image, ImageDraw


FIXTURE_VERSION = "dataset-a-fixture-v1"
COLORS = [
    ("Red", (210, 35, 45)),
    ("Blue", (35, 95, 205)),
    ("Black", (25, 25, 25)),
    ("Yellow", (235, 195, 25)),
    ("Pink", (225, 80, 145)),
]
CATEGORIES = [
    ("TOP", "Tshirts", "Topwear"),
    ("BOTTOM", "Trousers", "Bottomwear"),
    ("ONE_PIECE", "Dresses", "Dress"),
]


def create_dataset_a_fixture(root: Path) -> Path:
    """Create 30 original synthetic records that mimic Dataset A layout."""
    images_dir = root / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, str]] = []
    product_number = 1000
    for category, article_type, subcategory in CATEGORIES:
        for repeat in range(2):
            for color_name, rgb in COLORS:
                product_number += 1
                product_id = str(product_number)
                image_path = images_dir / f"{product_id}.jpg"
                _draw_product(image_path, category, rgb, repeat)
                rows.append(
                    {
                        "id": product_id,
                        "gender": "Unisex",
                        "masterCategory": "Apparel",
                        "subCategory": subcategory,
                        "articleType": article_type,
                        "baseColour": color_name,
                        "season": "Summer" if repeat == 0 else "Winter",
                        "year": "2026",
                        "usage": "Casual" if repeat == 0 else "Work",
                        "productDisplayName": f"Fixture {color_name} {article_type} Variant {repeat + 1}",
                    }
                )
    # Deliberate audit cases: one missing image, one corrupt image, one out-of-scope item.
    rows.append({
        "id": "1991", "gender": "Unisex", "masterCategory": "Apparel",
        "subCategory": "Topwear", "articleType": "Tshirts", "baseColour": "Green",
        "season": "Summer", "year": "2026", "usage": "Casual",
        "productDisplayName": "Fixture missing image record",
    })
    (images_dir / "1992.jpg").write_bytes(b"not-a-valid-image")
    rows.append({
        "id": "1992", "gender": "Unisex", "masterCategory": "Apparel",
        "subCategory": "Topwear", "articleType": "Tshirts", "baseColour": "Green",
        "season": "Summer", "year": "2026", "usage": "Casual",
        "productDisplayName": "Fixture corrupt image record",
    })
    _draw_product(images_dir / "1993.jpg", "TOP", (120, 80, 50), 0)
    rows.append({
        "id": "1993", "gender": "Unisex", "masterCategory": "Accessories",
        "subCategory": "Bags", "articleType": "Backpacks", "baseColour": "Brown",
        "season": "Summer", "year": "2026", "usage": "Casual",
        "productDisplayName": "Fixture out of scope backpack",
    })
    styles_path = root / "styles.csv"
    with styles_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return styles_path


def _draw_product(path: Path, category: str, color: tuple[int, int, int], variant: int) -> None:
    image = Image.new("RGB", (128, 128), "white")
    draw = ImageDraw.Draw(image)
    if category == "TOP":
        draw.polygon([(25, 18), (48, 8), (80, 8), (103, 18), (92, 45), (82, 36), (82, 72), (46, 72), (46, 36), (36, 45)], fill=color)
    elif category == "BOTTOM":
        draw.polygon([(43, 54), (85, 54), (80, 120), (66, 120), (64, 76), (61, 120), (47, 120)], fill=color)
    else:
        draw.polygon([(50, 12), (78, 12), (82, 45), (106, 116), (22, 116), (46, 45)], fill=color)
    if variant:
        draw.line([(30, 64), (98, 64)], fill=(245, 245, 245), width=4)
    image.save(path, quality=92)
