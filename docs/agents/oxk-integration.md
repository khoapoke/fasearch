# Tích hợp oxk vào FaSearch — 01/10/2026

Đã áp dụng bản project-local `0.1.0-fasearch.1` để nâng workflow trước implementation. Thay đổi thuộc agent tooling/tài liệu; production code, quyết định sản phẩm và packet cũ được bảo toàn. Chưa commit/PR; review độc lập và manual gate vẫn pending.

## Nguồn và audit

- Bundle: `/Users/khoado/Downloads/oxk-v0.1.0.bundle`; Git verify xác nhận complete history.
- Tag/HEAD upstream: `v0.1.0` / `6e5014c67d1864c3c4ff8798e4922c036554d3c5`.
- SHA-256 bundle: `3f4b9493f9a872a73abb05f867899ffa6dd815adca25a07b96d92a6b02481feb`.
- Audit source ở thư mục tạm trước khi chạy CLI; source adapter được giữ tại `tools/oxk/` để cập nhật không phụ thuộc checkout tạm hoặc Downloads.
- Snapshot provenance/hash: `.agent/oxk.json`; template/source local không giả định là upstream nguyên bản. `sourceCommit: null` phản ánh chưa có standalone Git commit cho adapter; `upstreamCommit` là ref của bundle, không phải reviewed commit FaSearch.
- Upstream validation được giữ với nhãn historical; chỉ kết quả thực thi dưới đây là evidence của lượt này.

## Những điểm đã ráp

| Bundle mặc định | FaSearch adapter |
| --- | --- |
| `.agent/<slug>/` | `.agent/tasks/<slug>/`; giữ nguyên năm packet cũ |
| React/Vite, Spring Boot | Next.js + Spring Boot + internal FastAPI/retrieval theo D054 |
| TASK/STATUS/REVIEW | Thêm task revision, command cwd, shipping/manual riêng; DESIGN cho UI |
| State lowercase | Giữ uppercase gate FaSearch; legacy trạng thái không bị migrate |
| Control hợp nhất STATUS | Áp dụng cho task mới; Implement ghi STATUS khi được chuyển owner rõ cho lượt đó |
| Generic delivery/overnight merge | Pi/Muse scoped PR into codex/vertical-slice; đại diện nhóm merge |
| Ponytail tùy hướng generic | full implementation/fixes, lite review, off grilling theo AGENTS.md |
| Optional upstream routing | Ưu tiên skills hiện có; upstream không cài kèm |
| Skill/package resources | Materialize local skill + UI metadata + bốn Pi prompt; không cài global |

Root `AGENTS.md` giữ nguyên phần chính và thêm block oxk; workflow, issue tracker và README đã nối các entry points. Source templates ở `tools/oxk/templates/task/`, project copies ở `.agent/templates/`. Managed snapshot ở `.agent/workflow/`; router/references self-contained ở `.agents/skills/oxk/`. Không chỉnh file managed trực tiếp để tránh conflict khi update; sửa source rồi preview/init.

## Cách dùng ngay

Từ root repo:

```bash
node tools/oxk/bin/oxk.mjs task <slug> --project . --mode task
node tools/oxk/bin/oxk.mjs task <ui-slug> --project . --mode ui
node tools/oxk/bin/oxk.mjs doctor --project . --task <slug>
```

Pi trong trusted project: `/reload`, kiểm startup diagnostics, rồi `/oxk-control .agent/tasks/<slug>`; có `/oxk-grill`, `/oxk-implement`, `/oxk-review`. Codex: `$oxk` kèm role và packet path; đọc SKILL.md trực tiếp nếu session chưa refresh. Vị trí repo `.agents/skills/` và metadata `agents/openai.yaml` phù hợp [tài liệu skill chính thức của OpenAI](https://learn.chatgpt.com/docs/build-skills). Pi 0.99.1 local docs tại `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/skills.md` và `prompt-templates.md` xác nhận discovery/project trust/reload; chưa chạy inference để kiểm startup trong lượt này.

Không dùng stock bundle `init/task` trong FaSearch: khác packet path/profile/policy. Cập nhật adapter bằng source local, `init --dry-run`, kiểm diff rồi `init`; managed conflict không được force overwrite. Các thay đổi packet chưa commit phải bàn giao file-state/hash hoặc sync ref trước khi sang worktree khác.

## Skills / plugins: khả năng thật và tham chiếu

| Nhóm | Quan sát hiện tại | Cách dùng |
| --- | --- | --- |
| Engineering skills | Codex exposes grilling, domain-modeling, codebase-design, diagnosing-bugs, tdd, code-review, prototype, frontend-design, research | Chọn theo task; đọc skill và dependencies; không load cả bộ |
| Pi package entries | settings có Ponytail, pi-subagents, pi-warden, pi-goal-x, pi-web-access, pi-mcp-adapter, pi-typesafe | Configured only; xác minh command/mode/budget trong Pi thực tế |
| Emil / HumanLayer / pstack | Bundle pin reference SHAs; không có code cài kèm | Không tuyên bố installed/active; kiểm license/dependencies/host khi cần |
| Browser / GitHub | Có tool trong Codex session; Stitch đọc được qua tab Brave đã login | Không suy diễn Pi có cùng access; task rights chi phối external writes |
| Overnight | Chưa có deadline/budget/continuation owner theo task | Chưa bật; cần bounded contract và host verification |

Không thêm extension, global skill, config model hay quyền service như side effect. Không tạo chat/subagent hoặc chạy unattended. Pi vẫn cần pilot riêng để xác minh resource discovery và extensions; file integrity không thay thế pilot đó.

## Stitch và scope đồ án

Project “FashionSearch AI Storefront” đã được quan sát có 17 screens và 1 style board. Workflow mới dùng DESIGN.md để map từng screen sang use case/requirement và ghi phần visual muốn giữ. Checkout, cart, shipping, vouchers/loyalty không tự thành requirement; D003 giữ scope tìm kiếm. Chưa fetch/export source HTML hoặc chọn UI direction trong task tích hợp workflow này.

## Verification của lượt tích hợp

| Check | Cwd | Kết quả |
| --- | --- | --- |
| Git bundle verify + hash | Repo root | Passed; upstream ref/hash ở trên |
| Upstream npm test / npm run check | Isolated /private/tmp/fasearch-oxk-audit-20261001 | 9 tests passed; kit structure passed |
| Adapter npm test / npm run check | tools/oxk | 10 tests passed; kit structure passed |
| Adapter extra scenario | Temporary fixtures | Canonical task path, new profiles, legacy preservation, local metadata, dry-run and duplicate refusal passed |
| Bootstrap dry-run/apply | Repo root | Materialized local resources; no global settings change |
| Snapshot doctor, skill validation, preservation/diff checks | Repo root | Passed: doctor errors [], skill valid, diff whitespace clean and preservation confirmed; exact limitations in STATUS.md |
| Product tests / live Pi pilot / independent Review / manual gate | N/A | Not run; not implied by workflow checks |

The integration packet is `.agent/tasks/oxk-workflow-integration/`. No final PASS is claimed for the uncommitted change. Review uses the committed workflow diff and separate manual check when the project representative chooses that checkpoint.
