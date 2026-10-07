"""Encode parity probe vectors with the delivered module (torch process).

Separated from the FAISS comparison process: faiss-cpu and torch must not
share a process on this host (native OpenMP conflict -> segfault). Output
probe vectors are frozen inputs to parity_check.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

AI_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                       "..", "..", "ai"))
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--max-text", type=int, default=8)
    parser.add_argument("--max-composed", type=int, default=8)
    args = parser.parse_args(argv)

    from src.services.search_service import encode_text_vector, fuse_vectors

    emb_path = os.path.join(
        args.repo_root, "artifacts/embeddings/week4-baseline-20260908-v1",
        "catalog-image-embeddings.v1.npy")
    map_path = os.path.join(
        args.repo_root, "artifacts/embeddings/week4-baseline-20260908-v1",
        "embedding-row-to-product.v1.jsonl")
    vectors = np.load(emb_path)
    rows = [json.loads(line) for line in open(map_path, encoding="utf-8")
            if line.strip()]
    cats: dict[str, list[int]] = {}
    for i, r in enumerate(rows):
        cats.setdefault(r.get("category", "?"), []).append(i)
    image_rows = []
    for cat in sorted(cats):
        image_rows.extend(cats[cat][:3])
    image_rows = image_rows[:9]

    probes = []
    for n, i in enumerate(image_rows):
        probes.append({"probe_id": f"IMAGE-{n + 1:02d}", "mode": "IMAGE",
                       "row": i, "vector": [float(v) for v in vectors[i].tolist()],
                       "k": 10, "exclude": None})

    qpath = os.path.join(args.repo_root,
                         "ai/evaluation/pilot_queries.dataset_a.v1.jsonl")
    texts = [json.loads(line) for line in open(qpath, encoding="utf-8")
             if line.strip()]
    texts = [q for q in texts if q.get("mode") == "TEXT"][:args.max_text]
    for n, q in enumerate(texts):
        probes.append({"probe_id": f"TEXT-{n + 1:02d}", "mode": "TEXT",
                       "query_id": q.get("query_id"),
                       "raw_text": q.get("raw_text"),
                       "vector": encode_text_vector(q["raw_text"]),
                       "k": 10, "exclude": None})

    for n in range(args.max_composed):
        i = image_rows[n % len(image_rows)]
        q = texts[n % len(texts)]
        img_vec = [float(v) for v in vectors[i].tolist()]
        probes.append({"probe_id": f"COMPOSED-{n + 1:02d}", "mode": "COMPOSED",
                       "row": i, "query_id": q.get("query_id"),
                       "vector": fuse_vectors(img_vec,
                                              encode_text_vector(q["raw_text"])),
                       "k": 10, "exclude": None})
    for n in range(4):
        base = dict(probes[n])
        base["probe_id"] = f"ANCHOR-{n + 1:02d}"
        base["exclude"] = rows[base["row"]]["product_id"]
        probes.append(base)

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump({"probes": probes}, fh)
    print(f"[*] {len(probes)} probe vectors -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
