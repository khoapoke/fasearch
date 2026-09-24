# Identity and Catalog Draft checkpoint

## Status — 24/09/2026

The representative chose a server-side session cookie. This checkpoint implements login, logout, `/me`, CSRF, role-derived permissions and the first catalog Draft create/revise path. It is not the full Week 8–9 identity scope or the complete Week 6 catalog-to-searchable path.

## Implemented and verified

- Flyway V1 creates User Account, Role, Permission and Spring Session JDBC tables; V2 creates Catalog Product, Product Version, Product Image and append-only Audit Event tables.
- PostgreSQL holds session state. Browser cookie is opaque, `HttpOnly`, `SameSite=Lax`, with a 30-minute inactivity timeout. `prod` enables `Secure` and requires HTTPS deployment.
- Spring Security rotates session ID on login and invalidates the session on logout. CSRF protects login, logout and catalog writes. Public image search stays stateless.
- Initial Super Administrator is bootstrapped only from explicit environment credentials when no account has ever held that role; a locked/disabled administrator is not silently replaced on restart. No default password is committed.
- `CATALOG_DRAFT_WRITE` protects create/read/revise. Operations Staff can edit its own Draft; Administrator and Super Administrator have the broader permission bundle.
- Draft creation and revision are transactional. Revision creates an immutable new Product Version and checks `expected_version_no`; stale edits get HTTP 409. Each write creates an audit event.
- Next.js forwards only the `FASEARCH_SESSION` cookie to Spring Boot. CSRF token is used from page memory. Login and Draft forms do not store credentials or tokens in browser storage.
- PostgreSQL Testcontainers verified migration, login, CSRF denial, cookie flags, session rotation, role denial, Draft version 1→2, stale-version conflict, audit rows, logout, public search without a session and locked-admin bootstrap behavior.
- Local same-origin proxy E2E passed for login, Draft version 1→2 and logout with a disposable PostgreSQL container.

## Remaining before broader claims

- Account registration, password change, role-assignment UI/API, MFA, rate limiting and production HTTPS validation.
- Immediate invalidation or revalidation of active sessions after account lock, disable or permission changes; the current session retains its login-time authorities until expiry or a fresh sign-in.
- Product image upload, quality/tagging/embedding jobs, review, atomic index publication and Active transition.
- PostgreSQL adapter for public catalog search; the existing `local`/`test` read adapter still serves the frozen pilot catalog.
- Week 5 business/system use-case package, class model, ERD and GVHD open questions remain to be reviewed.

## Run locally

Set a local database password and explicit first-run admin credentials in your environment. Do not commit those values. From the repository root:

```bash
docker compose -f be/compose.yaml up -d
cd be
./mvnw test
./mvnw spring-boot:run
```

For website development in another terminal, run `cd fe && npm ci && npm run dev`. The first startup needs `FASEARCH_DB_PASSWORD`, `FASEARCH_BOOTSTRAP_ADMIN_USERNAME`, `FASEARCH_BOOTSTRAP_ADMIN_EMAIL` and `FASEARCH_BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters). Later starts need only database credentials while an active Super Administrator exists. `./scripts/verify_session_proxy.sh` is the local integration check when all services are running; provide only disposable test credentials through environment variables.

Sources for the session decision are recorded in [ADR 0001](../adr/0001-server-session-for-website.md).
