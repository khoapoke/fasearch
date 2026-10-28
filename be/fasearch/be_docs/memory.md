# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `order` / `cart`:
    - `FR-35A`: Online Cart Management (`GET /api/v1/cart`, `POST /api/v1/cart/items`, `PUT /api/v1/cart/items/{skuId}`, `DELETE /api/v1/cart/items/{skuId}`, `DELETE /api/v1/cart`).
    - `FR-35B`: Online Checkout (`POST /api/v1/orders/checkout`) with automatic stock reservation (`reservedStock` +, `availableStock` -) and cart clearing.
    - `FR-36`: View order list & detail (`GET /api/v1/orders`, `GET /api/v1/orders/{id}`) with role-based data isolation (`CUSTOMER` sees own orders, `ADMIN`/`STAFF` see all with multi-criteria filtering).
    - `FR-37`: Sequential order status transition (`PATCH /api/v1/orders/{id}/status`: `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`) with employee tracking and automatic inventory release & physical deduction upon completion.
    - `FR-38`: Cancel Order (`POST /api/v1/orders/{id}/cancel`) with permission validation (`CUSTOMER` can only cancel `PENDING`/`CONFIRMED`, `ADMIN`/`STAFF` can cancel prior to completion), audit notes, and automatic inventory reserved stock restoration (`availableStock += quantity`, `reservedStock -= quantity`).
    - `FR-39`: POS Draft Order management (`POST /api/v1/orders/pos/draft` & `GET /api/v1/orders/pos/drafts`) for cashiers to temporarily save cart while serving subsequent customers, with `DRAFT` status, walk-in customer support (nullable customer), and stock availability checks.
    - `FR-40`: Automated Stock Reservation & Release (`SYS`) - built-in atomic stock locking upon checkout (`availableStock` -, `reservedStock` +), physical deduction upon delivery completion (`physicalStock` -, `reservedStock` -), and release upon cancellation (`availableStock` +, `reservedStock` -).
    - `FR-41`: Automated Shipping Fee Calculation (`POST /api/v1/orders/calculate-shipping-fee`) calculating real-time delivery fee and estimated delivery days based on destination (intra-city TP.HCM vs inter-provincial) and package weight (>2000g surcharge).
    *(Module 7 `order` & `cart` is 100% COMPLETED: FR-35A -> FR-41)*.
  - Module `payment`:
    - `FR-42`: Order payment calculation (`POST /api/v1/payments/calculate`) calculating item subtotal, voucher discounts, point redemptions (1 point = 1,000 VNĐ), shipping fee, 8% VAT, and final payable amount with customer ownership and terminal order state guards.
  - Module `inventory`:
    - `FR-29`: Paginated available stock search (`GET /api/v1/inventory/stock` & `GET /api/v1/inventory/stock/{skuId}`).
    - `FR-30`: Import receipt creation & automatic inventory stock accretion (`POST /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts/{id}`).
    - `FR-31`: Export receipt creation, warehouse transfer & damaged stock write-off (`POST /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts/{id}`).
    - `FR-32`: Stocktaking by barcode scanning (`POST /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes/{id}`).
  - Module `product` & `category` (100% COMPLETED): `FR-21` -> `FR-28` (Category CRUD, Product search, create, update, delete, Variant CRUD, Barcode export, POS lookup).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready to implement `FR-43` (Payment & Invoice Generation: `GET /api/v1/payments/methods`, `POST /api/v1/payments/process`, Flyway migration `V9`).
- **Next Immediate Actions:**
  1. Follow AGENTS.md 3-step process to clarify entities (`hoa_don`, `thanh_toan`, `phuong_thuc_thanh_toan`), cash change calculation, and omnichannel inventory deduction for `FR-43`.
- **Technical Gotchas & Constraints:**
  - Payment calculation (`POST /api/v1/payments/calculate`): Validates order existence, prevents calculation on `CANCELLED`/`RETURNED` orders, enforces customer ownership isolation, validates point redemption against customer available points (1 pt = 1,000 VNĐ), and computes 8% VAT on final payable amount.
  - Automated shipping fee calculation (`POST /api/v1/orders/calculate-shipping-fee`): Public access in `PUBLIC_ENDPOINTS`; calculates base rate (TP.HCM: 25k, major hubs: 30k, other provinces: 35k) and 5k / 500g surcharge for weight > 2000g.
  - POS Draft Orders (`DRAFT`): Do NOT reserve stock (`reservedStock` remains unchanged) to prevent holding inventory for undecided in-store shoppers. When cancelling, only non-draft orders restore reserved stock. Transitioning `DRAFT` via standard `updateOrderStatus` is blocked.
  - Order entity `customer` is nullable (`ma_kh` nullable) to accommodate walk-in POS customers without registered accounts.
  - Order cancellation (`POST /api/v1/orders/{id}/cancel`): Customer can only cancel `PENDING` or `CONFIRMED` orders; `ADMIN`/`STAFF` can cancel anytime before terminal status. Releases reserved stock (`availableStock += quantity`, `reservedStock -= quantity`).
  - Sequential order status transitions: strictly `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`. Closed orders (`CANCELLED`, `COMPLETED`, `RETURNED`) cannot be transitioned.
  - Completing an order (`COMPLETED`) atomically deducts `physicalStock` and releases `reservedStock` in `ton_kho`.
  - Auditing employee: `order.employee` updated with the `ADMIN`/`STAFF` performing status transition.
  - Role data isolation: `CUSTOMER` role automatically scoped to `customer.id = currentCustomer.id` in `GET /api/v1/orders` and forbidden on foreign order access in `GET /api/v1/orders/{id}`.
  - Multi-criteria specification filtering on `orderCode`, `status`, `customerPhone` (joined), and `orderDate` range (`startDate`, `endDate`).
  - Order Code generation format: `DH-YYYYMMDD-XXX` for online checkout, `POS-YYYYMMDD-XXX` for POS drafts with daily sequence increment.
  - Online checkout flow atomically reserves stock (`availableStock` -, `reservedStock` + in `ton_kho`) and clears customer's cart.
  - Delivery address fallbacks to `customer.address` if empty in request; custom receiver info (`receiverName`, `receiverPhone`) is neatly preserved in order `note`.
  - Cart item table `mat_hang_gio` uses composite PK `(ma_gio_hang, ma_sku)` referencing `bien_the_sp(ma_sku)` with hard delete.
  - Dynamic SKU pricing: `unitPrice = product.price + variant.additionalPrice`.
  - Lean Order refactoring: `don_hang` holds `ma_don` (Order Code), `ghi_chu`, `tien_giam`; payment transactions and methods are decoupled in Module 8 (`hoa_don`, `thanh_toan`).
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

### [Session 24] Implemented FR-42 (Order Payment Calculation) in Payment Module (2026-10-29)
- **Done:**
  - Created DTOs in `modules.payment.dto`: `PaymentCalculateReq` (validated with `@NotNull orderId`, `@Min(0) redeemedPoints`, optional `voucherCode`) and `PaymentCalculationRes` (`subTotal`, `voucherDiscount`, `pointDiscount`, `shippingFee`, `taxVat`, `finalAmount`).
  - Created `PaymentService` & `PaymentServiceImpl`:
    - `POST /api/v1/payments/calculate`:
      - Validates order existence and terminal states (`CANCELLED`, `RETURNED`).
      - Enforces customer ownership isolation (returns 403 `FORBIDDEN` if foreign order accessed by `CUSTOMER`).
      - Computes line item subtotal from `order.getDetails()`.
      - Computes voucher discount (supports `FASEARCH10` 10% voucher or order discount amount).
      - Computes point redemption discount (1 point = 1,000 VNĐ, verified against `customer.accumulatePoint`).
      - Calculates net product total, adds delivery `shippingFee`, and computes 8% VAT.
  - Created `PaymentController` with `POST /api/v1/payments/calculate`, protected by `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")`, returning `ApiResponse<PaymentCalculationRes>` with HTTP 200 OK.
  - Updated `SecurityConfig` authorizing `POST /api/v1/payments/calculate` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking `FR-42` as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (165 source files, 0 errors, 0 warnings).

### [Session 23] Implemented FR-41 (Shipping Fee Calculation) & Verified FR-40 in Order Module (2026-10-28)
- **Done:**
  - Created DTOs: `ShippingFeeCalcReq` (validated with `@NotBlank province`, `@NotBlank district`, `@NotNull @Min(1) totalWeightGram`) and `ShippingFeeRes` (`shippingFee`, `estimatedDays`).
  - Updated `OrderService` & `OrderServiceImpl`:
    - `POST /api/v1/orders/calculate-shipping-fee`: Calculates real-time delivery fee based on destination location (intra-city TP.HCM 25,000 VNĐ; major cities 30,000 VNĐ; other provinces 35,000 VNĐ) and package weight with overweight surcharge (5,000 VNĐ per 500g above 2,000g). Returns `ShippingFeeRes` with estimated delivery days ("1 - 2 ngày" / "2 - 3 ngày" / "3 - 5 ngày").
  - Updated `OrderController`: Added `POST /calculate-shipping-fee` returning `ApiResponse<ShippingFeeRes>` with HTTP 200 OK.
  - Updated `SecurityConfig`: Added `/api/v1/orders/calculate-shipping-fee` to `PUBLIC_ENDPOINTS` (accessible by both guests and authenticated customers).
  - Verified and closed `FR-40` (Automated stock reservation on checkout, deduction on completion, and restoration on cancellation).
  - Updated `be_docs/module.md` marking both `FR-40` and `FR-41` as completed (`X`). Module 7 is now 100% completed.
- **Build Status:** `BUILD SUCCESS` (160 source files, 0 errors, 0 warnings).

### [Session 22] Implemented FR-39 (POS Draft Orders) in Order Module (2026-10-28)
- **Done:**
  - Added `DRAFT` status to `OrderStatus` enum.
  - Updated `Order` entity to make `customer` nullable (allowing POS walk-in customers).
  - Created DTOs: `PosDraftItemReq` (validated with `@NotNull skuId`, `@Min(1) quantity`) and `PosDraftOrderReq` (validated with `@NotEmpty items`, optional `customerPhone`, optional `note`).
  - Updated `OrderRepository` with `findByStatusOrderByOrderDateDesc(OrderStatus.DRAFT)`.
  - Updated `OrderService` & `OrderServiceImpl`:
    - `POST /api/v1/orders/pos/draft`: Authenticates cashier, resolves customer by phone if registered (or notes phone for unregistered guests), validates variant existence and stock availability without holding reserved stock, auto-generates `POS-YYYYMMDD-XXX`, saves order in status `DRAFT`.
    - `GET /api/v1/orders/pos/drafts`: Lists all active POS drafts sorted newest first.
    - Enhanced `mapToOrderDetailRes` to safely handle nullable customer (`customer == null`).
    - Added guard in `updateOrderStatus` preventing `DRAFT` orders from transitioning via online order pipeline.
    - Added check in `cancelOrder` skipping reserved stock release when cancelling `DRAFT` orders.
  - Updated `OrderController`: Added `POST /api/v1/orders/pos/draft` (HTTP 201) and `GET /api/v1/orders/pos/drafts` (HTTP 200), protected with `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")`.
  - Updated `SecurityConfig`: Configured `/api/v1/orders/pos/**` for `ADMIN` and `STAFF`.
  - Updated `be_docs/module.md` marking FR-39 as completed (`X`).
  - Updated `be_docs/api/api-order.md` with complete request/response documentation for POS draft endpoints.
- **Build Status:** `BUILD SUCCESS` (158 source files, 0 errors, 0 warnings).

### [Session 21] Implemented FR-38 (Cancel Order) in Order Module (2026-10-28)
- **Done:**
  - Created DTO: `OrderCancelReq` (validated with `@NotBlank private String reason;`).
  - Updated `OrderService` & `OrderServiceImpl`:
    - `POST /api/v1/orders/{id}/cancel`:
      - Validates order is not in a terminal state (`CANCELLED`, `COMPLETED`, `RETURNED`).
      - Role-based cancellation permissions: `CUSTOMER` can cancel only when status is `PENDING` or `CONFIRMED` (throws 400 with guidance to contact staff if `PACKING`/`SHIPPING`, and checks order ownership throwing 403 `FORBIDDEN` if foreign order). `ADMIN` and `STAFF` can cancel any active order before completion.
      - Tracks staff in `order.employee` when cancelled by internal staff/admin.
      - Inventory restoration (FR-40): For every `OrderDetail`, atomically returns reserved stock back to available stock (`availableStock += quantity`, `reservedStock -= quantity`).
      - Appends timestamped audit note with actor role and cancel reason into `order.note`.
      - Updates order status to `OrderStatus.CANCELLED`.
  - Updated `OrderController`: Added `POST /api/v1/orders/{id}/cancel`, protected with `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")`, returning `ApiResponse<OrderDetailRes>` with HTTP 200 OK, no `@Operation` annotations.
  - Updated `SecurityConfig`: Configured `POST /api/v1/orders/*/cancel` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking FR-38 as completed (`X`).
  - Updated `be_docs/api/api-order.md` with cancel order documentation and response sample.
- **Build Status:** `BUILD SUCCESS` (156 source files, 0 errors, 0 warnings).

### [Session 20] Implemented FR-37 (Order Status Transition) in Order Module (2026-10-28)
- **Done:**
  - Created DTO: `OrderStatusUpdateReq` (validated with `@NotNull` for target `OrderStatus` and optional `note`).
  - Updated `EmployeeRepository` with `findByAccount_Username(username)` for auditing assigned employees.
  - Updated `OrderService` & `OrderServiceImpl`:
    - `PATCH /api/v1/orders/{id}/status`:
      - Guards terminal order states: prevents any modification if status is already `CANCELLED`, `COMPLETED`, or `RETURNED`.
      - Enforces strict sequential transitions: `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`. Rejects any invalid or backward transitions.
      - Assigns processing employee to `order.employee` from authentication context.
      - Appends timestamped audit note logs into `order.note`.
      - Automatically releases `reservedStock` and deducts `physicalStock` in `ton_kho` upon reaching `COMPLETED`.
  - Updated `OrderController`: Added `PATCH /api/v1/orders/{id}/status`, protected with `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")`, returning `ApiResponse<OrderDetailRes>`, no `@Operation` annotations.
  - Updated `SecurityConfig` to authorize `PATCH /api/v1/orders/*/status` for `ADMIN` and `STAFF`.
  - Updated `be_docs/module.md` marking FR-37 as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (155 source files, 0 errors, 0 warnings).


