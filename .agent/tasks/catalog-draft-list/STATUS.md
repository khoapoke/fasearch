# Status: list and reopen Catalog Drafts

State: FIX_APPLIED (2026-09-25) — PR #1 feedback addressed, re-review pending
Updated: 2026-09-25
Branch: `codex/catalog-draft-list`
Base: `a207f9f79887bf8604987731c433e4d12564fd6f` (== `origin/codex/vertical-slice` at branch creation)
Worktree: tracked files clean at branch creation. Unrelated local work preserved, NOT on this branch: stashed `catalog-processing-gate/STATUS.md` scout update (stash on `codex/catalog-processing-spec`) and untracked `catalog-processing-gate/SPEC.md` + `.pi/` runtime files (present on disk, excluded from commits).

- `catalog-processing-gate` remains separate-scope and is **not** authorization to implement processing.

## Changed files (this ticket only)

- `be/src/main/java/com/fasearch/backend/catalog/CatalogDraftModule.java` — `list(limitParam, offsetParam, actor)`: one bounded parameterized query (latest-version-per-product `MAX(version_no)` subselect, `v.status = 'DRAFT'`, `archived_at IS NULL`, owner filter unless `CATALOG_PUBLISH`), order `created_at DESC, product_id DESC`, `limit + 1` fetch for `has_more`. New `DraftSummary` (8 navigation fields; no description/`created_by`/storage data) and `DraftList(items, limit, offset, has_more)` records. No migration, no authorization-model change (existing `CATALOG_DRAFT_WRITE` URL/method guards cover the new GET).
- `be/src/main/java/com/fasearch/backend/catalog/CatalogDraftController.java` — `GET /api/v1/catalog/admin/drafts` with optional `limit`/`offset` query strings.
- `be/src/test/java/com/fasearch/backend/catalog/CatalogDraftListIntegrationTests.java` — 6 Testcontainers/PostgreSQL integration tests (401, 403, Staff-own/Admin-all + direct-GET denial, latest-only/archived exclusion, pagination/ordering/`has_more`/400s, read-only no-write).
- `fe/src/app/api/catalog/drafts/route.ts` — added same-origin GET proxy forwarding the query string; POST untouched.
- `fe/src/app/catalog/drafts/page.tsx` + `fe/src/components/catalog-draft-list.{tsx,module.css}` — list page with loading, empty, error (+retry) and Previous/Next pagination states; rows link to `/catalog/drafts/{productId}`; `aria-live` status, `role=alert` errors, real links/buttons.
- `fe/src/components/auth-panel.tsx` — signed-in header shows "Danh sách nháp" link for `CATALOG_DRAFT_WRITE` (UI hint only; backend enforces).
- `contracts/public-api.openapi.json` — `GET /api/v1/catalog/admin/drafts` + `DraftSummary`/`DraftList` schemas (JSON validated).
- `docs/week6/WEEK6_CATALOG_DRAFT_USE_CASE_AND_DATA.md` — `SUC-CAT-04` + list exception rows.
- `docs/week6/WEEK6_VERTICAL_SLICE_STATUS.md` — two date-labelled bullets (backend endpoint, website page). Older evidence left untouched.

## Decisions

- Empty-but-present `limit=`/`offset=` returns 400 `INVALID_REQUEST` (absent params use defaults 20/0). Rationale: an explicitly passed empty value is an invalid parameter per acceptance criteria.
- List items reuse a new `DraftSummary` instead of full `Draft`: hides `description`/`created_by` UUIDs per contract item 4 (no owner linkability, no extra data).
- Tests set non-`DRAFT` latest status and `archived_at` via direct JDBC (no processing/archive flow exists yet); this exercises the filter without inventing production behavior.

## Commands and results

- `cd be && ./mvnw -q -Dtest=CatalogDraftListIntegrationTests test` — first run 6 tests / 1 failure (`?limit=` returned 200, expected 400); after parser fix + rerun: **Tests run: 6, Failures: 0, Errors: 0** (surefire report 2026-09-25).
## Step 5 results (2026-09-25)

- Full backend suite `cd be && ./mvnw -q test`: **24 tests, 0 failures/errors** — CatalogDraftListIntegrationTests 6, S3CatalogObjectStoreTests 2, SessionSecurityIntegrationTests 4, ImageSearchControllerTests 4, PublicApiContractTests 1, ImageSearchModuleTests 4, HttpAiImageSearchAdapterTests 2, FixtureCatalogProductAdapterTests 1. Existing POST/PATCH/image and public image-search paths did not regress.
- `cd fe && npm ci && npm run lint`: PASS (exit 0) after fixing one `react-hooks/set-state-in-effect` error in `catalog-draft-list.tsx` (mount fetch moved to promise callbacks; `goTo` kept for button/retry handlers).
- `cd fe && npm run build`: PASS (exit 0); route table shows `ƒ /api/catalog/drafts`, `○ /catalog/drafts`, existing `new`/`[productId]` routes intact.
- Focused live UI/API check (thrown-away Postgres 16 container + backend jar + `next start` on :3100, all torn down after): login as bootstrap super-admin via Next proxy OK; created 2 drafts via proxy (201 + `location`); `GET /api/catalog/drafts` via proxy returned both newest-first with `limit:20, offset:0, has_more:false`; `?limit=1&offset=0` → 1 item + `has_more:true`; `?limit=1&offset=1` → 2nd item + `has_more:false`; anonymous proxy GET → 401; `?limit=200` via proxy → 400; `GET /catalog/drafts` HTML → 200 containing the page title. No session/credential or storage-URI leakage in list payloads.

## Step 7 (2026-09-25)

- Commit: `72547d14d3de743103c444f3e528622da7740573` on `codex/catalog-draft-list` (13 ticket files only; unrelated `catalog-processing-gate/SPEC.md`, `.pi/` runtime and build artifacts excluded). Pushed to `origin/codex/catalog-draft-list`. The Standards/Spec reviews inspected the worktree whose content was committed byte-identical as `72547d1` with no intervening edits; the pinned review target is therefore `72547d1` (see REVIEW.md).
- Docs-only delta `79c1eac42c4e1916a98c7818ce13d443d9a1d18f` touched only STATUS.md (PR-link line); no code impact, recorded as a reviewed delta in REVIEW.md.
- PR: https://github.com/khoapoke/fasearch/pull/1 (draft, `codex/catalog-draft-list` into `codex/vertical-slice`). Merge is reserved for the project representative.

## Fix pass on PR #1 feedback (2026-09-25)

Confirmed findings (from the task brief; `gh` comment APIs are blocked by token scope `read:project`, so feedback was taken from the brief text):

1. Order-dependent `CatalogDraftListIntegrationTests.staffSeesOnlyOwnDraftsAndAdminSeesAll`: the Admin assertion required exactly 2 rows on a DB shared with 3 other row-creating test methods. Reproduced by temporarily forcing polluting methods first (`@Order`, reverted afterwards): `expected: 2 but was: 6`. Fix: Admin assertion now checks the returned titles contain A's and B's drafts (`contains("Áo của A", "Quần của B")`) instead of an exact total; Staff assertions stay exact-count (owner-filtered with per-test users, order-independent). No production code touched.
2. Empty past-end page (`offset > 0`, `items: []`) showed the global "Chưa có sản phẩm nháp nào." message. Fix in `catalog-draft-list.tsx`: when `data.offset > 0` the page shows "Trang này không có sản phẩm nháp." with a "Về trang đầu" button (`goTo(0)`); the global-empty message + create link render only for `offset == 0`. New `.back` style in the module CSS.
3. STATUS.md/REVIEW.md reconciliation: this file no longer claims IMPLEMENTING/NOT STARTED/NOT DONE; REVIEW.md pins `72547d1` as the reviewed code SHA (not an uncommitted worktree) and records the docs-only `79c1eac` delta plus this fix round.

Out of scope (kept): the accepted P3 admin-check duplication in `CatalogDraftModule` — the fixes did not require touching it.

Verification (exact):

- Adversarial method order (temporary `@Order`, polluters first / admin test last, reverted after): old code failed `expected: 2 but was: 6`; fixed code **6/6 PASS**.
- Randomized seeds: NOT RUN as true shuffles — this repo configures no method orderer, and neither Surefire `-D` propagation, `-DargLine`, nor a temporary `junit-platform.properties` (removed afterwards) changed the execution order (observed order stayed `[staff, anonymous, readonly, pagination, latest, registered]` across seeds 1/9/42). The adversarial-order run above is strictly stronger for this defect (admin-last is the worst case) and both seed-equivalent default runs pass.
- Full backend suite after fix: **24/24 PASS, 0 failures/errors** (`CatalogDraftListIntegrationTests` 6, `S3CatalogObjectStoreTests` 2, `SessionSecurityIntegrationTests` 4, `ImageSearchControllerTests` 4, `PublicApiContractTests` 1, `ImageSearchModuleTests` 4, `HttpAiImageSearchAdapterTests` 2, `FixtureCatalogProductAdapterTests` 1).
- `cd fe && npm run lint`: PASS (exit 0). `npm run build`: PASS (exit 0).
- Focused empty-page check (fresh throwaway Postgres + unchanged backend jar + rebuilt `next start`, torn down after): created 1 draft via proxy (201); `GET /api/catalog/drafts?limit=20&offset=20` via proxy returned `{"items":[],"limit":20,"offset":20,"has_more":false}` — the exact payload the new `offset > 0` UI branch handles; `GET /catalog/drafts` HTML 200. Client rendering of the back button was verified by code inspection + lint/build + Spec re-review (no browser harness in this environment: Not run as a visual check).
