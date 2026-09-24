# Catalog Draft use case and data model seed

## Status — 24/09/2026

This describes the implemented Draft and primary-image checkpoints. It feeds the Week 5 business/system use-case, analysis class and ERD package; it does not close those full deliverables.

- `SUC-CAT-01`: Create a Catalog Product Draft.
- `SUC-CAT-02`: Revise a Draft by creating a new Product Version.
- `SUC-CAT-03`: Add or replace a primary Product Image on a Draft.
- Requirements: `FR-CAT-MGMT-001..002/005`, `FR-RBAC-001/004`, `FR-AUDIT-001`, `BR-CAT-001/005`.
- Diagrams: [Draft flow](../../tools/diagrams/week6/catalog-draft-sequence.v1.svg), [image flow](../../tools/diagrams/week6/catalog-image-sequence.v1.svg) and [implemented ERD seed](../../tools/diagrams/week6/identity-catalog-erd.v1.svg), each with an editable `.dot` source beside it.

## Actors and preconditions

Operations Staff initiates the use case. Administrator and Super Administrator inherit the Draft capability. The account must be active, authenticated by a valid server-side session, and granted `CATALOG_DRAFT_WRITE`. A state-changing request must carry the current session's CSRF token. A Staff account may edit only products it created; an Administrator with `CATALOG_PUBLISH` may edit other Drafts.

## `SUC-CAT-01` — Create Draft

1. Staff enters title, description and one MVP category (`TOP`, `BOTTOM`, `ONE_PIECE`) on the website.
2. Website obtains a CSRF token and submits JSON through its same-origin route handler.
3. Spring Security checks session, CSRF and `CATALOG_DRAFT_WRITE`.
4. The Catalog Draft module creates a stable Catalog Product ID, Product Group ID and Product Version 1 (`DRAFT`) in one PostgreSQL transaction.
5. The same transaction records actor, action, new version and optional trace ID in an append-only Audit Event.
6. Backend returns HTTP 201 with the Draft identifiers and state. Website opens the Draft edit page.

## `SUC-CAT-02` — Revise Draft

1. Staff opens a Draft and submits the full title/description/category snapshot with `expected_version_no`.
2. Backend locks the Catalog Product row, checks owner or Administrator permission, then reads the latest version.
3. If the expected version matches, a new immutable Product Version with `DRAFT` state is inserted and an Audit Event links the previous/new versions.
4. Backend returns the new version number; website keeps the current Product ID and updates the page.

## `SUC-CAT-03` — Add or replace primary image

1. Staff chooses a JPEG, PNG or WebP image (at most 10 MiB) on an existing Draft and sends its expected version number.
2. Next.js forwards multipart bytes through the same-origin route. Spring Security checks the session, CSRF and `CATALOG_DRAFT_WRITE`; the module checks owner/admin access, expected version, image header and JPEG/PNG dimensions. Full image-quality validation remains a later processing step.
3. The backend writes bytes under a unique, immutable key in an S3-compatible object store. PostgreSQL stores only the generated storage URI, SHA-256, media type, byte size and `PENDING` quality state.
4. In one PostgreSQL transaction, the module locks the Catalog Product, rechecks the version, inserts a new Product Version (`DRAFT`) with the same text metadata, adds its primary Product Image and records an Audit Event. An object already uploaded is deleted on a failed DB transaction on a best-effort basis.
5. The website receives the new version and reads its image through a session-protected, no-store, `nosniff` endpoint. A later text revision copies the image reference into another Product Version without rewriting the object bytes.

## Exceptions and postconditions

| Condition | Result |
|---|---|
| No session | Protected GET returns HTTP 401; POST without CSRF is rejected with HTTP 403 before any write. |
| Missing/invalid CSRF or role | HTTP 403; no write. |
| Staff edits another account's Draft | HTTP 403; no write. |
| Invalid category/blank title | HTTP 400; no write. |
| `expected_version_no` is stale | HTTP 409 `VERSION_CONFLICT`; no new version or audit event. |
| Image header invalid or too large | HTTP 400 `INVALID_IMAGE` or HTTP 413 `IMAGE_TOO_LARGE`; no version or object-store write. |
| Object storage unavailable | HTTP 503; no database version is committed. |
| Successful create/revision | Product Version remains `DRAFT`; it is not in the active search publication. |

## Implemented data dictionary seed

| Entity/table | Key and relationship | Invariant relevant to this slice |
|---|---|---|
| `user_accounts` | `id` UUID PK | Username/email case-insensitive unique; password hash only; status ACTIVE/LOCKED/DISABLED. |
| `roles`, `permissions`, `role_permissions`, `user_roles` | PK/FK combinations | Server loads effective authorities from role-permission mappings. |
| `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES` | Session primary/foreign keys | Server-side session state; expiry index and cleanup are managed by Spring Session. |
| `catalog_products` | `id` UUID PK, `created_by` → user account | Stable identity; `active_version_id` remains null for a Draft. |
| `product_versions` | `id` UUID PK, `product_id` → Catalog Product | Unique `(product_id, version_no)`, status/category checks; revisions insert a new row. |
| `product_images` | `id` UUID PK, `product_version_id` → Product Version | One primary image per version; URI, SHA-256, media type, byte size and `PENDING` quality state. Bytes live in S3-compatible storage, not PostgreSQL. |
| `audit_events` | `id` UUID PK, `actor_id` → user account | Create/revise events are inserted in the same transaction as Product Version changes. |

## Evidence and remaining work

Flyway V1/V2/V3, Spring Session JDBC, the Draft/image APIs and website form have been tested on PostgreSQL 16. A local same-origin proxy check passed login → Draft version 1 → text revision version 2 → image version 3 → byte-for-byte readback from SeaweedFS → logout. Integration tests also exercised owner denial, CSRF denial, stale-version conflict, S3 put/get/delete and image reference carry-forward. Multi-image selection/removal, full image quality checks, jobs, metadata review, publication/rollback and a PostgreSQL public catalog reader remain for later checkpoints.
