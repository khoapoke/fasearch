# IMPLEMENTATION_HANDOFF — real-pilot-integrated-demo revision 1

- Base `7b909a0257e6cc95db5a83e2dd5e7b61d84825ef`, final HEAD xem commit freeze (lifecycle + validators + docs/prototypes/real-pilot-demo, không sửa production ngoài wiring đã chứng minh).
- Thay đổi: mới `tools/real-pilot-demo/lifecycle.sh` + `verify-r1/r234/r5/r6/r7.sh`; `docs/prototypes/real-pilot-demo/{RUNBOOK,DEMO_ADVISOR,INPUT_AUDIT,IMPLEMENTATION_HANDOFF}` + `evidence/screenshots/*-1440|390.png` + logs. Không endpoint/migration/API/DB mới, không tune model/index.
- Wiring: AI `hf_clip` + frozen bundle; Boot `FASEARCH_CATALOG_FILE` trỏ catalog thật qua `FixtureCatalogProductAdapter` có sẵn; FE proxy ảnh có sẵn. Không sửa thuật toán, không `KMP_DUPLICATE_LIB_OK`.

| ID | Kết quả | Evidence |
| --- | --- | --- |
| R1 | PASS 7/7 | `verify_week4_artifacts.py` 600x512, catalog/mapping/config/weights hashes, 600 identities/images (`/tmp/rp-r1.log`) |
| R2 | PASS | Cold load ~1252ms, `hf_clip`, model/index/publication exact, token budget 77, warm TEXT OK (`lifecycle warm`, `/tmp/rp-r234.log`) |
| R3 | PASS 9/9 | TEXT 2 queries + IMAGE 2 ảnh + COMPOSED UPLOAD/PRODUCT, AI/Boot/Next parity order/count/scores ≤1e-5, anchor exclusion, stale 409, wrong-version 404 (`/tmp/rp-r234.log`) |
| R4 | PASS | Browser TEXT/IMAGE/COMPOSED 1440/390 ảnh thật, bytes sha khớp catalog qua Boot+Next, hero MINH HỌA, similarity thô (`evidence/screenshots/`, đã xem ảnh) |
| R5 | PASS 13/13 | TEXT/COMPOSED overflow REJECT_MODEL_LIMIT trước encode, MIME/413/400/CSRF 403, no-store+trace, AI-down 503 → recovery (`/tmp/rp-r5.log`) |
| R6 | PASS 12/12 | Admin login/me/list/create v1/revise v2/stale 409/upload v3/bytes/not-searchable/logout 204/old-session 401; anon 401; DB mới chỉ seed task-admin nên scope đa-user theo RBAC code (`/tmp/rp-r6.log`) |
| R7 | PASS 10/10 | Lifecycle executable, PID/listener guards, old stacks 3210/18180/18011/18080/8001 còn giữ, restart transcript (`/tmp/rp-r7.log`, `/tmp/rp-restart-transcript.log`) |
| R8 | Pending review/manual | Freeze commit + independent review + manual representative |

- Chạy: `http://localhost:3220/`, Swagger `http://localhost:18280/`; dừng `lifecycle.sh stop`; PID files `/private/tmp/fasearch-real-pilot-*.pid`; containers `fasearch-real-pilot-demo-pg/s3`.
- Hạn chế trung thực: self-query 11739 chỉ kiểm mapping; CLIP chưa kiểm chứng tiếng Việt; không benchmark/latency SLO; similarity thô không phải confidence.
- Reviewer giới hạn: không HTTP/shell thì kiểm raw evidence, không waive mục bắt buộc. Không sửa source sau verdict nếu không re-review.
