"""Real snapshot upload/restore into an absent isolated task collection."""
import hashlib
import json
import subprocess
import sys
import uuid

import os

import httpx
import numpy as np
from qdrant_client import QdrantClient

from lifecycle import ASSETS, ROOT, RUNTIME, guarded_container, save

sys.path.insert(0, str(ROOT / "ai"))
from src.core.config import load_shadow_config
from scripts.ingest_shadow import load_inputs, build_points, verify_ingested

SOURCE = os.environ.get("FASEARCH_RESTORE_SOURCE", "fasearch_shadow_week4_v1")
URL = "http://127.0.0.1:16333"


def inventory(client, name):
    points, cursor = client.scroll(name, limit=601, with_vectors=True, with_payload=True)
    assert cursor is None and len(points) == 600
    digest = hashlib.sha256()
    for point in sorted(points, key=lambda p: str(p.id)):
        digest.update(str(point.id).encode())
        digest.update(json.dumps(point.payload, sort_keys=True, separators=(",", ":")).encode())
        digest.update(np.asarray(point.vector, dtype="<f4").tobytes())
    return digest.hexdigest()


def main():
    guarded_container()
    cfg = load_shadow_config()
    vectors, rows, _ = load_inputs(str(ASSETS), cfg)
    points = build_points(vectors, rows, cfg)
    name = SOURCE + "_restore_" + uuid.uuid4().hex
    RUNTIME.mkdir(parents=True, exist_ok=True)
    client = QdrantClient(url=URL, timeout=30)
    created = False
    try:
        verify_ingested(client, cfg, points)
        assert not client.collection_exists(name), "Restore target must be absent"
        before = inventory(client, SOURCE)
        with httpx.Client(timeout=60) as http:
            response = http.post(URL + f"/collections/{SOURCE}/snapshots", params={"wait": "true"})
            response.raise_for_status()
            snapshot = response.json()["result"]
            snapshot_name = snapshot["name"]
            assert snapshot_name.startswith(SOURCE + "-") and "/" not in snapshot_name
            data = http.get(URL + f"/collections/{SOURCE}/snapshots/{snapshot_name}")
            data.raise_for_status()
            sha = hashlib.sha256(data.content).hexdigest()
            assert not snapshot.get("checksum") or snapshot["checksum"] == sha
            snapshot_path = RUNTIME / snapshot_name
            snapshot_path.write_bytes(data.content)
            save("restore-journal.json", {"source": SOURCE, "target": name,
                "snapshot": snapshot_name, "sha256": sha, "stage": "uploading"})
            # This is recovery from snapshot bytes; no create, seed or ingest call.
            response = http.post(URL + f"/collections/{name}/snapshots/upload",
                params={"priority": "snapshot", "wait": "true"},
                files={"snapshot": (snapshot_name, data.content, "application/octet-stream")})
            response.raise_for_status()
            created = True
        restored_cfg = dict(cfg, qdrant=dict(cfg["qdrant"], collection_name=name))
        assert verify_ingested(client, restored_cfg, points) == 600
        after = inventory(client, name)
        assert before == after == inventory(client, SOURCE)
        probes_path = RUNTIME / "probes.json"
        probes = json.loads(probes_path.read_text())["probes"]
        from parity_check import compare_probe, qdrant_search
        query_results = []
        for probe in probes:
            source, _ = qdrant_search(client, SOURCE, probe["vector"], probe["k"], probe["exclude"])
            restored, _ = qdrant_search(client, name, probe["vector"], probe["k"], probe["exclude"])
            sx, _ = qdrant_search(client, SOURCE, probe["vector"], probe["k"], probe["exclude"], fetch_extra=5)
            rx, _ = qdrant_search(client, name, probe["vector"], probe["k"], probe["exclude"], fetch_extra=5)
            fails, ties, verdict = compare_probe(probe, source, restored, extended=(sx, rx))
            query_results.append({"probe_id": probe["probe_id"], "verdict": verdict, "ties": ties})
            assert not fails, (probe["probe_id"], fails)
        report = RUNTIME / "parity-restored.json"
        subprocess.run([sys.executable, str(ROOT / "tools/ai-draft-hardening/parity_check.py"),
            "--repo-root", str(ASSETS), "--probes", str(probes_path),
            "--collection", name, "--out", str(report)], check=True)
        save("restore-result.json", {"pass": True, "source": SOURCE, "target": name,
            "snapshot_sha256": sha, "snapshot_bytes": len(data.content),
            "points": 600, "inventory_sha256": after, "query_parity": len(probes),
            "queries": query_results,
            "faiss_parity_report": str(report), "method": "snapshot upload, priority=snapshot; no re-ingest"})
        print("RESTORE PASS: snapshot bytes -> new collection; 600 exact IDs/payloads/vectors;",
              len(probes), "queries + FAISS parity")
    finally:
        # Never delete source; only this invocation's recorded unique restore target.
        if created:
            guarded_container()
            journal = json.loads((RUNTIME / "restore-journal.json").read_text())
            assert journal["target"] == name and name.startswith(SOURCE + "_restore_")
            client.delete_collection(name)
            assert client.count(SOURCE, exact=True).count == 600
            print("RESTORE CLEANUP PASS:", name, "; source retained")
        client.close()


if __name__ == "__main__":
    main()
