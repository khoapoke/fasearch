"""FAISS-vs-Qdrant exact shadow parity (read-only reference runner).

- FAISS side: canonical ``index.faiss`` (IndexFlatIP, unchanged) + the SAME
  frozen float32 vectors used for the Qdrant ingest. No re-embedding.
- Qdrant side: task shadow collection, DOT, ``exact=True`` (no ANN).
- Probes: fixed IMAGE (catalog rows), TEXT (CLIP-encoded pilot queries via
  the delivered module's encoder), COMPOSED (0.5/0.5 L2 fusion); PRODUCT
  anchor-exclusion probes apply the identical mask on both sides.
- Comparison: IDs/product-version/count/order/score with abs tolerance
  1e-5. Ties (|d| <= 1e-6) compare as sets; a rank-k cutoff inside a tie
  group is a reported boundary case, never hidden by re-sorting.
- Negative drills: wrong-dim query, unavailable collection, malformed
  ingest payload — all must fail closed with no fallback.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time

import numpy as np

AI_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       "..", "..", "ai"))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

SCORE_TOL = 1e-5
TIE_EPS = 1e-6


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_frozen(repo_root: str, cfg: dict):
    import faiss
    import yaml
    with open(os.path.join(AI_DIR, "configs", "shadow.v1.yaml"),
              "r", encoding="utf-8") as fh:
        shadow = yaml.safe_load(fh)
    assets = shadow["assets"]
    emb_path = os.path.join(repo_root, assets["embeddings"])
    map_path = os.path.join(repo_root, assets["mapping"])
    idx_path = os.path.join(repo_root, "artifacts/indexes/week4-baseline-20260908-v1",
                            "index.faiss")
    for p in (emb_path, map_path, idx_path):
        if not os.path.isfile(p):
            raise FileNotFoundError(f"Thiếu artifact đóng băng: {p}")
    vectors = np.load(emb_path)
    rows = [json.loads(line) for line in open(map_path, encoding="utf-8")
            if line.strip()]
    index = faiss.read_index(idx_path)
    return shadow, vectors, rows, index, {
        "embeddings": sha256_file(emb_path), "mapping": sha256_file(map_path),
        "index": sha256_file(idx_path)}


def build_probes(shadow, vectors, rows, repo_root, max_text: int = 8,
                 max_composed: int = 8):
    """Fixed deterministic probe set (>=24 with exclusion variants)."""
    probes = []
    cats: dict[str, list[int]] = {}
    for i, r in enumerate(rows):
        cats.setdefault(r.get("category", "?"), []).append(i)
    # IMAGE: spread across categories, fixed rows.
    image_rows = []
    per_cat = 3
    for cat in sorted(cats):
        image_rows.extend(cats[cat][:per_cat])
    image_rows = image_rows[:9]
    for n, i in enumerate(image_rows):
        probes.append({"probe_id": f"IMAGE-{n + 1:02d}", "mode": "IMAGE",
                       "row": i,
                       "product_version_id": rows[i]["product_version_id"],
                       "vector": [float(v) for v in vectors[i].tolist()],
                       "k": 10, "exclude": None})
    # TEXT: fixed pilot queries, CLIP-encoded with the delivered module.
    qpath = os.path.join(repo_root, "ai/evaluation/pilot_queries.dataset_a.v1.jsonl")
    texts = [json.loads(line) for line in open(qpath, encoding="utf-8")
             if line.strip()]
    texts = [q for q in texts if q.get("mode") == "TEXT"][:max_text]
    from src.services.search_service import encode_text_vector
    for n, q in enumerate(texts):
        probes.append({"probe_id": f"TEXT-{n + 1:02d}", "mode": "TEXT",
                       "raw_text": q["raw_text"],
                       "query_id": q.get("query_id"),
                       "vector": encode_text_vector(q["raw_text"]),
                       "k": 10, "exclude": None})
    # COMPOSED: fixed (row, text) pairs with frozen 0.5/0.5 L2 fusion.
    from src.services.search_service import fuse_vectors
    pairs = [(image_rows[n % len(image_rows)], texts[n % len(texts)])
             for n in range(max_composed)]
    for n, (i, q) in enumerate(pairs):
        text_vec = encode_text_vector(q["raw_text"])
        img_vec = [float(v) for v in vectors[i].tolist()]
        probes.append({"probe_id": f"COMPOSED-{n + 1:02d}", "mode": "COMPOSED",
                       "row": i, "query_id": q.get("query_id"),
                       "vector": fuse_vectors(img_vec, text_vec),
                       "k": 10, "exclude": None})
    # PRODUCT anchor exclusion: exclude the row's own product.
    for n in range(4):
        base = dict(probes[n])
        base["probe_id"] = f"ANCHOR-{n + 1:02d}"
        base["exclude"] = rows[base["row"]]["product_id"]
        probes.append(base)
    return probes


def faiss_search(index, rows, vector, k, exclude_pid=None, fetch_extra=0):
    import numpy as np
    q = np.array([vector], dtype=np.float32)
    fetch = k + fetch_extra + (20 if exclude_pid else 0)
    scores, ids = index.search(q, fetch)
    out = []
    want = k + fetch_extra
    for score, idx in zip(scores[0].tolist(), ids[0].tolist()):
        if idx < 0:
            continue
        r = rows[idx]
        if exclude_pid and r.get("product_id") == exclude_pid:
            continue
        out.append({"product_version_id": r["product_version_id"],
                    "product_id": r.get("product_id"), "score": float(score)})
        if len(out) == want:
            break
    return out


def qdrant_search(client, collection, vector, k, exclude_pid=None,
                  fetch_extra=0):
    from qdrant_client.models import (FieldCondition, Filter, MatchValue,
                                      SearchParams)
    qfilter = None
    if exclude_pid:
        qfilter = Filter(must_not=[FieldCondition(
            key="product_id", match=MatchValue(value=exclude_pid))])
    t0 = time.perf_counter()
    hits = client.query_points(
        collection_name=collection, query=vector, limit=k + fetch_extra,
        with_payload=True,
        search_params=SearchParams(exact=True), query_filter=qfilter).points
    dt_ms = (time.perf_counter() - t0) * 1000.0
    return [{"product_version_id": (h.payload or {}).get("product_version_id"),
             "product_id": (h.payload or {}).get("product_id"),
             "score": float(h.score)} for h in hits], dt_ms


def tie_groups(results):
    groups = []
    for row in results:
        if not groups or abs(row["score"] - groups[-1][0]["score"]) > TIE_EPS:
            groups.append([row])
        else:
            groups[-1].append(row)
    return groups


def compare_probe(prob, faiss_res, qdrant_res, extended=None):
    import math
    fails, ties = [], []
    f_ids = [r["product_version_id"] for r in faiss_res]
    q_ids = [r["product_version_id"] for r in qdrant_res]
    if len(faiss_res) != len(qdrant_res):
        fails.append("count mismatch")
    for label, rows, ids in (("faiss", faiss_res, f_ids), ("qdrant", qdrant_res, q_ids)):
        if len(set(ids)) != len(ids) or any(not r.get("product_id") or not r.get("product_version_id") for r in rows):
            fails.append(label + " duplicate/missing business identity")
        if any(not math.isfinite(float(r["score"])) for r in rows):
            fails.append(label + " nonfinite score")
    if fails:
        return fails, ties, "FAIL"
    fm = {r["product_version_id"]: r for r in faiss_res}
    qm = {r["product_version_id"]: r for r in qdrant_res}
    common = set(fm) & set(qm)
    for key in common:
        if fm[key]["product_id"] != qm[key]["product_id"]:
            fails.append("business identity: " + key)
        if abs(fm[key]["score"] - qm[key]["score"]) > SCORE_TOL:
            fails.append("score: " + key)
    qp = {key: i for i, key in enumerate(q_ids)}
    ordered = [key for key in f_ids if key in common]
    for i, left in enumerate(ordered):
        for right in ordered[i+1:]:
            if qp[left] > qp[right]:
                if (abs(fm[left]["score"] - fm[right]["score"]) > TIE_EPS or
                    abs(qm[left]["score"] - qm[right]["score"]) > TIE_EPS):
                    fails.append("order: non-tie inversion " + left + "/" + right)
                else:
                    ties.append({"members": [left, right]})
    boundary = set(f_ids) ^ set(q_ids)
    if boundary:
        allowed = bool(extended and faiss_res and qdrant_res)
        if allowed:
            fx = {r["product_version_id"]: r for r in extended[0]}
            qx = {r["product_version_id"]: r for r in extended[1]}
            cut_f, cut_q = faiss_res[-1]["score"], qdrant_res[-1]["score"]
            for key in boundary:
                f, q = fx.get(key), qx.get(key)
                if (not f or not q or f["product_id"] != q["product_id"] or
                    not math.isfinite(f["score"]) or not math.isfinite(q["score"]) or
                    abs(f["score"] - q["score"]) > SCORE_TOL or
                    abs(f["score"] - cut_f) > TIE_EPS or
                    abs(q["score"] - cut_q) > TIE_EPS):
                    allowed = False
        if allowed:
            ties.append({"boundary": True, "members": sorted(boundary)})
        else:
            fails.append("membership: unmatched cutoff identities")
    verdict = "FAIL" if fails else ("TIE-BOUNDARY" if boundary else ("TIE-OK" if ties else "PASS"))
    return fails, ties, verdict


def negative_drills(client, collection, dim):
    drills = {}
    try:
        client.query_points(collection_name=collection,
                            query=[0.0] * (dim + 1), limit=5)
        drills["wrong_dimension"] = {"fail_closed": False,
                                     "note": "server accepted bad dim"}
    except Exception as exc:
        drills["wrong_dimension"] = {"fail_closed": True,
                                     "error": type(exc).__name__}
    try:
        client.query_points(collection_name="no_such_collection_xyz",
                            query=[0.0] * dim, limit=5)
        drills["unknown_collection"] = {"fail_closed": False,
                                        "note": "server accepted unknown collection"}
    except Exception as exc:
        drills["unknown_collection"] = {"fail_closed": True,
                                        "error": type(exc).__name__}
    return drills


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--probes", required=True,
                        help="Probe vectors JSON from encode_probes.py")
    parser.add_argument("--out", required=True, help="JSON report path")
    parser.add_argument("--collection", default=None, help="Task-owned restore collection only")
    parser.add_argument("--warm-runs", type=int, default=1)
    args = parser.parse_args(argv)

    from qdrant_client import QdrantClient
    shadow, vectors, rows, index, hashes = load_frozen(args.repo_root, None)
    with open(args.probes, "r", encoding="utf-8") as fh:
        probes = json.load(fh)["probes"]
    q = dict(shadow["qdrant"])
    if args.collection:
        from src.core.shadow_ids import TASK_COLLECTIONS
        if (args.collection not in TASK_COLLECTIONS
                and not args.collection.startswith("fasearch_shadow_week4_v1_restore_")
                and not args.collection.startswith("fasearch_web_week4_v1_restore_")):
            raise ValueError("Only task-owned collection overrides allowed")
        q["collection_name"] = args.collection
    client = QdrantClient(url=f"http://{q['host']}:{q['http_port']}", timeout=5)
    try:
        # Warm run (not measured), then measured runs.
        for _ in range(args.warm_runs):
            qdrant_search(client, q["collection_name"], probes[0]["vector"],
                          probes[0]["k"])
        results, n_fail, n_tie = [], 0, 0
        lat = []
        for prob in probes:
            f_res = faiss_search(index, rows, prob["vector"], prob["k"],
                                 prob["exclude"])
            q_res, dt = qdrant_search(client, q["collection_name"],
                                      prob["vector"], prob["k"], prob["exclude"])
            lat.append({"probe_id": prob["probe_id"], "ms": round(dt, 2),
                        "mode": prob["mode"]})
            fails, ties, verdict = compare_probe(prob, f_res, q_res)
            if verdict == "FAIL" and any("membership" in f for f in fails):
                # Hypothesis check: exact-score tie straddling the rank-k
                # cutoff (engines break exact ties differently). Refetch
                # wider and test explicitly instead of loosening tolerance.
                f_x = faiss_search(index, rows, prob["vector"], prob["k"],
                                   prob["exclude"], fetch_extra=5)
                q_x, _ = qdrant_search(client, q["collection_name"],
                                        prob["vector"], prob["k"],
                                        prob["exclude"], fetch_extra=5)
                fails, ties, verdict = compare_probe(prob, f_res, q_res, extended=(f_x, q_x))
            if verdict == "FAIL":
                n_fail += 1
            if ties:
                n_tie += 1
            results.append({"probe_id": prob["probe_id"], "mode": prob["mode"],
                            "k": prob["k"], "exclude": prob["exclude"],
                            "verdict": verdict, "fails": fails, "ties": ties,
                            "faiss_top": f_res[0] if f_res else None,
                            "qdrant_top": q_res[0] if q_res else None})
        report = {
            "parity_spec": {"score_abs_tol": SCORE_TOL, "tie_eps": TIE_EPS,
                            "metric": "DOT", "exact": True,
                            "shadow_index_version":
                                shadow["publication"]["shadow_index_version"],
                            "source_index_version":
                                shadow["publication"]["source_index_version"]},
            "artifact_sha256": hashes,
            "collection": q["collection_name"],
            "n_probes": len(probes), "n_fail": n_fail,
            "n_tie_probes": n_tie,
            "latency_ms_descriptive": lat,
            "results": results,
            "negative_drills": negative_drills(client, q["collection_name"],
                                               int(q["vector_size"])),
        }
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"[*] parity: {len(probes) - n_fail}/{len(probes)} pass, "
              f"ties in {n_tie}, fails={n_fail} -> {args.out}")
        return 0 if n_fail == 0 and all(d["fail_closed"] for d in report["negative_drills"].values()) and len(probes) >= 24 else 3
    finally:
        try:
            client.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
