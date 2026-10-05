# IMPLEMENTATION_HANDOFF — catalog-discovery (Pi/Muse Implement)

Ngày: 04/10/2026. Ngôn ngữ: tiếng Việt.

## Base / HEAD / branch / worktree

- Base: `499d9eefb7c7e3667a0b87bab397ea4ca96d9457` (`codex/real-pilot-integrated-demo`,
  checkout `/private/tmp/fasearch-real-pilot-integrated-demo`, nguyên vẹn, không chạm).
- Branch mới: `codex/catalog-discovery`, checkout `/private/tmp/fasearch-catalog-discovery`.
- Freeze round 1: `4dd21c8a7e382dd5541d1b1fa65b640e6be51a38` (clean).
- Freeze round 2 (final): `0eb34baa9d046746c4cf99f76349baf027e68614` (clean).
- Chưa push/PR/merge/deploy; không nhắn teammate. Manual gate chờ đại diện dự án.

## Thay đổi và lý do

**Backend** (`be/src/main/java`):
- `search/application/PublicCatalogSnapshot.java` (mới): reader bất biến, có thứ tự
  trên đúng configured JSONL; validate unique product/version, category, snapshot
  từng dòng; giữ nguyên file order. Membership KHÔNG từ Draft DB, KHÔNG overlay
  `fasearch.catalog.products`, không `Map.copyOf` cho order.
- `PublicCatalogSnapshotProvider.java` (mới): lazy load + latch lỗi → thiếu/không
  tương thích publication thì fail-closed 503 `CATALOG_UNAVAILABLE`, app vẫn start.
- `PublicCatalogBrowseUseCase.java` + `PublicCatalogBrowseModule.java` (mới):
  list (page ≥1 int32, size 1–60, category enum, expected snapshot → 409;
  `long` offset, past-end empty + total đúng) và detail (context version+snapshot
  cả hai hoặc không có; sai snapshot 409; unknown/wrong-version 404 uniform;
  `description: null`; không fallback, không metadata commerce/private).
- `search/api/PublicCatalogController.java` (mới): parse raw query phát hiện
  unknown/duplicate/blank/bare-param/overflow → 400; no-store + trace mọi outcome;
  round 2 thêm `safeTraceId` (F1): trace bị reject không bao giờ echo, envelope
  dùng UUID mới.
- `config/SearchConfiguration.java`: beans provider + browse module.
- `identity/SecurityConfiguration.java`: GET-only permitAll 2 paths mới; Draft/admin
  và CSRF exemption giữ nguyên.

**Contracts**: `contracts/public-api.openapi.json` 0.2.0→0.3.0 additive (2 GET paths
+ schemas CatalogItem/Page/Detail, thêm 3 error codes); served copy byte-equal;
internal AI contract diff rỗng.

**Frontend** (`fe/src`):
- `lib/catalog-contract.ts` (mới): types + `detailHref`/`composedAnchorHref`/
  `safeReturnHref` (round 2: chỉ giữ allowlisted path, drop query)/
  `parseCatalogView`.
- Proxies `app/api/catalog/products[/[productId]]` (same-origin, no-store, trace).
- `/catalog`: chips, counts, pager, URL state, stale guards, loading/empty/error/retry.
- `/catalog/[productId]`: ảnh/title/category thật, “Chưa có mô tả”, provenance,
  CTA anchor, dải “Cùng danh mục” từ list API thật, safe return_to.
- 3 search modes: cards link detail exact version/snapshot, giữ rank/similarity.
- Composed: chế độ PRODUCT (preview đã validate, không image part, exclusion +
  CSRF giữ nguyên) + UPLOAD/regression + switch/reset/abort guards.
- Header + home có mục Catalog. Stitch tokens, Be Vietnam Pro self-host, CSS modules.

**Tools** (`tools/catalog-discovery/`): PLAN, API_SPEC, RUNBOOK, DEMO,
lifecycle.sh (ports FE3230/Boot18380/AI18031/PG55732/S338535, PID/listener guards),
verify-catalog-api.sh (30 checks).

**Tests**: BE unit + controller + contract (thêm regression F1);
FE `tests/catalog-contract.test.mjs` (7 tests) + suite hiện có; lint + build sạch.

## C1–C8 coverage (checks/logs/screenshots thực tế)

- C1: union 25 pages = 600 identities unique; category 200×3; default/max/past-end;
  deterministic file order (API runner 30/30 PASS).
- C2: detail parity list/search/image; null description; 404 unknown/wrong-version;
  409 stale; 400 partial context; 503 fail-closed (unit) — live runner + browser.
- C3: browser 1440/768/390 screenshots đã xem trực tiếp (list/filter/page/detail,
  loading skeleton, error/retry, past-end empty, back, keyboard Tab, reduced-motion CSS).
- C4: TEXT/IMAGE/COMPOSED result→detail thật (CLIP live), giữ ranking/similarity,
  return an toàn; không raw query/image trong URL/storage.
- C5: detail→PRODUCT end-to-end (reference PRODUCT, EXCLUDE_ANCHOR_PRODUCT, anchor
  vắng mặt trong results); stale anchor denial; missing CSRF 403; UPLOAD regression
  (reference UPLOAD/NONE); switch/reset/abort guards.
- C6: Guest/User equality (md5 sau normalize trùng); DB versions/audit/images = 0
  trước/sau; GET-only allowlist; uniform denial; no-store/trace; F1 probe echo-count 0.
- C7: OpenAPI additive + served byte-equal (test); internal contract diff rỗng;
  BE full suite 21 classes 0 fail; FE lint/build/tests xanh; search/session/Draft
  smoke qua suite hiện có.
- C8: lifecycle start/health/warm/verify/stop/restart có guard; asset sha256
  `82b21a09…` trước/sau khớp; PID/port ownership verify; preview cũ nguyên vẹn.

## Asset/runtime identity và reviewer limitations

- Reviewer độc lập (fresh, read-only app-code): round 1 BLOCKED (F1 P1 + F2/F3 P2 +
  live evidence Not run do reviewer không có shell/browser/git-range).
- Đã fix F1/F2, re-verify toàn bộ trên HEAD final, freeze sạch, đang chờ round 2.
- Round 2: PASS trên HEAD `0eb34baa` (delta `4dd21c8a..0eb34baa`).
  F1/F2 verified fixed tĩnh + tests; F3 giữ nguyên đúng TASK pilot; C1–C8 live evidence
  (parent-executed) được trích dẫn đóng gaps. Xem REVIEW.md trong packet.
  Residuals: R1 (pre-existing search trace pattern, follow-up ngoài scope),
  R2 (handler fallback), R3 (F3 note). Manual gate vẫn chờ đại diện dự án.
- (Cập nhật verdict round 2 tại đây khi có.)

## Preview URL, PID/start/test/stop/restart

- Preview: `http://127.0.0.1:3230` (FE), Boot `18380`, AI `18031` — đang chạy,
  giữ nguyên nếu an toàn; start/stop xem RUNBOOK.
- Raw logs: `/private/tmp/catalog-discovery-*.log`, target surefire-reports,
  screenshots `/tmp/catdisc-evidence/` (catalog/detail/composed × viewports).

## Manual journey và blockers

- Journey tay: xem DEMO.md (~10 phút).
- Blocker còn lại: verdict round 2 + manual gate của đại diện dự án. Không tồn
  tại blocker kỹ thuật nào khác ở thời điểm handoff.

---

## Lunch run 05/10/2026 11:53–12:04 +07 (Pi Implement, LUNCH_PROMPT, 90 phút)

- Nhận việc HEAD `86bf4545` sạch (đúng SHA Control kiểm); preview sẵn healthy
  nên KHÔNG restart stack. Browser hostname `http://catalog.localhost:3230`.
- `git diff 15d6e1df..86bf4545 -- be/ fe/` rỗng → BE 81/FE 32/lint/build cũ
  vẫn hiệu lực cho app-tree; lunch chạy lại trên HEAD hiện tại:
  `verify-catalog-api.sh 18380` 30/30 PASS; `PublicCatalogControllerTests`
  5/5; FE `node --test` 32/32; Swagger served `/docs/openapi.json` byte-equal
  `contracts/public-api.openapi.json`; catalog SHA `82b21a09…` khớp pins.
- C6 script mới `c6-readonly-check.sh` (reusable, exit status): guest browse
  full 600 + details → counts PG y nguyên (`user_accounts=1`, catalog/audit
  tables 0); guest/auth equality trace-normalized PASS; login→/me 200 →
  logout→401; `/me` không session → 401. Hai vấp trong script (login JSON
  403 do form-login+CSRF; logout token cũ 403) là artifact test-flow, đã sửa
  trong runner, KHÔNG phải defect sản phẩm.
- Browser thật (Playwright MCP): list/filter TOP/page/detail 10011 exact;
  TEXT → top 59983 khớp API; IMAGE 10011.jpg → top-1 chính nó; COMPOSED
  anchor 10011 → 10 kết quả, anchor excluded, `return_to` back đúng;
  detail 28500 exact + strip "Cùng danh mục"; 404/409 UI có trace UUID;
  query không vào URL/storage; overflow=false ở 768 và 390; Tab focus
  di chuyển; header/footer IMAGE → `/#tim-bang-anh`.
- Evidence: `docs/prototypes/catalog-discovery/evidence-lunch/` (3 logs) +
  packet `evidence/lunch-*.png` (detail-1440, image-results-1440,
  catalog-768, catalog-390).
- Commit lunch chỉ thêm runner + handoff + logs (không đổi be/fe).
  Manual 10–15 phút + quyết định nghiệm thu/publish thuộc về bạn.
