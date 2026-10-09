# RUNBOOK — Qdrant website candidate (residual-fix revision, 08/10/2026)

Worktree `W=/tmp/fasearch-ai-qdrant-web` (`/private/tmp/fasearch-ai-qdrant-web`),
branch `codex/ai-qdrant-web-integration`. Canonical repo root below is
`REPO=/Users/khoado/Documents/ChatGPT/Graduate Bachelor`.
Quote every path (both roots contain spaces). No credential literal appears in
this file; key names and owner-only file paths only.

## 1. Environment (task-private, pinned, lock-reproducible)

- Standalone Python: `/tmp/fasearch-py312/python/bin/python3` (3.12.15,
  task-private download, no global install).
- Create the venv and install direct requirements, then verify:
```bash
/tmp/fasearch-py312/python/bin/python3 -m venv /tmp/fasearch-web-venv312
/tmp/fasearch-web-venv312/bin/pip install -r "$W/ai/requirements-cpu.txt"
/tmp/fasearch-web-venv312/bin/pip check   # expect: No broken requirements found
/tmp/fasearch-web-venv312/bin/python --version  # 3.12.15
```
- Direct pins (`ai/requirements-cpu.txt`): torch 2.4.1, transformers 4.44.2,
  faiss-cpu 1.8.0.post1, qdrant-client 1.12.2, fastapi 0.141.1, starlette 1.6.0,
  python-multipart 0.0.32, uvicorn 0.34.0, jsonschema 4.26.0, ImageHash 4.3.1,
  scipy 1.17.1, pytest 8.3.4 (+ PyYAML/pillow/numpy/grpcio/httpx).
- Lock (`ai/requirements-cpu.lock`) is the exact `pip freeze` of that install
  (59 lines, setuptools/pip excluded). Reproduce it into a clean env:
```bash
/tmp/fasearch-py312/python/bin/python3 -m venv /tmp/verify-lock-venv
/tmp/verify-lock-venv/bin/pip install -r "$W/ai/requirements-cpu.txt"
/tmp/verify-lock-venv/bin/pip freeze | grep -v "^pip==\|^setuptools==" | sort \
  | diff - <(sort "$W/ai/requirements-cpu.lock")  # expect: no output
```
- Model cache (read-only, offline): `HF_HOME=/Users/khoado/.cache/huggingface`,
  `HF_HUB_OFFLINE=1`. No downloads. Frozen inputs read-only under `$REPO`.
- Java 17 (host). Node via worktree `fe/node_modules` (`cp -a` preserves symlinks).
- faiss/torch native-boundary rule: files importing faiss (`test_encoder_index_search`,
  `test_internal_api` via ml.retrieval) must run in a separate pytest process
  from torch-model tests (`test_lifecycle`, `*_hf`); combined runs segfault.
- Secrets (owner-only, chmod 600, outside Git, never logged):
  `/tmp/dbpass.txt` (shared-DB role password handle) and
  `/tmp/webcand-admin.pass` (rotated task-owned bootstrap credential).
  Launchers read them with `$(cat <file>)`; no literal anywhere.

## 2. Shared runtime (observe-only, never recreate/reset)

```bash
"$REPO/infra/fasearch/manage.sh" --profile shadow up -d qdrant  # fasearch-qdrant 1.12.4, 127.0.0.1:16333/16334
```
- Postgres 127.0.0.1:55732 (DB `fasearch_web_candidate`, created once);
  storage 127.0.0.1:38535.
- Guard before any signal: `lsof -nP -iTCP:<port>` + `ps -o pid,command -p <pid>`
  (fresh PID/cmd/cwd); signal only candidate-owned PIDs; never blanket kills.

## 3. Candidate start order (all loopback)

```bash
W=/tmp/fasearch-ai-qdrant-web
REPO="/Users/khoado/Documents/ChatGPT/Graduate Bachelor"
# AI 18042 (Python 3.12 task venv, web config)
cd "$W" && FASEARCH_SHADOW_CONFIG="$W/ai/configs/web.v1.yaml" \
  FASEARCH_REPO_ROOT="$REPO" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" \
  nohup /tmp/fasearch-web-venv312/bin/python -m uvicorn src.main:app \
  --host 127.0.0.1 --port 18042 > /tmp/ai-18042-final.log 2>&1 &
curl -s http://127.0.0.1:18042/internal/v1/health  # {"status":"UP",...}
curl -s http://127.0.0.1:18042/ready               # ready:true, 600/DOT/vectors:frozen-exact

# BE 18680 (loopback; Qdrant triple; secrets from owner-only files)
DBPASS=$(cat /tmp/dbpass.txt); BOOTPASS=$(cat /tmp/webcand-admin.pass)
export SERVER_PORT=18680 FASEARCH_DB_URL="jdbc:postgresql://127.0.0.1:55732/fasearch_web_candidate" \
  FASEARCH_DB_USER=fasearch FASEARCH_DB_PASSWORD="$DBPASS" \
  FASEARCH_CATALOG_FILE="$REPO/data/processed/catalog-20260908-pilot-v1/catalog.cleaned.v1.jsonl" \
  FASEARCH_CATALOG_SNAPSHOT_ID=catalog-20260908-pilot-v1 \
  FASEARCH_MODEL_VERSION="openai/clip-vit-base-patch32@092a3b7e3172+a6a0317b924b" \
  FASEARCH_INDEX_VERSION="qdrant-dot-exact-web-v1" \
  FASEARCH_AI_BASE_URL="http://127.0.0.1:18042" \
  FASEARCH_OBJECT_ENDPOINT="http://127.0.0.1:38535" \
  FASEARCH_BOOTSTRAP_ADMIN_USERNAME="webcand-admin" \
  FASEARCH_BOOTSTRAP_ADMIN_EMAIL="webcand-admin@example.test" \
  FASEARCH_BOOTSTRAP_ADMIN_PASSWORD="$BOOTPASS"
cd "$W/be" && nohup java -jar target/backend-0.0.1-SNAPSHOT.jar \
  --server.address=127.0.0.1 > /tmp/task-be-18680-final.log 2>&1 &
lsof -nP -iTCP:18680 -sTCP:LISTEN  # must show 127.0.0.1:18680
# NOTE: bootstrap env is seed-only; the persisted JDBC account was rotated via
# POST /api/v1/auth/password (see EVIDENCE/residual-fix/rotation-receipt.txt).
# Editing env alone never rotates the stored account.

# FE 3270 (loopback; run `next build` first after any FE source change)
cd "$W/fe" && FASEARCH_BACKEND_URL=http://127.0.0.1:18680 \
  ./node_modules/.bin/next start -H 127.0.0.1 -p 3270 > /tmp/task-fe-3270-loopback.log 2>&1 &
```

## 4. Coherent FAISS rollback → Qdrant restoration

Rollback swaps BOTH Boot triple and AI backend (never one side alone):

```bash
# 4a. FAISS AI (canonical .venv, research baseline, unchanged code; quoted path)
cd "$W/ai" && TRANSFORMERS_OFFLINE=1 HF_HUB_OFFLINE=1 TOKENIZERS_PARALLELISM=false \
  HF_HOME=/Users/khoado/.cache/huggingface FASEARCH_CATALOG_SNAPSHOT_ID=catalog-20260908-pilot-v1 \
  FASEARCH_ENCODER=hf_clip FASEARCH_INDEX_DIR="$REPO/artifacts/indexes/week4-baseline-20260908-v1" \
  FASEARCH_CONFIG_PATH="$REPO/ai/configs/baseline.v1.yaml" \
  nohup "$REPO/.venv/bin/python" -m uvicorn fasearch_ai.main:app \
  --host 127.0.0.1 --port 18043 > /tmp/task-ai-18043-rem.log 2>&1 &
# 4b. Restart BE with FASEARCH_INDEX_VERSION=faiss-flatip-week4-v1 +
#     FASEARCH_AI_BASE_URL=http://127.0.0.1:18043 (same guarded restart as §3).
# 4c. Prove 3 modes (TEXT/IMAGE/COMPOSED+anchor) → identical ranks expected.
# 4d. Stop 18043 after the drill; restart BE with the §3 Qdrant triple;
#     reprove Qdrant 3 modes. Never auto-fallback: AI-down must yield Boot 503.
```

## 5. Genuine snapshot restore (not re-ingest)

Create owned prerequisites first (works in a genuinely clean disposable
export with no ignored `.runtime/` preexisting; `encode_probes.py` also
creates `--out` parents itself), then prepare fresh probes (torch process,
offline cache), then drill:

```bash
mkdir -p "$W/tools/ai-draft-hardening/.runtime"
cd "$W" && FASEARCH_SHADOW_CONFIG="$W/ai/configs/web.v1.yaml" \
  FASEARCH_REPO_ROOT="$REPO" HF_HOME=/Users/khoado/.cache/huggingface HF_HUB_OFFLINE=1 \
  PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python \
  tools/ai-draft-hardening/encode_probes.py --repo-root "$REPO" \
  --out "$W/tools/ai-draft-hardening/.runtime/probes.json"
cd "$W/tools/ai-draft-hardening" && FASEARCH_REPO_ROOT="$REPO" \
  /tmp/fasearch-web-venv312/bin/python lifecycle.py adopt-qdrant
cd "$W/tools/ai-draft-hardening" && FASEARCH_SHADOW_CONFIG="$W/ai/configs/web.v1.yaml" \
  FASEARCH_RESTORE_SOURCE=fasearch_web_week4_v1 FASEARCH_REPO_ROOT="$REPO" \
  HF_HOME=/Users/khoado/.cache/huggingface HF_HUB_OFFLINE=1 \
  PYTHONPATH="$W/ai:$W/tools/ai-draft-hardening" \
  /tmp/fasearch-web-venv312/bin/python restore_drill.py
# Verifies 600 ID/payload/vector equality + 29-query parity, deletes ONLY the
# owned fasearch_web_week4_v1_restore_* target.
```

## 6. Checks (exact commands; cwd/exit recorded in EVIDENCE/residual-fix/)

```bash
# Process 1: candidate selection WITHOUT native-faiss boundary files.
cd "$W/ai" && FASEARCH_TASK_REPO_ROOT="$W" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python -m pytest \
  tests/test_canonical_contract.py tests/test_vector_readiness.py tests/test_web_candidate.py \
  tests/test_config_paths.py tests/test_shadow_ids.py tests/test_publication_guards.py \
  tests/test_parity_comparator.py tests/test_lifecycle.py tests/test_upload_bounds.py \
  tests/test_supervisor_boundaries.py tests/test_recovery.py
# Process 2: test_internal_api (faiss via ml.retrieval) in its OWN process.
cd "$W/ai" && FASEARCH_TASK_REPO_ROOT="$W" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python -m pytest \
  tests/test_internal_api.py
# Process 3: test_encoder_index_search (faiss) in its OWN process.
cd "$W/ai" && FASEARCH_TASK_REPO_ROOT="$W" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python -m pytest \
  tests/test_encoder_index_search.py
# Process 4: faiss-importing research files together (no torch here).
cd "$W/ai" && FASEARCH_TASK_REPO_ROOT="$W" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python -m pytest \
  tests/test_catalog_pipeline.py tests/test_internal_composed.py tests/test_metrics.py
# Process 5: schemas + light research + torch HF files (no faiss here).
cd "$W/ai" && FASEARCH_TASK_REPO_ROOT="$W" HF_HOME=/Users/khoado/.cache/huggingface \
  HF_HUB_OFFLINE=1 PYTHONPATH="$W/ai" /tmp/fasearch-web-venv312/bin/python -m pytest \
  tests/test_schemas.py tests/test_internal_text.py tests/test_pilot_queries.py \
  tests/test_composed_token_budget_hf.py tests/test_text_token_budget_hf.py
# Verified 09/10/2026: 84 + 9 + 4 + 18 + 15 = 130, all green. Combining
# processes 4+5 (faiss + torch in one process) aborts; the split above is
# required, not advisory. Research core/HF never join process 1.
cd "$W/fe" && npm run lint && ./node_modules/.bin/tsc --noEmit && node --test tests/*.test.mjs
cd "$W/be" && ./mvnw -q '-Dtest=*Search*Tests,*ContractTests,HistoryCsrfAuthorizerTests' test
cd "$W/be" && ./mvnw -q '-Dtest=LibraryHistoryIntegrationTests,LibrarySavedProductsIntegrationTests,SessionSecurityIntegrationTests,AccountPasswordIntegrationTests' test
```

## 7. Manual URLs

- http://127.0.0.1:3270, /search/text, /search/composed (+`?anchor_product_id=…`),
  /catalog/10011?v=dataset-a-10011-v1&s=catalog-20260908-pilot-v1
- http://127.0.0.1:18042/internal/v1/health, /ready
