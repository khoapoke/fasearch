import json
from pathlib import Path

from ml.retrieval.catalog import map_article_type, prepare_catalog
from ml.retrieval.fixtures import create_dataset_a_fixture
from ml.retrieval.utils import read_jsonl


def test_article_type_policy() -> None:
    assert map_article_type("Tshirts") == "TOP"
    assert map_article_type("Jeans") == "BOTTOM"
    assert map_article_type("Dresses") == "ONE_PIECE"
    assert map_article_type("Shoes") == "OUT_OF_SCOPE"


def test_fixture_catalog_audit_and_balance(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    output = tmp_path / "processed"
    create_dataset_a_fixture(raw)
    artifacts = prepare_catalog(raw, output, pilot_size=30, seed=42, snapshot_version="test-v1")
    catalog = read_jsonl(artifacts.catalog_path)
    report = json.loads(artifacts.report_path.read_text(encoding="utf-8"))

    assert len(catalog) == 30
    assert report["counts"]["metadata_rows_before_join"] == 33
    assert report["counts"]["rows_after_valid_image_join"] == 31
    assert report["quality"]["missing_image_count"] == 1
    assert report["quality"]["corrupt_image_count"] == 1
    assert report["category_counts"] == {"BOTTOM": 10, "ONE_PIECE": 10, "TOP": 10}
    assert all(len(item["image_sha256"]) == 64 for item in catalog)
    assert all(len(item["image_phash"]) == 16 for item in catalog)
    assert artifacts.gallery_path.exists()
    assert artifacts.raw_manifest_path.exists()
