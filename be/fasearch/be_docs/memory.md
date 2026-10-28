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
  - Module `inventory`:
    - `FR-29`: Paginated available stock search (`GET /api/v1/inventory/stock` & `GET /api/v1/inventory/stock/{skuId}`).
    - `FR-30`: Import receipt creation & automatic inventory stock accretion (`POST /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts/{id}`).
    - `FR-31`: Export receipt creation, warehouse transfer & damaged stock write-off (`POST /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts/{id}`).
    - `FR-32`: Stocktaking by barcode scanning (`POST /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes`, `GET /api/v1/inventory/stocktakes/{id}`).
  - Module `product` & `category` (100% COMPLETED): `FR-21` -> `FR-28` (Category CRUD, Product search, create, update, delete, Variant CRUD, Barcode export, POS lookup).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready to implement `FR-36` (Order List & Detail View: `GET /api/v1/orders`, `GET /api/v1/orders/{id}`) in Module 7 `order`.
- **Next Immediate Actions:**
  1. Follow AGENTS.md 3-step process to clarify edge cases, query filters, and DTOs for `FR-36` (Order List & Detail).
- **Technical Gotchas & Constraints:**
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

### [Session 16] Implemented FR-32 (Stocktaking by Barcode Scanning) in Inventory Module (2026-10-27)
- **Done:**
  - Created Flyway migration `V7__create_stocktake_tables.sql` for tables `phieu_kiem_ke` and `ct_phieu_kiem_ke` with indexes on code and FKs.
  - Created `StocktakeStatus` enum (`PENDING_APPROVAL`, `RECONCILED`, `CANCELLED`).
  - Added new error codes to `ErrorCode`: `STOCKTAKE_NOT_FOUND` (404), `INVALID_STOCKTAKE_RECORD` (400).
  - Created JPA entities: `Stocktake` and `StocktakeDetail` with `@SQLRestriction("da_xoa = false")`.
  - Created DTOs: `StocktakeItemReq`, `StocktakeCreateReq`, `StocktakeDiscrepancyRes`, `StocktakeRes`, `StocktakeDetailRes`.
  - Created Repositories: `StocktakeRepository` (with `JpaSpecificationExecutor`) and `StocktakeDetailRepository`.
  - Updated `InventoryMapper` with MapStruct mappings for stocktakes, line records, and discrepancy items.
  - Implemented `InventoryService` & `InventoryServiceImpl`:
    - `POST /api/v1/inventory/stocktakes`: Auto-generates `KK-YYYYMMDD-XXX`, captures system snapshot `systemCount` from inventory physical stock, computes `difference = actualCount - systemCount`, sums absolute discrepancies, and saves in status `PENDING_APPROVAL`.
    - `GET /api/v1/inventory/stocktakes`: Paginated specification search by `stocktakeCode` and `status`.
    - `GET /api/v1/inventory/stocktakes/{id}`: Detailed view of stocktake with list of discrepancies.
  - Updated `InventoryController` without `@Operation` annotations, accessible by `ADMIN` and `STAFF`.
  - Updated `be_docs/module.md` marking FR-32 as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (129 source files, 0 errors, 0 warnings).

### [Session 15] Implemented FR-31 (Export Receipts & Warehouse Transfers) in Inventory Module (2026-10-26)
- **Done:**
  - Created Flyway migration script `V6__create_export_receipt_tables.sql` for tables `phieu_xuat_kho` and `ct_phieu_xuat` with soft-delete flags and foreign key indexes.
  - Created `ExportType` enum (`DAMAGED`, `TRANSFER`, `OTHER`).
  - Added new error codes to `ErrorCode`: `EXPORT_RECEIPT_NOT_FOUND` (404), `INSUFFICIENT_STOCK` (400).
  - Created JPA entities: `ExportReceipt` and `ExportReceiptDetail` with `@SQLRestriction("da_xoa = false")`.
  - Created DTOs: `ExportReceiptItemReq`, `ExportReceiptCreateReq`, `ExportReceiptItemRes`, `ExportReceiptRes`, `ExportReceiptDetailRes`.
  - Created Repositories: `ExportReceiptRepository` (with `JpaSpecificationExecutor`) and `ExportReceiptDetailRepository`.
  - Updated `InventoryMapper` with MapStruct mappings for export receipts and line items.
  - Implemented `InventoryService` & `InventoryServiceImpl`:
    - `POST /api/v1/inventory/export-receipts`: Aggregates SKU quantities, pre-validates against available stock, generates auto code `XK-YYYYMMDD-XXX`, deducts physical and available stock atomically, saves receipt and items.
    - `GET /api/v1/inventory/export-receipts`: Paginated specification search by `receiptCode` and `exportType`.
    - `GET /api/v1/inventory/export-receipts/{id}`: Detailed receipt view with full line item details.
  - Updated `InventoryController` without `@Operation` annotations, protected with `@PreAuthorize("hasRole('ADMIN')")` for creation and `@PreAuthorize("hasAnyRole('ADMIN', 'STAFF')")` for reading.
  - Updated `be_docs/module.md` marking FR-31 as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (119 source files, 0 errors, 0 warnings).

### [Session 14] Implemented FR-29 and FR-30 in Inventory Module (2026-10-26)
- **Done:**
  - Created Flyway migration `V5__create_inventory_tables.sql` for tables `ton_kho`, `phieu_nhap_kho`, and `ct_phieu_nhap` with indexes and soft delete columns.
  - Added `ReceiptStatus` enum (`PENDING`, `COMPLETED`, `CANCELLED`) and inventory error codes (`INVENTORY_NOT_FOUND`, `RECEIPT_NOT_FOUND`, `INVALID_RECEIPT_ITEM`).
  - Created JPA entities: `Inventory` (OneToOne with `ProductVariant`), `ImportReceipt`, and `ImportReceiptDetail` with `@SQLRestriction("da_xoa = false")`.
  - Created DTOs: `StockRes`, `ImportReceiptCreateReq`, `ImportReceiptItemReq`, `ImportReceiptRes`, `ImportReceiptDetailRes`, `ImportReceiptItemRes`.
  - Created Repositories: `InventoryRepository`, `ImportReceiptRepository`, `ImportReceiptDetailRepository` (with `JpaSpecificationExecutor`).
  - Created `InventoryMapper` with MapStruct for clean entity/DTO translation.
  - Implemented `InventoryService` & `InventoryServiceImpl`:
    - `FR-29`: Dynamic specification search for stock list (`GET /api/v1/inventory/stock`) by SKU/barcode, product name, or keyword, and get by SKU ID (`GET /api/v1/inventory/stock/{skuId}`).
    - `FR-30`: Create import receipt (`POST /api/v1/inventory/import-receipts`) with date-formatted receipt codes (`NK-YYYYMMDD-XXX`) and atomic inventory accretion; plus list/detail endpoints.
  - Created `InventoryController` without `@Operation` annotations, secured with `@SecurityRequirement(name = "BearerAuth")`.
  - Updated `SecurityConfig` to grant `ADMIN` and `STAFF` access to inventory endpoints.
  - Updated `be_docs/module.md` marking FR-29 and FR-30 as completed (`X`).
- **Build Status:** `BUILD SUCCESS` (109 source files, 0 errors, 0 warnings).


