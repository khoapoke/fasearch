# Review: list and reopen Catalog Drafts

Verdict: PASS_WITH_NOTES (Standards) / PASS (Spec) — no unresolved P0–P2 findings.

## Pinned SHAs

- Base: `a207f9f79887bf8604987731c433e4d12564fd6f` (`codex/vertical-slice` at branch creation).
- Reviewed code SHA (round 1): `72547d14d3de743103c444f3e528622da7740573`. The reviewers inspected the worktree whose content was committed byte-identical as `72547d1` with no intervening edits, so the pinned review target is the commit, not the worktree.
- Docs-only delta `79c1eac42c4e1916a98c7818ce13d443d9a1d18f` (STATUS.md PR-link lines only, verified via `git show`): no production/test/UI/contract impact; reviewed as a delta by the implementation agent, no findings.
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

## Round 2 — fix verification (2026-09-25)

- Fixed code SHA: `d8155d39e2ced50e366b15538e40d9d924647e5a` (delta `79c1eac42..d8155d39e`: test containment assertion, past-end empty page + `.back` style, STATUS/REVIEW reconciliation).
- Standards re-review (b9555718): **PASS**, no P0–P4 findings. Correct flake fix, conventions preserved, `.back` mirrors existing button styles, docs light-touch. Non-blocking note: containment permits extra rows without `size>=2` — not worth a cycle. Prior P3 duplication untouched, not worsened.
- Spec re-review (943b5e24): **PASS**, no findings. Admin-titles assertion still proves "Administrator sees both"; Staff exact-1 assertions order-independent (distinct per-test users); past-end branch is keyboard-accessible with a way back and no global false claim; Scope 5 states intact; STATUS/REVIEW SHAs and claims verified against git state (tracked tree clean apart from excluded untracked paths). Limitation noted: reviewer had no shell, verified via read/grep + watchdog_diff.
- No P0–P2 findings in either round; no fix/retest cycle required beyond the reviewed delta itself.

## Round 3 — past-end failure state (2026-09-25)

- Fixed code SHA: `2d8fd71f086e5c173e788f0af846563664d76230` (delta `c6056c223..2d8fd71f0`: empty-branch error alert with retry-current/back-to-first, `.errorActions` style, STATUS round-3 notes).
- Standards review (d103f67e): **PASS** — worst P4 (redundant `currentPage > 0` guard; `p`-as-button-wrapper). No standard violation.
- Spec review (3bc82bf9): **PASS** — worst none (P4 note: two "Về trang đầu" buttons visible in the failure state — redundant but harmless and keyboard-accessible). Acceptance intact, no scope creep, STATUS claims verified against code.
- No P0–P2 findings; P4 notes accepted without another cycle (cosmetic, zero behavioral gain).

## Disposition

- No P0–P2 findings exist, so no fix/retest cycle was required (step 6 threshold: fix confirmed in-scope P0–P2 only).
- P3 admin-check duplication: accepted as-is — extracting a helper would refactor the pre-existing `revise`/`get` methods outside this ticket's one-endpoint scope (Shotgun Surgery risk for zero behavioral gain).
- P4 error-string and auth-panel duplications: accepted as-is — three call sites and two adjacent JSX gates; a shared constant/block buys nothing at this size (Speculative Generality).
- No architecture/scope decision arose; nothing escalated to the project representative.
- The pi-goal-x completion auditor and Warden are supporting checks, not substitutes for this review or the project representative's merge decision.
