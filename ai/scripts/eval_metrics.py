"""Evaluation metrics for STT6 offline search evaluation.

Pure-Python implementation (no external dependencies) so it can run
in any environment. Computes Precision@K, Recall@K, and latency statistics.

Synthetic fixture unit tests may test metric math ONLY, clearly separated
from experimental results. No synthetic relevance labels in real evaluation.
"""

from __future__ import annotations

import json
import math
import statistics
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class QueryResult:
    """Result of a single search query evaluation."""
    query_id: str
    retrieved_ids: List[str]
    relevant_ids: Set[str]
    latency_ms: float
    mode: str = "text"
    k: int = 10


@dataclass
class MetricResult:
    """Aggregated metric result for a set of queries."""
    precision_at_k: float
    recall_at_k: float
    num_queries: int
    num_queries_with_relevant: int
    k: int
    latency_p50_ms: Optional[float] = None
    latency_p95_ms: Optional[float] = None
    latency_mean_ms: Optional[float] = None
    latency_min_ms: Optional[float] = None
    latency_max_ms: Optional[float] = None
    per_query: List[Dict] = field(default_factory=list)


def precision_at_k(retrieved: List[str], relevant: Set[str], k: int) -> float:
    """Precision@K = |retrieved[:k] ∩ relevant| / min(k, |retrieved|).

    If k <= 0 or no items retrieved, returns 0.0.
    """
    if k <= 0 or not retrieved:
        return 0.0
    top_k = retrieved[:k]
    hits = sum(1 for item in top_k if item in relevant)
    denom = min(k, len(top_k))
    if denom == 0:
        return 0.0
    return hits / denom


def recall_at_k(retrieved: List[str], relevant: Set[str], k: int) -> float:
    """Recall@K = |retrieved[:k] ∩ relevant| / |relevant|.

    If relevant is empty, returns 0.0 (no ground truth).
    If k <= 0, returns 0.0.
    """
    if k <= 0 or not relevant:
        return 0.0
    top_k = retrieved[:k]
    hits = sum(1 for item in top_k if item in relevant)
    return hits / len(relevant)


def latency_percentile(latencies: List[float], percentile: float) -> Optional[float]:
    """Compute percentile of latency values using linear interpolation.

    Returns None if latencies is empty.
    """
    if not latencies:
        return None
    sorted_l = sorted(latencies)
    if len(sorted_l) == 1:
        return sorted_l[0]
    rank = (percentile / 100.0) * (len(sorted_l) - 1)
    lower = int(math.floor(rank))
    upper = int(math.ceil(rank))
    if lower == upper:
        return sorted_l[lower]
    frac = rank - lower
    return sorted_l[lower] + frac * (sorted_l[upper] - sorted_l[lower])


def compute_metrics(results: List[QueryResult], k: int) -> MetricResult:
    """Compute aggregate metrics over a list of query results.

    Queries with empty relevant_ids are counted in num_queries but not
    in precision/recall averages (they have no ground truth).
    """
    if k <= 0:
        raise ValueError("k must be positive")

    precisions = []
    recalls = []
    latencies = []
    per_query = []
    num_with_relevant = 0

    for r in results:
        latencies.append(r.latency_ms)
        has_relevant = len(r.relevant_ids) > 0
        if has_relevant:
            num_with_relevant += 1
            p = precision_at_k(r.retrieved_ids, r.relevant_ids, k)
            rec = recall_at_k(r.retrieved_ids, r.relevant_ids, k)
            precisions.append(p)
            recalls.append(rec)
        per_query.append({
            "query_id": r.query_id,
            "mode": r.mode,
            "k": k,
            "retrieved_count": len(r.retrieved_ids),
            "relevant_count": len(r.relevant_ids),
            "hits": len(set(r.retrieved_ids[:k]) & r.relevant_ids) if r.relevant_ids else 0,
            "precision_at_k": precision_at_k(r.retrieved_ids, r.relevant_ids, k) if has_relevant else None,
            "recall_at_k": recall_at_k(r.retrieved_ids, r.relevant_ids, k) if has_relevant else None,
            "latency_ms": r.latency_ms,
            "has_ground_truth": has_relevant,
        })

    avg_precision = sum(precisions) / len(precisions) if precisions else 0.0
    avg_recall = sum(recalls) / len(recalls) if recalls else 0.0

    return MetricResult(
        precision_at_k=avg_precision,
        recall_at_k=avg_recall,
        num_queries=len(results),
        num_queries_with_relevant=num_with_relevant,
        k=k,
        latency_p50_ms=latency_percentile(latencies, 50),
        latency_p95_ms=latency_percentile(latencies, 95),
        latency_mean_ms=statistics.mean(latencies) if latencies else None,
        latency_min_ms=min(latencies) if latencies else None,
        latency_max_ms=max(latencies) if latencies else None,
        per_query=per_query,
    )


def metric_result_to_dict(mr: MetricResult) -> dict:
    """Convert MetricResult to a JSON-serializable dict."""
    return {
        "precision_at_k": mr.precision_at_k,
        "recall_at_k": mr.recall_at_k,
        "num_queries": mr.num_queries,
        "num_queries_with_relevant": mr.num_queries_with_relevant,
        "k": mr.k,
        "latency_p50_ms": mr.latency_p50_ms,
        "latency_p95_ms": mr.latency_p95_ms,
        "latency_mean_ms": mr.latency_mean_ms,
        "latency_min_ms": mr.latency_min_ms,
        "latency_max_ms": mr.latency_max_ms,
        "per_query": mr.per_query,
    }