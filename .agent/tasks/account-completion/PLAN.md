# PLAN — Account completion (Implement)

Branch: `codex/account-completion` from base `01104318b25ceabd3dda1a661b4f72d25f7d255d`
Checkout: `/private/tmp/fasearch-catalog-discovery` (clean, no competing writer verified 2026-10-06 00:09 +07)
Start: 2026-10-06 00:09 Asia/Ho_Chi_Minh. Runtime: FE 3230 (PID 63719, fe/), BE 18380 (PID 74307, be/), AI 18031. Shared Compose `fasearch` only.
Skills verified on host: `tdd` (SKILL+tests+mocking read), `diagnosing-bugs` (SKILL read), `code-review` (SKILL read), oxk core/roles/skill-map read. Ponytail: not installed as Pi command on this host — ghi nhận, implement tối giản thủ công theo tinh thần Ponytail full, không claim đã chạy plugin.

## Seams (public test boundaries, đã chốt — không hỏi lại)

- BE HTTP: `POST /api/v1/auth/register`, `GET/PATCH /api/v1/auth/profile`, `POST /api/v1/auth/password`, `GET /api/v1/auth/me`, `POST /api/v1/auth/login|logout|csrf` (hồi quy). Test qua real HTTP + Testcontainers PG (pattern `SessionSecurityIntegrationTests`), không mock internal collaborators.
- DB/Flyway: `V4__account_display_name.sql` additive (`display_name VARCHAR(100) NULL`), existing users compatible.
- Contracts: `contracts/public-api.openapi.json` + `be/src/main/resources/docs/openapi.json` parity, FE `fe/src/lib/*contract*` + proxies `fe/src/app/api/auth/*`.
- FE routes: `/dang-nhap`, `/dang-ky`, `/tai-khoan`, `/tai-khoan/thong-tin`, `/tai-khoan/bao-mat` qua `node --test tests/*.test.mjs`, `tsc`, `lint`, `build`, browser E2E live.

## A1–A12 mapping

| AC | Seams/files | Implementation | Commands | Evidence |
|---|---|---|---|---|
| A1 register | `AccountController` mới, `AccountService`, validation, `V4`, `SecurityConfiguration` (permit register), OpenAPI | 201 ACTIVE+REGISTERED_USER atomic, no autologin, CSRF, 409 generic, rollback | `./mvnw test -Dtest=AccountRegistrationIntegrationTests` | red/green log, HTTP 201/409 |
| A2 login/session | Giữ `SecurityConfiguration`, `JdbcIdentityService`; hồi quy locked/disabled, generic 401, no JWT | Không đổi kiến trúc, thêm test register không tự login | existing `SessionSecurityIntegrationTests` + new | live E2E |
| A3 profile | `GET/PATCH /profile`, chỉ `display_name` writable, 400 unknown/protected, XSS escape ở FE (React default + test) | username/email readonly, no IDOR (own only) | `AccountProfileIntegrationTests` | 200/400, cancel/draft FE test |
| A4 password | `POST /password`, `current_password` check, policy 15–64 cp + ≤72 UTF-8 bytes, `SELECT FOR UPDATE`, revoke `SPRING_SESSION` by principal, invalidate current | 2 jars revoked, other user intact, old dead/new works, concurrent race | `AccountPasswordIntegrationTests` + live 2-jar script | DB session rows + /me 401 |
| A5 migration/audit | `V4` unique version, bootstrap compatible, OpenAPI/proxies/no-store/error envelope/audit redacted (`ACCOUNT_REGISTERED/PROFILE_UPDATED/PASSWORD_CHANGED` theo pattern `audit_events`) | Nếu schema audit khác, reconcile + record | `doctor`, OpenAPI diff, `SELECT` data preserved | migration log, audit rows |
| A6 5 pages Stitch | `fe/src/app/(dang-nhap|dang-ky|tai-khoan)/...`, shared `SiteHeader/Footer`, tokens `globals.css`, không fake commerce | map reference→impl table | `npm run build`, screenshots | route/state/viewport/SHA shots |
| A7 states/a11y | skeleton profile, draft retention, double-submit guard, reveal/autocomplete/focus, password success→login+fresh CSRF | FE unit `node --test` + browser | `npm run lint`, `tsc` | screenshots validation/error/success/session-expired |
| A8 responsive | 1440/768/390 + 320 sanity, keyboard/tab, reduced-motion | CSS modules, no Tailwind CDN | manual + shots | mapping table |
| A9 search regression | Không chạm search code; chạy TEXT/IMAGE/COMPOSED + catalog/detail E2E | `fe/tests/*.test.mjs` + live search | `node --test`, live curl | S1–S4 preserved log |
| A10 TDD/E2E | red→green mỗi slice, live 2-session journey script `tools/account-completion/e2e-account-lifecycle.sh` | failures labelled mock/live | all checks | logs redacted |
| A11 review | reviewer độc lập (worker) Spec+Standards+runtim e/visual, pin base/final SHA | tối đa 2 rounds/slice | review SHA | REVIEW.md (reviewer giữ) |
| A12 handoff | RUNBOOK/DEMO/IMPLEMENTATION_HANDOFF VI, coverage, preview URL, manual 10–15' | no push/merge | `git log`, `git status` | final reply + files |

## Routine choices (tự xử lý, ghi rationale)

- Audit actions: `ACCOUNT_REGISTERED`, `ACCOUNT_PROFILE_UPDATED`, `ACCOUNT_PASSWORD_CHANGED`, `resource_type='user_accounts'`, `resource_id=user id`, `actor_id=user id`, không secrets/body/hash. Theo pattern `CatalogDraftModule` (trực tiếp `jdbc.update INSERT INTO audit_events`).
- Profile response: `{username, email, display_name}` snake_case (Jackson SNAKE_CASE), `/me` giữ nguyên + thêm `display_name` nếu cần tương thích (không break consumers — test `AuthPanel` vẫn đọc `username`).
- Error envelope: `{code, message}` cho auth (theo `SecurityConfiguration.writeError`), thêm `details` map cho validation 400 khi cần (additive only).
- `no-store` cho `/register`, `/profile`, `/password`, `/me` (Cache-Control).
- Revocation query: `DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME = ?` sau khi xác minh mapping thật qua test (không đoán lowercase). `PRINCIPAL_NAME` do Spring Session JDBC set từ `authentication.getName()` = username case-preserved; test sẽ assert với username mixed-case.
- Return URL allowlist: `^/(tai-khoan.*|catalog.*|search.*|/?$)` local only, else fallback `/tai-khoan`.

## Thứ tự vertical slices (một hành vi → red → green → slice tiếp)

1. S1 register valid 201 + retrievable + no autologin.
2. S2 register duplicates (case-insensitive, concurrent) 409 generic + rollback.
3. S3 register validation/bounds/malformed/unknown fields + CSRF/415.
4. S4 profile GET/PATCH + protected-field rejection + cancel/draft (BE + FE unit).
5. S5 password change + policy + current check + revoke 2 sessions + other user intact + concurrency.
6. S6 OpenAPI/proxies/no-store/audit parity.
7. S7 FE 5 routes Stitch + states/a11y/responsive.
8. S8 full live E2E + search regression + checks + review/fix rounds.

Material decision mới/canonical conflict: ghi repro + đề xuất, tiếp tục phần độc lập. Không waive gap.
