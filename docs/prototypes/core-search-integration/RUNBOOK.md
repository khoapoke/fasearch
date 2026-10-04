# RUNBOOK — task-owned stack (executable, guarded)

Task root: `/private/tmp/fasearch-core-search-integration-2h` (branch `codex/core-search-integration-2h`).
Ports: FE 3210, Boot 18180, AI 18011, PG 55532, S3 38335. Never touch 18080/8001 or other tasks' containers.
PID files: `/private/tmp/fasearch-core-search-2h-{ai,boot,fe}.pid` (written by the lifecycle script only).
Logs: `/private/tmp/fasearch-core-search-2h-{ai,boot,fe}.log`.
Task AI interpreter (required): `/Users/khoado/Documents/ChatGPT/Graduate Bachelor/.venv/bin/python` (3.12.14, pinned deps incl. jsonschema/transformers). Verify with `"$VENV" -c "import fastapi,jsonschema,transformers"` and import-origin check `PYTHONPATH=<root>/ai $VENV -c "import fasearch_ai.main"`. Never use the old 3.13 `/private/tmp/fasearch-ai-venv`.

## Env (disposable test secrets only; sanitized from logs)

PG: `POSTGRES_PASSWORD=task-test-pw`. S3: `task-test-key`/`task-test-secret`, bucket `fasearch-product-images`.
Boot: `FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:55532/fasearch`, `FASEARCH_DB_USER=fasearch`, `FASEARCH_DB_PASSWORD=task-test-pw`, `FASEARCH_OBJECT_ENDPOINT=http://127.0.0.1:38335` (+keys above), `FASEARCH_AI_BASE_URL=http://127.0.0.1:18011`, `SERVER_PORT=18180`, `FASEARCH_CATALOG_SNAPSHOT_ID=core-search-task-fixture-v1`, `FASEARCH_MODEL_VERSION=fixture-v1+4eaad46f9361`, `FASEARCH_INDEX_VERSION=api-prototype-index-v1`, `FASEARCH_CATALOG_FILE=/private/tmp/fasearch-ai-fixture/boot-catalog.jsonl` (read-only fixture), bootstrap admin `task-admin`/`task-admin@example.test`/`Task-Admin-Test-Pass-123` (env `TASK_ADMIN_PASS`), `FASEARCH_COOKIE_SECURE=false`.
AI: `FASEARCH_CONFIG_PATH=/private/tmp/fasearch-api-prototype-3h/ai/configs/baseline.v1.yaml`, `FASEARCH_INDEX_DIR=/private/tmp/fasearch-ai-fixture/index` (read-only), `FASEARCH_ENCODER=fixture`, `FASEARCH_CATALOG_SNAPSHOT_ID` as above, `PYTHONPATH=<root>/ai`.
FE: `FASEARCH_BACKEND_URL=http://127.0.0.1:18180`, `PORT=3210`.

## Lifecycle (single executable; guards refuse unknown owners)

All process control goes through `tools/core-search-integration/lifecycle.sh`:

```
tools/core-search-integration/lifecycle.sh start   # expects free ports, starts PG/S3 → AI → Boot → FE, writes PID files, polls health
tools/core-search-integration/lifecycle.sh health  # AI /internal/v1/health, Boot /actuator/health, FE GET / (200)
tools/core-search-integration/lifecycle.sh stop    # verifies PID cmdline + listener port per service, kills FE wrapper → Boot → AI, stops task containers
```

Stop guards: PID file must name a live process whose command line matches this task's service (`npm run start --port 3210`, `backend-0.0.1-SNAPSHOT.jar`, `uvicorn fasearch_ai.main:app.*--port 18011`) AND whose TCP listener is the task port (FE child resolved via parent PID). Anything else → loud `REFUSE`, no kill. No broad pkill/pgrep-first-match anywhere.

First-time build: `cd be && ./mvnw -q package -DskipTests`; `cd fe && npm ci && npm run build`.
Restart proof (this task only): `lifecycle.sh stop` → ports free → `lifecycle.sh start` → `lifecycle.sh health`. See IMPLEMENTATION_HANDOFF for the last proven restart.

Preview: http://127.0.0.1:3210/ (combined app). No secrets/raw assets in Git; fixture/model/index read-only, never committed.
