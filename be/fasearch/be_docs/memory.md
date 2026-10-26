# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully and clearly documented. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **Completed Tasks:** `FR-10` (Paginated customer search/filtering) & `FR-11` (Customer detail by ID with RBAC ownership check).
- **In-progress Task:** Ready for `FR-12` (Create/Update customer profile) or `FR-13` (Soft delete customer).
- **Next Immediate Actions:**
  1. Implement `FR-12`: `POST /api/v1/users/customers` & `PUT /api/v1/users/customers/{id}` with validation (`CustomerCreateReq`, `CustomerUpdateReq`).
  2. Implement `FR-13`: `DELETE /api/v1/users/customers/{id}` (`da_xoa = true`).
  3. Implement `FR-14`: POS fast phone lookup `GET /api/v1/users/customers/lookup?phone={sdt}`.
- **Technical Gotchas & Constraints:**
  - Paginated API responses must wrap Spring Data `Page<T>` in `PageResponse<T>` inside `ApiResponse<T>`.
  - Customers (`CUSTOMER` role) can only access their own profile; `SecurityUtils` verifies ownership against `customer.account.username`.
  - Automatic MapStruct generation: Run `./mvnw.cmd test-compile` after editing mappers.
  - Hibernate `@SQLRestriction("da_xoa = false")` automatically ignores soft-deleted entities.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

### [Session 6] Implemented FR-10 and FR-11 in User Module (2026-10-26)
- **Done:**
  - Created shared DTO `PageResponse<T>` for standard paginated responses.
  - Created `MembershipTier` entity and `MembershipTierRepository` for table `hang_thanh_vien`.
  - Created `SecurityUtils` for extracting current username and checking authorities.
  - Updated `Customer` entity with `address`, `avatar`, and relationships to `MembershipTier` and `Account`.
  - Updated `CustomerRes` with `address`, `tierId`, and `tierName` via `UserMapper`.
  - Implemented `FR-10` (Paginated search by keyword & tierId via `JpaSpecificationExecutor`) and `FR-11` (Get customer detail by ID with RBAC ownership check).
  - Updated `SecurityConfig` and `UserController` with `@PreAuthorize` role protection.
- **Build Status:** `BUILD SUCCESS` (0 errors).

### [Session 5] Setup Working Memory & Document Cross-linking (2026-10-25)
- **Done:** Initialized `be_docs/memory.md` with Rolling 5 Sessions rule. Streamlined `AGENTS.md` (single source of truth in `be_docs/module.md`). Added bidirectional cross-links across all docs.
- **Build Status:** `BUILD SUCCESS`.

### [Session 4] Generated 10 API Specification Files (2026-10-25)
- **Done:** Created `be_docs/api/` with `README.md` and 10 detailed Request/Response specification files covering all 10 modules with `ApiResponse<T>` and Spring Data pagination.
- **Build Status:** `BUILD SUCCESS`.

### [Session 3] Refactored Functional Requirements & ASCII Status Marks (2026-10-25)
- **Done:** Converted `module.md` status marks to ASCII (`X` done, `O` in progress, blank: todo) to optimize context/tokens. Relocated `module.md` to `be_docs/module.md`.
- **Build Status:** `BUILD SUCCESS`.

### [Session 2] Standardized Enums, Soft Delete & Flyway Migrations (2026-10-25)
- **Done:** Added `V2` (added `da_xoa`, UPPER_SNAKE_CASE enums), `V3` (BCrypt hash for seed passwords), `V4` (added `da_xoa` to `vai_tro`).
- **Build Status:** `BUILD SUCCESS`.
