# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `inventory`:
    - `FR-29`: Paginated available stock search (`GET /api/v1/inventory/stock` & `GET /api/v1/inventory/stock/{skuId}`).
    - `FR-30`: Import receipt creation & automatic inventory stock accretion (`POST /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts`, `GET /api/v1/inventory/import-receipts/{id}`).
    - `FR-31`: Export receipt creation, warehouse transfer & damaged stock write-off (`POST /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts`, `GET /api/v1/inventory/export-receipts/{id}`).
  - Module `product` & `category` (100% COMPLETED): `FR-21` -> `FR-28` (Category CRUD, Product search, create, update, delete, Variant CRUD, Barcode export, POS lookup).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready for subsequent Inventory features (`FR-32` -> `FR-34`).
- **Next Immediate Actions:**
  1. Implement `FR-32`: Stocktaking by barcode scanning (`POST /api/v1/inventory/stocktakes`).
  2. Implement `FR-33`: Automatic inventory reconciliation (`POST /api/v1/inventory/stocktakes/{id}/reconcile`).
  3. Implement `FR-34`: Low-stock alert retrieval (`GET /api/v1/inventory/low-stock-alerts`).
- **Technical Gotchas & Constraints:**
  - Database tables: `ton_kho`, `phieu_nhap_kho`, `ct_phieu_nhap` via `V5`, `phieu_xuat_kho`, `ct_phieu_xuat` via `V6`.
  - Export receipts use auto-generated unique code `XK-YYYYMMDD-XXX` and export types: `DAMAGED`, `TRANSFER`, `OTHER`.
  - Stock deduction strictly validates available stock per SKU (`availableStock >= requestedQuantity`) before modifying any records; fails immediately with HTTP 400 `INSUFFICIENT_STOCK`.
  - Auto-deduction formula: `physicalStock -= quantity`, `availableStock = physicalStock - reservedStock` inside a `@Transactional` boundary.
  - Do NOT add `@Operation` annotations to Controllers unless explicitly requested.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 13] Implemented FR-27 and FR-28 in Product Module (2026-10-26)
- **Done:**
  - Integrated ZXing 3.5.3 (`core`, `javase`) in `pom.xml` for standard Code 128 barcode encoding.
  - Created DTOs: `BarcodeRes` (with `barcodeBase64`, product & pricing metadata) and `PosProductRes` (for POS cashier lookup).
  - Created `BarcodeService` & `BarcodeServiceImpl` to encode Code 128 into PNG byte arrays and Base64 data URLs.
  - Implemented `FR-27` in `ProductVariantService` & `ProductVariantController`:
    - `GET /api/v1/products/variants/{skuId}/barcode`: Export Base64 barcode data for price tag printing (`ADMIN`, `STAFF`).
    - `GET /api/v1/products/variants/{skuId}/barcode/image`: Direct PNG byte stream for barcode preview (`ADMIN`, `STAFF`).
  - Implemented `FR-28` in `ProductVariantService` & `ProductController`:
    - `GET /api/v1/products/pos-lookup?barcode={code}`: Instant variant lookup by barcode or SKU ID (`STAFF`, `ADMIN`).
    - `GET /api/v1/products/pos-search?keyword={text}`: Keyword search across product name, color, size, barcode (`STAFF`, `ADMIN`).
  - Updated `SecurityConfig` with strict role protection (`ADMIN`, `STAFF`) for POS and Barcode routes.
  - Updated `be_docs/module.md` marking Module `product` completely done.
- **Build Status:** `BUILD SUCCESS` (92 source files, 0 errors, 0 warnings).

### [Session 12] Implemented FR-26 (Product Variant Management) in Product Module (2026-10-26)
- **Done:**
  - Added new error codes to `ErrorCode`: `VARIANT_NOT_FOUND` (404), `VARIANT_ALREADY_EXISTS` (400).
  - Created DTOs: `VariantCreateReq` (validated with `@NotBlank`, `@Size`), `VariantUpdateReq` (for partial updates), and updated `VariantRes` with `productId`.
  - Added query methods to `ProductVariantRepository` for duplicate checks by `(productId, color, size)` and barcode uniqueness.
  - Updated `ProductMapper` to map `VariantCreateReq -> ProductVariant` and support `updateVariantFromReq`.
  - Implemented `ProductVariantService` & `ProductVariantServiceImpl`:
    - List variants by product ID (`GET /api/v1/products/{productId}/variants`).
    - Get variant detail by ID (`GET /api/v1/products/variants/{variantId}`).
    - Add new variant with duplicate checks and auto-generated barcodes (`POST /api/v1/products/{productId}/variants`).
    - Partial update variant color, size, barcode (`PATCH /api/v1/products/variants/{variantId}`).
    - Soft delete variant (`DELETE /api/v1/products/variants/{variantId}`).
  - Created `ProductVariantController` with OpenAPI `@Tag` and `@SecurityRequirement`.
  - Updated `be_docs/api/api-product.md` with complete documentation for all FR-26 endpoints.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).

### [Session 11] Implemented FR-22, FR-23, FR-24, FR-25 in Product Module (2026-10-26)
- **Done:**
  - Added new error codes: `PRODUCT_NOT_FOUND` (404), `BARCODE_ALREADY_EXISTS` (400).
  - Created entities: `Product` (`san_pham`) and `ProductVariant` (`bien_the_sp`) with `@SQLRestriction("da_xoa = false")`.
  - Created DTOs: `ProductRes`, `ProductDetailRes`, `VariantRes`, `ProductCreateReq`, `ProductUpdateReq`, `VariantReq`.
  - Created `ProductRepository` (with `JpaSpecificationExecutor`), `ProductVariantRepository`, and `ProductMapper` (MapStruct).
  - Implemented `ProductService` & `ProductServiceImpl`:
    - `FR-22`: Dynamic multi-criteria specification search (`keyword`, `categoryId`, `minPrice`, `maxPrice`, `status`) with pagination.
    - `FR-23`: Create product with initial variants and auto-generated barcodes (`SP%04d-%s-%s`).
    - `FR-24`: Get product detail by ID and partial update (`PATCH /api/v1/products/{id}`).
    - `FR-25`: Soft delete product (`da_xoa = true`, status `DISCONTINUED`).
  - Created `ProductController` with `@ParameterObject Pageable` and `@SecurityRequirement`.
  - Configured `SecurityConfig` to protect mutating product endpoints with `ADMIN` role.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).

