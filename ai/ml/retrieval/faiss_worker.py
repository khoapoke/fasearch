from __future__ import annotations

import json
import sys
from pathlib import Path

import faiss
import numpy as np


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("usage: faiss_worker INDEX_DIR K")
    artifact_dir = Path(sys.argv[1])
    k = int(sys.argv[2])
    query = np.asarray(json.load(sys.stdin), dtype=np.float32)[None, :]
    index = faiss.read_index(str(artifact_dir / "index.faiss"))
    scores, rows = index.search(np.ascontiguousarray(query), min(k, index.ntotal))
    print(json.dumps([
        {"row": int(row), "score": float(score)}
        for row, score in zip(rows[0], scores[0]) if row >= 0
    ]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
