# oxk FaSearch adapter

Bản project-local `0.1.0-fasearch.1`, chuyển từ bundle oxk `v0.1.0`. Provenance nằm ở `provenance.json`; audit và capability matrix nằm trong `docs/agents/oxk-integration.md` của FaSearch.

Giữ Control → Grill khi cần → Pi/Muse Implement → independent Review → kiểm tra tay. Source template/task CLI dùng `.agent/tasks/<slug>/`. Profile cho FaSearch là `nextjs,spring-boot,fastapi`; profile React/Vite chỉ giữ để tương thích kit, không áp dụng cho frontend hiện tại.

Từ root FaSearch:

```bash
node tools/oxk/bin/oxk.mjs init --project . --profiles nextjs,spring-boot,fastapi --local-pi --dry-run
node tools/oxk/bin/oxk.mjs init --project . --profiles nextjs,spring-boot,fastapi --local-pi
node tools/oxk/bin/oxk.mjs task <slug> --project . --mode task
node tools/oxk/bin/oxk.mjs task <ui-slug> --project . --mode ui
node tools/oxk/bin/oxk.mjs doctor --project . --task <slug>
```

`init` preflights managed conflicts/symlinks và bảo toàn context/packet có sẵn; không có force. Preview và xem diff trước khi update. Không dùng stock oxk CLI cho FaSearch vì packet path khác. Source task templates ở `templates/task/`; bản để nhóm đọc/copy ở `.agent/templates/` phải đồng bộ khi thay đổi có chủ ý. `init` không overwrite project template copies.

Skill local ở `.agents/skills/oxk/`, Pi prompts ở `.pi/prompts/oxk-*.md`. Trong trusted Pi project chạy `/reload`, rồi `/oxk-control .agent/tasks/<slug>` và các role còn lại. Tránh nạp package oxk đồng thời với local resources. Trong Codex dùng `$oxk` với role/path rõ; nếu chưa discover thì đọc SKILL.md theo path. Các bản references local và snapshot giữ self-contained, ưu tiên snapshot khi làm việc.

`doctor` chỉ kiểm integrity/context; không chứng nhận acceptance criteria, plugin loading, budgets, CI, model entitlement hoặc manual gate. CLI không network, install plugin, scaffold application code, đổi global settings hay ship. Quyền merge thuộc đại diện nhóm.

Upstream skills là optional references trong `upstreams.lock.json`, không được tải/cài kèm. Historical VALIDATION.md không phải chứng cứ của adapter. Chạy checks từ thư mục `tools/oxk/`:

```bash
npm test
npm run check
```

Không cần `npm install`; CLI/tests dùng Node built-ins, Node >=20.
