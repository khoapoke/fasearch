# PLAN — search-input-ui (clipboard IMAGE + Stitch TEXT)

Base `9dc64600`, branch `codex/search-input-ui`, worktree
`/private/tmp/fasearch-catalog-discovery`. Giữ nguyên model/query/rank/API.

## U1/U2 — paste ảnh

- Mới `fe/src/lib/clipboard-image.ts`: `decidePaste(target, clipboard)` thuần —
  editable (textarea/select/input phi-file/contenteditable) → ignored;
  `files[0]` → image; `text/uri-list`/`text/html` → rejected; còn lại ignored.
  Không đọc clipboard ngoài event, không fetch URL.
- `image-search-workbench.tsx`: `onPaste` trên dropzone label (`tabIndex=0`,
  aria-label) + hint `pasteHint` + facts. Image → `selectFile` (đúng pipeline
  validate/preview/guard); rejected → error visible, giữ selection cũ, không
  auto-submit. File/drop/reset không đổi.

## U3/U4 — TEXT Stitch

- `text-search-workbench.module.css`: thay 6 token undefined
  (`--thread-dark/--thread/--paper/--porcelain/--cobalt/--aubergine`) bằng
  global Stitch (`--line/--line-soft/--surface/--surface-subtle/--accent/
  --accent-deep/--brand`); xóa ~70 dòng class IMAGE chết; panel 340px +
  results grid `auto-fill minmax(230px,1fr)`; CTA cam full-width + hover/focus;
  breakpoint stack 960px; giữ reduced-motion.
- `page.module.css`: kicker `--aubergine` → `--brand`.

## U5/U6 — không đổi hành vi + regressions

- Không chạm query/API/model/fusion/auth. Tests mới:
  `tests/clipboard-image.test.mjs` (6 cases synthetic) và
  `tests/css-tokens.test.mjs` (changed CSS không còn legacy/undefined token).
- Browser thật: computed styles, TEXT Anh → 10 results grid → detail exact,
  Việt qua proxy OK; paste synthetic (image/link/reset) trong browser;
  viewports 1440/768/390 + Tab. Native Ctrl/Cmd+V OS là manual gate.

---

## Revision2 — TEXT settled continuity (S1–S5) + Q1 read-only

- Mới `search-state.ts`: draft/pending(snapshot)/settled(success incl.
  empty)/failure thuần túy, unit-test races (typing giữ settled, edit giữa
  pending thoát skeleton + late response bị bỏ, success thay thế, failure
  giữ cũ + nhãn query, validation không nổ request, reset sạch).
- Component dùng view-state: submit snapshot draft; skeleton grid Stitch
  (`skeletonCount=min(k,8)`, aria-busy, reduced-motion tĩnh); lỗi hiện nhãn
  `Giữ kết quả của “…”`; empty success trung thực (live API TEXT không bao
  giờ rỗng — nhánh này chỉ unit-covered, ghi rõ).
- Q1: xem RETRIEVAL_DIAGNOSTIC.md (4 query top10 + coverage + public==internal).
