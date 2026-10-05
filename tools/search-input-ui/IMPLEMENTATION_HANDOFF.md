# IMPLEMENTATION_HANDOFF — search-input-ui (Pi Implement)

- Branch `codex/search-input-ui` từ base `9dc64600` (catalog ref giữ nguyên).
- Final HEAD: xem commit mới nhất (freeze sạch, dưới đây). Chưa push/merge.
- Preview: FE rebuild + restart guarded (listener mới, descendant verified),
  `http://catalog.localhost:3230`; Boot 18380, AI 18031, PG/S3 giữ nguyên.

## Files

- `fe/src/lib/clipboard-image.ts` (mới): `decidePaste`/`isEditableTarget`.
- `fe/src/components/image-search-workbench.tsx`: `handlePaste`, dropzone
  focusable + hint.
- `fe/src/components/image-search-workbench.module.css`: `.pasteHint`.
- `fe/src/components/text-search/text-search-workbench.module.css`: Stitch
  tokens + panel/grid + xóa class chết.
- `fe/src/app/search/text/page.module.css`: kicker token.
- `fe/tests/clipboard-image.test.mjs`, `fe/tests/css-tokens.test.mjs` (mới).

## Repro → fix

- TEXT: computed style trước sửa không có border (khớp screenshot user);
  nguyên nhân 6 `var(--…)` undefined → invalid. Fix tại component, không
  global alias. Sau: input `1px solid #E5E7EB`/trắng, CTA `#FF4D00`/chữ trắng
  (computed styles browser thật).
- IMAGE: chưa có paste. Thêm theo DESIGN, tái dùng `selectFile`.

## Commands/outcomes (worktree `fe/`)

- `node --test tests/*.test.mjs` → 44 pass (32 cũ + 12 mới).
- `npx tsc --noEmit` → sạch. `npm run lint` → 2 lỗi cũ `site-header.tsx`
  (đã verify y hệt trên base sạch, không phải của ticket này).
- `npm run build` → xanh (`/search/text` prerender OK).
- Browser: TEXT Anh "red summer dress" → 10 results grid 3 cột → detail
  37267 exact; Việt qua proxy `chân váy hồng…` → 200 cùng endpoint;
  paste synthetic image → preview, link → alert + không fetch + giữ file,
  reset → idle; 768/390 overflow=false; Tab vào textarea.
- Screenshots: packet `evidence/` (before-text + after-text-1440/results/
  768/390 + after-image-pasted-1440).

## Known limits

- Native Ctrl/Cmd+V từ OS clipboard: Not run (synthetic + unit đã cover
  handler) → manual gate của bạn.
- Không đổi Anh/Việt retrieval (user observation giữ nguyên, không benchmark).

## Manual (bạn làm, ~10 phút)

1. Focus khung ảnh landing → Ctrl/Cmd+V ảnh thật → preview → Tìm kiếm.
2. Dán text/link vào khung ảnh → lỗi đẹp, không mất gì.
3. Dán chữ vào ô TEXT → vẫn là text bình thường.
4. TEXT nhập query → kết quả → detail; thử file quá lớn/sai định dạng.
5. Xem 390px + Tab toàn trang.
