"""HTTP validation, real model parity and upstream restart evidence."""
import concurrent.futures
import json
import socket
import subprocess
import sys
import time

import httpx
from lifecycle import ROOT, ASSETS, RUNTIME, guarded_container

URL = "http://127.0.0.1:18041"
REFERENCE = "http://127.0.0.1:18021"
PUB = {"catalog_snapshot_id": "catalog-20260908-pilot-v1",
       "model_version": "openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b",
       "index_version": "qdrant-dot-exact-shadow-v1"}


def require(response, status, code=None):
    assert response.status_code == status, (status, response.status_code, response.text[:300])
    if code: assert response.json()["code"] == code
    if str(response.url).startswith(URL) and "/search/" in str(response.url):
        assert response.headers["cache-control"] == "no-store"
    return response.json() if response.content else None


def compare(a, b):
    assert a["mode"] == b["mode"]
    assert a["publication"] == dict(b["publication"], index_version=PUB["index_version"])
    assert len(a["results"]) == len(b["results"])
    # Live selected probes are checked with the same published score/tie rule.
    from parity_check import compare_probe
    def mapped(body):
        return [dict(product_id=r["product_id"], product_version_id=r["product_version_id"],
                     score=r["similarity_score"]) for r in body["results"]]
    fails, ties, verdict = compare_probe({}, mapped(b), mapped(a))
    assert not fails, fails
    return verdict


def chunked_probe(path, content_type, cap):
    with socket.create_connection(("127.0.0.1", 18041), timeout=5) as sock:
        sock.sendall((f"POST {path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: {content_type}\r\n"
                      "Transfer-Encoding: chunked\r\nConnection: close\r\n\r\n").encode())
        # Exceed cap with streamed chunks; do not send the final chunk.
        try:
            for _ in range(cap // 8192 + 1):
                sock.sendall(b"2000\r\n" + b"x" * 8192 + b"\r\n")
        except (BrokenPipeError, ConnectionResetError):
            pass
        data = b""
        while True:
            chunk = sock.recv(65536)
            if not chunk: break
            data += chunk
        assert b" 413 " in data.split(b"\r\n", 1)[0], data[:200]
        assert b"cache-control: no-store" in data.lower()


def main():
    results = []
    def passed(name):
        results.append(name); print("PASS:", name, flush=True)
    with httpx.Client(timeout=60) as client:
        assert require(client.get(URL+"/ready"), 200)["qdrant"]["points"] == 600
        passed("ready: real frozen600")
        text = dict(PUB, schema_version="1.0.0", trace_id="supervisor-live", query_text="  red   shirt  ", k=10)
        a = require(client.post(URL+"/internal/v1/search/text", json=text), 200)
        b = require(client.post(REFERENCE+"/internal/v1/search/text", json=dict(text, index_version="faiss-flatip-week4-v1")), 200)
        compare(a, b); passed("HTTP TEXT real cached CLIP vs canonical FAISS + NFC/whitespace")
        image = (ASSETS / "data/raw/dataset_a/images/10011.jpg").read_bytes()
        fields = dict(PUB, trace_id="supervisor-image", k="10")
        a = require(client.post(URL+"/internal/v1/search/image", data=fields, files={"image": ("a.jpg", image, "image/jpeg")}), 200)
        b = require(client.post(REFERENCE+"/internal/v1/search/image", data=dict(fields, index_version="faiss-flatip-week4-v1"), files={"image": ("a.jpg", image, "image/jpeg")}), 200)
        compare(a, b); passed("HTTP IMAGE actual photo query vs canonical FAISS")
        fields.update(schema_version="1.0.0", trace_id="supervisor-composed", modification_text="red shirt", fusion_version="equal-weight-l2-v1", exclude_product_id="10011")
        a = require(client.post(URL+"/internal/v1/search/composed", data=fields, files={"image": ("a.jpg", image, "image/jpeg")}), 200)
        b = require(client.post(REFERENCE+"/internal/v1/search/composed", data=dict(fields, index_version="faiss-flatip-week4-v1"), files={"image": ("a.jpg", image, "image/jpeg")}), 200)
        compare(a, b)
        assert a["provenance"] == b["provenance"]
        assert all(r["product_id"] != "10011" for r in a["results"])
        passed("HTTP COMPOSED actual photo/text + anchor exclusion + exact provenance")
        assert a.keys() == b.keys()
        assert a["publication"]["index_version"].startswith("qdrant-")
        passed("canonical response fields; honest shadow publication")
        for k in [None, True, 1.5, 0, 101, "10", 999999999999999999999]:
            require(client.post(URL+"/internal/v1/search/text", json=dict(text, k=k)), 422, "INVALID_REQUEST")
        passed("K null/bool/float/string/zero/overflow rejected")
        for query, status, code in [("\ud800",400,"INVALID_REQUEST"), ("x"*1025,400,"TEXT_TOO_LONG"),
                                   ("word "*180,400,"TEXT_TOO_LONG"), ("   ",422,"INVALID_REQUEST")]:
            require(client.post(URL+"/internal/v1/search/text", content=json.dumps(dict(text, query_text=query)).encode(), headers={"content-type":"application/json"}), status, code)
        passed("Unicode/raw cap/loaded token overflow/empty")
        require(client.post(URL+"/internal/v1/search/text", json=dict(text, unknown="private-query")),422,"INVALID_REQUEST")
        require(client.post(URL+"/internal/v1/search/text", json=text, headers={"X-Trace-Id":"mismatch"}),422,"INVALID_REQUEST")
        require(client.post(URL+"/internal/v1/search/text", content=b'{"query_text":"secret","query_text":"secret2"}', headers={"content-type":"application/json"}),422,"INVALID_REQUEST")
        passed("unknown/trace mismatch/duplicate JSON")
        require(client.post(URL+"/internal/v1/search/text", json=dict(text, index_version="stale")),409,"STALE_PUBLICATION")
        require(client.post(URL+"/internal/v1/search/composed", data=dict(fields, fusion_version="stale"), files={"image":("a.jpg",image,"image/jpeg")}),409,"FUSION_VERSION_MISMATCH")
        require(client.post(URL+"/internal/v1/search/composed", data=dict(fields, exclude_product_id="unknown"), files={"image":("a.jpg",image,"image/jpeg")}),422,"INVALID_REQUEST")
        passed("publication/fusion/unknown anchor fail closed")
        bad = require(client.post(URL+"/api/search/text", json={"query":"PRIVATE-INPUT", "limit": None}),422,"INVALID_REQUEST")
        assert "PRIVATE-INPUT" not in json.dumps(bad)
        require(client.post(URL+"/api/search/image", files={"file":("same.jpg", image,"image/png")}),422,"INVALID_REQUEST")
        passed("validation privacy + decoded MIME agreement")
        for path in ("/api/search/image", "/internal/v1/search/image", "/internal/v1/search/composed"):
            for content_type in ("multipart/form-data", "multipart/form-data; boundary=a"):
                require(client.post(URL+path, content=b"invalid-private-body",
                                    headers={"content-type":content_type}),422,"INVALID_REQUEST")
        passed("malformed multipart: legacy/internal sanitized422")
        chunked_probe("/api/search/text", "application/json", 16384)
        chunked_probe("/internal/v1/search/text", "application/json", 16384)
        chunked_probe("/internal/v1/search/image", "multipart/form-data; boundary=a", 11*1024*1024)
        passed("wire chunked caps before final chunk: legacy+internal JSON/multipart")
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            future = pool.submit(client.post, URL+"/internal/v1/search/text", json=text)
            t0 = time.monotonic(); require(client.get(URL+"/health"),200)
            assert time.monotonic()-t0 < 2
            require(future.result(),200)
        passed("health responsive during native inference")
        # Only the recorded exact task container is stopped; always restart in finally.
        guarded_container()
        lifecycle = [sys.executable, str(ROOT/"tools/ai-draft-hardening/lifecycle.py")]
        subprocess.run(lifecycle+["qdrant-stop"], check=True)
        try:
            require(client.get(URL+"/ready"),503)
            require(client.post(URL+"/internal/v1/search/text",json=text),503,"INDEX_UNAVAILABLE")
            require(client.get(URL+"/health"),200)
            passed("live Qdrant down -> readiness/search503, health200")
        finally:
            subprocess.run(lifecycle+["qdrant-start"],check=True)
        for _ in range(30):
            response=client.get(URL+"/ready")
            if response.status_code==200: break
            time.sleep(.5)
        require(response,200)
        require(client.post(URL+"/internal/v1/search/text",json=text),200)
        passed("Qdrant restart -> automatic readiness/search recovery without API restart")
    (RUNTIME/"live-result.json").write_text(json.dumps({"passed":results,"n_pass":len(results)},indent=2))
    print("RESULT:", len(results), "pass; no failures")


if __name__ == "__main__":
    main()
