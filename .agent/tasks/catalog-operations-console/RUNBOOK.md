# RUNBOOK — Catalog Operations Console (candidate preview)

Scope: isolated candidate runtime only. Shared PostgreSQL `127.0.0.1:55732`
and SeaweedFS `127.0.0.1:38535` are reused; nothing else is mutated.
Review runtimes (FE `3270`, Boot `18680`, AI `18042`, older previews) are
observe-only and were never signalled.

## 1. Secrets (owner-only, never in Git)

```
ls -l /tmp/ops-console-secrets.env   # -rw------- (600), outside any repo
```

Contents are `KEY=value` lines actually used below: `FASEARCH_DB_URL`
(`jdbc:postgresql://127.0.0.1:55732/fasearch_ops_candidate`),
`FASEARCH_DB_USER`, `FASEARCH_DB_PASSWORD`, `FASEARCH_OBJECT_ENDPOINT`
(`http://127.0.0.1:38535`), `FASEARCH_OBJECT_REGION`,
`FASEARCH_OBJECT_BUCKET` (`fasearch-ops-candidate`),
`FASEARCH_BOOTSTRAP_ADMIN_*` (first start only),
`FASEARCH_COOKIE_SECURE=false`, `FASEARCH_OBJECT_ANONYMOUS=true`
(auth-less local emulator rejects signed requests; default `false`,
never combined with static keys).

## 2. Isolated database (created once on shared PG)

```
docker exec fasearch-postgres psql -U fasearch -d fasearch -c "CREATE DATABASE fasearch_ops_candidate;"
```

Flyway migrates it automatically on backend start. Task bucket (once):

```
curl -s -m 10 -X PUT http://127.0.0.1:38535/fasearch-ops-candidate -w "\nmkbucket:%{http_code}\n"
```

## 3. Build exact source

```
cd /tmp/fasearch-ops-console/be && ./mvnw package -DskipTests -o -q
cd /tmp/fasearch-ops-console/fe && ./node_modules/.bin/next build
```

Jar used for preview: `be/target/backend-0.0.1-SNAPSHOT.jar`
(sha256 prefix `bc74103991155753`, 50243027 bytes).

## 4. Start candidate backend (Boot 18780) and frontend (3280)

```
set -a; . /tmp/ops-console-secrets.env; set +a
cd /tmp/fasearch-ops-console/be
nohup java -jar target/backend-0.0.1-SNAPSHOT.jar --server.address=127.0.0.1 --server.port=18780 > /tmp/ops-console-be-18780.log 2>&1 &
sleep 22; curl -s -o /dev/null -w "csrf:%{http_code}\n" http://127.0.0.1:18780/api/v1/auth/csrf
```

```
cd /tmp/fasearch-ops-console/fe
FASEARCH_BACKEND_URL=http://127.0.0.1:18780 PORT=3280 nohup ./node_modules/.bin/next start -H 127.0.0.1 -p 3280 > /tmp/ops-console-fe-3280.log 2>&1 &
sleep 10; curl -s -o /dev/null -w "operations:%{http_code}\n" http://127.0.0.1:3280/catalog/operations
```

Single runtime mutator rule: stop **only** the exact owned PIDs
(`lsof -ti :18780`, `lsof -ti :3280`); never blanket kill/freeport.

## 5. Preview fixtures (owned DB only, disposable passwords)

Register via `POST http://127.0.0.1:18780/api/v1/auth/register`, then assign
existing roles in the owned DB only:

```
docker exec fasearch-postgres psql -U fasearch -d fasearch_ops_candidate -c "INSERT INTO user_roles (user_id, role_id) SELECT a.id, r.id FROM user_accounts a, roles r WHERE a.username IN ('ops-staff-a','ops-staff-b') AND r.code='OPERATIONS_STAFF'; INSERT INTO user_roles (user_id, role_id) SELECT a.id, r.id FROM user_accounts a, roles r WHERE a.username='ops-admin-preview' AND r.code='ADMINISTRATOR';"
```

No role-management feature was added; this is fixture setup.

## 6. Checks run (all green before handoff)

```
cd /tmp/fasearch-ops-console/be && ./mvnw test -Dtest='CatalogOperationsConsoleIntegrationTests,CatalogDraftListIntegrationTests,S3CatalogObjectStoreTests,ApiDocsWebTests,ApiDocsProdTests,PublicApiContractTests,TextPublicContractTests,ComposedPublicContractTests,SessionSecurityIntegrationTests' -DfailIfNoTests=true -o
cd /tmp/fasearch-ops-console/fe && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/eslint src/ && ./node_modules/.bin/next build
```

Contract parity:

```
curl -s http://127.0.0.1:18780/docs/openapi.json -o /tmp/served-openapi.json
diff -q /tmp/served-openapi.json /tmp/fasearch-ops-console/contracts/public-api.openapi.json
diff -q /tmp/served-openapi.json /tmp/fasearch-ops-console/be/src/main/resources/docs/openapi.json
```

## 7. Manual preview (10–20 minutes, representative-owned PASS)

1. Open `http://127.0.0.1:3280/catalog/operations` logged out → expired
   notice + retryable error (no privileged flash).
2. Log in at `/dang-nhap` as `ops-staff-a` → dashboard counts + identity.
3. `/catalog/drafts` → search `linen`, filter category/ảnh chính, page;
   URL preserves filters; row link keeps `?from=` return context.
4. Open draft → edit title → save → new version; timeline + audit refresh.
5. Two-tab: revise via another session, save stale → conflict panel keeps
   local text, compares, explicit resubmit creates next version.
6. Timeline: expand a version (historical image bytes), compare vN vs v1.
7. Audit: lineage rows, expandable event/trace IDs, refresh.
8. Log in as `ops-staff-b` → other owner's draft URL → 403 denial.
9. Public `/catalog` still loads; account routes unaffected.

## 8. Restore healthy preview after drills

Restart exactly the two commands in §4 if stopped; confirm the two
`curl` checks return `200`. Clean only owned disposable resources:
candidate object keys under `s3://fasearch-ops-candidate/products/<uuid>/`
are namespaced per product and listed from the owned DB; shared buckets,
other databases, and all review processes stay untouched.
