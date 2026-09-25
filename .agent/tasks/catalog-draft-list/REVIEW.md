# Review: list and reopen Catalog Drafts

Verdict: PASS_WITH_NOTES (Standards) / PASS (Spec) — no unresolved P0–P2 findings.

## Pinned SHAs

- Base: `a207f9f79887bf8604987731c433e4d12564fd6f` (`codex/vertical-slice` at branch creation; `HEAD` at review time, all ticket changes uncommitted worktree edits on top).
- Review target: uncommitted worktree on `codex/catalog-draft-list` reviewed 2026-09-25 (base `a207f9f7` + the 13 ticket files listed in STATUS.md). Commit SHA recorded in STATUS.md after step 7; reviewed content is identical unless a fix commit is noted there.
- Method: two parallel read-only subagents via the `code-review` skill (Standards + Spec axes, same fixed point), plus the implementation agent as runtime/regression owner. Reviewers were instructed to ignore unrelated paths (`.agent/tasks/catalog-processing-gate/SPEC.md`, `.pi/`); those paths are excluded from the commit.

## Standards findings (reviewer f5301163, verbatim in essence)

Verdict: PASS_WITH_NOTES. No hard violations of a documented standard.

- P3 Duplicated Code (judgement call): the `CATALOG_PUBLISH` admin check (`actor.getAuthorities().stream().anyMatch(...)`) now appears 3× in `CatalogDraftModule.java` (create/revise `get` at L70-71, L130-131, plus new `list` at L158-159). Worst finding of this axis.
- P4 Duplicated Code: Vietnamese error string `"Không thể tải danh sách nháp. Hãy thử lại."` repeated 3× in `catalog-draft-list.tsx` (L43, L57, L69).
- P4 Duplicated Code: `user.authorities.includes("CATALOG_DRAFT_WRITE") && (` gate duplicated in `auth-panel.tsx` (L87, L90) — could merge into one block.
- Clean: controller thin delegation, test-only `Test-only-*` passphrases (not committed credentials), proxy mirrors POST pattern with no business rule, page wrapper matches App Router convention, `aria-live`/`role=alert`/real links-buttons, OpenAPI ranges match code, docs are date-labelled light-touch with no artifact/credential staging.

## Spec findings (reviewer 8e273bf6, verbatim in essence)

Verdict: PASS. No missing items, no scope creep, nothing implemented-but-wrong.

- (a) Missing/partial: none. All Scope 1–6 covered — latest-DRAFT-only filter, Staff-own/Admin-all backend enforcement matching `get()` semantics, `created_at DESC, product ID DESC` ordering, `{items, limit, offset, has_more}` with `limit+1` (no unbounded count), 400 `INVALID_REQUEST` on invalid params, 8-field allow-list with no S3/session/credential data, proxy + loading/empty/error/pagination states + row links, `CATALOG_DRAFT_WRITE` list-link gate, OpenAPI + narrow Week 6 updates, no migration.
- (b) Extra behaviour: none — no processing/publication/archive/delete/role-admin or `active_version_id`/600-product changes.
- (c) Implemented-but-wrong: none. `SNAKE_CASE` (application.yml:15) reconciles Java records with OpenAPI/FE snake_case; tests assert field names, ordering, 401/403/400, isolation and read-only counts.

## Runtime/regression owner (implementation agent, observed evidence)

- Targeted: `CatalogDraftListIntegrationTests` 6/6 PASS (surefire 2026-09-25).
- Full backend suite: 24/24 PASS, 0 failures/errors — existing POST/PATCH/image and public image-search paths did not regress.
- Frontend: `npm run lint` exit 0, `npm run build` exit 0 with `ƒ /api/catalog/drafts` + `○ /catalog/drafts` in the route table.
- Focused live check (throwaway Postgres + backend jar + `next start`, torn down): proxy login → 2× create (201) → default list (newest-first, `has_more:false`) → `limit=1` pages (`has_more:true/false`) → anon 401 → `limit=200` 400 → list page HTML 200. Payloads carried no storage URI/session/credential data.
- Not run: full browser matrix and responsive/accessibility sweep beyond keyboard-accessible links/buttons and live-region/error roles (out of ticket scope; recorded as Not run, not as pass).

## Disposition

- No P0–P2 findings exist, so no fix/retest cycle was required (step 6 threshold: fix confirmed in-scope P0–P2 only).
- P3 admin-check duplication: accepted as-is — extracting a helper would refactor the pre-existing `revise`/`get` methods outside this ticket's one-endpoint scope (Shotgun Surgery risk for zero behavioral gain).
- P4 error-string and auth-panel duplications: accepted as-is — three call sites and two adjacent JSX gates; a shared constant/block buys nothing at this size (Speculative Generality).
- No architecture/scope decision arose; nothing escalated to the project representative.
- The pi-goal-x completion auditor and Warden are supporting checks, not substitutes for this review or the project representative's merge decision.
