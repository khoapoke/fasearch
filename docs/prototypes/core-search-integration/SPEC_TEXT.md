# SPEC_TEXT — NEW TEXT vertical slice (additive, frozen semantics)

Task: core-search-integration-2h, rev1. Base a207f9f. Owner: Pi/Muse Implement.
Status: spec-before-code, 04/10/2026 Asia/Ho_Chi_Minh.

## 1. Routes (JSON only, no multipart)

- Public (Boot): `POST /api/v1/search/text`, `Content-Type: application/json`.
- Internal (AI): `POST /internal/v1/search/text`, `Content-Type: application/json`.
- Same-origin (Next): `POST /api/search/text`, JSON passthrough, keeps ADR-0001 session cookie + page-memory CSRF.
- No image/anchor/client publication/model/alpha/exclusion fields anywhere. Unknown JSON fields rejected.

## 2. Public request shape

```json
{"schema_version":"1.0.0","query_text":"áo đỏ","k":10}
```

- `schema_version`: const `"1.0.0"`, required.
- `query_text`: raw UTF-8 string, 1..1024 Unicode code points (`codePointCount`), NFC-whitespace `modelView` nonempty. Malformed encoding/schema/types → 400/422 per existing conventions (Boot: `INVALID_REQUEST` 400 for empty/unknown, `TEXT_TOO_LONG` 400 for >1024; AI mirrors).
- `k`: optional integer 1..100, default 10. Non-integer/out-of-range → 400 `INVALID_REQUEST` (Boot) / 422 internal validation.
- `X-Trace-Id` header: optional; `[A-Za-z0-9_\-.:]{1,128}` else 400 `INVALID_REQUEST`; absent → server generates UUID. Returned on every success/error as `X-Trace-Id` + `trace_id` body; `Cache-Control: no-store` on all TEXT responses.
- Guest uses existing CSRF handshake; TEXT adds NO new CSRF exception. Boot `SecurityConfiguration`: `permitAll("/api/v1/search/text")` but CSRF ignoring stays only `/api/v1/search/image`. Authenticated callers need same public search scope (no new scope).

## 3. Body cap 16 KiB (Next + Boot + AI)

- Limit 16384 bytes on raw JSON bytes BEFORE full parsing, for both `Content-Length` and chunked (no length). Next: pre-check declared length → 413 fast path, then `await request.text()` length check → 413 before `JSON.parse`. Boot: read `InputStream` capped at 16385 bytes → 413 `INVALID_REQUEST`/`IMAGE_TOO_LARGE`? Use code `INVALID_REQUEST` status 413 with message "Request body exceeds 16 KiB limit" (mirrors composed 413 shape). AI: `await request.body()` length check → 413 before JSON parse. Never trust `Content-Length` alone.

## 4. AI internal contract

Request JSON (Boot → AI):

```json
{"schema_version":"1.0.0","query_text":"raw","k":10,"trace_id":"…","catalog_snapshot_id":"…","model_version":"…","index_version":"…"}
```

- Strict (`extra="forbid"`), same code-point/normalized/k/trace rules. Header `X-Trace-Id` if present must equal body `trace_id` else 422.
- Behavior: reuse cached `SearchEngine` via `get_text_search_module()` (same `_cached_engine_bundle` key as image/composed). Before encoding, apply SAME loaded-tokenizer guard as Composed: `tokenizer.model_max_length` if exposed → count tokens of `normalized_model_view(query_text)` → exceed raises `TokenBudgetExceededError` → 400 `TEXT_TOO_LONG`. If no tokenizer, policy `RAW_CAP_ONLY` (fixture honest, never fake `REJECT_MODEL_LIMIT`).
- Success response (internal):

```json
{"schema_version":"1.0.0","trace_id":"…","mode":"TEXT","publication":{…triple…},"requested_k":10,"returned_k":3,"provenance":{"artifact_scope":"PILOT_ONLY","model_config_hash":"…","text_normalization_version":"nfc-whitespace-v1","text_overflow_policy":"RAW_CAP_ONLY|REJECT_MODEL_LIMIT"},"results":[{"product_id":"…","product_version_id":"…","rank":1,"similarity_score":0.31}],"ai_latency_ms":12.3}
```

- No `query_text`/`normalized_text` echo, no private `image_path`, no filenames, no body logging. `rank` 1-based sequential, `similarity_score` finite double, `requested_k==k`, `returned_k==len(results)<=k`.
- Errors: `INVALID_REQUEST` 400/422, `TEXT_TOO_LONG` 400, `PUBLICATION_MISMATCH` 409, `MODEL_UNAVAILABLE`/`INDEX_UNAVAILABLE` 503, all with `trace_id`, `no-store` implied by FastAPI JSON (add `Cache-Control: no-store` header explicitly).

## 5. Boot contract

- Pins configured immutable `publication` once per request from `FaSearchProperties.publication()`. Sends expected triple + validated raw `query_text`/`k`/`trace_id`.
- `AiTextSearchPort.Request(queryText,k,traceId,publication)`, `Response(schemaVersion,traceId,mode,publication,requestedK,returnedK,provenance,results,aiLatencyMs)`.
- Fail-closed validation of AI response: `schema_version=="1.0.0"`, `mode=="TEXT"`, `trace_id` echo, publication equality, `requestedK==command.k`, `returnedK==results.size()<=k`, ranks sequential, finite scores/latency, provenance `PILOT_ONLY` + nonempty `modelConfigHash` + `nfc-whitespace-v1` + overflow policy in `{RAW_CAP_ONLY,REJECT_MODEL_LIMIT}`. Else `AI_CONTRACT_MISMATCH` 503. Publication mismatch → `AI_PUBLICATION_MISMATCH` 503. No model/index fallback, no business-backend fallback in Next.
- Success (public) adds catalog join WITHOUT re-rank: `title/category/image_url` from `CatalogProductReader.findActive`, order preserved. Missing key → `CATALOG_VERSION_MISMATCH` 503. Shape:

```json
{"schemaVersion":"1.0.0","traceId":"…","mode":"TEXT","publication":{…},"requestedK":10,"returnedK":3,"provenance":{…same as internal…},"results":[{"productId":"…","productVersionId":"…","rank":1,"similarityScore":0.31,"title":"…","category":"TOP","imageUrl":"…"}],"latency":{"aiLatencyMs":12.3,"totalLatencyMs":20.1}}
```

(Snake/camel follows Jackson SNAKE_CASE global: wire is `schema_version` etc. — Java records serialize per global strategy; contract JSON in OpenAPI uses snake_case.)

- Error envelope: `{"schema_version":"1.0.0","trace_id":"…","code":"…","message":"…"}` + `X-Trace-Id`, `no-store`. Codes: `INVALID_REQUEST` 400, `TEXT_TOO_LONG` 400, 413 body-cap, `AI_PUBLICATION_MISMATCH`/`AI_CONTRACT_MISMATCH`/`AI_UNAVAILABLE`/`AI_TIMEOUT`/`CATALOG_VERSION_MISMATCH` 503.

## 6. Next contract

- Validates `Content-Type` JSON, applies 16 KiB cap, forwards `{schema_version,query_text,k}` + `X-Trace-Id` + session cookie + `x-csrf-token` to Boot. Never logs query body. Propagates status/body/headers (`X-Trace-Id`, `no-store`). `BACKEND_UNAVAILABLE` 502 only on fetch throw.
- UI `TextSearchWorkbench`: free text (textarea, maxlength guidance 1024 code points), K number 1..100 default 10, submit. States: idle/loading/success(empty vs results)/error. Shows `PILOT_ONLY`, provenance secondary details, rank/raw similarity to 4 decimals (never %/confidence), stale guard via `createRequestGuard` + AbortController on reset/mode-switch. Keyboard labels/focus, reduced-motion safe (no autoplay).

## 7. OpenAPI

- `contracts/public-api.openapi.json`: add `POST /api/v1/search/text` (request `TextSearchRequest`, response `TextSearchResponse`, errors `AuthError`/`SearchError`), schemas `TextSearchRequest/TextSearchResponse/TextProvenance/TextResult`.
- `contracts/internal-ai.openapi.json`: add `POST /internal/v1/search/text` with internal schemas.
- `be/src/main/resources/docs/openapi.json`: byte-equal copy of canonical public contract after edits (generated by copy, verified by test).

## 8. Tests (new)

- `ai/tests/test_internal_text.py`: strict field rejection, code-point cap, normalized-empty, k bounds, trace mismatch, no echo/private fields, token-guard honest policy, parity `SearchEngine.search_text` vs endpoint ordering/scores.
- `be/src/test/.../TextSearchModuleTests.java` + controller contract test: validation, fail-closed AI mismatch, join order, no-store/trace headers.
- `fe/tests/text-workbench.test.mjs`: validation limits + stale guard.
- Full-stack fixture: core→internal→Boot→Next→render parity (order/product/version/rank/count, score ≤1e-5).

## 9. Closure addendum (bounded streaming + strict text)

- Pre-buffer bounds: Next TEXT streams `request.body` with early 16 KiB stop (covers chunked/missing length); Next Composed streams raw bytes with early 11 MiB stop then rebuilds formData from the bounded bytes (same forward semantics); AI TEXT consumes `request.stream()` with early 16 KiB stop; Boot reads the servlet InputStream capped (covers chunked). A downstream 413 never substitutes for the pre-buffer guard.
- Strict text: lone surrogates / non-UTF-8-encodable query text is rejected 400 `INVALID_REQUEST` (typed, trace + no-store) at Next (regex), AI (strict UTF-8 round-trip before normalize/core) and Boot (REPORT-decoder + surrogate scan), plus module-level `ValueError` guard. K: null/bool/float/out-of-int-range rejected; absent defaults 10.
