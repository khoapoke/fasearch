# AC COVERAGE — Catalog Operations Console

Base dependency: original Qdrant review verdict still pending; result is
feature-scoped, not an integrated-release PASS.

## M1 — Permission-aware operations shell/dashboard ✅

- `/catalog/operations` shell: breadcrumb, live identity
  (`/api/auth/me` authorities), navigation to implemented pages only.
- Dashboard reads `GET summary` (typed, no-store): total, with/without
  image, TOP/BOTTOM/ONE_PIECE — all effective authorized scope.
- Denial states: logged-out shows expired notice; 403 shows limited-access
  alert without privileged data (browser-verified).
- Evidence: `ops-01-operations-1440.png`, E2E summary A/B split.

## M2 — Server-side Draft search/filter/paging ✅

- `GET drafts?q&category&has_primary_image`: trimmed/bounded `q` (250),
  strict category enum, strict boolean; invalid → 400 `INVALID_REQUEST`
  (never silent dynamic SQL; parameterized `ILIKE` with LIKE-escaping).
- Stable order `created_at DESC, product_id DESC`; `limit/offset/total/
  has_more` envelope (`total` added, old keys preserved).
- FE toolbar + URL sync (`limit/offset/q/category/has_primary_image`),
  `?from=` list-return context on rows and editor back-link; out-of-order
  responses discarded via request id; AbortController on unmount.
- Evidence: filter/paging/400 BE tests; `ops-02-drafts-1440.png`;
  `Hiển thị 1–1 trong 1` rendering.

## M3 — Create/edit/image workspace ✅

- Immutable-version APIs + `expected_version_no` reused; validation before
  request (title ≤250, description ≤4000, 10MiB client check);
  dirty indicator + `beforeunload` guard (dialog observed);
  `saving||uploading` double-submit guard + disabled buttons;
  in-flight abort on new submit/unmount.
- Image: selected-file preview with object-URL cleanup, file info,
  server readback, carry-forward after text edit (v3→v4→v5 `Có ảnh`
  verified); failed saves keep text/selection; nothing persisted to
  browser storage.
- Evidence: carry-forward BE test; `ops-03-editor-1440.png`.

## M4 — Two-tab conflict recovery (metadata + image) ✅

- `409 VERSION_CONFLICT` preserves local text/file, fetches server
  latest, shows side-by-side compare, explicit fresh-version resubmit;
  no silent overwrite or auto-retry. Image path shares the mechanism
  (selected file kept, re-upload against fresh version).
- Concurrent saves → sequential immutable versions + transactional audits;
  rejected stale attempt creates no version/audit (BE + browser proven:
  tab2 v4 + tab1 v5; later v7/v8/v9 sequences).
- Evidence: stale-write BE test; `ops-04-conflict-1440.png`; resubmit
  `Đã lưu bản 5.` observed.

## M5 — Version timeline/detail/compare ✅

- `GET versions` (DESC, bounded, `total`), `GET versions/{id}` (actual
  historical title/description/category + safe image metadata, no
  storage keys), version-bound image reader (product+version match,
  `no-store`/`nosniff`, no S3 redirect, no current-image stand-in).
- Read-only, clearly labelled; two-version compare with keyboard-labelled
  selects; historical image errors isolated with retry.
- Evidence: binding/404 BE tests; timeline v1–v8 + compare table in
  browser (`ops-05-compare-1440.png`).

## M6 — Scoped catalog audit trail ✅

- `GET audit`: allowlisted `CATALOG_PRODUCT`
  create/revise/primary-image events only; DTO has version lineage
  (ids + numbers), timestamps, optional trace/actor ids; no account/
  session/library events, no emails/usernames/storage paths/raw JSON.
- Ownership checked before rows; immutable (DELETE → 4xx, count
  unchanged); stable pagination; refreshes after writes.
- Evidence: lineage/immutability BE tests; live v7→v8 audit row in
  browser; `ACCOUNT_REGISTERED` correctly excluded.

## M7 — Validation/review/handoff ✅ (pending independent verdict)

- 32 affected BE tests green; FE `tsc`/`eslint`/`next build` clean;
  served==canonical==resource contracts; role-matrix/security/failure/
  browser evidence above; healthy `:3280`/`:18780` preview left running.
- Independent Spec+Standards+runtime/visual review dispatched in-mission
  per packet; verdict binds final SHA; fixes (if any) return to Implement
  for repro→regression→minimal fix→recheck→new-SHA assessment.

## Explicitly out of scope (not built, not implied)

Publishing/ACTIVE transitions, role editor, embeddings/jobs, commerce,
AI/provider changes, storefront redesign, fake publish controls —
none present. Drafts never enter search; UI states this.
