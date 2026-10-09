# Workflow nhiều session cho FaSearch

## Mục đích và nguồn chung

Control là session điều phối: lập task, soạn prompt bàn giao, tổng hợp kết quả, theo dõi quyết định và trả lời câu hỏi của đại diện nhóm. Các session Implement, Review và Grill chỉ làm việc trên một task được chỉ rõ. Chưa tạo session nào chỉ vì tài liệu này tồn tại; đại diện nhóm sẽ chỉ định session khi cần.

Mỗi task dùng một packet tại `.agent/tasks/<slug>/` với `TASK.md`, `STATUS.md`, `REVIEW.md`; task UI thêm `DESIGN.md`. Đây là **một nguồn trạng thái làm việc chung**; nó không thay thế đề cương CNTT-KLCN198, Decision Register, schema/contract, research protocol hoặc `CONTEXT.md`. Dùng [template packet](../../.agent/templates/) khi mở task mới. Không tạo thêm nhánh packet ở `.agent/<slug>/` hoặc `.scratch/`.

Các worktree/branch khác nhau **không tự nhìn thấy thay đổi chưa commit của nhau**. Trước khi giao việc, Control phải bảo đảm session nhận được đúng phiên bản packet bằng checkout/ref phù hợp hoặc bằng nội dung được bàn giao rõ ràng. Prompt luôn nêu đường dẫn packet và branch/SHA hiện hành; không coi đoạn chat được paste là nguồn sự thật cao hơn file và mã nguồn.

## Vai trò và quyền ghi

| Session | Việc chính | File được cập nhật trong lượt đó | Bàn giao |
|---|---|---|---|
| **Control** | Chọn task kế tiếp, kiểm tra nguồn, chia một vertical slice, soạn prompt, ghi quyết định đã được đại diện nhóm duyệt, theo dõi gate | `TASK.md`, `STATUS.md`, `.agent/PROJECT.md`; tài liệu quyết định khi được phép | Prompt ngắn, đúng packet và câu hỏi cần giải quyết |
| **Implement** | Pi/Muse triển khai hoặc sửa đúng một ticket trên branch/worktree riêng; chạy check phù hợp | Production code và artifacts đúng scope; trả evidence để Control hợp nhất `STATUS.md` | Tóm tắt file đổi, branch/HEAD, lệnh và kết quả thật, PR, blocker |
| **Review** | So sánh diff tại base/review SHA cố định với spec và chuẩn repo; kiểm tra độc lập | Chỉ `REVIEW.md` và ghi chú review, không sửa production code trong lượt review | Verdict, findings có vị trí/bằng chứng, checks đã chạy hoặc `Not run` |
| **Grill** | Chất vấn lựa chọn về scope, kiến trúc, trạng thái hoặc trade-off; đưa khuyến nghị và câu hỏi quyết định | Mặc định trả kết quả trong chat; Control ghi quyết định đã được đại diện nhóm chốt vào `TASK.md` | Các phương án, tác động, khuyến nghị, quyết định còn cần người duyệt |

Đại diện nhóm duyệt thay đổi scope/kiến trúc và merge PR. Một implementation writer sở hữu mỗi file/worktree tại một thời điểm. Reviewer không merge target của chính mình. Khi Pi Ponytail có sẵn, Implement dùng `full`, Review dùng `lite`, Grill dùng `off` và xác minh mode trong từng session.

## Vòng đời một ticket

1. **Control chuẩn bị:** kiểm tra nguồn theo `AGENTS.md`, tạo packet với mục tiêu, phạm vi/ngoài phạm vi, acceptance criteria, nguồn, owner và câu hỏi mở. Chỉ chuyển sang `READY_FOR_IMPLEMENTATION` khi quyết định cần thiết đã được duyệt. Task khảo sát hoặc đang chờ quyết định giữ trạng thái riêng như `SCOUT_READY` hoặc `NEEDS_DECISION`.
2. **Implement nhận việc:** đọc `AGENTS.md`, `CONTEXT.md`, `TASK.md`, `STATUS.md` và chỉ các nguồn được packet trỏ tới. Xác minh branch/base, làm đúng một slice, trả handoff bằng chứng thực thi để Control cập nhật `STATUS.md`. Nếu phải đổi scope/kiến trúc, ghi blocker và trả Control; không tự mở rộng ticket.
3. **Control chuyển review:** nhận handoff của Implement, đối chiếu `STATUS.md`, ghi rõ PR hoặc base/review SHA trong prompt cho Review. Không suy diễn `PASS` từ tóm tắt trong chat.
4. **Review kiểm tra:** pin một cặp SHA, review theo **Spec** và **Standards**, ghi findings và check đã chạy vào `REVIEW.md`. Verdict là `CHANGES_REQUESTED`, `PASS_WITH_NOTES`, `PASS`, `BLOCKED`, `PROVISIONAL` hoặc `NOT_STARTED`; `Not run` không được đổi thành `Verified` từ chứng cứ cũ.
5. **Control điều phối tiếp:** nếu có lỗi, soạn prompt fix cho Implement trên cùng ticket rồi review lại commit mới. Nếu vướng quyết định, gửi Grill và trình đại diện nhóm. Chỉ đại diện nhóm quyết định merge; sau merge Control cập nhật trạng thái đóng task.

Giữ trạng thái trong `STATUS.md` ngắn và thực tế: current gate, branch/base/HEAD/PR, `Verified`/`Failed`/`Not run`/`Blocked`, blocker và next action. `TASK.md` là hợp đồng công việc; `REVIEW.md` là bằng chứng review. Quyết định mới ghi dưới `## Decisions` với ngày, người duyệt và tác động; không sửa ngầm quyết định Locked.

## Prompt để copy sang session khác

Thay các phần trong dấu `<...>` bằng giá trị thật. Control chỉ đưa những nguồn cần cho task, không paste lại toàn bộ lịch sử chat.

### Implement

```text
Bạn là session Implement cho FaSearch. Làm đúng một ticket: .agent/tasks/<slug>/.
Đọc AGENTS.md, CONTEXT.md, TASK.md, STATUS.md và các nguồn canonical được TASK.md chỉ ra. Xác minh branch/base và trạng thái READY_FOR_IMPLEMENTATION trước khi sửa production code. Implement trên branch/worktree riêng theo acceptance criteria; không tự đổi scope hoặc kiến trúc. Chạy check phù hợp và trả handoff gồm task revision, lệnh/cwd/kết quả thực tế, HEAD SHA, PR và blocker để Control cập nhật STATUS.md. Khi xong, trả handoff ngắn để mình chuyển cho Control; không merge PR.
```

### Review

```text
Bạn là session Review cho FaSearch. Review ticket .agent/tasks/<slug>/ tại base <base-sha> và review <head-sha> (PR: <url-or-none>).
Đọc AGENTS.md, TASK.md, STATUS.md, diff và nguồn liên quan. Review độc lập theo hai trục Spec và Standards; ghi findings có mức độ, file/dòng và bằng chứng vào REVIEW.md. Ghi chính xác check đã chạy và Not run; không sửa production code hoặc merge. Trả verdict và handoff ngắn cho Control.
```

### Grill

```text
Bạn là session Grill cho FaSearch. Xem .agent/tasks/<slug>/ và câu hỏi quyết định: <question>.
Đọc AGENTS.md, TASK.md, STATUS.md, REVIEW.md nếu có, rồi chỉ mở nguồn canonical liên quan. Chất vấn giả định, nêu 2-3 phương án với tác động tới scope, data, API, test và tiến độ; đưa một khuyến nghị có lý do. Không coi khuyến nghị là quyết định đã duyệt. Trả danh sách câu hỏi thật sự cần đại diện nhóm chốt để Control ghi vào packet.
```

Control có thể thêm một dòng mô tả mục tiêu cụ thể của lượt và cặp branch/SHA. Nếu session nhận thấy packet không cùng phiên bản với prompt, dừng phần phụ thuộc và báo Control để đồng bộ trước.

## oxk FaSearch: context, design và gate bổ sung

Bản adapter `0.1.0-fasearch.1` giữ packet path và các vai trò hiện có. `.agent/PROJECT.md` chứa facts về stack, commands và capabilities; `.agent/oxk.json` pin provenance/hash; `.agent/workflow/` là snapshot. Xem [audit tích hợp](oxk-integration.md). Chỉ đọc profile/playbook cần cho ticket: `nextjs`, `spring-boot`, `fastapi`. React/Vite không áp dụng cho frontend hiện tại.

Control là writer mặc định của TASK/STATUS. Implement trả handoff; nếu một lượt cần Implement ghi STATUS trực tiếp, Control phải chuyển ownership rõ trong packet/prompt và không ghi đồng thời. Packet cũ giữ bằng chứng và trạng thái; không đổi hàng loạt. Review chỉ ghi REVIEW; DESIGN có owner được Control chỉ định. Khi scope/criteria/quyết định đổi, tăng task revision; phiên bản packet chưa commit phải có hash hoặc file-state được bàn giao để worktree khác nhận đúng nội dung.

`VERIFIED` cần required checks và review độc lập tại commit được chỉ rõ. Final PASS chỉ áp dụng cho revision đã commit với phạm vi review sạch; các thay đổi unrelated được giữ nguyên, không yêu cầu xóa chúng để review. Dirty previews ghi PROVISIONAL và pin patch/hash; không phong PASS cuối cùng. `PASS_WITH_NOTES` chỉ chứa notes không chặn, không che lỗi quan trọng hay missing required checks. `MANUAL_PASS` cần xác nhận thật từ đại diện nhóm. Shipping, manual gate và verdict là ba trường riêng. Code mới làm verdict cũ hết hiệu lực cho phần bị ảnh hưởng. Reviewer không tự merge.

Task UI dùng DESIGN.md để chốt reference, tokens/component reuse, responsive, accessibility, trạng thái và evidence. Prototype Stitch “FashionSearch AI Storefront” là nguồn visual; phải map screens vào requirement trước khi implement. D003 loại full commerce: giỏ hàng, thanh toán, vận chuyển và loyalty không tự trở thành scope. Grill chỉ xử lý lựa chọn thật sự còn mở; không bắt bạn duyệt lại quyết định đã chốt.

Tạo task từ repo root bằng CLI local:

```bash
node tools/oxk/bin/oxk.mjs task <slug> --project . --mode task
node tools/oxk/bin/oxk.mjs task <ui-slug> --project . --mode ui
node tools/oxk/bin/oxk.mjs doctor --project . --task <slug>
```

Pi: `/reload` sau khi thêm resources, rồi `/oxk-control .agent/tasks/<slug>`; các prompt còn lại là `/oxk-grill`, `/oxk-implement`, `/oxk-review`. Project trust và startup diagnostics quyết định resource loading; tránh cài package oxk global đồng thời với local resources. Codex dùng `$oxk` với path/role rõ; discovery tại `.agents/skills/oxk/`, hoặc đọc SKILL.md trực tiếp nếu session chưa refresh.

Handoff tối thiểu: packet path + revision/hash, role, worktree/branch, base/HEAD, allowed writes, acceptance/gate, selected profiles/skills, commands + cwd + actual outcomes, blocker và next owner. Chưa tạo chat/worker chỉ vì template tồn tại. Overnight chỉ mở khi scope/rights/deadline/budget/continuation owner được chốt và capabilities thực sự hoạt động; kit không bật unattended execution hoặc merge.
