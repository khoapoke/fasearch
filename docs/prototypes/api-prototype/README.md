# API prototype + Swagger — local runbook

Local-only prototype. No source edits needed to start/demo. All commands below
assume `ROOT=/private/tmp/fasearch-api-prototype-3h` (the isolated task checkout).

## Prerequisites

- Java 17, `./be/mvnw` (Maven wrapper), Docker Desktop (disposable PostgreSQL + object storage).
- Project Python **3.12** with pinned dependencies: `ROOT/.venv` is not checked in;
  this host provides `/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python`
  (3.12.14, `ai/requirements.lock`: fastapi 0.141.1, uvicorn 0.53.0, pillow 10.4.0,
  numpy 1.26.4, pyyaml 6.0.2, python-multipart 0.0.32, faiss-cpu 1.8.0.post1, pytest 8.3.3).
  Verify before use: `"$PY312" --version` and `"$PY312" -m pytest ai/tests/test_internal_api.py`.
- Ports free: Boot `18080`, AI `8001`, PostgreSQL `127.0.0.1:55432`, object storage `127.0.0.1:8334`.
- Env values below are local test-only examples — quote them, never commit real secrets.

## Start

All blocks run from `ROOT` (`cd /private/tmp/fasearch-api-prototype-3h`).

```bash
ROOT=/private/tmp/fasearch-api-prototype-3h; cd "$ROOT"
PY312="/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python"
DB_PW='proto-test-pw'; OBJ_KEY='proto-test-key'; OBJ_SECRET='proto-test-secret'
ADMIN_U='proto-admin'; ADMIN_E='proto-admin@example.test'; ADMIN_P='Proto-Admin-Test-Pass-123'

# 1. disposable backends (task-owned names/ports/volumes; do not touch shared stacks)
docker run -d --name fasearch-api-proto-pg -e POSTGRES_DB=fasearch \
  -e POSTGRES_USER=fasearch -e POSTGRES_PASSWORD="$DB_PW" \
  -p 127.0.0.1:55432:5432 -v fasearch-api-proto-pg-data:/var/lib/postgresql/data postgres:16-alpine
docker run -d --name fasearch-api-proto-s3 -e AWS_ACCESS_KEY_ID="$OBJ_KEY" \
  -e AWS_SECRET_ACCESS_KEY="$OBJ_SECRET" -e S3_BUCKET=fasearch-product-images \
  -p 127.0.0.1:8334:8333 chrislusf/seaweedfs:4.47

# 2. fixture retrieval index (real pipeline, deterministic FixtureEncoder; ~6 products)
PYTHONPATH="$ROOT/ai" "$PY312" "$ROOT/tools/api-prototype/build_fixture_index.py"
# prints MODEL_VERSION / INDEX_VERSION used below (repeatable: fixture-v1+4eaad46f9361)

# 3. AI service (PYTHONPATH pins the worktree ai/ package; absolute config path)
PYTHONPATH="$ROOT/ai" FASEARCH_ENCODER=fixture \
  FASEARCH_CONFIG_PATH="$ROOT/ai/configs/baseline.v1.yaml" \
  FASEARCH_INDEX_DIR=/private/tmp/fasearch-ai-fixture/index \
  FASEARCH_CATALOG_SNAPSHOT_ID=api-prototype-fixture-v1 \
  nohup "$PY312" -m uvicorn fasearch_ai.main:app --host 127.0.0.1 --port 8001 \
  > /private/tmp/fasearch-ai.log 2>&1 < /dev/null &
echo $! > /private/tmp/fasearch-ai-proto.pid
curl -s http://127.0.0.1:8001/internal/v1/health   # {"status":"UP",...}

# 4. Boot (from ROOT/be first: ./mvnw package -DskipTests)
export FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:55432/fasearch FASEARCH_DB_USER=fasearch
export FASEARCH_DB_PASSWORD="$DB_PW" FASEARCH_OBJECT_ENDPOINT=http://127.0.0.1:8334
export FASEARCH_OBJECT_ACCESS_KEY="$OBJ_KEY" FASEARCH_OBJECT_SECRET_KEY="$OBJ_SECRET"
export FASEARCH_AI_BASE_URL=http://127.0.0.1:8001 FASEARCH_CATALOG_FILE=/private/tmp/fasearch-ai-fixture/boot-catalog.jsonl
export FASEARCH_CATALOG_SNAPSHOT_ID=api-prototype-fixture-v1 FASEARCH_MODEL_VERSION=fixture-v1+4eaad46f9361 FASEARCH_INDEX_VERSION=api-prototype-index-v1
export FASEARCH_BOOTSTRAP_ADMIN_USERNAME="$ADMIN_U" FASEARCH_BOOTSTRAP_ADMIN_EMAIL="$ADMIN_E" FASEARCH_BOOTSTRAP_ADMIN_PASSWORD="$ADMIN_P"
export SERVER_PORT=18080
cd "$ROOT/be" || exit 1
nohup java -jar target/backend-0.0.1-SNAPSHOT.jar \
  > /private/tmp/fasearch-boot.log 2>&1 < /dev/null &
echo $! > /private/tmp/fasearch-boot-proto.pid
```

Actual URL: **http://127.0.0.1:18080/docs** (canonical spec: `/docs/openapi.json`).

## Test

```bash
cd "$ROOT/be" && ./mvnw test                        # backend suite (incl. docs/security/contract)
ADMIN_PASS="$ADMIN_P" BASE=http://127.0.0.1:18080 \
  bash "$ROOT/tools/api-prototype/verify_api_journeys.sh"   # 30 live journey checks
```

The journey script manages the AI process by exact PID
(`/private/tmp/fasearch-ai-proto.pid` + command-line ownership check) and
fails loudly if the PID file does not name this task's AI service — it never
broad-pattern kills processes that could belong to other worktrees.

## Swagger auth flow (browser)

1. Expand `GET /api/v1/auth/csrf` → Try it out → Execute → copy `token`.
2. Expand `POST /api/v1/auth/login` → Try it out → header `X-CSRF-TOKEN` = token,
   form `username`/`password` → Execute (200 sets `HttpOnly FASEARCH_SESSION`).
3. After login, re-run step 1 (session/CSRF refresh), then use the fresh token for writes.
4. Writes without session → 401/403; without `X-CSRF-TOKEN` → 403. Logout → old session 401.

## Stop (task-owned processes only)

```bash
# Exact-PID stop with ownership check; aborts if the PID is not this task's service.
AI_PID=$(tr -d '[:space:]' < /private/tmp/fasearch-ai-proto.pid)
ps -p "$AI_PID" -o args= | grep -q "uvicorn fasearch_ai.main:app.*--port 8001" \
  && kill "$AI_PID" || { echo "AI PID unknown — refusing to kill"; exit 1; }
BOOT_PID=$(tr -d '[:space:]' < /private/tmp/fasearch-boot-proto.pid)
ps -p "$BOOT_PID" -o args= | grep -q "backend-0.0.1-SNAPSHOT.jar" \
  && lsof -ti:18080 | grep -qx "$BOOT_PID" \
  && kill "$BOOT_PID" || { echo "Boot PID unknown or not listening on :18080 — refusing to kill"; exit 1; }
docker stop fasearch-api-proto-pg fasearch-api-proto-s3   # keep volumes for reruns; rm only task-owned data
```

## Limitations

- Fixture encoder/index prove plumbing, not Vietnamese retrieval quality; `artifact_scope: PILOT_ONLY`.
- `/docs` is disabled under the `prod` profile; webjars JS is static-only (no API data).
- AI runs on project Python 3.12 (`ai/pyproject.toml`, `ai/requirements.lock`); the earlier
  3.13 support venv (`/private/tmp/fasearch-ai-venv`) is retired.
