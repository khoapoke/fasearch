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
  - Module `inventory`:
    - `FR-29`: Paginated available stock search (`GET /api/v1/inventory/stock` & `GET /api/v1/inventory/stock/{skuId}`).
    - `FR-30`: Import receipt creation & automatic inventory stock accretion (`POST /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts/{id}`).
    - `FR-31`: Export receipt creation, warehouse transfer & damaged stock write-off (`POST /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts/{id}`).
    - `FR-32`: Stocktaking by barcode scanning (`POST /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes/{id}`).
  - Module `product` & `category` (100% COMPLETED): `FR-21` -> `FR-28` (Category CRUD, Product search, create, update, delete, Variant CRUD, Barcode export, POS lookup).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready to implement `FR-39` (Draft Order at POS: `POST /api/v1/orders/pos/draft` & `GET /api/v1/orders/pos/drafts`) in Module 7 `order`.
- **Next Immediate Actions:**
  1. Follow AGENTS.md 3-step process to clarify POS draft order creation, items, cashier/staff tracking, and draft listing for `FR-39`.
- **Technical Gotchas & Constraints:**
  - Order cancellation (`POST /api/v1/orders/{id}/cancel`): Customer can only cancel `PENDING` or `CONFIRMED` orders; `ADMIN`/`STAFF` can cancel anytime before terminal status. Releases reserved stock (`availableStock += quantity`, `reservedStock -= quantity`).
  - Sequential order status transitions: strictly `PENDING` -> `CONFIRMED` -> `PACKING` -> `SHIPPING` -> `COMPLETED`. Closed orders (`CANCELLED`, `COMPLETED`, `RETURNED`) cannot be transitioned.
  - Completing an order (`COMPLETED`) atomically deducts `physicalStock` and releases `reservedStock` in `ton_kho`.
  - Auditing employee: `order.employee` updated with the `ADMIN`/`STAFF` performing status transition.
  - Role data isolation: `CUSTOMER` role automatically scoped to `customer.id = currentCustomer.id` in `GET /api/v1/orders` and forbidden on foreign order access in `GET /api/v1/orders/{id}`.
  - Multi-criteria specification filtering on `orderCode`, `status`, `customerPhone` (joined), and `orderDate` range (`startDate`, `endDate`).
  - Order Code generation format: `DH-YYYYMMDD-XXX` with daily sequence increment.
  - Online checkout flow atomically reserves stock (`availableStock` -, `reservedStock` + in `ton_kho`) and clears customer's cart.
  - Delivery address fallbacks to `customer.address` if empty in request; custom receiver info (`receiverName`, `receiverPhone`) is neatly preserved in order `note`.
  - Cart item table `mat_hang_gio` uses composite PK `(ma_gio_hang, ma_sku)` referencing `bien_the_sp(ma_sku)` with hard delete.
  - Dynamic SKU pricing: `unitPrice = product.price + variant.additionalPrice`.
  - Lean Order refactoring: `don_hang` holds `ma_don` (Order Code), `ghi_chu`, `tien_giam`; payment transactions and methods are decoupled in Module 8 (`hoa_don`, `thanh_toan`).
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 19] Implemented FR-36 (Order List & Detail View) in Order Module (2026-10-28)
- **Done:**
  - Created DTOs: `OrderCustomerRes` (customer summary: `customerId`, `fullName`, `phoneNumber`), `OrderItemRes` (line item: `skuId`, `productName`, `color`, `size`, `imageUrl`, `quantity`, `unitPrice`, `totalPrice`), `OrderDetailRes` (full order view).
  - Updated `OrderRes` with `customerName`, `customerPhone`, and `deliveryAddress` for rich paginated order lists.
  - Updated `OrderService` & `OrderServiceImpl`:
    - `GET /api/v1/orders`: Implemented dynamic `Specification<Order>` filtering by `status`, `orderCode`, `customerPhone`, `startDate`, `endDate`. Built-in RBAC data isolation (automatically enforces `customer.id = currentCustomer.id` for `CUSTOMER`, allows full search for `ADMIN`/`STAFF`).
    - `GET /api/v1/orders/{id}`: Retrieves comprehensive order details with line items, SKU metadata, dynamic subtotal calculation, and ownership verification for `CUSTOMER` (throws 403 `FORBIDDEN` if accessing foreign order).
  - Updated `OrderController`: Added `GET /api/v1/orders` (paginated `PageResponse<OrderRes>`) and `GET /api/v1/orders/{id}`, protected with `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF', 'CUSTOMER')")`, wrapped in `ApiResponse<T>`, no `@Operation` annotations.
  - Updated `SecurityConfig` to authorize `GET /api/v1/orders/**` for `ADMIN`, `STAFF`, `CUSTOMER`.
  - Updated `be_docs/module.md` marking FR-36 as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (154 source files, 0 errors, 0 warnings).

### [Session 18] Implemented FR-35B (Online Checkout) in Order Module (2026-10-28)
- **Done:**
  - Added `CART_EMPTY` (400) to `ErrorCode`.
  - Created DTOs: `CheckoutReq` (validated with `@DecimalMin` for shipping fee, delivery details, receiver info, voucher code) and `OrderRes`.
  - Created Repositories: `OrderRepository` (with `countByOrderCodeStartingWith`, `existsByOrderCode`, `findByOrderCode`, `JpaSpecificationExecutor`) and `OrderDetailRepository`.
  - Implemented `OrderService` & `OrderServiceImpl`:
    - `POST /api/v1/orders/checkout`:
      - Validates authenticated customer and verifies cart is not empty.
      - Resolves delivery address (fallback to `customer.address`) and formats custom receiver info into order note.
      - Checks stock availability and performs atomic stock reservation (`availableStock` -, `reservedStock` + in `ton_kho` - FR-40).
      - Computes line totals (`unitPrice = product.price + additionalPrice`), `subTotal`, and `totalAmount = subTotal - discountAmount + shippingFee`.
      - Auto-generates unique order code `DH-YYYYMMDD-XXX`.
      - Persists `Order` and cascaded `OrderDetail` records.
      - Clears customer's cart upon checkout success.
  - Created `OrderController` without `@Operation` annotations, protected with `@PreAuthorize("hasRole('CUSTOMER')")`, returning HTTP 201 Created.
  - Configured `SecurityConfig` to authorize `/api/v1/orders/checkout` for `CUSTOMER`.
  - Updated `be_docs/module.md` marking FR-35B as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (151 source files, 0 errors, 0 warnings).

### [Session 17] Implemented FR-35A (Online Cart Management) in Order Module (2026-10-27)
- **Done:**
  - Created Flyway migration `V8__refactor_cart_and_order_tables.sql` adding `gia_phu_thu` to `bien_the_sp`, fixing `mat_hang_gio` to reference `ma_sku` with composite PK `(ma_gio_hang, ma_sku)`, and adding `ma_don`, `ghi_chu`, `tien_giam` to `don_hang`.
  - Updated `ProductVariant` entity & `VariantRes` with `additionalPrice`.
  - Added new error codes to `ErrorCode`: `CART_NOT_FOUND` (404), `CART_ITEM_NOT_FOUND` (404), `ORDER_NOT_FOUND` (404).
  - Created JPA entities: `Cart`, `CartItem`, `CartItemId` (composite key), `Order`, `OrderDetail`, `OrderDetailId`.
  - Created DTOs: `CartItemReq`, `CartItemUpdateReq`, `CartItemRes`, `CartRes`.
  - Created Repositories: `CartRepository`, `CartItemRepository`.
  - Implemented `CartService` & `CartServiceImpl`:
    - `GET /api/v1/cart`: Returns current customer's cart with dynamic SKU pricing (`unitPrice = product.price + additionalPrice`), `subTotal`, and `totalItems`. Auto-initializes cart if none exists.
    - `POST /api/v1/cart/items`: Adds SKU to cart, accumulates quantity if exists, validates against available stock (`inventory.availableStock`).
    - `PUT /api/v1/cart/items/{skuId}`: Updates item quantity in cart with stock validation.
    - `DELETE /api/v1/cart/items/{skuId}`: Hard removes SKU from cart.
    - `DELETE /api/v1/cart`: Clears all items from cart.
  - Created `CartController` without `@Operation` annotations, protected with `@PreAuthorize("hasRole('CUSTOMER')")`.
  - Configured `SecurityConfig` to restrict `/api/v1/cart/**` to `CUSTOMER`.
  - Updated `be_docs/module.md` marking FR-35A as completed (`X`).
  - Updated `be_docs/api/api-order.md` with complete documentation for all cart endpoints.
- **Build Status:** `BUILD SUCCESS` (144 source files, 0 errors, 0 warnings).


