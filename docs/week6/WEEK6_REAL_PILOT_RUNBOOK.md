# Real CLIP pilot: local website, backend, AI and database runbook

## Scope

This runs the pinned 600-product Dataset A pilot through Next.js, Spring Boot, FastAPI, PyTorch and FAISS. The query uses a catalog image to validate product/index mapping. It is a technical integration check, not an independent retrieval-quality evaluation. Its latency is one local sample, not website p50/p95.

The commands below assume the historical Week 4 raw/processed/index artifacts are present in the repository root. They are Git-ignored local files. Teammates without them must generate their own compatible snapshot under `ai/` and point the environment variables to its exact paths and manifest versions.

## Verify the publication first

From the repository root:

```bash
repo_root="$(pwd)"
cd "$repo_root/ai"
../.venv/bin/python scripts/verify_week4_artifacts.py \
  --catalog "$repo_root/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" \
  --embeddings-dir "$repo_root/artifacts/embeddings/week4-baseline-20260908-v1" \
  --index-dir "$repo_root/artifacts/indexes/week4-baseline-20260908-v1"
```

Expected: 600 rows, dimension 512, catalog SHA-256 `82b21a099c92dbf42eca43475e6cea5459da3c3ff27fc528589ad85517f9da44`, model version `openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b`, index version `faiss-flatip-week4-v1`.

## Start the database and three applications

From the repository root, export a locally chosen `FASEARCH_DB_PASSWORD`, then start PostgreSQL:

```bash
docker compose -f be/compose.yaml up -d
```

On the first database startup, also set `FASEARCH_BOOTSTRAP_ADMIN_USERNAME`, `FASEARCH_BOOTSTRAP_ADMIN_EMAIL` and `FASEARCH_BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters) in the backend terminal. Do not put these credentials in Git. Later backend starts need only the database credentials while an active Super Administrator exists. The local database container uses port 5432 unless `FASEARCH_DB_PORT` is set; match `FASEARCH_DB_URL` to that port.

Terminal 1, AI:

```bash
repo_root="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
cd "$repo_root/ai"
HF_HOME="$repo_root/.cache/huggingface" \
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
FASEARCH_ENCODER=hf_clip \
FASEARCH_INDEX_DIR="$repo_root/artifacts/indexes/week4-baseline-20260908-v1" \
FASEARCH_CATALOG_SNAPSHOT_ID=catalog-20260908-pilot-v1 \
../.venv/bin/uvicorn fasearch_ai.main:app --host 127.0.0.1 --port 8001
```

Terminal 2, Spring Boot:

```bash
repo_root="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
cd "$repo_root/be"
FASEARCH_AI_BASE_URL=http://127.0.0.1:8001 \
FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:5432/fasearch \
FASEARCH_DB_USER=fasearch \
FASEARCH_CATALOG_SNAPSHOT_ID=catalog-20260908-pilot-v1 \
FASEARCH_MODEL_VERSION='openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b' \
FASEARCH_INDEX_VERSION=faiss-flatip-week4-v1 \
FASEARCH_CATALOG_FILE="$repo_root/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" \
./mvnw -q spring-boot:run
```

The backend reads `FASEARCH_DB_PASSWORD` and first-run admin values from the exported environment. The local catalog JSONL adapter is still used for frozen pilot search; product Draft writes use PostgreSQL.

Terminal 3, website:

```bash
repo_root="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
cd "$repo_root/fe"
FASEARCH_BACKEND_URL=http://127.0.0.1:8080 npm run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000` to inspect the UI. Then run the machine-readable check from the repository root:

```bash
./scripts/verify_real_pilot_e2e.sh
```

The check requires `curl`, `jq` and `shasum`. It verifies Top-5 rank/order, exact publication versions, trace ID, product ID/version and the image bytes served through the same-origin website URL. Stop the terminals with Ctrl+C when finished.

## Local troubleshooting

On macOS, a restricted sandbox may deny OpenMP shared memory when the parent Python process imports PyTorch and the FAISS child starts. The minimal symptom is `OMP: Error #179: Can't open SHM` with child exit `-6`. The same command passed outside the sandbox on 23/09/2026. Use an authorized normal terminal for this local integration check; do not set `KMP_DUPLICATE_LIB_OK`.
