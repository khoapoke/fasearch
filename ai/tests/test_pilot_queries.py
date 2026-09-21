import json
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_dataset_a_pilot_query_contract() -> None:
    queries = [json.loads(line) for line in (ROOT / "evaluation/pilot_queries.dataset_a.v1.jsonl").read_text(encoding="utf-8").splitlines() if line]
    assert len(queries) == 24
    assert Counter(query["mode"] for query in queries) == {"TEXT": 12, "IMAGE": 6, "COMPOSED": 6}
    assert all(query["pilot_only"] is True for query in queries)
    assert all(query.get("source_note") for query in queries)
    assert all(query.get("exclude_product_id") for query in queries if query["mode"] != "TEXT")
    assert any("á" in query.get("raw_text", "") or "đ" in query.get("raw_text", "") for query in queries)


def test_pilot_text_does_not_copy_full_catalog_title_when_catalog_is_available() -> None:
    catalog_path = ROOT / "data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl"
    if not catalog_path.exists():
        return
    titles = {json.loads(line)["title"].strip().casefold() for line in catalog_path.read_text(encoding="utf-8").splitlines()}
    queries = [json.loads(line) for line in (ROOT / "evaluation/pilot_queries.dataset_a.v1.jsonl").read_text(encoding="utf-8").splitlines() if line]
    texts = {query.get("raw_text", "").strip().casefold() for query in queries if query.get("raw_text")}
    assert not (titles & texts)
