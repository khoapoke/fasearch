# BE S2 v1.4 documentation and source parity record

**Status:** Owner-side source and isolated-database verification passed through 2026-10-31 16:51 +07. JAR/runtime pinning and independent S2 Review remain outstanding; this is not a READY verdict.

## Contract and acknowledged interface

- Authority: `live/be/S2/CONTRACT.md` / `CONTRACT-v1.4.md`, 23,280 bytes, SHA-256 `1a06061c8b35feeb50945f5b52be39b29f759d366518cb6c5fd6fc7966bad529`.
- Exact FE ACK: `live/fe/S2/ACK.json`; valid JSON, version `1.4`, state `ACK`, `dependentImplementationAuthorized=true`, exact contract hash above; current file SHA-256 `125f4d962577065f8847c7c65797fac7f6acbe60b8b8fd54cd31618d650dfbcf`. The earlier recorded `b1f49...` file digest is superseded; the acknowledged contract digest is unchanged.
- FE owner source: `codex/loyalty-reports-fe` HEAD `44ed8d0a87201b1a814b43c253dd5463e3d24758`; source manifest SHA-256 `34f3a0f7984ce217c0e256ab5d489919c7b6c08336b557d247581d6836784c0c`. Its final production build is `_e-QYDEvBai0kQMQJbJ0p`, recorded in `live/fe/S2/BUILD.json`. FE source is untouched by BE.
- The exact v1.4 FE ACK is the versioned wire approval for this S2 scope. The BE implementation is documented against those bytes; no new endpoint/field semantics are proposed. Any later wire delta must first receive its own exact versioned FE ACK. The old BE status statement that FE ACK JSON was invalid/unmatched is superseded and must not be repeated.

## Teammate-doc discrepancies reconciled

| Existing teammate documentation | v1.4/current S2 behavior | Candidate documentation update |
|---|---|---|
| `api-user.md` described `/api/v1/users/loyalty/tiers` and `/redeem`, fixed `1 point = 1,000 VND`, point-count tiers (500/2,000), and percentage benefits. | Those historical examples are not current S2 routes or policy. S2 uses `/api/v1/thanh-vien/**`, once-only opening, explicit versioned policy rates, and sales tiers based on covered paid invoice totals. | Replaced section 8; retained `tierId`/`thresholdPoint` legacy semantics and separated new `salesTierId`. |
| `api-payment.md` described fixed-rate calculation/earning as current and listed VNPAY URL/IPN routes absent from this candidate's controllers. | S2 calculation is snapshot-based and read-only. The old no-voucher preview is display-only and cannot authorize settlement. There are no external gateway endpoints in this candidate. | Rewrote payment API doc; made no gateway/provider changes. |
| Shared `PageResponse` serializes `last`; teammate examples used `isLast`. | Contract v1.4 uses `last`. | Corrected common/user/promotion/analytics examples. |
| `api-analytics.md` presented reports as current product APIs without the S3 gate. | S2 adds no analytics routes. XNT acceptance remains SKU×warehouse; available schema lacks required warehouse/history data. | Marked report docs as S3-only/not delivered by S2; did not implement reports or synthesize data. |

## Source convention audit

- Layers follow the neighboring interface/implementation layout: `LoyaltyService` + `LoyaltyServiceImpl`, DTOs under `modules/loyalty/dto`, entities/repositories in their standard packages, and existing order/payment/user/promotion service interfaces remain the integration seams.
- New policy/ledger/hold state uses English enums (`LoyaltyPolicyStatus`, `LoyaltyEntryType`, `LoyaltyHoldStatus`); wire DTO status strings remain contract names. All mutating service paths are transactional; read paths are read-only where appropriate. Direct profile/order response enrichment is limited to derived fields that cannot be mapped from one entity; existing `UserMapper` remains responsible for entity fields.
- Controllers use existing `ApiResponse` and `PageResponse`; role checks use `@PreAuthorize`; current JWT identity determines customer ownership. Loyalty/profile/quote/payment sensitive responses use `Cache-Control: no-store`. Stable `ErrorCode` 4201–4208 remain separate from HTTP 409; malformed points/policy values use HTTP 400.
- Contract-specific nullable values are serialized explicitly (`availablePoints`, incomplete paid sales, tier/policy identifiers); optional POS quote `orderId` is omitted for the ordinary cart quote. POS replay state stays internal to `PaymentService.PaymentResult`; it is represented by HTTP 200 and does not add an unacknowledged `InvoiceRes.replayed` wire field.

## Endpoint-to-contract map (owner implementation map; partial API and DB coverage below)

| Contract surface | BE path | Roles | Expected v1.4 behavior |
|---|---|---|---|
| Balance/history | `GET /api/v1/thanh-vien`, `/lich-su` | CUSTOMER | JWT-owned balance and append-only own ledger; page size capped at 100; unknown values remain null/statused. |
| Staff balance | `GET /api/v1/thanh-vien/khach-hang/{customerId}` | STAFF/ADMIN | Balance only, no customer ledger. |
| Policies/opening/tiers | `/api/v1/thanh-vien/chinh-sach/**`, `/api/v1/quan-tri/thanh-vien/mo-dau` | ADMIN | Versioned policy and tier updates; one explicit opening baseline; no implicit grant/default enable. |
| Customer profiles | `GET /api/v1/users/customers[/{id}]` | ADMIN/STAFF; customer self for detail | Preserve legacy fields; append cumulative paid sales and sales-tier status; keep legacy `tierId` separate. |
| Cart quote/checkout | `POST /api/v1/cart/quote`, `POST /api/v1/orders/checkout` | CUSTOMER | Preview-only quote; voucher first, points over remaining merchandise; exact fingerprint + expected amount at commit; shipping is outside fingerprint. |
| POS quote/payment | `POST /api/v1/orders/pos/{orderId}/quote`, `POST /api/v1/payments/process` | STAFF/ADMIN for POS | Persisted draft lines/customer, CASH-only atomic commit and replay, no customerless points. |
| Calculate/payment settlement | `POST /api/v1/payments/calculate`, `/process` | Existing order/payment roles | Calculation read-only; S2 settlement uses persisted policy snapshot and invoice actual paid once. |
| Analytics | no S2 endpoint added | — | S3 remains gated; no SKU-only XNT downgrade. |

## Current verification state — 2026-10-31 16:51 +07

- BE source remains uncommitted WIP on `codex/loyalty-reports-be`, based on frozen S1 BE `6713a461fdf8c0da97c1b4d81f05eb8a63d19962`. The additive V11 migration is applied to the retained isolated candidate DB `fasearch_loyalty_reports_20261031` on loopback 55442; Flyway validated all 20 migrations and reported schema version 11/up to date. The S1 input snapshot is unchanged; test-created synthetic rows are intentionally retained in the candidate DB.
- Verified task-local JDK `21.0.12.1`. `mvn -B -ntp test-compile` passed, compiling 233 main and 11 test sources; log: `/home/dolakhoa/projects/fasearch-migration/runtime/loyalty-s2-test-compile-after-api-tests-20261031T1643+0700.log`.
- PostgreSQL financial/transaction integration class passed 7/7 at `/home/dolakhoa/projects/fasearch-migration/runtime/loyalty-s2-postgres-tests-retry1-20261031T1629+0700.log`. The API integration class passed 3/3, including customer/staff/admin ownership, unknown-history nulls, default-disabled policy, once-only opening, disabled/stale policy errors, online hold/release/redeem/earn and paid-sales tiering, plus POS cash settlement/replay conflict; log: `/home/dolakhoa/projects/fasearch-migration/runtime/loyalty-s2-api-lifecycle-pass-20261031T1650+0700.log`.
- Final bounded full suite passed 41/41, 0 failures/errors/skips on the isolated candidate DB with all `DB_*`, `PROMOTION_TEST_DB_*`, and `DEMO_TEST_DB_*` variables bound to loopback 55442, Hikari max 2/minimum idle 0; log: `/home/dolakhoa/projects/fasearch-migration/runtime/loyalty-s2-full-tests-retry5-20261031T1658+0700.log`. No test used the prior 55440 database in this run.
- The new API RBAC test exposed method-level Spring Security denial being translated to HTTP 500 by the generic runtime handler. `GlobalExceptionHandler` now maps `AccessDeniedException` to the existing 403 `ACCESS_DENIED`; the API class and full suite pass with that fix.
- No S2 JAR has been packaged, no BE18126 runtime has been started, and independent source/runtime/DB Review remains NOT_RUN. S2 is not READY. S1 BE18124, its retained DB/snapshot, published candidate, FE source, and UI remain untouched; S3 remains out of scope.

Next: finish the narrow source/parity audit and `git diff --check`, create a clean source commit, package/hash the JAR, capture a read-only candidate-data snapshot/pin, then repeat capacity/port checks before starting only BE18126. Publish exact source/JAR/data/runtime evidence for independent Review; stop before the user's manual gate. Do not reset the candidate DB or clean retained test fixtures.
