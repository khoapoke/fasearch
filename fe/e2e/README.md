# FaSearch e2e suite (`fe/e2e/`)

One maintained end-to-end suite that replaces the scattered one-off harnesses (admin quality pass, catalog/motion
verifiers, demo rehearsal, AI search smoke). Runner: Node's built-in `node --test` + `playwright-core@1.56.1`
(the only added dependency). No application source is touched.

## Quick start

```bash
cd fe
export E2E_BASE_URL=http://127.0.0.1:3191            # FE under test
export E2E_API_URL=http://127.0.0.1:18164            # BE (optional; needed by the `payments` group)
export E2E_FIXTURES_DIR=$HOME/.config/fasearch/e2e-fixtures     # private credential files, see below
export E2E_BROWSERS_PATH=/path/to/browsers           # dir holding chromium_headless_shell-* (no download is done)
npm run e2e                                          # read-only, all groups
E2E_GROUPS=customer,ai npm run e2e                   # a subset  (also: npm run e2e:customer|admin|roles|ai|payments)
node e2e/run.mjs admin.sweep                         # one test file (substring filter on the file name)
```

## Environment variables

| Variable | Meaning |
|---|---|
| `E2E_BASE_URL` | FE origin (required) |
| `E2E_API_URL` | BE origin; enables `payments` group (otherwise skipped with a reason) |
| `E2E_MODE` | `readonly` (default) or `write` |
| `E2E_ALLOW_WRITES=1`, `E2E_DB_IS_CLONE=1`, `E2E_DB_NAME=<db>` | all three are required for write mode; `E2E_DB_NAME` must look like `fasearch_cand_*`, `fasearch_it_*`, `fasearch_e2e_*` or `fasearch_clone_*` and must not be the baseline `fasearch_admin_customer_core_20261104` |
| `E2E_BASELINE_PORTS` | ports that are never written to (default `3191,18164,8024`); write mode refuses a `E2E_BASE_URL` / `E2E_API_URL` on them |
| `E2E_GROUPS` | comma list of `customer,admin,roles,ai,payments` (default all) |
| `E2E_FIXTURES_DIR` | directory with the private fixture files (below) |
| `E2E_ROLES_MATRIX` | path to a roles matrix JSON (default `e2e/fixtures/roles-matrix.quan-ly.json`) |
| `E2E_BROWSERS_PATH` | Playwright browsers dir (falls back to `PLAYWRIGHT_BROWSERS_PATH`) |
| `E2E_REPORT_DIR` / `E2E_RUN_DIR` | where reports go (default `$TMPDIR/fasearch-e2e/<timestamp>`; outside Git) |
| `E2E_PRODUCT_ID`, `E2E_SKU_IDS` | optional overrides; by default a product and two SKUs with stock are discovered |
| `E2E_KNOWN_FAILS` | comma list of test-name substrings reported as TODO instead of failures (explicit, printed in the report) |
| `E2E_KEEP_SCREENSHOTS=1` | keep screenshots of passing browser suites (default: failures only) |

Write mode is refused (exit 2) unless every guard holds, and each write suite re-checks the guards itself.
Note the guard can only trust what you declare in `E2E_DB_NAME`; it cannot read the BE's real datasource.

## Credentials / fixtures (never in Git, never printed)

Files under `E2E_FIXTURES_DIR`, read inside the test process only (not logged, not in argv/URLs, not in screenshots):

- `accounts.json` – `{ "accounts": [ { "role": "ADMIN"|"CUSTOMER"|..., "username": "...", "password": "..." } ] }`
- `customer.json` – `{ "username", "password" }` (preferred for CUSTOMER)
- `staff.json` – `{ "username", "password" }` – STAFF exists only on clone DBs; without it the STAFF role test is skipped
- `<role>.json` – same shape for any other role in a roles matrix (e.g. `manager.json`)

## Groups and tags

| Group | Files | Content |
|---|---|---|
| `customer` | `customer.api`, `customer.ui`, `journeys.write` | guest pages/APIs, read-only CUSTOMER session, catalog filters/pager/price/search/selection (desktop+mobile, reduced motion, Motion Off), motion (navbar, marquee, theme menu, PDP CTA, Off toggle), nav listing pages; write: profile/favorites/history/cart, COD checkout + customer cancel, order to COMPLETED with stock/loyalty checks |
| `admin` | `admin.sweep`, `admin.write`, `journeys.write` | route sweep at 1440/390 (HTTP, final path, console/page errors, failed responses, overflow, labels, clipping, occlusion, tokens, link health), reset buttons, injected-503 recovery, product-form states; write: customer/HR/account/category/product-draft (never published)/import+export (multi-line, real pointer+keyboard)/stocktake/promotion/loyalty edit+restore/order advance+cancel+cash collection |
| `roles` | `roles` | ADMIN vs STAFF vs CUSTOMER vs GUEST driven by `fixtures/roles-matrix*.json` (routes, sidebar, API reads/writes, labels) |
| `ai` | `ai` | text / image / multimodal search through the FE with named results and image bytes; input validation |
| `payments` | `payments` | BE read-only contract checks: methods, unsigned IPN rejected, webhook verb/signature. **No provider is ever called.** |

Browser feature probes: the catalog/motion UI checks are skipped (with the reason) on builds that lack the catalog
filter panel / motion header (e.g. the frozen baseline).

### Roles matrix (ADMIN / Quản lý / CUSTOMER)

Copy `fixtures/roles-matrix.quan-ly.json`, change `roles.<ROLE>` entries (`allowedRoutes`, `deniedRoutes` with the
write control that must be absent, `sidebarRequired/Forbidden`, `allowedReads`, `deniedReads`, `deniedWrites` (must answer 403), `allowedWrites` (must succeed; `{{rand}}` in the body becomes a random suffix), optional
`displayLabel` that must appear in the admin shell) and run `E2E_ROLES_MATRIX=/path/to/copy.json E2E_GROUPS=roles npm run e2e`.
Add a `<role>.json` fixture for each new role. Denied-write and allowed-write probes run in write mode only (they need valid
bodies, so a regression could create data); in readonly mode they are skipped.

## Reports

`$E2E_RUN_DIR/summary.txt` (non-passing tests + counts) and `summary.json` (all tests with status/error), plus
`screenshots/<suite>/` only for failing browser suites. The spec reporter output is also printed to stdout.

## Known issues / expected results

- `G-ai5` (Vietnamese query relevance) is reported as TODO: the CLIP model is English-centric (known limit).
- Older builds still use the retired `/api/be` proxy for `/nu /hang-moi /sale /bo-suu-tap`; run with
  `E2E_KNOWN_FAILS="Nav listings"` to report that as TODO.
- `/quan-tri/khuyen-mai` and `/quan-tri/bao-cao` at 390px keep a wide data table (accepted in the Admin quality pass);
  reported as TODO.
- Browser suites use real timers around animations; the WSL clock occasionally jumps on this host and can cause a
  one-off timeout – re-run before treating a single timeout as a regression.
- Not ported: `auth-account-completion/verify-ui*.mjs` (tied to temporary order/fixture ids) – its API parts for
  loyalty tier/policy edit are covered by the admin write flow.

- Builds without the Admin quality-pass fixes (e.g. 3191 on 2026-11-05) fail the genuine regressions these tests encode: occluded receipt quantity/price inputs, filter reset not clearing the query, missing retry on injected 503, auth outage shown as 'no permission', product form stuck loading, and the `/xem-truoc` preview 404 for published product ids. They pass on `cand/admin-quality-20261105` (3199).
- Denied-write probes of the roles matrix are skipped in readonly mode (they need a valid body; the BE validates before authorizing).

## BE integration tests

See `be/fasearch/scripts/it-db/README.md` (`run-it.sh` creates the isolated `fasearch_it_*` database in the Postgres
container, exports `PROMOTION_TEST_DB_*` / `DEMO_TEST_DB_*` and runs `./mvnw -o test`).
