# Ticket: list and reopen Catalog Drafts

Status: READY_FOR_IMPLEMENTATION
Owner: Pi/Muse implementation agent on `codex/catalog-draft-list`; Codex reviews the PR; project representative merges.

## Goal

An authenticated Operations Staff member can find their own non-archived Catalog Products whose **latest Product Version is DRAFT** and reopen one for editing. Administrator and Super Administrator can list all such Drafts. This fills the navigation gap in the already implemented create/revise/image workflow; it does not start processing or publish anything.

## Canonical sources

- `AGENTS.md`, `CONTEXT.md`, `docs/10_DECISION_REGISTER.md` (D003, D004, D006, D054, D056)
- `docs/week5/WEEK5_REQUIREMENTS_SPECIFICATION.md` (`FR-CAT-MGMT-001/002`, ACT-03, `FR-RBAC-*`)
- `docs/week5/WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md` (actor–permission matrix, `BR-CAT-001`)
- `docs/week6/WEEK6_CATALOG_DRAFT_USE_CASE_AND_DATA.md`, `docs/week6/WEEK6_DATABASE_CURRENT_SCHEMA.md`
- `contracts/public-api.openapi.json`, Flyway V1–V3, current Catalog Draft controller/module and frontend form/routes

## Scope and contract

1. Add `GET /api/v1/catalog/admin/drafts` to the existing Spring Boot catalog surface. It returns only non-archived Catalog Products whose latest Product Version has status `DRAFT`.
2. Operations Staff sees only products they created. Accounts with `CATALOG_PUBLISH` may see all Drafts, matching current `CatalogDraftModule.get` access semantics. The backend enforces authorization; UI hiding is not sufficient.
3. Paginate with integer `limit` (default 20, range 1–100) and `offset` (default 0, non-negative), ordered by latest version `created_at DESC`, then product ID DESC. Return `{items, limit, offset, has_more}`; get `has_more` without an unbounded count. Reject invalid parameters with 400. Use parameterized SQL and one bounded query, not N+1 reads.
4. Each item carries the existing Draft fields needed for navigation (product/version IDs, version number, title, category, status, created_at, has_primary_image); do not expose S3 credentials, storage URI, password/session data or a public URL for an unpublished image.
5. Add a same-origin Next.js GET proxy on `/api/catalog/drafts`, preserving the existing POST path. Add `/catalog/drafts` with loading, empty, error and paginated states, each row linking to `/catalog/drafts/{productId}`. Show the list link only to an authenticated account with `CATALOG_DRAFT_WRITE`; do not rely on this UI condition for security.
6. Extend OpenAPI and narrowly update the relevant Week 6 status/use-case documentation. No new migration is expected.

## Acceptance criteria

- [ ] Anonymous list request returns 401; Registered User without permission returns 403; no Draft data leaks.
- [ ] Staff A sees only A's Drafts; Staff B sees only B's; Administrator sees both. A direct GET of another Staff's Draft remains forbidden.
- [ ] Only the **latest** version per product appears once; a product whose latest version is not DRAFT or is archived does not appear.
- [ ] Limit/offset boundaries, deterministic ordering and `has_more` are covered by tests; invalid values return 400.
- [ ] Listing is read-only: it creates no Product Version, Audit Event or object-store write. Existing POST/PATCH/image and public image-search paths do not regress.
- [ ] Website can navigate from the signed-in header to the list and from a row to the existing edit page; loading/empty/error states are understandable and keyboard-accessible.
- [ ] Backend targeted tests, full backend suite, frontend lint/build and a focused browser/API check are run and recorded with exact results. If an environment check cannot run, mark `Not run` with reason.
- [ ] Two-axis Standards/Spec review uses one pinned base/review SHA pair; actionable findings are fixed and retested before a draft PR is marked ready. Do not merge the PR.

## Non-goals

- No processing job, quality-state transition, review queue, publication, Active catalog read, archive/delete semantics, registration or role-admin changes.
- No schema redesign or new authorization model. Do not change `catalog_products.active_version_id` or the frozen 600-product search publication.
- Do not resolve open Week 5 delete/archival semantics (`W5-O06`) inside this ticket.

## Ownership and skills

- One Pi/Muse implementation writer owns production files in a dedicated worktree/branch. Read-only scouts may independently inspect backend query/test seams, frontend/UX seams and requirements/security risks; do not have multiple agents edit overlapping files.
- Ponytail `full` in the implementation/fix session. Use `tdd` if it improves the stable JDBC/API seam; `frontend-design` only for the new list page. Warden is optional guardrail, not a replacement for tests or review. Avoid duplicate Jev judgments if Warden and a separate pi-typesafe sidecar are both loaded.
- At completion, update `STATUS.md` with files, exact commands/results, branch/head SHA, known risks and PR link. Record review in `REVIEW.md`; leave previous Week 6 evidence date-labelled rather than claiming it was rerun.

## Stop rules

If implementation needs a new domain/architecture decision, a broader list of lifecycle states, a migration, or a destructive data operation, stop that part, record the blocker in `STATUS.md`, and request the project representative's decision. Otherwise finish only this bounded ticket. Commit/push the branch and open a draft PR into `codex/vertical-slice` when checks/review are complete; never merge or push directly to the target branch.
