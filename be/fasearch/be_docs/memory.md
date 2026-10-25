# WORKING MEMORY & HANDOVER LOG (AGENT MEMORY)

> ⚠️ **Maintenance Rules for AI Agents:**
> - **Completeness First (Crucial):** All 5 recent sessions MUST be fully and clearly documented. NEVER truncate, cut off sentences, or omit critical technical details just to satisfy line counts.
> - **Rolling 5 Sessions (Strict Rule):** Maintain current context and **strictly at most 5 recent sessions**. When session #6 is added, **MUST prune the oldest session** at the bottom.
> - **Soft Target:** Aim for concise bullet points (~100–150 lines total). Completeness and technical accuracy always take precedence over line limits.
> - **Post-task Requirement:** Update `1. CURRENT CONTEXT` and append 1 new session to `2. RECENT 5 SESSIONS`.

---

## 1. CURRENT CONTEXT

- **In-progress Task:** `FR-11` — Get customer details (`CustomerRes` in `user` module).
- **Next Immediate Actions:**
  1. Inspect and add missing customer fields to `Customer` entity and `CustomerRes` (address, dob, membership tier).
  2. Implement `FR-10` (Paginated customer search/list) or `FR-12` (Create/Update customer).
- **Technical Gotchas & Constraints:**
  - Seed passwords hashed with BCrypt (Flyway `V3`), default password: `123456`.
  - No separate `admin` table; Admins reside in `nhan_vien` and are assigned `ADMIN` role in `vai_tro`.
  - Automatic MapStruct generation: Always run `./mvnw.cmd test-compile` after modifying mappers.
  - Mandatory response format: `ApiResponse<T>`, 100% UPPER_SNAKE_CASE enums.

---

## 2. RECENT 5 SESSIONS (ROLLING LOGS)

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

### [Session 1] Completed Auth Module & Spring Security (2026-10-25)
- **Done:** Configured Spring Security 6 (`SecurityConfig`, `JwtConfig`), created `JwtProvider`, `JwtAuthenticationFilter`, implemented 3 core APIs: `login`, `register`, `my-info`.
- **Build Status:** `BUILD SUCCESS`.
