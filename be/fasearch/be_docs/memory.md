# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully và rõ ràng ghi lại. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `product`: `FR-21` (Category CRUD), `FR-22` (Product list & multi-criteria search), `FR-23` (Add product with initial variants), `FR-24` (Product details & partial update), `FR-25` (Soft delete / discontinue product), `FR-26` (Product Variant management - color, size, SKU, soft delete).
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready for Barcode Export & POS Lookup (`FR-27` -> `FR-28`).
- **Next Immediate Actions:**
  1. Implement `FR-27`: Barcode export for variant SKUs (`GET /api/v1/products/variants/{skuId}/barcode`).
  2. Implement `FR-28`: Rapid POS product lookup by SKU / Barcode (`GET /api/v1/products/pos-lookup?barcode={code}`).
- **Technical Gotchas & Constraints:**
  - `Product` has 1-N relation with `ProductVariant` (`bien_the_sp`) and N-1 with `Category` (`danh_muc`).
  - Read APIs (`GET /api/v1/products/**`, `GET /api/v1/categories/**`) are public (`permitAll`).
  - Mutating APIs (`POST`, `PATCH`, `PUT`, `DELETE` on `/api/v1/products/**` and `/api/v1/categories/**`) require `ADMIN` role.
  - Hibernate `@SQLRestriction("da_xoa = false")` applied to `Product`, `ProductVariant`, and `Category`.
  - Automatic Barcode generation pattern `SP%04d-%s-%s` when custom barcode is not supplied.
  - Variant duplicate prevention checks `(productId, color, size)` uniqueness case-insensitively.
  - Do NOT run `git commit` unless explicitly instructed by the user.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 8] Implemented FR-15, FR-16, and FR-17 in User Module (2026-10-26)
- **Done:**
  - Added new error codes to `ErrorCode`: `EMPLOYEE_NOT_FOUND`, `CCCD_ALREADY_EXISTS`, `ACCOUNT_NOT_FOUND`, `ACCOUNT_ALREADY_LINKED`.
  - Created `Employee` entity mapping to `nhan_vien` table with soft delete and `@OneToOne` account relationship.
  - Created `EmployeeRes`, `EmployeeCreateReq`, and `EmployeeUpdateReq` with 12-digit CCCD and phone validations.
  - Created `EmployeeRepository` with `JpaSpecificationExecutor` and uniqueness check queries.
  - Created `EmployeeMapper` with MapStruct and null-ignoring property strategy.
  - Implemented `EmployeeService` & `EmployeeServiceImpl`:
    - `FR-15`: Paginated search by name, phone, CCCD (`GET /api/v1/users/employees`).
    - `FR-16`: Create employee (`POST /api/v1/users/employees`) with account link validation & partial update (`PATCH /api/v1/users/employees/{id}`).
    - `FR-17`: Soft delete employee (`DELETE /api/v1/users/employees/{id}`) and automatically lock linked account (`status = LOCKED`).
  - Created `EmployeeController` with `@PreAuthorize("hasRole('ADMIN')")` and OpenAPI `@SecurityRequirement`.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).
