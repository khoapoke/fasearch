# RUNBOOK — task-owned stack (ports/PIDs/namespaced)

Task root: /private/tmp/fasearch-core-search-integration-2h (branch codex/core-search-integration-2h).
Ports: FE 3210, Boot 18180, AI 18011, PG 55532, S3 38335. Never touch 18080/8001 or other tasks' containers.
PIDs: /private/tmp/fasearch-core-search-2h-ai.pid, -boot.pid, -fe.pid. Logs: /private/tmp/fasearch-core-search-2h-{ai,boot,fe}.log.

## Env (disposable test secrets only)

PG: POSTGRES_PASSWORD=task-test-pw. S3: task-test-key/task-test-secret, bucket fasearch-product-images.
Boot: FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:55532/fasearch, FASEARCH_DB_USER=fasearch, FASEARCH_DB_PASSWORD=task-test-pw, FASEARCH_OBJECT_ENDPOINT=http://127.0.0.1:38335 (+keys above), FASEARCH_AI_BASE_URL=http://127.0.0.1:18011, SERVER_PORT=18180, FASEARCH_CATALOG_SNAPSHOT_ID=core-search-task-fixture-v1, FASEARCH_MODEL_VERSION=fixture-v1+4eaad46f9361, FASEARCH_INDEX_VERSION=api-prototype-index-v1, FASEARCH_CATALOG_FILE=/private/tmp/fasearch-ai-fixture/boot-catalog.jsonl (read-only fixture), FASEARCH_BOOTSTRAP_ADMIN_USERNAME=task-admin, _EMAIL=task-admin@example.test, _PASSWORD=Task-Admin-Test-Pass-123, FASEARCH_COOKIE_SECURE=false.
AI: FASEARCH_CONFIG_PATH=/private/tmp/fasearch-api-prototype-3h/ai/configs/baseline.v1.yaml, FASEARCH_INDEX_DIR=/private/tmp/fasearch-ai-fixture/index (read-only), FASEARCH_ENCODER=fixture, FASEARCH_CATALOG_SNAPSHOT_ID as above, PYTHONPATH=<checkout>/ai, venv /private/tmp/fasearch-ai-venv/bin/python (py3.13; host lacks 3.12 — recorded deviation).
FE: FASEARCH_BACKEND_URL=http://127.0.0.1:18180, PORT=3210.

## Start (order PG/S3 → AI → Boot → FE)

```
docker start fasearch-core-search-integration-2h-pg fasearch-core-search-integration-2h-s3
# or create (first time):
docker run -d --name fasearch-core-search-integration-2h-pg -e POSTGRES_DB=fasearch -e POSTGRES_USER=fasearch -e POSTGRES_PASSWORD=task-test-pw -p 127.0.0.1:55532:5432 postgres:16-alpine
docker run -d --name fasearch-core-search-integration-2h-s3 -e AWS_ACCESS_KEY_ID=task-test-key -e AWS_SECRET_ACCESS_KEY=task-test-secret -e S3_BUCKET=fasearch-product-images -p 127.0.0.1:38335:8333 chrislusf/seaweedfs:4.47 mini
cd <checkout>/ai && FASEARCH_CONFIG_PATH=... FASEARCH_INDEX_DIR=... FASEARCH_ENCODER=fixture FASEARCH_CATALOG_SNAPSHOT_ID=... PYTHONPATH=<checkout>/ai /private/tmp/fasearch-ai-venv/bin/python -m uvicorn fasearch_ai.main:app --host 127.0.0.1 --port 18011 > /private/tmp/fasearch-core-search-2h-ai.log 2>&1 & echo $! > /private/tmp/fasearch-core-search-2h-ai.pid
curl -s http://127.0.0.1:18011/internal/v1/health
cd <checkout>/be && <env above> nohup java -jar target/backend-0.0.1-SNAPSHOT.jar > /private/tmp/fasearch-core-search-2h-boot.log 2>&1 & echo $! > /private/tmp/fasearch-core-search-2h-boot.pid
curl -s http://127.0.0.1:18180/actuator/health
cd <checkout>/fe && FASEARCH_BACKEND_URL=http://127.0.0.1:18180 PORT=3210 nohup npm run start -- --port 3210 > /private/tmp/fasearch-core-search-2h-fe.log 2>&1 & echo $! > /private/tmp/fasearch-core-search-2h-fe.pid
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3210/
```

Build first time: `cd be && ./mvnw -q package -DskipTests`; `cd fe && npm ci && npm run build`.

## Health / test / stop / restart

Health: AI /internal/v1/health, Boot /actuator/health, FE GET / (200). Bounded polling, no blind sleeps in scripts.
Test: ai `/private/tmp/fasearch-ai-venv/bin/python -m pytest tests/test_internal_api.py tests/test_internal_composed.py tests/test_internal_text.py`; be `./mvnw -q test` (cwd be/); fe `npm run lint && npm run build` + `node --test tests/*.test.mjs`.
Stop (exact PID + cmdline check, never broad pkill):
```
kill $(cat /private/tmp/fasearch-core-search-2h-fe.pid) $(cat /private/tmp/fasearch-core-search-2h-boot.pid) $(cat /private/tmp/fasearch-core-search-2h-ai.pid)
docker stop fasearch-core-search-integration-2h-pg fasearch-core-search-integration-2h-s3
```
Restart: stop, verify ports free (`lsof -i :3210,:18180,:18011`), start again same order.
Preview: http://127.0.0.1:3210/ (combined app). No secrets in Git; fixture/model/index read-only, never committed.
