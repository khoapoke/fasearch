# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Active task:** `admin-polish` (Session ADM-2) — permissions V27, loyalty ADJUST V26, analytics overview, Barcode scan; full suite 639/639.
- **Previous task:** `admin-benefits-reports-completion` (BE lane) — candidate `18156` / DB `fasearch_admin_benefits_reports_20261103` (V20) / read-only analytics LIVE; S1 benefits endpoints verified. Contract: `.agent/tasks/admin-benefits-reports-completion/live/be/CONTRACT.md`.
- **Previous task:** `customer-catalog-detail-r5` (BE lane) — candidate `18154` / DB `fasearch_catalog_detail_r5_20261103` (V20) / taxonomy repaired to 12 canonical buckets / with-counts + sentinel flags live; AI 8024 read-only reuse. Contract: `.agent/tasks/customer-catalog-detail-r5/live/be/CONTRACT.md`.
- **Previous task:** `customer-storefront-refinement-r3` (BE lane) — candidate `18150` / AI `8022` / DB `fasearch_storefront_r3_20261102` / index `storefront_r3_v1`. Catalog expanded from verified first-party VN + global feeds (1,259 published products), real CLIP index, brand filter and search proxies verified. Contract: `.agent/tasks/customer-storefront-refinement-r3/live/be/CONTRACT.md`.
- **Completed Tasks:**
  - Module `search` (100% COMPLETED: FR-NC1, FR-NC2, FR-NC3):
    - `FR-NC1`: Text Search (`POST /api/v1/search/text`) querying CLIP vector embeddings in Qdrant via FastAPI AI Service.
    - `FR-NC2`: Image Search (`POST /api/v1/search/image`) uploading reference image binary and retrieving visually similar products.
    - `FR-NC3`: Multimodal Search (`POST /api/v1/search/multimodal`) combining reference image and modifying text query with configurable `text_weight`.
  - Module `payment` S1 baseline (FR-42, FR-43 historically completed; S2 loyalty settlement replacement is active):
    - `FR-42`: Order payment calculation (`POST /api/v1/payments/calculate`).
    - `FR-43`: Payment processing & Invoice generation (`GET /api/v1/payments/methods`, `POST /api/v1/payments/process`, Flyway migration `V9`).
  - Module `order` / `cart` (100% COMPLETED: FR-35A -> FR-41):
    - `FR-35A`: Online Cart Management (`GET /api/v1/cart`, `POST /api/v1/cart/items`, `PUT /api/v1/cart/items/{skuId}`, `DELETE /api/v1/cart/items/{skuId}`, `DELETE /api/v1/cart`).
    - `FR-35B`: Online Checkout (`POST /api/v1/orders/checkout`) with automatic stock reservation (`reservedStock` +, `availableStock` -) and cart clearing.
    - `FR-36`: View order list & detail (`GET /api/v1/orders`, `GET /api/v1/orders/{id}`) with role-based data isolation (`CUSTOMER` sees own orders, `ADMIN`/`STAFF` see all with multi-criteria filtering).
    - `FR-37`: Sequential order status transition (`PATCH /api/v1/orders/{id}/status`: `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`) with employee tracking and automatic inventory release & physical deduction upon completion.
    - `FR-38`: Cancel Order (`POST /api/v1/orders/{id}/cancel`) with permission validation (`CUSTOMER` can only cancel `PENDING`/`CONFIRMED`, `ADMIN`/`STAFF` can cancel prior to completion), audit notes, and automatic inventory reserved stock restoration (`availableStock += quantity`, `reservedStock -= quantity`).
    - `FR-39`: POS Draft Order management (`POST /api/v1/orders/pos/draft` & `GET /api/v1/orders/pos/drafts`) for cashiers to temporarily save cart while serving subsequent customers, with `DRAFT` status, walk-in customer support (nullable customer), and stock availability checks.
    - `FR-40`: Automated Stock Reservation & Release (`SYS`) - built-in atomic stock locking upon checkout, physical deduction upon delivery completion, and release upon cancellation.
    - `FR-41`: Automated Shipping Fee Calculation (`POST /api/v1/orders/calculate-shipping-fee`) calculating real-time delivery fee and estimated delivery days based on destination and package weight (>2000g surcharge).
  - Module `inventory`: `FR-29` -> `FR-32` (Stock search, Import receipts, Export receipts, Stocktaking).
  - Module `product` & `category`: `FR-21` -> `FR-28` (Category CRUD, Product search, create, update, delete, Variant CRUD, Barcode export, POS lookup).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **Active Task:** Brand catalog / AI mapping / sandbox payments on `codex/brand-catalog-payments-be` (base `9b2e32ca`). Added additive V14 brand schema, brand read API/logo serving, product brand/model fields and exact brand filter; added deterministic guarded brand importer (`scripts/import_brand_catalog.py`) with seed-only stock default and explicit `--update-stock` guard. Added V15 payment-attempt/event skeleton, Stripe/VNPAY signature verifiers, focused unit tests. No candidate runtime/DB/index yet; external provider E2E and credentials remain pending.
- **Next Immediate Actions:** run focused build/tests, publish exact pins/progress, then build candidate DB/AI index when FE manifest arrives; no provider PAID claims or public IPN exposure.
- **Technical Gotchas & Constraints:**
  - AI Search (`POST /api/v1/search/**`): Public endpoints in `PUBLIC_ENDPOINTS` (`/api/v1/search/**`); callers do not require authentication.
  - Integration with FastAPI AI Server (`ai-service.base-url: http://localhost:8000`) using Spring 6 `RestClient` in `FashionAiClient`.
  - Automatically computes `fullImageUrl = base-url + imagePath` for instant frontend rendering.
  - Resilient product enrichment: safely tolerates `product_id == null` in test datasets, while enriching with `Product` data (`productName`, `price`, `status`) when a valid `product_id` matches the database.
  - Image file validation: checks non-empty, supported extensions (`.png`, `.jpg`, `.jpeg`, `.webp`), and size limit ($\le 10\text{MB}$).
  - Connection resilience: catches connection refusals / timeouts and throws `AI_SERVICE_UNAVAILABLE` (503).
  - Loyalty gotcha: historical S1 payment code had a fixed-rate award, and historical preview docs used a fixed point conversion. These are not S2 defaults. For orders with an S2 policy snapshot, one settlement authority uses immutable policy version and `Invoice.totalActualPaid`; no second legacy award runs. Pre-S2 non-voucher point calculation remains display-only; pre-S2 orders receive no retroactive S2 earning/redemption. Unknown invoice coverage remains null, not zero.
  - Promotions-checkout S1 uses the isolated candidate contract revision 2 (SHA-256 `734e0db49016c427efb1ec242214cb097c876565445b149bb651614a943aae82`), migration V10, DB `fasearch_promotions_checkout_20261030` on PG55440, and loopback BE18124 only. Exact source/JAR/data pins and retained synthetic fixtures are in the shared `live/be/BE-HANDOFF-S1.md`; no parent DB or BE18122 changes.
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

- F-LINK-01 (Control finding, fixed): the seeder quoted vouchers but omitted voucherCode/fingerprint/expectedMerchandiseAmountDue at checkout, so the 6 planned voucher orders settled full-price. Fixed run_order to send all three + assert persisted voucherCode/discount>0 from GET detail before proceeding. Added 3 supplemental API journeys (2 voucher-paid COMPLETED + 1 voucher-cancelled): idx 60 id 78 (voucher 457,000, invoice HD-20261103-037 PAID 4,113,000, usage CONSUMED, stock deducted, ledger EARN), idx 61 id 79 (voucher 95,000, invoice HD-20261103-038 PAID 855,000, CONSUMED, EARN 34), idx 62 id 80 (voucher hold RELEASED on pre-handoff cancel, no invoice). 63 new orders, 44 paid total. Checkout-key idempotency verified live (burned-key reuse with different inputs -> 409; identical replay returns the same order flagged replayed=true and the seeder refuses to drive it). Manual idx 60/61 recording from direct verification after trailing tooling crashes (column names su_dung_voucher, manifest status flag); no data rewritten.

### [Session ADM-2] Admin polish, permissions, loyalty tools, reports (2026-11-07..09)
- **Permissions (Flyway V27):** `quyen_vai_tro` (STAFF permission codes) + `nhat_ky_phan_quyen` (audit). `JwtAuthenticationFilter` adds `PERM_*` authorities per request (ADMIN implicit all, CUSTOMER none, fail closed). Every admin endpoint maps to one permission (`api-auth.md` section 15); `PermissionMatrixTest` fails on any unmapped endpoint. Editor API `GET/PUT /api/v1/auth/roles/STAFF/permissions`, `GET .../audit` (ADMIN only). Self role/status change refused; trash restore of ADMIN-linked profiles needs ADMIN.
- **Loyalty (Flyway V26):** ledger type `ADJUST` (signed delta, reason, note, actor, idempotency key); `POST /api/v1/quan-tri/thanh-vien/khach-hang/{id}/dieu-chinh`, history `GET .../lich-su`, recalc `GET|POST /don-hang/{id}/tinh-lai-diem` reusing the normal earn path (one `earn:<orderId>` per order; refuses LEGACY_UNTRACKED, NO_POLICY_AT_CHECKOUT, VOUCHER_NO_EARN, ALREADY_EARNED). Permission `LOYALTY_ADJUST`, off for STAFF by default.
- **Reports:** `GET /api/v1/analytics/overview` (KPIs with previous period, revenue by category, orders by status, payment methods, top customers); inventory movement now fills Nhập/Hỏng from completed receipts; all paid-invoice queries exclude soft-deleted orders.
- **Other:** `GET /api/v1/products/variants/scan-lookup` (Barcode scan), `ProductDetailRes.publicationStatus`, orders list `startDate`/`endDate` half-open, category names unique ignoring case, ~190 user-facing messages in Vietnamese.
- **Tests:** full suite 639/639 on an isolated Postgres 16 (`max_connections=600`; the shared 55442 instance must not run the full suite).

### [Session PDP-1] Product reviews module (2026-11-05)
- Candidate branch `cand/pdp-engage-20261105`; clone DB `fasearch_cand_pdp_20261105` (V23); BE `18181`.
- Added module `review` (entity/repository/service/controller/dto) + Flyway `V23__product_review.sql` (additive table `product_review`, partial unique `(product_id, account_id)` where `da_xoa=false`, CHECK rating 1-5, size_fit NHO/VUA/RONG).
- Public `GET /api/v1/reviews/products/{id}` (+`/summary`); CUSTOMER `GET .../me`, `POST/PUT/DELETE` (needs a `COMPLETED` order containing the product); ADMIN/STAFF `GET /api/v1/admin/reviews`, `PATCH .../{id}/visibility`.
- Error codes `4301 REVIEW_NOT_ELIGIBLE`, `4302 REVIEW_ALREADY_EXISTS`, `4303 REVIEW_NOT_FOUND`. Docs: `be_docs/api/api-review.md` (FR-NC4..NC6). IT: `ProductReviewApiIntegrationTest` (6 tests, `scripts/it-db/run-it.sh`).
- Mock review rows are seeded by a script, not a migration (`.agent/tasks/pdp-engage-20261105/live/seed-reviews.py`), clone DB only.
### [Session AIL-1] AI search returns live products (2026-11-05)
- **Root cause:** `/api/v1/search/*` returned raw AI hits (dataset image proxy, `fileName`/`catalog`, product fields optional, per-hit `findById`); FE BFF hard-coded `nguonDuLieu: "AI dataset"` and the page showed "Nguồn dữ liệu / Danh mục AI / Tệp", with a provenance line "chưa gắn sản phẩm đang bán".
- **Change:** `SearchServiceImpl` over-fetches `min(24, 3×limit)` from AI, dedupes by `productId` (best score), then hydrates with ONE batched query (`ProductRepository.findLiveInStockByIdIn` + `findInStockColorsByProductIdIn`): not soft-deleted, `PUBLISHED`, `ACTIVE`, ≥1 variant with `so_luong_kha_dung > 0`; truncates to `limit`. `ProductSearchItemRes` is now card data (`id,score,productId,productName,brandName,price,imageUrl,colors,status`); dataset fields removed. `GET /search/images/{fileName}` kept as debug only. Docs: `be_docs/api/api-search.md`.
- **Test:** `SearchLiveHydrationIntegrationTest` (mocked AI client, isolated `fasearch_it_*` DB). Candidate runtime: BE 18182 / FE 3212 / DB `fasearch_cand_ailive_20261105`; AI 8024 search only (reconciler interval disabled in the candidate env).

### [Session ALD-1] Admin linked demo data (2026-11-03)
- New isolated candidate: BE `18158` / DB `fasearch_admin_linked_demo_20261103` (V20, role-owned clone of ABR; media/AI read-only reuse). Parent ABR 18156/DB and all older runtimes untouched; pool max 2 / min 0, no global/PG changes. JAR `664bb8...` (only the missing-param handler added).
- Stage 1: added `MissingServletRequestParameterException` -> 400 to GlobalExceptionHandler (same file convention as the type-mismatch handler). Authenticated missing year/startDate now 400 with the parameter named; anon 401 and CUSTOMER 403 preserved. Narrow tests (2 unit + live matrix). Root cause: DefaultHandlerExceptionResolver.sendError collided with the security chain.
- Stage 2: `scripts/seed_linked_demo_orders.py` (idempotent, run-key ABR-DEMO-20261103-v1): exactly 60 orders via real APIs (36 COMPLETED+CASH/PAID, 8 SHIPPING, 4 CONFIRMED, 4 PACKING, 4 PENDING, 4 CANCELLED), 10 synthetic @example.test customers, one multi-line import receipt top-up (unit price, documented), 1 ABR-DEMO campaign + ABR-DEMO-10 code activated, voucher subset settled at SHIPPING by ADMIN per COD rule. No ad-hoc PAID/stock SQL, no backdating. Manifest has per-order invoice/paid/stock/ledger + before/after snapshots; reruns resume and skip recorded indexes.
- Reconciled: 42 paid / 110,827,000 (Nov 2: 6/10,407,000 baseline; Nov 3: 36/100,420,000 new); Nike Dunk Low top qty 6; sku-level deltas match reservation->deduction; cancelled rows released, unpaid hold reservations. Voucher orders paid only at SHIPPING by staff-role (ADMIN here), per service guard.
- Gotchas: LocalDateTime rejects offset datetimes (use naive local ISO in scripts); Shopify-style "Title" option + UNKNOWN size are presentation sentinels (R5 flags), not real choices; customer register-then-login needs incremental manifest writes or passwords are lost on crash; import receipt needs importPrice>0 per line; voucher campaign defaults TAM_DUNG (must PUT HOAT_DUNG with version); pickleball-style names need word-boundary matching care.
### [Session ABR-1] Admin benefits + reports completion (2026-11-03)
- New isolated candidate: BE `18156` / DB `fasearch_admin_benefits_reports_20261103` (role-owned clone of R5, schema V20, no new migration; R5 media namespace read-only reused). Parent R5/3169/18152 and all older runtimes untouched; pool max 2 / min 0, no global/PG changes. JAR `39435614...` (new: analytics module only).
- S1 verified live with ADMIN JWT: promotions list 200 (4 campaigns)/detail 200/create 201 (new rows default TAM_DUNG, no auto-enable)/codes 201; loyalty policies 200 (5)/balance 200; anon 401, CUSTOMER 403 on admin writes; public promotions 200. Discount enum is PHAN_TRAM/SO_TIEN; LocalDateTime fields reject offset datetimes (test bug, not BE). Disposable [ABR-TEST] campaign id 5 + code left tagged in the new DB. Double campaign submit creates a second row (no idempotency key in contract) — recorded, not changed.
- S2 implemented read-only `modules/analytics` (controller/DTO/service/repo, no schema edit): revenue/top-products/inventory-movement, ADMIN only; PAID-only settlement, channel ALL-only (no channel column), COGS/grossProfit null (no cost history), opening/import/damaged null (no warehouse/opening/detail history) + explicit coverage object. Reconciled live: 10,407,000 = 6 paid invoices; Nike Blazer qty 3 (2 PENDING lines excluded); sku 1 sold 1/available 12. Focused math/boundary tests 6/6; PublishServiceTest 10/10 still green.
- Gotchas: `docker exec` without `-i` drops piped SQL; Mockito List.of needs explicit <Object[]> witness for Object[] stubbing; PageResponse lives in com.springboot.fasearch.shared.
