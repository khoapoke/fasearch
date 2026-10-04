# PLAN — catalog-discovery (Pi/Muse Implement)

- Start: 04/10/2026 ~18:30 Asia/Ho_Chi_Minh. Budget 150 phút → deadline ~21:00. 25 phút cuối (từ ~20:35) cho evidence/commit/review/handoff.
- Base: `499d9eefb` (`codex/real-pilot-integrated-demo`, checkout `/private/tmp/fasearch-real-pilot-integrated-demo`, clean).
- Branch: `codex/catalog-discovery`, checkout `/private/tmp/fasearch-catalog-discovery` (worktree mới, đã tạo).
- Nguồn chân lý: `TASK.md` rev 1 + `MASSIVE_PROMPT.md`; file này chỉ là kế hoạch thực thi, không override packet.

## Milestones

1. **Preflight (done ~18:30–18:35)**: verify base HEAD, worktree mới, ports gợi ý trống (3230/18380/18031/55732/38535), Python 3.12.14, asset hash `82b21a09…` = 600 dòng, design hashes khớp, kickoff toolchain (BE offline compile + FE npm install nền).
2. **BE public catalog API (~18:35–19:10)**:
   - `PublicCatalogSnapshot` (immutable, ordered): đọc đúng configured JSONL, validate unique product_id / one-version / category / snapshot, giữ deterministic file order. Không chạm Draft DB, không overlay properties, không `Map.copyOf` cho membership order.
   - `PublicCatalogBrowseUseCase` + `PublicCatalogController`: `GET /api/v1/catalog/products`, `GET /api/v1/catalog/products/{productId}` theo API_SPEC.
   - `SecurityConfiguration`: permitAll GET 2 path mới (không CSRF exemption mới, không đổi Draft paths).
   - OpenAPI additive + served copy byte-equal.
   - Unit/contract tests BE (filter/order/pagination/version/snapshot/errors/source-ownership).
3. **FE (~19:10–19:50)**:
   - Proxy `/api/catalog/products`, `/api/catalog/products/[productId]` (same-origin, no-store, trace).
   - `/catalog` list + `/catalog/[productId]` detail (CSS modules, Stitch tokens, Be Vietnam Pro qua font hệ thống/next, không Tailwind CDN, không ảnh remote).
   - Result cards 3 modes → detail link (giữ rank/similarity); home/header catalog entry.
   - Detail CTA → `/search/composed?anchor_…` PRODUCT branch (preview đã validate, không image part, giữ UPLOAD/reset/switch/abort/stale).
   - `catalog-contract.ts` types + FE tests affected/new.
4. **Stack + verification (~19:50–20:35)**: lifecycle `tools/catalog-discovery/lifecycle.sh` (start/health/warm/verify/stop/restart, PID/cwd/executable/listener guards, ports 3230/18380/18031/55732/38535); build jar + FE build; runners C1–C8 (page union 600, category 200×3, detail parity, 409/404/400, read-only counts, browser 3 modes + PRODUCT, responsive/keyboard, contract parity, asset hashes).
5. **Freeze → review → handoff (~20:35–21:00)**: freeze clean commit trước logs; independent reviewer (fresh, read-only app-code, runtime disposable OK) đánh giá C1–C8 Spec+Standards → REVIEW.md; fix ≤3 rounds; RUNBOOK + DEMO + IMPLEMENTATION_HANDOFF tiếng Việt; giữ preview chạy nếu an toàn.

## Quy tắc xuyên suốt

- Một writer duy nhất trong checkout mới; không sửa worktree nguồn, không broad pkill, không hosts/DNS.
- Retry ≤2/hypothesis, transient rerun 1, review/fix ≤3 rounds. Thiếu evidence bắt buộc = blocker, không gọi “minor”.
- Không push/PR/merge/deploy/nhắn teammate. Không sửa Control TASK/STATUS/DESIGN. Manual gate chờ user.
