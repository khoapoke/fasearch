# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `search` (100% COMPLETED: FR-NC1, FR-NC2, FR-NC3):
    - `FR-NC1`: Text Search (`POST /api/v1/search/text`) querying CLIP vector embeddings in Qdrant via FastAPI AI Service.
    - `FR-NC2`: Image Search (`POST /api/v1/search/image`) uploading reference image binary and retrieving visually similar products.
    - `FR-NC3`: Multimodal Search (`POST /api/v1/search/multimodal`) combining reference image and modifying text query with configurable `text_weight`.
  - Module `payment` (100% COMPLETED: FR-42, FR-43):
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
- **In-progress Task:** Module 5 (`search`) is 100% completed. Ready to proceed to Module 9 (`promotion`: FR-44 to FR-47).
- **Next Immediate Actions:**
  1. Follow AGENTS.md 3-step process to clarify database schema, voucher lifecycle (`VoucherStatus`: `UPCOMING`, `ACTIVE`, `EXPIRED`, `DISABLED`), and API specifications for `FR-44` (Promotion list & filtering).
- **Technical Gotchas & Constraints:**
  - AI Search (`POST /api/v1/search/**`): Public endpoints in `PUBLIC_ENDPOINTS` (`/api/v1/search/**`); callers do not require authentication.
  - Integration with FastAPI AI Server (`ai-service.base-url: http://localhost:8000`) using Spring 6 `RestClient` in `FashionAiClient`.
  - Automatically computes `fullImageUrl = base-url + imagePath` for instant frontend rendering.
  - Resilient product enrichment: safely tolerates `product_id == null` in test datasets, while enriching with `Product` data (`productName`, `price`, `status`) when a valid `product_id` matches the database.
  - Image file validation: checks non-empty, supported extensions (`.png`, `.jpg`, `.jpeg`, `.webp`), and size limit ($\le 10\text{MB}$).
  - Connection resilience: catches connection refusals / timeouts and throws `AI_SERVICE_UNAVAILABLE` (503).
  - Payment processing (`POST /api/v1/payments/process`): Checks order existence and terminal states (`CANCELLED`, `RETURNED`), rejects already paid orders (`ORDER_ALREADY_PAID`), enforces customer ownership, verifies payment methods (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`), calculates cash change for cash payments, auto-generates invoice code `HD-YYYYMMDD-XXX`, persists `Invoice` & `Payment`, awards customer loyalty points (100,000 VNĐ = 1 pt), and handles omnichannel inventory deduction for POS draft orders (`OrderStatus.DRAFT` -> `OrderStatus.COMPLETED`).
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

### [Session 26] Implemented Module 5 (AI Search: FR-NC1, FR-NC2, FR-NC3) (2026-10-30)
- **Done:**
  - Configured `ai-service.base-url`, `api-prefix`, and `timeout-seconds` in `application.yaml`.
  - Added AI search error codes in `ErrorCode.java`: `AI_SERVICE_UNAVAILABLE` (503), `INVALID_IMAGE_FILE` (400).
  - Created DTOs in `modules.search.dto`:
    - `ai/AiApiResponse.java`, `ai/AiSearchData.java`, `ai/AiSearchResultItem.java`, `ai/AiTextSearchReq.java` for FastAPI communication.
    - `request/TextSearchReq.java` (validated `@NotBlank query`, `@Min(1) @Max(24) limit`).
    - `response/ProductSearchItemRes.java` (`id`, `score`, `imagePath`, `fullImageUrl`, `fileName`, `catalog`, `productId`, `productName`, `price`, `status`) and `response/AiSearchRes.java`.
  - Created `FashionAiClient` using Spring 6 `RestClient`: implements `searchByText`, `searchByImage`, `searchMultimodal` with robust error wrapping into `AI_SERVICE_UNAVAILABLE`.
  - Created `SearchService` & `SearchServiceImpl`: validates input text & image files (`.png`, `.jpg`, `.jpeg`, `.webp`, $\le 10\text{MB}$), generates `fullImageUrl`, and enriches product details from `ProductRepository` when `productId` is present.
  - Created `SearchController` with:
    - `POST /api/v1/search/text` (FR-NC1)
    - `POST /api/v1/search/image` (FR-NC2)
    - `POST /api/v1/search/multimodal` (FR-NC3)
    - No `@Operation` Swagger annotations, all responses wrapped in `ApiResponse<AiSearchRes>`.
  - Updated `SecurityConfig`: added `/api/v1/search/**` to `PUBLIC_ENDPOINTS`.
  - Updated `be_docs/module.md` marking `FR-NC1`, `FR-NC2`, `FR-NC3` as completed (`X`). Module 5 is 100% completed.
- **Build Status:** `BUILD SUCCESS` (185 source files, 0 errors, 0 warnings).

### [Session 25] Implemented FR-43 (Process Payment & Generate Invoice) in Payment Module (2026-10-29)
- **Done:**
  - Created Flyway migration `V9__refactor_invoice_and_payment_tables.sql`: added `ma_hd`, `ma_nv`, `tien_khach_dua`, `tien_thua`, `ghi_chu` to `hoa_don`; added `ma_giao_dich`, `ghi_chu`, `da_xoa` to `thanh_toan`; widened `thue_vat` to `DECIMAL(15, 2)`; seeded 4 active payment methods (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`).
  - Added payment error codes in `ErrorCode.java`: `INVOICE_NOT_FOUND` (404), `ORDER_ALREADY_PAID` (400), `PAYMENT_METHOD_NOT_FOUND` (404), `PAYMENT_AMOUNT_INSUFFICIENT` (400).
  - Created JPA Entities with Hibernate 6 `@SQLRestriction("da_xoa = false")`: `PaymentMethod`, `Invoice`, `Payment`.
  - Created Spring Data JPA repositories in `modules.payment.repository`: `PaymentMethodRepository`, `InvoiceRepository`, `PaymentRepository`.
  - Created DTOs in `modules.payment.dto`: `PaymentMethodRes`, `PaymentProcessReq`, `InvoiceRes`.
  - Implemented `getPaymentMethods()` and `processPayment(PaymentProcessReq)` in `PaymentServiceImpl`:
    - Validates order existence, prevents payment on cancelled/returned orders, checks for duplicate payment (`ORDER_ALREADY_PAID`).
    - Validates customer ownership (403 `FORBIDDEN` if customer accesses foreign order).
    - Tracks cashier/admin in `invoice.employee` for internal staff checkout.
    - Validates cash payment amount sufficiency and computes `cashChange = cashReceived - totalAmount`.
    - Handles Omnichannel stock deduction for POS draft orders (`order.status == DRAFT`): deducts `physicalStock` and `availableStock` atomically in `ton_kho`, sets order status to `COMPLETED`.
    - Updates online order status from `PENDING` to `CONFIRMED`.
    - Auto-generates unique invoice code `HD-YYYYMMDD-XXX`.
    - Persists `Invoice` and `Payment` records with `PaymentStatus.PAID`.
    - Accrues customer loyalty points (1 point per 100,000 VNĐ paid) if customer is present.
  - Updated `PaymentController`: Added `GET /api/v1/payments/methods` (HTTP 200) and `POST /api/v1/payments/process` (HTTP 201), no `@Operation` annotations.
  - Updated `SecurityConfig`: Added `/api/v1/payments/methods` to `PUBLIC_ENDPOINTS` and authorized `POST /api/v1/payments/process` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking `FR-43` as completed (`X`). Module 8 is now 100% completed.
- **Build Status:** `BUILD SUCCESS` (174 source files, 0 errors, 0 warnings).

### [Session 24] Implemented FR-42 (Order Payment Calculation) in Payment Module (2026-10-29)
- **Done:**
  - Created DTOs in `modules.payment.dto`: `PaymentCalculateReq` and `PaymentCalculationRes`.
  - Created `PaymentService` & `PaymentServiceImpl`:
    - `POST /api/v1/payments/calculate`: Validates order existence and terminal states (`CANCELLED`, `RETURNED`); enforces customer ownership isolation (returns 403 `FORBIDDEN` if foreign order accessed by `CUSTOMER`); computes line item subtotal from `order.getDetails()`; computes voucher discount; computes point redemption discount (1 point = 1,000 VNĐ, verified against `customer.accumulatePoint`); calculates net product total, adds delivery `shippingFee`, and computes 8% VAT.
  - Created `PaymentController` with `POST /api/v1/payments/calculate`, protected by `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")`, returning `ApiResponse<PaymentCalculationRes>` with HTTP 200 OK.
  - Updated `SecurityConfig` authorizing `POST /api/v1/payments/calculate` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking `FR-42` as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (165 source files, 0 errors, 0 warnings).

### [Session 23] Implemented FR-41 (Shipping Fee Calculation) & Verified FR-40 in Order Module (2026-10-28)
- **Done:**
  - Created DTOs: `ShippingFeeCalcReq` and `ShippingFeeRes`.
  - Updated `OrderService` & `OrderServiceImpl`: `POST /api/v1/orders/calculate-shipping-fee`: Calculates real-time delivery fee based on destination location (TP.HCM 25,000 VNĐ; major cities 30,000 VNĐ; other provinces 35,000 VNĐ) and package weight (>2,000g surcharge). Returns `ShippingFeeRes` with estimated delivery days.
  - Updated `OrderController`: Added `POST /calculate-shipping-fee` returning `ApiResponse<ShippingFeeRes>` with HTTP 200 OK.
  - Updated `SecurityConfig`: Added `/api/v1/orders/calculate-shipping-fee` to `PUBLIC_ENDPOINTS`.
  - Verified and closed `FR-40` (Automated stock reservation on checkout, deduction on completion, and restoration on cancellation).
  - Updated `be_docs/module.md` marking both `FR-40` and `FR-41` as completed (`X`). Module 7 is now 100% completed.
- **Build Status:** `BUILD SUCCESS` (160 source files, 0 errors, 0 warnings).

### [Session 22] Implemented FR-39 (POS Draft Orders) in Order Module (2026-10-28)
- **Done:**
  - Added `DRAFT` status to `OrderStatus` enum.
  - Updated `Order` entity to make `customer` nullable (allowing POS walk-in customers).
  - Created DTOs: `PosDraftItemReq` and `PosDraftOrderReq`.
  - Updated `OrderRepository` with `findByStatusOrderByOrderDateDesc(OrderStatus.DRAFT)`.
  - Updated `OrderService` & `OrderServiceImpl`: `POST /api/v1/orders/pos/draft` (draft order creation) and `GET /api/v1/orders/pos/drafts` (list active drafts).
  - Enhanced `mapToOrderDetailRes` to safely handle nullable customer.
  - Added guard preventing `DRAFT` orders from transitioning via online order pipeline and skipping reserved stock release on cancellation.
  - Updated `OrderController`: Added `POST /api/v1/orders/pos/draft` (HTTP 201) and `GET /api/v1/orders/pos/drafts` (HTTP 200).
  - Updated `SecurityConfig`: Configured `/api/v1/orders/pos/**` for `ADMIN` and `STAFF`.
  - Updated `be_docs/module.md` marking FR-39 as completed (`X`).
  - Updated `be_docs/api/api-order.md` with complete request/response documentation.
- **Build Status:** `BUILD SUCCESS` (158 source files, 0 errors, 0 warnings).
