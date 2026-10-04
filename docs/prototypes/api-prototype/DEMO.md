# Demo script — 5–7 minutes

Target: http://127.0.0.1:18080/docs (Boot + AI + disposable PG/object storage running per README).

| Min | Action | Expected |
| --- | --- | --- |
| 0–1 | Open `/docs`; show 11 operations + Schemas, no schema/network errors | FaSearch Public API 0.1.0 OAS 3.1 renders |
| 1–2 | Try it out `GET csrf` → Execute; then `POST login` with `X-CSRF-TOKEN` + bootstrap credentials → Execute | 200 + `Set-Cookie: FASEARCH_SESSION` (HttpOnly, JS cannot read it) |
| 2–3 | Try it out `GET me` → Execute | 200 `proto-admin` + authorities incl. `CATALOG_DRAFT_WRITE` |
| 3–4 | Re-run csrf (post-login refresh); Try it out `POST drafts` `{title, category}` → Execute; `PATCH` with `expected_version_no` → Execute; repeat PATCH with stale version | 201 v1 → 200 v2 → 409 conflict |
| 4–5 | Try it out `POST drafts/{id}/image` (upload PNG) → Execute; `GET` image back; compare bytes | v3 `has_primary_image: true`; identical bytes/checksum |
| 5–6 | Try it out `POST /search/image` (upload fixture photo, k=3) → Execute | 200 ranked `f1/f5/f4` + `publication {catalog_snapshot_id, model_version, index_version}` + `latency` |
| 6–7 | Try it out `POST logout` → Execute; `GET me` again; `POST drafts` without token | 204; then 401; write without CSRF 403 |
| — | Limitations to state | Fixture plumbing only (no Vi quality claim); docs disabled in `prod`; AI 503 body `AI_UNAVAILABLE` when AI down; full evidence in `IMPLEMENTATION_HANDOFF.md` |
