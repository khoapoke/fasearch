#!/usr/bin/env python3
"""Evaluation runner for STT6 offline search evaluation.

Usage:
    python eval_runner.py --queries queries.json --qrels qrels.json --output results.json --k 10

If qrels file is missing or invalid, emits an evaluation BLOCKED report with
the exact missing input schema and runnable command. No synthetic relevance
labels are generated.

queries.json schema:
    [
        {"query_id": "q1", "query": "áo sơ mi", "mode": "text", "limit": 5},
        ...
    ]

qrels.json schema:
    {
        "q1": ["product_id_1", "product_id_2"],
        "q2": ["product_id_3"]
    }

The runner does NOT call any AI service or search endpoint. It computes
metrics from pre-collected retrieval results. To collect results, use the
companion script eval_collect.py (or provide a results.json with retrieved_ids).
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval_metrics import QueryResult, compute_metrics, metric_result_to_dict


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_qrels(qrels, queries):
    """Validate qrels against queries. Returns (valid, errors)."""
    errors = []
    if not isinstance(qrels, dict):
        errors.append("qrels must be a JSON object mapping query_id -> list of relevant product IDs")
        return False, errors
    query_ids = {q["query_id"] for q in queries}
    for qid in query_ids:
        if qid not in qrels:
            errors.append(f"missing qrels for query_id: {qid}")
    for qid, rels in qrels.items():
        if not isinstance(rels, list):
            errors.append(f"qrels for {qid} must be a list of product IDs")
        elif not all(isinstance(r, str) for r in rels):
            errors.append(f"qrels for {qid} must contain string product IDs")
    return len(errors) == 0, errors


def run_evaluation(queries_path, qrels_path, results_path, output_path, k):
    """Run evaluation if qrels are valid; otherwise emit BLOCKED report."""
    queries = load_json(queries_path)

    # Check qrels
    if not os.path.exists(qrels_path):
        blocked_report = {
            "status": "BLOCKED",
            "reason": "Canonical qrels file not found",
            "missing_input": qrels_path,
            "required_schema": {
                "type": "object",
                "description": "Maps query_id -> list of relevant product IDs (strings)",
                "example": {"q1": ["product_id_1", "product_id_2"]},
            },
            "queries_file": queries_path,
            "num_queries": len(queries),
            "k": k,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "runnable_command": f"python eval_runner.py --queries {queries_path} --qrels <qrels_file> --results <results_file> --output {output_path} --k {k}",
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(blocked_report, f, indent=2, ensure_ascii=False)
        print(f"BLOCKED: qrels file not found: {qrels_path}")
        print(f"Report written to: {output_path}")
        return

    qrels = load_json(qrels_path)
    valid, errors = validate_qrels(qrels, queries)
    if not valid:
        blocked_report = {
            "status": "BLOCKED",
            "reason": "Invalid qrels",
            "errors": errors,
            "queries_file": queries_path,
            "qrels_file": qrels_path,
            "num_queries": len(queries),
            "k": k,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "required_schema": {
                "type": "object",
                "description": "Maps query_id -> list of relevant product IDs (strings)",
                "example": {"q1": ["product_id_1", "product_id_2"]},
            },
            "runnable_command": f"python eval_runner.py --queries {queries_path} --qrels <valid_qrels_file> --results <results_file> --output {output_path} --k {k}",
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(blocked_report, f, indent=2, ensure_ascii=False)
        print(f"BLOCKED: invalid qrels: {errors}")
        print(f"Report written to: {output_path}")
        return

    # Check results file
    if not results_path or not os.path.exists(results_path):
        blocked_report = {
            "status": "BLOCKED",
            "reason": "Retrieval results file not found",
            "missing_input": results_path,
            "required_schema": {
                "type": "array",
                "description": "List of query results with retrieved_ids and latency",
                "example": [{"query_id": "q1", "retrieved_ids": ["p1", "p2"], "latency_ms": 12.5, "mode": "text"}],
            },
            "queries_file": queries_path,
            "qrels_file": qrels_path,
            "num_queries": len(queries),
            "k": k,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "runnable_command": f"python eval_runner.py --queries {queries_path} --qrels {qrels_path} --results <results_file> --output {output_path} --k {k}",
        }
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(blocked_report, f, indent=2, ensure_ascii=False)
        print(f"BLOCKED: results file not found: {results_path}")
        print(f"Report written to: {output_path}")
        return

    results_raw = load_json(results_path)
    query_map = {q["query_id"]: q for q in queries}

    query_results = []
    for r in results_raw:
        qid = r["query_id"]
        relevant = set(qrels.get(qid, []))
        query_results.append(QueryResult(
            query_id=qid,
            retrieved_ids=r.get("retrieved_ids", []),
            relevant_ids=relevant,
            latency_ms=r.get("latency_ms", 0.0),
            mode=r.get("mode", query_map.get(qid, {}).get("mode", "text")),
            k=k,
        ))

    mr = compute_metrics(query_results, k)
    result = metric_result_to_dict(mr)
    result["status"] = "COMPLETE"
    result["queries_file"] = queries_path
    result["qrels_file"] = qrels_path
    result["results_file"] = results_path
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    result["measurement_boundary"] = "end-to-end (BE search endpoint including AI service round-trip)"
    result["latency_note"] = "p50/p95 computed via linear interpolation over measured samples"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Evaluation complete: P@{k}={mr.precision_at_k:.4f}, R@{k}={mr.recall_at_k:.4f}, n={mr.num_queries}")
    print(f"Report written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="STT6 offline search evaluation runner")
    parser.add_argument("--queries", required=True, help="Path to queries JSON file")
    parser.add_argument("--qrels", required=True, help="Path to qrels JSON file")
    parser.add_argument("--results", default=None, help="Path to retrieval results JSON file")
    parser.add_argument("--output", required=True, help="Path to output report JSON file")
    parser.add_argument("--k", type=int, default=10, help="K for Precision@K and Recall@K")
    args = parser.parse_args()

    run_evaluation(args.queries, args.qrels, args.results, args.output, args.k)


if __name__ == "__main__":
    main()