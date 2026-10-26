# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `product` & `category` (100% COMPLETED):
    - `FR-21`: Category CRUD & soft delete.
    - `FR-22`: Paginated product list & dynamic specification search (`keyword`, `categoryId`, `priceRange`, `status`).
    - `FR-23`: Create product with initial variants & auto-generated barcodes.
    - `FR-24`: Get product detail & partial update (`PATCH /api/v1/products/{id}`).
    - `FR-25`: Soft delete product (`DISCONTINUED`, `da_xoa = true`).
    - `FR-26`: Variant CRUD (`GET`, `POST`, `PATCH`, `DELETE` on `/api/v1/products/**/variants/**`).
    - `FR-27`: Barcode export with ZXing Code 128 as Base64 JSON and direct PNG byte stream.
    - `FR-28`: Rapid POS lookup & keyword search at cashier checkout.
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready to transition to next business module.
- **Next Immediate Actions:**
  - Discuss with user on next module:
    - Module 6 `inventory`: `FR-29` -> `FR-34` (Kho hàng & tồn kho: tra cứu tồn kho, phiếu nhập/xuất kho, kiểm kê, cảnh báo tồn kho thấp).
    - Or Module 7 `order` / `cart`: `FR-35` -> `FR-41` (Giỏ hàng, đặt hàng trực tuyến, POS lưu đơn tạm, quản lý đơn hàng).
    - Or Module 5 `search`: `FR-NC1` -> `FR-NC3` (Tìm kiếm thông minh AI văn bản/hình ảnh).
- **Technical Gotchas & Constraints:**
  - ZXing 3.5.3 integrated for Code 128 barcode rendering (Base64 data URI and raw PNG bytes).
  - Specific protected matchers (`/api/v1/products/pos-lookup/**`, `/api/v1/products/variants/*/barcode/**`) placed before broad `GET /api/v1/products/**` in `SecurityConfig` to reject unauthenticated requests immediately.
  - `AppException` supports overloaded constructor with custom messages, mapped cleanly in `GlobalExceptionHandler`.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 10] Implemented FR-21 (Category Management) in Product Module (2026-10-26)
- **Done:**
  - Added new error codes: `CATEGORY_NOT_FOUND` (404), `CATEGORY_NAME_ALREADY_EXISTS` (400).
  - Created `Category` entity mapping to `danh_muc` with `@SQLRestriction("da_xoa = false")`.
  - Created `CategoryRes` and `CategoryReq` DTOs with validation.
  - Created `CategoryRepository` and `CategoryMapper` with MapStruct.
  - Implemented `CategoryService` & `CategoryServiceImpl`:
    - List all active categories (`GET /api/v1/categories`).
    - Get category detail by ID (`GET /api/v1/categories/{id}`).
    - Create category with duplicate name check (`POST /api/v1/categories`).
    - Partial update category (`PATCH /api/v1/categories/{id}`).
    - Soft delete category (`DELETE /api/v1/categories/{id}`).
  - Created `CategoryController` with public GET and admin-protected mutations.
  - Updated `SecurityConfig` to protect category mutations with `ADMIN` role.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).

### [Session 9] Implemented FR-01, FR-02, FR-03, and FR-04 in Auth Module (2026-10-26)
- **Done:**
  - Restricted `PUBLIC_ENDPOINTS` in `SecurityConfig` from `/api/v1/auth/**` to `/api/v1/auth/login` and `/api/v1/auth/register` to protect `/api/v1/auth/accounts/**` and `/api/v1/auth/my-info`.
  - Created `AccountCreateReq` and `AccountUpdateReq` for internal account management.
  - Created `AccountMapper` with MapStruct and updated `AccountRepository` with `JpaSpecificationExecutor`.
  - Implemented `AuthService` & `AuthServiceImpl`:
    - `FR-01`: Paginated list/search accounts by keyword, role, status (`GET /api/v1/auth/accounts`).
    - `FR-02`: Create internal account for Staff/Admin (`POST /api/v1/auth/accounts`) with password BCrypt hashing and role assignment.
    - `FR-03`: Partial update account (`PATCH /api/v1/auth/accounts/{id}`) for email, status, role, and password.
    - `FR-04`: Soft delete and deactivate account (`DELETE /api/v1/auth/accounts/{id}`).
  - Created `AccountController` protected with `@PreAuthorize("hasRole('ADMIN')")` and `@SecurityRequirement`.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).
