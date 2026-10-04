# INPUT_AUDIT — real-pilot-integrated-demo revision 1

- Base: `codex/core-search-integration-2h @ 7b909a0257e6cc95db5a83e2dd5e7b61d84825ef`
- Worktree: `/private/tmp/fasearch-real-pilot-integrated-demo`, branch `codex/real-pilot-integrated-demo`
- Asset root: `/Users/khoado/Documents/ChatGPT/Graduate Bachelor`
- Catalog: `data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl`, sha `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44`, 600 rows/600 unique, 600 images present
- Embeddings: `artifacts/embeddings/week4-baseline-20260908-v1`, 600x512, L2 norms ~1.0
- Index: `artifacts/indexes/week4-baseline-20260908-v1`, `faiss-flatip-week4-v1`, mapping sha `4ef3bb9ceb69955f02a1ca3347f000194e1d5fe027115e24ca38cb3f61decf6b`
- Config: `ai/configs/baseline.v1.yaml`, sha `47c89a1911e2bcfd2def03778cdbefd8447b63eff2e419eb43ea190a424127f8`
- Model: `openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b`, revision `092a3b7e31726acc3a0207eea00f6040ac8b03a7`, config hash `a6a0317b924b6bece0b9cc8887d0ee53c1bf4ac51c00797f7514dce3e0bfeac8`
- Weights: repo `.cache/huggingface`, `pytorch_model.bin` 605247071 bytes (symlink resolved via `stat -L`)
- Python: root `.venv/bin/python` 3.12.14, `HF_HOME=<root>/.cache/huggingface`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`
- Runtime import origin: worktree `ai/` via `PYTHONPATH`, no artifact rebuild, read-only assets
- Ports: FE 3220 / Boot 18280 / AI 18021 / PG 55632 / S3 38435; preview `localhost`, internal `127.0.0.1`; old stacks untouched
- Execution: start 17:25 +07 04/10/2026, deadline 19:25, implement until ~19:05, reviewer final 20 phút
