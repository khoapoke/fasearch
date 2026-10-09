# EVIDENCE — Catalog Operations Console (Implement)

## Source / build / runtime identities

- Base (pinned, clean): `1d0a2e6fc97c90a2a92fd05f3b7a7a602b2a6caf`
  (verified in `/tmp/fasearch-ai-qdrant-web`, untouched throughout).
- Worktree: `/tmp/fasearch-ops-console`, branch
  `codex/catalog-operations-console`, created from the pinned base.
- Packet hashes at intake (sha256): TASK `d63e730e…`, API_DESIGN
  `3a338eb3…`, DESIGN `809d6c92…`, STATUS `edaea0ea…`, REVIEW_PROMPT
  `9d78ad93…`, IMPLEMENT_PROMPT `9fd73f34…`, REVIEW `d1a238dd…`.
- Backend jar: `be/target/backend-0.0.1-SNAPSHOT.jar`, 50243027 bytes,
  sha256 prefix `bc74103991155753` (built from this worktree).
- Runtimes (owned, 127.0.0.1-only): Boot `18780` (PID `12455`,
  `java -jar target/backend-0.0.1-SNAPSHOT.jar --server.address=127.0.0.1
  --server.port=18780`, cwd `/tmp/fasearch-ops-console/be`);
  FE `3280` (current `next start -H 127.0.0.1 -p 3280`,
  `FASEARCH_BACKEND_URL=http://127.0.0.1:18780`).
- Isolated DB `fasearch_ops_candidate` on shared PG `55732` (Flyway v6
  applied at first start); object bucket `fasearch-ops-candidate` on
  shared SeaweedFS `38535`; keys `products/<product-uuid>/…`.
- Review runtimes observed only, never signalled: java `97152`
  (`/tmp/fasearch-ai-qdrant-web` jar), FE `3270`/`3240`/`3250`,
  Boot `18480`/`18580`/`18590`, AI `18031`/`18032`.

## Backend tests (isolated Testcontainers PG, real JDBC + object adapter)

`./mvnw test -Dtest='…'` (see RUNBOOK §6): **32 run, 0 failures**.

| Suite | n | Covers |
|---|---|---|
| `CatalogOperationsConsoleIntegrationTests` (new) | 7 | anon/registered deny; StaffA/B/Admin matrix on summary/list/versions/detail/image/audit; hidden-resource search isolation; q/category/has_primary_image/total/paging/ordering + 400s; version timeline/image binding (wrong-version and cross-product 404); audit lineage + stale-write no-phantom + DELETE immutability; image carry-forward; candidate-scoped storage 503 + recovery |
| `CatalogDraftListIntegrationTests` (existing) | 6 | no regression on existing list semantics |
| `S3CatalogObjectStoreTests` | 3 | incl. new anonymous/key-combination guard |
| `ApiDocsWebTests` / `ApiDocsProdTests` | 3+1 | served==canonical, counts 26 paths / 33 ops |
| Search `*ContractTests` | 2+2+3 | public/internal contracts unchanged |
| `SessionSecurityIntegrationTests` | 5 | session/CSRF unchanged |

Contract parity: `/docs/openapi.json` served by exact-source Boot is
byte-identical to both `contracts/public-api.openapi.json` and
`be/src/main/resources/docs/openapi.json` (`diff -q` clean). Parsed-diff
check: all old paths/schemas unchanged except `DraftList.total` and the
list-GET description; purely additive (+5 paths, +6 schemas).

Frontend: `tsc --noEmit` clean, `eslint src/` 0 errors 0 warnings,
isolated `next build` success (26/26 static, new routes listed).

## Live API journey (candidate 18780, owned fixtures)

- `ops-staff-a` create → v1 → revise → v2 → image upload → v3
  (byte-identical readback, `X-Content-Type-Options: nosniff`,
  `Cache-Control: no-store`).
- Summary scoped: A sees own counts, B sees zeros; B searching A's title
  returns `total: 0`; B reading A's versions/audit → `403`; admin → `200`.
- Stale `PATCH expected_version_no: 2` at v3 → `409`, audit total
  unchanged (no phantom version/audit).
- Version image binding: v3 bytes `200`, v1 (no image) `404`,
  foreign version id `404`.
- Audit: `CATALOG_DRAFT_CREATED(→v1)`, `CATALOG_DRAFT_REVISED(1→2)`,
  `CATALOG_PRIMARY_IMAGE_REPLACED(2→3)`; stale write adds nothing;
  `ACCOUNT_REGISTERED` rows exist in table but are never served.
- Storage fault (candidate adapter `failNextPut`) → `503
  OBJECT_STORAGE_UNAVAILABLE`, no version/audit; retry succeeds.

## Browser journey (Playwright, candidate 3280, screenshots in `evidence/`)

- `ops-01-operations-1440.png`: dashboard, live counts, identity
  `ops-staff-a · Nhân viên vận hành`, real navigation.
- `ops-02-drafts-1440.png`: server-filtered list, `Hiển thị 1–1 trong 1`,
  `?from=` return context preserved on row links.
- `ops-03-editor-1440.png`: editor + carried image + timeline + audit.
- `ops-04-conflict-1440.png`: two-tab conflict — local text preserved,
  server v9 notice, side-by-side compare, explicit resubmit
  (button `#aa3000`/white, contrast 6.71 after fix).
- `ops-05-compare-1440.png`: v5-vs-v1 table (title/category/image change).
- `ops-06-operations-768.png`, `ops-07-operations-390.png`,
  `ops-09-drafts-320.png`: responsive, 320px zero horizontal overflow.
- `ops-08-denied-390.png`: `ops-staff-b` opening A's draft → 403 denial.
- Post-save live refresh verified: timeline shows v8 `Mới nhất`, audit
  gains `Bản 7 → bản 8` without manual reload.
- Dirty guard: `beforeunload` dialog observed on reload with unsaved edits.
- Contrast (computed): ink 17.11, ink-soft 6.48, brand 6.71, danger 6.46,
  ok 4.99 — all ≥ 4.5 on white. Reduced-motion: no keyframe animations;
  only `0.00001s` inherited transitions (no visible motion). Keyboard:
  Tab moves focus across breadcrumb/toolbar/table/editor controls (all
  native elements with labels).

## Findings fixed during implementation (no reviewer round needed)

1. Conflict submit button used undefined `--cobalt` (also undefined in
   base: `--cobalt/--teal/--thread*/--aubergine` never defined in
   `globals.css`). Scoped fix: new console CSS uses only defined tokens;
   pre-existing usages left untouched and recorded as inherited base
   condition for Review.
2. Timeline/audit went stale after save → added `currentVersion` refresh
   trigger (lint-clean, verified live v8 refresh).
3. Shared SeaweedFS (no S3 auth) rejects signed SDK requests → additive
   opt-in `FASEARCH_OBJECT_ANONYMOUS` (default `false`, refuses static-key
   combination, candidate-only usage documented in RUNBOOK).
4. Stale FE process shadowed the new build on `:3280` → killed exact PIDs,
   verified served chunks contain the fix.

## Negative controls / not-run

- Negative: invalid `category/has_primary_image/q>250/limit/offset` → 400;
  cross-owner reads → 403; wrong-version/foreign image → 404; stale PATCH
  → 409; DELETE audit → 4xx with count unchanged; oversized file blocked
  client-side; double-submit guarded (`saving||uploading` + disabled).
- Public catalog on candidate returns honest `CATALOG_UNAVAILABLE` (no
  frozen fixtures configured — console scope needs no inference; search
  code paths untouched, contract suites green).
- Not run: full unrelated BE suite (no changed code there); image-conflict
  two-tab in browser (metadata path proven; image path shares the same
  `enterConflict`/`expected_version_no` mechanism + BE-tested 409).
- No secrets, storage URIs, object keys, or model/vector data in Git or
  screenshots (usernames fixture-only; UUIDs secondary details only).
