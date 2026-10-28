# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `payment` (100% COMPLETED: FR-42, FR-43):
    - `FR-42`: Order payment calculation (`POST /api/v1/payments/calculate`) calculating item subtotal, voucher discounts, point redemptions (1 point = 1,000 VNĐ), shipping fee, 8% VAT, and final payable amount with customer ownership and terminal order state guards.
    - `FR-43`: Payment processing & Invoice generation (`GET /api/v1/payments/methods`, `POST /api/v1/payments/process`, Flyway migration `V9__refactor_invoice_and_payment_tables.sql`) supporting cash change calculation, omnichannel inventory deduction for POS draft orders (`DRAFT` -> `COMPLETED`), online order status transition (`PENDING` -> `CONFIRMED`), unique invoice code generation (`HD-YYYYMMDD-XXX`), customer loyalty points accrual (100,000 VNĐ = 1 point), and transaction persistence in `hoa_don` & `thanh_toan`.
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
- **In-progress Task:** Module 8 (`payment`) is 100% completed. Ready to proceed to Module 9 (`promotion`: FR-44 to FR-47).
- **Next Immediate Actions:**
  1. Follow AGENTS.md 3-step process to clarify database schema, voucher lifecycle (`VoucherStatus`: `UPCOMING`, `ACTIVE`, `EXPIRED`, `DISABLED`), and API specifications for `FR-44` (Promotion list & filtering).
- **Technical Gotchas & Constraints:**
  - Payment processing (`POST /api/v1/payments/process`): Checks order existence and terminal states (`CANCELLED`, `RETURNED`), rejects already paid orders (`ORDER_ALREADY_PAID`), enforces customer ownership, verifies payment methods (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`), calculates cash change for cash payments (`PAYMENT_AMOUNT_INSUFFICIENT` if `amountPaid < totalAmount`), auto-generates invoice code `HD-YYYYMMDD-XXX`, persists `Invoice` (`hoa_don`) and `Payment` (`thanh_toan`), awards customer loyalty points (100,000 VNĐ = 1 pt), and handles omnichannel inventory deduction for POS draft orders (`OrderStatus.DRAFT` -> `OrderStatus.COMPLETED`).
  - Active payment methods list (`GET /api/v1/payments/methods`): Publicly accessible in `PUBLIC_ENDPOINTS`, returns active methods seeded via migration `V9`.
  - Payment calculation (`POST /api/v1/payments/calculate`): Validates order existence, prevents calculation on `CANCELLED`/`RETURNED` orders, enforces customer ownership isolation, validates point redemption against customer available points (1 pt = 1,000 VNĐ), and computes 8% VAT on final payable amount.
  - Automated shipping fee calculation (`POST /api/v1/orders/calculate-shipping-fee`): Public access in `PUBLIC_ENDPOINTS`; calculates base rate (TP.HCM: 25k, major hubs: 30k, other provinces: 35k) and 5k / 500g surcharge for weight > 2000g.
  - POS Draft Orders (`DRAFT`): Do NOT reserve stock (`reservedStock` remains unchanged) to prevent holding inventory for undecided in-store shoppers. When cancelling, only non-draft orders restore reserved stock. Transitioning `DRAFT` via standard `updateOrderStatus` is blocked.
  - Order entity `customer` is nullable (`ma_kh` nullable) to accommodate walk-in POS customers without registered accounts.
  - Order cancellation (`POST /api/v1/orders/{id}/cancel`): Customer can only cancel `PENDING` or `CONFIRMED` orders; `ADMIN`/`STAFF` can cancel anytime before terminal status. Releases reserved stock (`availableStock += quantity`, `reservedStock -= quantity`).
  - Sequential order status transitions: strictly `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`. Closed orders (`CANCELLED`, `COMPLETED`, `RETURNED`) cannot be transitioned.
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

### [Session 25] Implemented FR-43 (Process Payment & Generate Invoice) in Payment Module (2026-10-29)
- **Done:**
  - Created Flyway migration `V9__refactor_invoice_and_payment_tables.sql`: added `ma_hd`, `ma_nv`, `tien_khach_dua`, `tien_thua`, `ghi_chu` to `hoa_don`; added `ma_giao_dich`, `ghi_chu`, `da_xoa` to `thanh_toan`; widened `thue_vat` to `DECIMAL(15, 2)`; seeded 4 active payment methods (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`).
  - Added payment error codes in `ErrorCode.java`: `INVOICE_NOT_FOUND` (404), `ORDER_ALREADY_PAID` (400), `PAYMENT_METHOD_NOT_FOUND` (404), `PAYMENT_AMOUNT_INSUFFICIENT` (400).
  - Created JPA Entities with Hibernate 6 `@SQLRestriction("da_xoa = false")`:
    - `PaymentMethod.java` (`phuong_thuc_thanh_toan`).
    - `Invoice.java` (`hoa_don` with `invoiceCode`, `order`, `employee`, `vatAmount`, `totalActualPaid`, `cashReceived`, `cashChange`, `status`, `note`).
    - `Payment.java` (`thanh_toan` with `invoice`, `paymentMethod`, `amount`, `paymentTime`, `transactionCode`, `status`, `note`).
  - Created Spring Data JPA repositories in `modules.payment.repository`: `PaymentMethodRepository`, `InvoiceRepository`, `PaymentRepository`.
  - Created DTOs in `modules.payment.dto`: `PaymentMethodRes`, `PaymentProcessReq` (`@NotNull orderId`, `@NotNull paymentMethodCode`, `@NotNull @DecimalMin("0.0") amountPaid`, `note`), and `InvoiceRes`.
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
  - Created DTOs in `modules.payment.dto`: `PaymentCalculateReq` (validated with `@NotNull orderId`, `@Min(0) redeemedPoints`, optional `voucherCode`) and `PaymentCalculationRes` (`subTotal`, `voucherDiscount`, `pointDiscount`, `shippingFee`, `taxVat`, `finalAmount`).
  - Created `PaymentService` & `PaymentServiceImpl`:
    - `POST /api/v1/payments/calculate`: Validates order existence and terminal states (`CANCELLED`, `RETURNED`); enforces customer ownership isolation (returns 403 `FORBIDDEN` if foreign order accessed by `CUSTOMER`); computes line item subtotal from `order.getDetails()`; computes voucher discount; computes point redemption discount (1 point = 1,000 VNĐ, verified against `customer.accumulatePoint`); calculates net product total, adds delivery `shippingFee`, and computes 8% VAT.
  - Created `PaymentController` with `POST /api/v1/payments/calculate`, protected by `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")`, returning `ApiResponse<PaymentCalculationRes>` with HTTP 200 OK.
  - Updated `SecurityConfig` authorizing `POST /api/v1/payments/calculate` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking `FR-42` as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (165 source files, 0 errors, 0 warnings).

### [Session 23] Implemented FR-41 (Shipping Fee Calculation) & Verified FR-40 in Order Module (2026-10-28)
- **Done:**
  - Created DTOs: `ShippingFeeCalcReq` (validated with `@NotBlank province`, `@NotBlank district`, `@NotNull @Min(1) totalWeightGram`) and `ShippingFeeRes` (`shippingFee`, `estimatedDays`).
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

### [Session 21] Implemented FR-38 (Cancel Order) in Order Module (2026-10-28)
- **Done:**
  - Created DTO: `OrderCancelReq` (`reason`).
  - Updated `OrderService` & `OrderServiceImpl`: `POST /api/v1/orders/{id}/cancel` validating non-terminal states, checking role permissions (`CUSTOMER` can only cancel `PENDING`/`CONFIRMED`, `ADMIN`/`STAFF` can cancel prior to completion), releasing reserved stock back to available stock in `ton_kho`, and appending timestamped audit notes into `order.note`.
  - Updated `OrderController`: Added `POST /api/v1/orders/{id}/cancel`, returning `ApiResponse<OrderDetailRes>` with HTTP 200 OK.
  - Updated `SecurityConfig`: Configured `POST /api/v1/orders/*/cancel` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking FR-38 as completed (`X`).
  - Updated `be_docs/api/api-order.md` with cancel order documentation.
- **Build Status:** `BUILD SUCCESS` (156 source files, 0 errors, 0 warnings).
