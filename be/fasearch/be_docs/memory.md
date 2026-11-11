# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Category merge (2026-11-10):** V34 merges normalized active duplicates, moves product/draft references, adds active-name index, and rejects conflicting category restores; see `today/cat-merge/REPORT.md`. FR-21 remains X.

- **BE test fixes (2026-11-10):** ProductReportIntegrationTest accepts an explicitly configured DEMO_TEST_DB_NAME without a lane-specific prefix. ReturnIntegrationTest reads product-level analytics columns and seeds completion one day inside the window; expired/future/unknown completion rejection remains covered. Product code unchanged. Evidence: `fasearch/.agent/tasks/admin-polish-20261107/today/fix-betests/READY.md`.

- **Report fix (2026-11-10):** FR-53 now groups live SKUs per product ID before ranking/slow filtering; DTO unchanged. Product quantity/revenue net refunds, stock summed once per SKU; inventory movement remains per SKU. Evidence: `fasearch/.agent/tasks/admin-polish-20261107/today/fix-report/READY.md`.

- **Active task:** `admin-polish` round 3 R1F — independent-review fixes, V31 (V28 unchanged); candidate 3211/18181 on disposable dev DB. Previous ADM-2 — permissions V27, loyalty ADJUST V26, analytics overview, Barcode scan; full suite 639/639.
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

### [Session CAT-MERGE] Gộp danh mục trùng (2026-11-10)
- V34 chọn danh mục theo số sản phẩm đang hoạt động rồi ID; chuyển sản phẩm và bản nháp, xóa mềm bản trùng và tạo chỉ mục tên hoạt động. Khôi phục trùng chuẩn hóa trả lỗi trùng tên. Test tích hợp PostgreSQL 16 cô lập và chi tiết áp dụng tại `today/cat-merge/REPORT.md`.

### [Session FIX-BETESTS] Sửa fixture và hợp đồng test BE (2026-11-10)
- Product report bỏ ràng buộc tên DB `it_fix_report_*`; vẫn bắt buộc DEMO_TEST_DB_NAME tường minh, không fallback vào DB ứng dụng.
- Product report rollback fixture bằng @Transactional để không cộng nhầm dữ liệu tháng 03/2001 vào AnalyticsOverviewIntegrationTest.
- Return analytics chọn theo product ID, kiểm tra net quantity ở cột 3, revenue ở cột 4 và every-SKU-zero ở cột 7. Giữ kiểm tra movement theo SKU, category, damaged, invoice/count/refund.
- Fixture xác nhận trigger có completed_at, sau đó đặt một ngày trước theo đồng hồ PostgreSQL; test cửa sổ vẫn từ chối 8 ngày trước, tương lai và NULL, chấp nhận một ngày trước. Không nới window/guard trong product code.
- Chỉ chạy bốn lớp được yêu cầu trên DB tạm `it_fixbe_*` ở Postgres dùng chung; snapshot source riêng tránh target thay đổi giữa các lane. Build BE qua locked-build.sh/daemon. Kết quả và giới hạn điều tra thời gian ghi ở `today/fix-betests/READY.md`. FR-53 đã X, không thay đổi tiến độ.

### [Session FIX-REPORT] Tổng hợp theo sản phẩm (2026-11-10)
- FR-53: one row per product across non-deleted SKUs, summed net quantity/revenue and available stock; SLOW_MOVING requires every SKU net quantity zero. Same DTO and REPORT_VIEW. Inventory movement query unchanged.
- ProductReportIntegrationTest uses a throwaway it_fix_report_* PostgreSQL with no web server, tests one/two selling SKUs, refunds, deleted SKUs, date boundary and no stock multiplication. FE adapter test preserves product totals and distinct IDs with identical names.
- Table, bars, help text and CSV use net sales/revenue and available-stock labels. Docs/index/tracker updated; Control ReturnService clock_timestamp() preserved. Build/UI/SQL evidence and final results: `today/fix-report/READY.md`.

### [Session R3-DOCS] Tài liệu round 3 (2026-11-10)
- Đổi/trả: khách gửi yêu cầu trên đơn của mình; quản trị duyệt, nhận hàng và hoàn tiền theo RETURN_VIEW, RETURN_PROCESS, RETURN_REFUND. Báo cáo trừ khoản hoàn.
- Đơn hàng hỗ trợ chọn nhiều đơn để cập nhật trạng thái và in hóa đơn/phiếu giao hàng. Thông báo gồm tùy chọn email, cảnh báo yêu thích và chuông quản trị theo quyền; nhật ký hoạt động có lọc và Export CSV.
- V28–V29 bổ sung đổi/trả và thông báo; V31–V32 sửa hai luồng, V33 bổ sung nhật ký. Tư vấn size chưa thấy trong trang sản phẩm hiện tại.
- Kiểm tra mapping API bằng `/tmp/fasearch-doc-coverage.py`; kết quả và các phần chưa hoàn thành nằm trong `r3-docs/READY.md`.

### [Session R3-N1] Thông báo đơn hàng, yêu thích và chuông quản trị (2026-11-09)
- Module `notification`, V29: transactional SQL signal/outbox captures order/return/stock/Publish price transitions. AFTER_COMMIT listeners wake a bounded background worker; 5s recovery poll; SKIP LOCKED and unique event keys. Snapshot survives restart and disappears on rollback. Delivery retry 3 times; dry-run default never invokes Brevo.
- Brevo send overload carries stable UUID idempotencyKey, handles accepted-key duplicates. first_attempt_at commits before HTTP; after 10 minutes stop ambiguous automatic retries rather than exceed provider dedupe window. Old five-argument auth emails keep their API. Publish version set before SKU operations can flush price early.
- CUSTOMER own preference controls order/return emails, checked again before send. Favorite stock/price alerts opt in separately; rate allowance shared per account/product, max one queued email/24h. Removed favorites/inactive accounts skipped. Admin bell filters count/list/read markers by ORDER_VIEW / RETURN_VIEW / INVENTORY_VIEW; existing permissions reused, matrix includes PERM_ANY.
- FE account opt-out, favorite toggles, 30s bell with read markers, keyboard dismissal and exact return deep links. BFF origin/JSON/body/path guards. Docs: api/api-notification.md and indices/auth/tracker. Evidence and READY: `fasearch/.agent/tasks/admin-polish-20261107/r3-n1/`.
- Dev V29 was applied by a shared build while being completed: only dev DB synchronized SQL function STABLE->VOLATILE and first_attempt_at, checksum final -2067723326. Historical scripts/results in dev-v29-sync.txt; fresh test DB runs current V29 unchanged. Native TCP pg-tcp.sh works in sandbox; socket mounts do not.
- Live test orders 93/94, returns 7/8: opt-out suppresses confirmed; eight expected DRY_RUN mails incl return and favorite, zero SENT. Product 51 stock fixtures exported then restored exactly via completed import, reserved stock preserved. Price Publish tested only in throwaway DB with AI client mocked; never Publish/Unpublish on live shared AI. Snapshots/screens and final checks are in N1 READY.
- Targeted Maven tests run from a clean /tmp/n1-test-source snapshot under flock to prevent shared target/classes/build races; create/drop it_n1_* DB. Never run full suite on shared Postgres. No servers launched manually, no Git mutation.

- F-LINK-01 (Control finding, fixed): the seeder quoted vouchers but omitted voucherCode/fingerprint/expectedMerchandiseAmountDue at checkout, so the 6 planned voucher orders settled full-price. Fixed run_order to send all three + assert persisted voucherCode/discount>0 from GET detail before proceeding. Added 3 supplemental API journeys (2 voucher-paid COMPLETED + 1 voucher-cancelled): idx 60 id 78 (voucher 457,000, invoice HD-20261103-037 PAID 4,113,000, usage CONSUMED, stock deducted, ledger EARN), idx 61 id 79 (voucher 95,000, invoice HD-20261103-038 PAID 855,000, CONSUMED, EARN 34), idx 62 id 80 (voucher hold RELEASED on pre-handoff cancel, no invoice). 63 new orders, 44 paid total. Checkout-key idempotency verified live (burned-key reuse with different inputs -> 409; identical replay returns the same order flagged replayed=true and the seeder refuses to drive it). Manual idx 60/61 recording from direct verification after trailing tooling crashes (column names su_dung_voucher, manifest status flag); no data rewritten.

### [Session R3-R1F] Sửa review trả hàng (2026-11-09)
- V31 bổ sung CANCELLED/cancel_reason, order_return_refund_attempt và chỉ mục; không sửa V28. APPROVED chưa nhận hàng có thể CANCEL qua decision/RETURN_PROCESS, bắt buộc lý do, không đổi kho/tiền/điểm, trả lại quota.
- Mọi phương thức ngoài Stripe hoàn thủ công có chứng từ. Stripe đối soát toàn bộ metadata, failed/canceled mới được khóa returnKey+attemptNumber mới; pending/unknown giữ đối soát, succeeded mới REFUNDED. Lưu lần thử khi provider lỗi, không ghi điểm/hóa đơn.
- Khóa/tính/kiểm tra khách, điểm, trạng thái trước Stripe; sau chỉ ghi kết quả. Hoàn redeemed trước reverse, giữ held. Số dư 0/reverse10/redeemed20 -> 10, thiếu0.
- API khách bỏ actor/refundActor/refundNote/lịch sử nội bộ; giữ lý do từ chối/hủy. FE picker tiếng Việt, lỗi chứng từ thực, parse status note, nhãn phương thức. Đơn trả hết hàng giữ phí ship: RETURNED/PAID, nhãn đã hoàn một phần + đã hoàn/đã trả, cả khi thiếu RETURN_VIEW.
- Báo cáo bỏ full-refund khỏi count/AOV, units net; Hỏng loại TRA-% không trừ thêm kho bán. Tier filter và CSV net, REFUNDED ghi Đã hoàn tiền. Admin return list 3 query/page, không detail mỗi dòng.
- Targeted 242/242 BE trên DB it_r1f_* tạo/drop, gồm PermissionMatrixTest; FE439/439 + tsc/eslint. Handoff/evidence: `.agent/tasks/admin-polish-20261107/r3-r1f/READY.md`. Không sửa notification/orders.tsx/print/admin bell; shared OrderService chỉ fillPaidPayment, test constructor được bổ sung mock publisher theo N1.
