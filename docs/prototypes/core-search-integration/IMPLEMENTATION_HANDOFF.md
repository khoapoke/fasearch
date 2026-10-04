# IMPLEMENTATION_HANDOFF — core-search-integration-2h closure

Base a207f9f. Branch codex/core-search-integration-2h, checkout /private/tmp/fasearch-core-search-integration-2h.
Final HEAD: this commit (includes this handoff; code tree identical to 392ccd1 except evidence re-run logs + this file). Evidence logs re-run at cb4bc19 (e2e-final 23/23, drafts-lifecycle 15/15, ai-suites 33, hf-text 2, be 61, fe 17, chunked probes) — see evidence/.
Prior clean HEAD 119efa0a (round-1 APPROVE) + closure fixes. No push/PR/merge/deploy.

## Stack (task-owned, proven restart via runbook)

FE 3210 / Boot 18180 / AI 18011 / PG 55532 / S3 38335. PID files /private/tmp/fasearch-core-search-2h-{ai,boot,fe}.pid.
Task AI interpreter (required): root `.venv` Python 3.12.14 (pinned fastapi/starlette/jsonschema/transformers); import origins verified under checkout. Ports 18080/8001 untouched.
Lifecycle: tools/core-search-integration/lifecycle.sh {start|stop|health} with PID-cmdline + listener guards; full stop→start→health proven, other stacks intact.

## AC coverage (evidence in docs/prototypes/core-search-integration/evidence/ unless noted)

- A1: INTEGRATION_MAP 5-source import + overlap merges; final scoped diff `git diff 119efa0a HEAD` (streaming/strict/parity/lifecycle/runners/docs only); source packets untouched.
- A2: TEXT parity AI→Boot→Next e2e-final.log (order f1/f5/f4, scores ≤1e-5, PILOT_ONLY, no echo); rendered cards match (fx-text-success-1440.png, raw 0.7201/0.7054/0.7028); IMAGE live 3 results; COMPOSED UPLOAD live; lone-surrogate now typed 400 (was 500) at Next/AI/Boot + regression tests; K null/huge/float rejected; strict UTF-8.
- A3: negatives (blank/overlong/badK/unknown/trace/surrogate/malformed-UTF8/caps/mime-415/pub-409) e2e-final.log 23/23; AI-down 503 AI_UNAVAILABLE + no-store/trace (draft-evidence.log); error headers everywhere; bounded bodies: Next/AI/Boot declared + chunked probes (small 200, oversize 413 pre-buffer).
- A4: MIME mismatch 415; PILOT_ONLY + no-store + trace on success/error; Next >11MiB 413 + chunked oversize 413 pre-buffer; Boot envelope; HF actual-tokenizer: composed 1 pass (packet control-hf-312.log) + NEW TEXT 2 pass incl. pre-core rejection and surrogate guard; fixture stays RAW_CAP_ONLY honestly.
- A5: drafts-lifecycle.log 15/15 — login/list/create/revise v2/stale-409/upload v3/bytes-match/stale-upload-409/pagination/staff-own/admin-all/registered-403/anon-401-403/logout-401 + BE integration suites green.
- A6: fx-*.png — TEXT success/error/empty(stub-supplementary; fixture always ranks)/768/390, home reduced-motion initial (CDP reduce) + mid-run toggle settled readable; keyboard focus lands labelled textarea; hero labelled MINH HỌA, network log zero /api/search/*; trust-row copy fixed to live routes.
- A7: internal OpenAPI regenerated with 3.12 → parity test passes (was 1 fail: 413-description drift); BE 61/61 incl. new controller tests; AI 29 + schemas 4 + HF TEXT 2 on 3.12; Swagger served byte-equal canonical (11 paths/14 ops), 3-mode contracts present.
- A8: lifecycle.sh executable + guarded; restart proven; scoped commits; this handoff; independent full-matrix review requested on this exact HEAD (max 2 closure rounds); user manual gate separate.

## Commands (cwd + result + log)

- ai: `PYTHONPATH=<root>/ai <3.12venv> -m pytest tests/test_internal_api.py tests/test_internal_composed.py tests/test_internal_text.py` → 29 passed; `test_schemas.py` → 4 passed; `test_text_token_budget_hf.py` (own process, offline) → 2 passed.
- be: `./mvnw test` (cwd be/) → 61 tests, 0 fail/err/skip (surefire).
- fe: `npm run lint` clean; `npm run build` ok; `node --test tests/*.test.mjs` → 17/17.
- runners: `tools/core-search-integration/verify-e2e.sh` → 23/23 (e2e-final.log); `verify-drafts.sh` → 15/15 (drafts-lifecycle.log).
- lifecycle: `lifecycle.sh stop` (guarded) → `start` → `health` (AI/Boot/FE UP).

## Outstanding / limits

- Empty-results UI proven via stub-supplement (fixture catalog always ranks; code branch + copy verified).
- History persistence still absent (frozen scope). Secrets: disposable test creds in env only, jars 0600, sanitized logs.
- Preview: http://127.0.0.1:3210/ running. Manual (7–10 min): home → /search/text live query + invalid input → /search/composed → login task-admin → /catalog/drafts → /docs.
