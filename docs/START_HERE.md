# START HERE — team reading branch `codex/team-integration`

One branch with the current FaSearch to study together. Not a redesign,
not a release: Qdrant review verdict is still pending and Console browser
closure is pending — this branch is for group dissection only.

## What this branch contains

- **App**: Qdrant website candidate (account/library/search/Swagger/Stitch)
  + catalog operations console (drafts/versions/audit) + shared Compose
  runtime. See SOURCE_MANIFEST.md for exact provenance per file group.
- **Context**: current AGENTS.md, `.agent` workflow/project packets, the two
  task handoffs + runbooks, roadmaps, readability-audit packet, oxk adapter.
- **Deliberately absent**: old prototypes (landing/stitch demos),
  hardening ancestry with generated vectors, teammate's future backend push.

## Run one integrated app (loopback, own preview)

Prereqs: shared `fasearch` containers running (PG `:55732`, storage
`:38535`); task venv `/tmp/fasearch-web-venv312` (3.12.15);
owner-only secret file with `FASEARCH_DB_PASSWORD` (never in Git).

```bash
# 1. AI :18062 (own process, frozen Qdrant read-only)
/tmp/fasearch-web-venv312/bin/python -m uvicorn src.main:app --host 127.0.0.1 --port 18062  # cwd: ai/
# 2. Boot :18880 (exact-source JAR; own DB fasearch_team_candidate)
SERVER_PORT=18880 FASEARCH_DB_URL=jdbc:postgresql://127.0.0.1:55732/fasearch_team_candidate \
  FASEARCH_AI_BASE_URL=http://127.0.0.1:18062 ... java -jar be/target/backend-0.0.1-SNAPSHOT.jar --server.address=127.0.0.1
# 3. FE :3290
FASEARCH_BACKEND_URL=http://127.0.0.1:18880 ./node_modules/.bin/next start -H 127.0.0.1 -p 3290  # cwd: fe/
```

Full variable list: `.agent/tasks/ai-qdrant-web-integration/RUNBOOK.md` §3
(substitute ports/DB above). Never touch `:3270`/`:18680`/`:18042`
(Qdrant review), `:3280`/`:18780` (Console), or old previews.

## What works / what's open

- Works: TEXT/IMAGE/COMPOSED Qdrant search (incl. malformed-IMAGE 400,
  outage 503), account/profile/password/library/Saved/history + privacy,
  Draft create/edit/image + carry-forward + version conflict + timeline/
  compare + audit, Stitch public views, Swagger/three-way OpenAPI parity.
- Open: Qdrant independent PASS at new SHA, Console browser closure,
  publication/seller policy (W5-O01), teammate backend organization
  (pending Discord) — none decided by this branch.

## Directory purpose (where to look)

- `be/src/main/java/.../identity| catalog|library|search` — one Boot app.
- `ai/fasearch_ai` + `ai/src` — internal Python AI (FastAPI, not Boot).
- `fe/src/app` — Stitch storefront + `/catalog/operations` console.
- `contracts/` — canonical OpenAPI; `be/.../docs/openapi.json` served copy.
- `tools/ai-draft-hardening` — parity/restore drills (research tooling).
- `.agent/tasks/*` — frozen task context (this branch's copies are snapshots).

## Three request traces to walk through together

1. **Public image search**: drop an image on `/search/image` →
   `fe/.../api/search/image/route.ts` → Boot
   `search/api/ImageSearchController.java` → `application/ImageSearchModule`
   → `infrastructure/ai/HttpAiImageSearchAdapter.java` (4xx mapping) →
   AI `ai/fasearch_ai/main.py::search_image` → Qdrant
   `fasearch_web_week4_v1`. Bad bytes → 400 `INVALID_IMAGE`.
2. **Draft with image + audit**: `/catalog/drafts/new` →
   `catalog/CatalogDraftController` → `CatalogDraftModule` (owner/CAS) →
   `CatalogDraftImageController`/`CatalogImageModule` (S3 + new version) →
   timeline `CatalogDraftOperations` → `audit_events` lineage.
3. **Login → save → history**: `/dang-nhap` → session cookie + CSRF →
   `/api/v1/me/saved-products` → search with token writes history only on
   valid session token (`HistoryCsrfAuthorizer`); Guest/foreign denied.

Business workflow vs code layout vs deployment: features are organized by
module (identity/catalog/library/search) inside one Boot JAR plus a
separate Python AI process — see `.agent/tasks/app-consolidation/
ARCHITECTURE_NOTE.md` before proposing any reorganisation.
