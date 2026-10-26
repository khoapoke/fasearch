# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully and clearly documented. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:**
  - Module `auth`: `FR-01`..`FR-08` (Login, Register, MyInfo, List/Search accounts, Create internal account, Partial update account, Soft delete/lock account, RBAC).
  - Module `user`: `FR-10`..`FR-13` (Customer CRUD & soft delete), `FR-15`..`FR-17` (Employee CRUD, partial update, soft delete with account lock).
- **In-progress Task:** Ready for `FR-14` (POS phone lookup) or Loyalty/Points (`FR-18`..`FR-20`).
- **Next Immediate Actions:**
  1. Implement `FR-14`: Fast customer lookup at POS `GET /api/v1/users/customers/lookup?phone={sdt}` (`STAFF` role).
  2. Implement `FR-19`: Public membership tiers list `GET /api/v1/users/loyalty/tiers`.
  3. Implement `FR-20`: Redeem points for order discount `POST /api/v1/users/loyalty/redeem`.
- **Technical Gotchas & Constraints:**
  - Restricted `PUBLIC_ENDPOINTS` in `SecurityConfig` to `/api/v1/auth/login` and `/api/v1/auth/register`. All `/api/v1/auth/accounts/**` endpoints require `ADMIN` role.
  - Isolated account management in `AccountController` (`/api/v1/auth/accounts`) with `@PreAuthorize("hasRole('ADMIN')")`.
  - All partial updates across entities use PATCH/PUT with MapStruct `@BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)`.
  - Soft delete universally sets `da_xoa = true` (or `isDeleted = true`) with `@SQLRestriction("da_xoa = false")`.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 7] Implemented FR-12 and FR-13 in User Module (2026-10-26)
- **Done:**
  - Implemented `CustomerCreateReq` with phone regex format (`^(0|\+84)[0-9]{9}$`) and name validation.
  - Implemented `CustomerUpdateReq` for safe partial updates (omitting `@NotBlank` on fields).
  - Configured `UserMapper` with `NullValuePropertyMappingStrategy.IGNORE` and `ReportingPolicy.IGNORE`.
  - Implemented `FR-12`: `POST /api/v1/users/customers` (duplicate phone check, default tier assignment, 201 Created) and `PATCH /api/v1/users/customers/{id}` (ownership check for CUSTOMER, partial update).
  - Implemented `FR-13`: `DELETE /api/v1/users/customers/{id}` (ADMIN only, soft delete `isDeleted = true`).
  - Synchronized `be_docs/api/api-user.md` with PATCH semantics.
- **Build Status:** `BUILD SUCCESS` (0 errors, 0 warnings).

### [Session 6] Implemented FR-10 and FR-11 in User Module (2026-10-26)
- **Done:**
  - Created shared DTO `PageResponse<T>` for standard paginated responses.
  - Created `MembershipTier` entity and `MembershipTierRepository` for table `hang_thanh_vien`.
  - Created `SecurityUtils` for extracting current username and checking authorities.
  - Updated `Customer` entity with `address`, `avatar`, and relationships to `MembershipTier` and `Account`.
  - Updated `CustomerRes` with `address`, `tierId`, and `tierName` via `UserMapper`.
  - Implemented `FR-10` (Paginated search by keyword & tierId via `JpaSpecificationExecutor`) and `FR-11` (Get customer detail by ID with RBAC ownership check).
  - Updated `SecurityConfig` and `UserController` with `@PreAuthorize` role protection.
- **Build Status:** `BUILD SUCCESS`.

### [Session 5] Setup Working Memory & Document Cross-linking (2026-10-25)
- **Done:** Initialized `be_docs/memory.md` with Rolling 5 Sessions rule. Streamlined `AGENTS.md` (single source of truth in `be_docs/module.md`). Added bidirectional cross-links across all docs.
- **Build Status:** `BUILD SUCCESS`.
