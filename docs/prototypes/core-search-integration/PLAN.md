# PLAN — core-search-integration-2h (Implement)

Start: 04/10/2026 12:42 +07, deadline +120m (14:42). Checkout /private/tmp/fasearch-core-search-integration-2h, branch codex/core-search-integration-2h from a207f9f.
Stack task-owned: FE 3210 / Boot 18180 / AI 18011 / PG 55532 / S3 38335. PIDs in /private/tmp/fasearch-core-search-2h-{ai,boot,fe}.pid.

1. Spine: import 5 source deltas (stitch → demo → composed → draft → swagger), merge 4 overlaps (README, auth-panel aria-expanded + draft links, SecurityConfiguration composed+docs, public-api composed+draft), regenerate internal OpenAPI + static docs copy. (done)
2. SPEC_TEXT before code. (done, docs/prototypes/core-search-integration/SPEC_TEXT.md)
3. TEXT slice: AI models/module/runtime/main + test; BE port/usecase/module/adapter/controller + SecurityConfiguration permitAll (no CSRF exception) + SearchConfiguration bean + no-store on 3 search controllers + contract/tests; FE contract/route/validation/workbench/page/css/nav + test. (done)
4. Verification: AI pytest, mvn test, fe lint/build + node tests, live HTTP journeys (3 modes, negatives, cap, draft CRUD, swagger byte-equal, MIME/no-store/11MiB/chunked/logout), browser 1440/768/390 + network zero-hero-calls. (done, logs below)
5. Docs: INTEGRATION_MAP, RUNBOOK, IMPLEMENTATION_HANDOFF; copy screenshots; commit; independent review (max 3 rounds); manual steps for user. (this file + next)
