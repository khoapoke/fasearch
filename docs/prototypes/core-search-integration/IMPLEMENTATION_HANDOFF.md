# IMPLEMENTATION_HANDOFF — core-search-integration-2h

Base a207f9f (codex/vertical-slice). Branch codex/core-search-integration-2h, checkout /private/tmp/fasearch-core-search-integration-2h. HEAD after commit: see `git rev-parse HEAD` (commit message `feat(core-search): integrate 5 sources + TEXT slice`).

## What the new app does

One runnable site: Stitch home + live IMAGE workbench, NEW live TEXT workbench (/search/text: free text + K, PILOT_ONLY provenance, stale guard), live COMPOSED workbench (/search/composed, UPLOAD-first + PRODUCT anchor), labelled Composed hero demo (zero API calls, proven by network log), session login/logout + privileged Draft list/create (Staff-own/Admin-all, anon/Registered-User denied), combined Swagger at /docs (byte-equal canonical, 11 paths/14 ops).

## Files / source pins

Spine per INTEGRATION_MAP.md (5 pins in .agent/tasks/core-search-integration-2h/source-pins.json). New TEXT files listed in SPEC_TEXT §8 + PLAN. Overlaps merged, no packet/config/secret imports.

## Coverage / checks (all PASS, recorded with cwd+revision+logs)

- ai (venv /private/tmp/fasearch-ai-venv, py3.13 — host has no 3.12, deviation recorded): test_internal_api + test_internal_composed + test_internal_text PASS; test_schemas NOT RUN (venv lacks jsonschema); test_composed_token_budget_hf SKIPPED (no loadable HF assets; fixture policy stays RAW_CAP_ONLY honestly).
- be: ./mvnw test PASS (incl. new TextSearchModuleTests, TextPublicContractTests; ApiDocsWebTests counts 11/14).
- fe: npm run lint PASS, npm run build PASS (routes incl. /api/search/text + /search/text), node --test 17/17 PASS (stale-guard, composed-demo, composed-workbench, text-workbench).
- Live fixture journeys (AI 18011/Boot 18180/FE 3210, PG 55532, S3 38335): TEXT core→internal→Boot→Next parity (order f1/f5/f4, scores identical); negatives blank/overlong/badK/unknown-field/trace-mismatch/cap-16KiB (413)/publication-mismatch; IMAGE + COMPOSED UPLOAD ok; MIME mismatch 415; Next >11MiB 413 + chunked oversize 413; draft login→list→create→read, anon 403, logout 204 + old session 401; Swagger byte-equal; hero network log has zero /api/search/* (only /api/auth/me 401 anon).
- Browser (Playwright, hostname 127.0.0.1:3210): home/text/composed @1440 (+768/390 composed, 390 home) screenshots in evidence/; nav links to 3 modes keyboard-accessible; reduced-motion: page has no autoplay, matchMedia checked; hero demo labelled MINH HỌA, distinct from live workbenches.

## Limits / blockers

- Python 3.12 unavailable on host (only 3.11/3.13/3.14); AI suites ran on existing 3.13 venv — Deviation from ">=3.12,<3.13", recorded, no behavior change.
- Actual loaded-HF tokenizer overflow check: NOT RUN live (assets not loadable offline, test skips); fixture RAW_CAP_ONLY reported honestly, no fake REJECT_MODEL_LIMIT.
- History persistence still absent (per frozen scope). No push/PR/merge/deploy (delivery = local reviewed commit only).

## Processes / manual demo (7–10 min)

PIDs/ports/runbook: RUNBOOK.md. Preview http://127.0.0.1:3210/ (leave running). Manual: 1) open home, note 3-mode nav + labelled demo; 2) /search/text: search "váy đỏ" K=3 → 3 ranked cards + PILOT_ONLY details; try blank/1025-char text; 3) /search/composed upload + text; 4) login task-admin/Task-Admin-Test-Pass-123 → /catalog/drafts list/create; 5) /docs Swagger shows search/text; 6) logout → drafts 401.
