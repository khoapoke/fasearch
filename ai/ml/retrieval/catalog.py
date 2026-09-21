from __future__ import annotations

import csv
import html
import json
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image, UnidentifiedImageError

from .utils import canonical_json_hash, sha256_file, write_json, write_jsonl


TOP_TYPES = {
    "Tshirts", "Shirts", "Tops", "Kurtas", "Kurtis", "Sweaters", "Sweatshirts",
    "Tunics", "Waistcoat", "Suspenders",
}
BOTTOM_TYPES = {
    "Jeans", "Trousers", "Track Pants", "Shorts", "Skirts", "Leggings", "Jeggings",
    "Churidar", "Salwar", "Patiala", "Capris", "Tights",
}
ONE_PIECE_TYPES = {"Dresses", "Jumpsuit", "Rompers", "Dungarees"}
REQUIRED_METADATA = ("id", "masterCategory", "articleType", "productDisplayName")


def map_article_type(article_type: str) -> str:
    normalized = (article_type or "").strip()
    if normalized in TOP_TYPES:
        return "TOP"
    if normalized in BOTTOM_TYPES:
        return "BOTTOM"
    if normalized in ONE_PIECE_TYPES:
        return "ONE_PIECE"
    return "OUT_OF_SCOPE"


def _locate_styles(raw_dir: Path) -> Path:
    candidates = sorted(raw_dir.rglob("styles.csv"), key=lambda path: (len(path.parts), str(path)))
    if not candidates:
        raise FileNotFoundError(f"No styles.csv found under {raw_dir}")
    hashes = {sha256_file(path) for path in candidates}
    if len(hashes) != 1:
        raise ValueError(
            f"Multiple non-identical styles.csv files found under {raw_dir}; choose a clean snapshot"
        )
    # Kaggle's small archive currently contains a byte-identical root/nested copy.
    return candidates[0]


def _image_map(raw_dir: Path) -> tuple[dict[str, Path], list[Path]]:
    images = sorted(
        path for path in raw_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    mapping: dict[str, Path] = {}
    for path in images:
        mapping.setdefault(path.stem, path)
    return mapping, images


def _perceptual_hash(path: Path) -> str:
    try:
        import imagehash

        with Image.open(path) as image:
            return str(imagehash.phash(image.convert("RGB")))
    except ImportError:
        # A reserved value keeps the product schema explicit when optional pHash tooling is absent.
        return "PENDING_IMAGEHASH_DEPENDENCY"


def _inspect_image(path: Path) -> tuple[bool, int | None, int | None, str | None]:
    try:
        with Image.open(path) as image:
            width, height = image.size
            image.verify()
        return True, width, height, None
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        return False, None, None, f"{type(exc).__name__}: {exc}"


def _balanced_sample(rows: list[dict[str, str]], pilot_size: int, seed: int) -> list[dict[str, str]]:
    import random

    rng = random.Random(seed)
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["mapped_category"]].append(row)
    for values in grouped.values():
        values.sort(key=lambda item: item["id"])
        rng.shuffle(values)

    categories = ["TOP", "BOTTOM", "ONE_PIECE"]
    base, remainder = divmod(pilot_size, len(categories))
    selected: list[dict[str, str]] = []
    leftovers: list[dict[str, str]] = []
    for index, category in enumerate(categories):
        quota = base + (1 if index < remainder else 0)
        values = grouped.get(category, [])
        selected.extend(values[:quota])
        leftovers.extend(values[quota:])
    if len(selected) < pilot_size:
        rng.shuffle(leftovers)
        selected.extend(leftovers[: pilot_size - len(selected)])
    return sorted(selected, key=lambda row: (row["mapped_category"], row["id"]))


@dataclass(frozen=True)
class CatalogArtifacts:
    catalog_path: Path
    catalog_hash: str
    report_path: Path
    raw_manifest_path: Path
    gallery_path: Path
    product_count: int


def prepare_catalog(
    raw_dir: Path,
    output_dir: Path,
    pilot_size: int = 600,
    seed: int = 42,
    snapshot_version: str = "catalog-pilot-20260908-v1",
) -> CatalogArtifacts:
    raw_dir = raw_dir.resolve()
    output_dir = output_dir.resolve()
    styles_path = _locate_styles(raw_dir)
    image_by_id, image_files = _image_map(raw_dir)

    with styles_path.open("r", encoding="utf-8-sig", newline="") as handle:
        metadata_rows = list(csv.DictReader(handle))

    metadata_ids = {str(row.get("id", "")).strip() for row in metadata_rows}
    missing_metadata_ids = sorted(set(image_by_id) - metadata_ids)
    missing_image_ids: list[str] = []
    missing_field_rows: list[dict[str, object]] = []
    corrupt_rows: list[dict[str, str]] = []
    joined_rows: list[dict[str, str]] = []
    article_mapping_counts: Counter[tuple[str, str]] = Counter()

    for row in metadata_rows:
        product_id = str(row.get("id", "")).strip()
        missing_fields = [field for field in REQUIRED_METADATA if not str(row.get(field, "")).strip()]
        if missing_fields:
            missing_field_rows.append({"product_id": product_id, "missing_fields": missing_fields})
        image_path = image_by_id.get(product_id)
        if image_path is None:
            missing_image_ids.append(product_id)
            continue
        ok, width, height, error = _inspect_image(image_path)
        if not ok:
            corrupt_rows.append({"product_id": product_id, "image_path": str(image_path), "error": error or "unknown"})
            continue
        mapped = map_article_type(str(row.get("articleType", "")))
        article_mapping_counts[(str(row.get("articleType", "")), mapped)] += 1
        enriched = {key: str(value or "").strip() for key, value in row.items()}
        enriched.update(
            {
                "id": product_id,
                "mapped_category": mapped,
                "image_path": str(image_path),
                "image_width": str(width),
                "image_height": str(height),
            }
        )
        joined_rows.append(enriched)

    apparel_rows = [row for row in joined_rows if row.get("masterCategory") == "Apparel"]
    in_scope_rows = [row for row in apparel_rows if row["mapped_category"] != "OUT_OF_SCOPE"]
    selected = _balanced_sample(in_scope_rows, pilot_size, seed)

    catalog: list[dict[str, object]] = []
    for row in selected:
        image_path = Path(row["image_path"])
        product_id = row["id"]
        image_sha = sha256_file(image_path)
        phash = _perceptual_hash(image_path)
        catalog.append(
            {
                "schema_version": "1.0.0",
                "catalog_snapshot_id": snapshot_version,
                "product_id": product_id,
                "product_version_id": f"dataset-a-{product_id}-v1",
                "product_group_id": f"phash-pending-{product_id}",
                "title": row.get("productDisplayName", ""),
                "category": row["mapped_category"],
                "article_type": row.get("articleType", ""),
                "image_path": str(image_path),
                "image_sha256": image_sha,
                "image_phash": phash,
                "base_colour": row.get("baseColour", ""),
                "gender": row.get("gender", ""),
                "season": row.get("season", ""),
                "usage": row.get("usage", ""),
                "source_master_category": row.get("masterCategory", ""),
                "source_subcategory": row.get("subCategory", ""),
                "pilot_only": True,
            }
        )

    catalog_path = output_dir / "catalog.cleaned.v1.jsonl"
    write_jsonl(catalog_path, catalog)
    catalog_hash = sha256_file(catalog_path)

    raw_files = sorted(path for path in raw_dir.rglob("*") if path.is_file())
    raw_manifest = {
        "schema_version": "1.0.0",
        "manifest_id": f"{snapshot_version}-raw-manifest",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_root": str(raw_dir),
        "immutable": True,
        "file_count": len(raw_files),
        "files": [
            {
                "path": str(path.relative_to(raw_dir)),
                "size_bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for path in raw_files
        ],
    }
    raw_manifest["content_hash"] = canonical_json_hash(raw_manifest["files"])
    raw_manifest_path = output_dir / "raw-manifest.v1.json"
    write_json(raw_manifest_path, raw_manifest)

    category_counts = Counter(item["category"] for item in catalog)
    mapping_rows = [
        {"article_type": source, "mapped_category": target, "count": count}
        for (source, target), count in sorted(article_mapping_counts.items())
    ]
    report = {
        "schema_version": "1.0.0",
        "report_id": f"{snapshot_version}-cleaning-report",
        "pilot_only": True,
        "source": "paramaggarwal/fashion-product-images-small",
        "counts": {
            "metadata_rows_before_join": len(metadata_rows),
            "image_files_before_join": len(image_files),
            "unique_image_ids_before_join": len(image_by_id),
            "duplicate_source_image_paths": len(image_files) - len(image_by_id),
            "rows_after_valid_image_join": len(joined_rows),
            "rows_after_apparel_filter": len(apparel_rows),
            "rows_after_taxonomy_scope_filter": len(in_scope_rows),
            "pilot_catalog_rows": len(catalog),
        },
        "category_counts": dict(sorted(category_counts.items())),
        "quality": {
            "missing_image_count": len(missing_image_ids),
            "corrupt_image_count": len(corrupt_rows),
            "metadata_missing_required_count": len(missing_field_rows),
            "image_without_metadata_count": len(missing_metadata_ids),
        },
        "missing_image_ids": missing_image_ids,
        "corrupt_images": corrupt_rows,
        "metadata_missing_required": missing_field_rows,
        "images_without_metadata": missing_metadata_ids,
        "article_type_mapping": mapping_rows,
        "catalog_sha256": catalog_hash,
        "dedupe": {
            "exact_image_checksum_computed": True,
            "phash_computed": all(item["image_phash"] != "PENDING_IMAGEHASH_DEPENDENCY" for item in catalog),
            "product_group_status": "PLACEHOLDER_PENDING_NEAR_DUPLICATE_CLUSTER_REVIEW",
        },
    }
    report_path = output_dir / "cleaning-report.v1.json"
    write_json(report_path, report)
    _write_csv(output_dir / "category-counts.v1.csv", [
        {"category": key, "count": value} for key, value in sorted(category_counts.items())
    ])
    _write_csv(output_dir / "mapping-report.v1.csv", mapping_rows)
    write_json(output_dir / "missing-corrupt-report.v1.json", report["quality"] | {
        "missing_image_ids": missing_image_ids,
        "corrupt_images": corrupt_rows,
        "metadata_missing_required": missing_field_rows,
        "images_without_metadata": missing_metadata_ids,
    })
    gallery_path = output_dir / "sample-gallery.v1.html"
    _write_gallery(gallery_path, catalog[: min(18, len(catalog))])
    return CatalogArtifacts(catalog_path, catalog_hash, report_path, raw_manifest_path, gallery_path, len(catalog))


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def _write_gallery(path: Path, catalog: Iterable[dict[str, object]]) -> None:
    cards = []
    for item in catalog:
        image_uri = Path(str(item["image_path"])).as_uri()
        cards.append(
            "<figure>"
            f'<img src="{html.escape(image_uri)}" alt="{html.escape(str(item["product_id"]))}">'
            f"<figcaption>{html.escape(str(item['product_id']))} - "
            f"{html.escape(str(item['category']))}<br>{html.escape(str(item['title']))}</figcaption>"
            "</figure>"
        )
    document = """<!doctype html><html lang="vi"><meta charset="utf-8">
<title>Dataset A pilot sample gallery v1</title>
<style>body{font-family:system-ui;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1rem}figure{margin:0;padding:1rem;border:1px solid #ddd;border-radius:8px}img{width:100%;aspect-ratio:1;object-fit:contain}figcaption{font-size:.85rem;margin-top:.5rem}</style>
<h1>Dataset A pilot sample gallery v1</h1><p>Pilot-only visual audit; not a final benchmark.</p><main>""" + "".join(cards) + "</main></html>\n"
    path.write_text(document, encoding="utf-8")
