"""Test EvaluationService: báo thiếu Ground Truth rõ ràng, recall chỉ tính trên item có trong collection."""

import csv

import pytest
import torch

from conftest import FakeModel, TEST_COLLECTION
from src.core.exceptions import GroundTruthMissingError
from src.services.evaluation_service import EvaluationService


def _write_csv(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "articleType", "productDisplayName"])
        w.writeheader()
        w.writerows(rows)
    return path


def _index(repo, file_names):
    for i, name in enumerate(file_names):
        repo.create(1000 + i, FakeModel._vec(torch.tensor([i + 1])).numpy()[0].tolist(),
                    {"file_name": name, "image_path": f"/dataset/{name}", "status": "SEEDED", "catalog": "FASHION_PRODUCT"})


@pytest.fixture
def svc(mem_repo, fake_processor):
    return EvaluationService(collection_name=TEST_COLLECTION)


def test_missing_csv_raises_not_zero(svc, mem_repo, tmp_path):
    _index(svc.search_srv.repo, ["1.jpg", "2.jpg"])
    with pytest.raises(GroundTruthMissingError, match="Thiếu dữ liệu nhãn"):
        svc.evaluate_query("shirt", "Shirts", csv_path=tmp_path / "nope.csv")
    with pytest.raises(GroundTruthMissingError):
        svc.run_full_benchmark(test_cases=[{"query": "shirt", "target_article_type": "Shirts"}], csv_path=tmp_path / "nope.csv")


def test_no_overlap_between_csv_and_collection_raises(svc, mem_repo, tmp_path):
    _index(svc.search_srv.repo, ["uuid-a.jpg", "uuid-b.jpg"])
    csv_path = _write_csv(tmp_path / "styles.csv", [{"id": "1", "articleType": "Shirts", "productDisplayName": "a"}])
    with pytest.raises(GroundTruthMissingError, match="0/2"):
        svc.evaluate_query("shirt", "Shirts", csv_path=csv_path)


def test_recall_denominator_counts_only_indexed_items(svc, mem_repo, tmp_path):
    # CSV có 5 áo sơ mi nhưng collection chỉ có 2 trong số đó (+1 quần)
    rows = [{"id": str(i), "articleType": "Shirts", "productDisplayName": f"s{i}"} for i in range(1, 6)]
    rows.append({"id": "6", "articleType": "Jeans", "productDisplayName": "j"})
    csv_path = _write_csv(tmp_path / "styles.csv", rows)
    _index(svc.search_srv.repo, ["1.jpg", "2.jpg", "6.jpg"])

    res = svc.evaluate_query("shirt", "Shirts", k_list=[1, 3], limit=3, csv_path=csv_path)
    assert res.total_relevant_in_db == 2  # không phải 5
    m3 = res.metrics_at_k[3]
    assert m3.total_relevant == 2
    assert m3.recall == pytest.approx(m3.hit_count / 2, abs=1e-4)
    assert m3.recall <= 1.0  # trước đây có thể bị chia cho cả CSV


def test_benchmark_skips_queries_without_relevant_items(svc, mem_repo, tmp_path):
    rows = [{"id": "1", "articleType": "Shirts", "productDisplayName": "s"},
            {"id": "2", "articleType": "Shirts", "productDisplayName": "s2"},
            {"id": "3", "articleType": "Watches", "productDisplayName": "w"}]  # Watches không được index
    csv_path = _write_csv(tmp_path / "styles.csv", rows)
    _index(svc.search_srv.repo, ["1.jpg", "2.jpg"])
    cases = [{"query": "shirt", "target_article_type": "Shirts"}, {"query": "watch", "target_article_type": "Watches"}]
    summary = svc.run_full_benchmark(test_cases=cases, k_list=[1, 3], csv_path=csv_path)
    assert summary.total_queries == 2
    assert summary.skipped_queries == ["watch"]
    assert summary.evaluated_images_count == 2
    assert 0.0 <= summary.map_score <= 1.0


def test_benchmark_all_queries_without_relevant_items_raises(svc, mem_repo, tmp_path):
    csv_path = _write_csv(tmp_path / "styles.csv", [{"id": "1", "articleType": "Shirts", "productDisplayName": "s"}])
    _index(svc.search_srv.repo, ["1.jpg"])
    with pytest.raises(GroundTruthMissingError):
        svc.run_full_benchmark(test_cases=[{"query": "w", "target_article_type": "Watches"}], csv_path=csv_path)


def test_soft_deleted_items_are_not_counted(svc, mem_repo, tmp_path):
    csv_path = _write_csv(tmp_path / "styles.csv", [{"id": "1", "articleType": "Shirts", "productDisplayName": "s"},
                                                    {"id": "2", "articleType": "Shirts", "productDisplayName": "s2"}])
    _index(svc.search_srv.repo, ["1.jpg", "2.jpg"])
    svc.search_srv.repo.soft_delete(1001)
    res = svc.evaluate_query("shirt", "Shirts", csv_path=csv_path, limit=3)
    assert res.total_relevant_in_db == 1
