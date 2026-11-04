"""Unit tests for eval_metrics metric math.

These tests verify the correctness of Precision@K, Recall@K, and latency
computation functions using synthetic fixtures. They are clearly separated
from experimental results — no synthetic relevance labels are used in
real evaluation.

Run: python -m pytest ai/tests/test_eval_metrics.py -v
"""

import os
import sys
import math

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
from eval_metrics import (
    precision_at_k,
    recall_at_k,
    latency_percentile,
    compute_metrics,
    QueryResult,
    metric_result_to_dict,
)


def test_precision_at_k_perfect():
    retrieved = ["a", "b", "c"]
    relevant = {"a", "b", "c"}
    assert precision_at_k(retrieved, relevant, 3) == 1.0


def test_precision_at_k_partial():
    retrieved = ["a", "b", "x"]
    relevant = {"a", "b", "c"}
    assert precision_at_k(retrieved, relevant, 3) == 2.0 / 3.0


def test_precision_at_k_zero():
    retrieved = ["x", "y", "z"]
    relevant = {"a", "b", "c"}
    assert precision_at_k(retrieved, relevant, 3) == 0.0


def test_precision_at_k_k_larger_than_retrieved():
    retrieved = ["a", "b"]
    relevant = {"a", "b", "c"}
    assert precision_at_k(retrieved, relevant, 5) == 1.0


def test_precision_at_k_k_zero():
    assert precision_at_k(["a", "b"], {"a"}, 0) == 0.0


def test_precision_at_k_empty_retrieved():
    assert precision_at_k([], {"a"}, 3) == 0.0


def test_recall_at_k_perfect():
    retrieved = ["a", "b", "c"]
    relevant = {"a", "b", "c"}
    assert recall_at_k(retrieved, relevant, 3) == 1.0


def test_recall_at_k_partial():
    retrieved = ["a", "b", "x"]
    relevant = {"a", "b", "c"}
    assert recall_at_k(retrieved, relevant, 3) == 2.0 / 3.0


def test_recall_at_k_empty_relevant():
    assert recall_at_k(["a", "b"], set(), 3) == 0.0


def test_recall_at_k_k_zero():
    assert recall_at_k(["a", "b"], {"a"}, 0) == 0.0


def test_latency_percentile_empty():
    assert latency_percentile([], 50) is None


def test_latency_percentile_single():
    assert latency_percentile([10.0], 50) == 10.0


def test_latency_percentile_median():
    assert latency_percentile([1.0, 2.0, 3.0, 4.0], 50) == 2.5


def test_latency_percentile_p95():
    vals = [1.0, 2.0, 3.0, 4.0, 5.0]
    result = latency_percentile(vals, 95)
    assert result is not None
    assert result > 4.0


def test_compute_metrics_basic():
    results = [
        QueryResult(query_id="q1", retrieved_ids=["a", "b", "c"], relevant_ids={"a", "b"}, latency_ms=10.0, k=3),
        QueryResult(query_id="q2", retrieved_ids=["x", "y"], relevant_ids={"a", "b"}, latency_ms=20.0, k=3),
    ]
    mr = compute_metrics(results, 3)
    assert mr.num_queries == 2
    assert mr.num_queries_with_relevant == 2
    assert mr.precision_at_k == (2.0/3.0 + 0.0) / 2.0
    assert mr.recall_at_k == (2.0/2.0 + 0.0) / 2.0
    assert mr.latency_p50_ms is not None
    assert mr.latency_mean_ms == 15.0


def test_compute_metrics_no_ground_truth():
    results = [
        QueryResult(query_id="q1", retrieved_ids=["a", "b"], relevant_ids=set(), latency_ms=5.0, k=3),
    ]
    mr = compute_metrics(results, 3)
    assert mr.num_queries == 1
    assert mr.num_queries_with_relevant == 0
    assert mr.precision_at_k == 0.0
    assert mr.recall_at_k == 0.0


def test_compute_metrics_invalid_k():
    try:
        compute_metrics([], 0)
        assert False, "Should raise ValueError"
    except ValueError:
        pass


def test_metric_result_to_dict():
    results = [
        QueryResult(query_id="q1", retrieved_ids=["a"], relevant_ids={"a"}, latency_ms=5.0, k=1),
    ]
    mr = compute_metrics(results, 1)
    d = metric_result_to_dict(mr)
    assert d["status"] if "status" in d else True
    assert "precision_at_k" in d
    assert "recall_at_k" in d
    assert "per_query" in d
    assert len(d["per_query"]) == 1