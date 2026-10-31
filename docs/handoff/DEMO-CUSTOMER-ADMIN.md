# Customer and Admin source handoff

31 October 2026. Reviewed module snapshots assembled for teammate collaboration, not production acceptance.

## Provenance and scope

- Base BE/AI: `6713a461fdf8c0da97c1b4d81f05eb8a63d19962`, descendant of teammate develop `ccf4d899c3680b83bcfb8786af0a730600ff4aa3` (remote develop verified at handoff).
- Entire FE directory: exact approved source `396ade96a7ae338e77301e601afe59923813a31f`; only this handoff's FE README/env template differ. No unfinished `loyalty-reports-*` WIP is included.
- S1 promotions/voucher/COD pair had independent technical review and representative MANUAL_PASS. This is provenance, not a claim that the combined branch has passed a new runtime E2E or production gate.
- User requested immediate publication of the previous work instead of waiting for membership points. S2 points/tier/report work and later UI audit are deferred, not declared complete.

Included source covers Customer Home/catalog/product/AI/account/cart/COD/orders and Admin B+Inter order/product/SKU/category/inventory/receipts/stocktake/customer/employee/account/promotions work. Some legacy routes are present but unsupported against current BE: route existence is not completion.

## Local setup

Use Node22+ (the accepted FE was built on22.23.2), a JDK matching `be/fasearch/pom.xml` (Java21), PostgreSQL15+ (candidate used16), and Python3.12 for AI. Do not point a local demo at a production database.

1. Create a fresh disposable PostgreSQL database and local credentials. Copy `be/fasearch/.env.example` to `be/fasearch/.env`; set DB variables, generate your own random JWT key and choose expiration. Use actual values only in ignored local env files. `AI_SERVICE_URL` must point to the separately configured AI service.
2. From `be/fasearch`, run `./mvnw test-compile`, then `SERVER_PORT=8080 ./mvnw spring-boot:run`. Flyway applies tracked migrations throughV10 and configured seed scripts. Read `be_docs` and inspect seed account/data definitions before use; do not assume private PC demo accounts/dataset exist in a fresh clone. Check Swagger at `http://localhost:8080/swagger-ui/index.html`.
3. From `fe`, copy `.env.example` to `.env.local`. Keep all three backend URLs aligned to the same BE instance. Set `FASEARCH_AUTH_PILOT_ORIGIN` to the actual browser origin (`localhost` and `127.0.0.1` are different origins). Run `npm ci`, `npm run build -- --webpack`, then `npm run start -- --hostname 127.0.0.1 --port 3000`, or `npm run dev -- --hostname 127.0.0.1 --port 3000` for development. Open `http://127.0.0.1:3000`.
4. AI needs its own dataset/media/Qdrant collection and model configuration per `ai/README.md`. Do not run seed/index scripts against the PC's frozen research indexes. No weights/index/dataset/DB dump is distributed here. An unavailable AI backend is a genuine dependency, not a reason to invent search results.

This handoff does not include a clean-machine runtime/DB recreation acceptance. The current PC previews and data remain separate. Use module setup/docs and share credentials through a private channel, never Git or chat screenshots.

## Suggested viewing

- Customer: `/`, `/nam`, `/tim-kiem-ai`, `/dang-nhap`, `/tai-khoan`, `/gio-hang`, `/don-hang`.
- Admin: `/quan-tri`, `/quan-tri/don-hang`, `/quan-tri/san-pham`, `/quan-tri/danh-muc`, `/quan-tri/ton-kho`, `/quan-tri/phieu-nhap`, `/quan-tri/phieu-xuat`, `/quan-tri/kiem-ke`, `/quan-tri/khach-hang`, `/quan-tri/nhan-vien`, `/quan-tri/tai-khoan-noi-bo`, `/quan-tri/khuyen-mai`.
- Use CUSTOMER vs ADMIN/STAFF accounts provisioned on your own database. English AI examples such as `black shirt`, `blue jeans`, `black jacket` fit the current English-heavy data; no Vietnamese search-quality claim.
- Functional demo: select a real catalogSKU → cart → apply/remove an active voucher → COD → Admin fulfillment/collection → compare relative stock/usage. Do this on disposable data; do not reuse a developer's retained test fixture as a normal customer order.

## Known limitations and deferred work

- S2 loyalty/tier/points policy ledger and S3 reports are not delivered. Historical point snippets/legacy screens are not a completed auditable loyalty system.
- UI audit deferred by user: remove the preview/theme toolbar from product navigation; auth-aware Sign in/Account routing; profile layout/auth consistency; order-detail spacing/hierarchy and technical copy. The theme setting means OS light/dark, not device-size preview.
- A screenshot shows account identity present but profile load unauthorized. Root cause is not reproduced; treat as a functional known issue, not a claim of complete profile UX.
- FE396ade96 preserves ID-only legacy voucher order reads. Later checkout-response-hardening exists on other unpublished follow-up/S2 commits and is NOT in this approved snapshot. Shared validator can accept incomplete voucher metadata on a synthetic create response; independent Review did not observe malformed responses from the accepted BE. This known source-level guard gap is disclosed, not silently relabeled fixed.
- Order107 in retained PC test data is a header-only integration-test fixture with no lines; it must not be used to infer normal order subtotal correctness or filled with fabricated data.
- Stocktakes record counts; approval/apply adjustment, full warehouse transfers/ledger/alerts, carrier integration, returns/exchanges, provider payments/email, and full audit/reporting remain incomplete or unverified. No redirect proves payment and no real gateway integration is claimed.
- Old JWT revocation, device/browser/AT coverage, load, backup/restore and deployment gates are not established by this branch. No production-ready claim.
- Old UI routes may target historical APIs and have diagnostic/preview copy; only the scoped current routes have reviewed pilot evidence. Preserve approved Customer A/B2/Be Vietnam Pro and Admin B+Inter while adapting future UI to actual product context.

## Checks and next steps

Run FE `node --test tests/*.test.mjs`, TypeScript/lint/build and BE focused/full tests as appropriate. The branch contains previously reviewed snapshots; any new feature/fix requires independent exact-commit review and new runtime evidence. A pushed collaboration branch is not a merge, deployment, manual acceptance of S2, or a production release.
