from __future__ import annotations

from collections import defaultdict
from typing import Iterable, Mapping, Sequence

import numpy as np


def precision_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    if k <= 0:
        raise ValueError("k must be positive")
    top = ranked_ids[:k]
    return sum(item in relevant_ids for item in top) / k


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    return sum(item in relevant_ids for item in ranked_ids[:k]) / len(relevant_ids)


def target_recall_at_k(ranked_ids: Sequence[str], target_id: str | None, k: int) -> float:
    if target_id is None:
        return 0.0
    return float(target_id in ranked_ids[:k])


def reciprocal_rank_at_k(ranked_ids: Sequence[str], relevant_ids: set[str], k: int) -> float:
    for rank, item in enumerate(ranked_ids[:k], start=1):
        if item in relevant_ids:
            return 1.0 / rank
    return 0.0


def evaluate_queries(
    query_outputs: Iterable[dict],
    qrels: Mapping[str, Mapping[str, int]],
    targets: Mapping[str, str | None],
    ks: Sequence[int] = (1, 5, 10),
) -> dict:
    outputs = list(query_outputs)
    aggregates: dict[str, list[float]] = defaultdict(list)
    by_mode: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    per_query: list[dict] = []
    latencies: list[float] = []

    for output in outputs:
        query_id = output["query_id"]
        mode = output["mode"]
        ranked = [str(result["product_id"]) for result in output["results"]]
        grades = qrels.get(query_id, {})
        strict = {str(product_id) for product_id, grade in grades.items() if grade >= 2}
        relaxed = {str(product_id) for product_id, grade in grades.items() if grade >= 1}
        row: dict[str, object] = {"query_id": query_id, "mode": mode}
        for k in ks:
            values = {
                f"precision_strict@{k}": precision_at_k(ranked, strict, k),
                f"precision_relaxed@{k}": precision_at_k(ranked, relaxed, k),
                f"recall_strict@{k}": recall_at_k(ranked, strict, k),
                f"recall_relaxed@{k}": recall_at_k(ranked, relaxed, k),
                f"target_recall@{k}": target_recall_at_k(ranked, targets.get(query_id), k),
                f"mrr_strict@{k}": reciprocal_rank_at_k(ranked, strict, k),
                f"mrr_relaxed@{k}": reciprocal_rank_at_k(ranked, relaxed, k),
            }
            for name, value in values.items():
                row[name] = value
                aggregates[name].append(value)
                by_mode[mode][name].append(value)
        row["latency_ms"] = float(output["latency_ms"])
        row["ranked_product_ids"] = ranked
        latencies.append(float(output["latency_ms"]))
        per_query.append(row)

    overall = {name: float(np.mean(values)) for name, values in sorted(aggregates.items())}
    mode_metrics = {
        mode: {name: float(np.mean(values)) for name, values in sorted(metrics.items())}
        for mode, metrics in sorted(by_mode.items())
    }
    latency = {
        "count": len(latencies),
        "p50_ms": float(np.percentile(latencies, 50)) if latencies else 0.0,
        "p95_ms": float(np.percentile(latencies, 95)) if latencies else 0.0,
    }
    return {"overall": overall, "by_mode": mode_metrics, "latency": latency, "per_query": per_query}
