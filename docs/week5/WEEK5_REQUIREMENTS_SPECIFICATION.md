# Week 5 Requirements Specification

## Trạng thái tài liệu

- Phiên bản: `0.1-draft`
- Ngày: 20/09/2026
- Phạm vi: website tìm kiếm sản phẩm thời trang đa phương thức, Backend API và các capability hỗ trợ bắt buộc
- Trạng thái: draft để nhóm/GVHD review; chưa phải baseline `Approved`
- Nguồn traceability chính: đề cương CNTT-KLCN198, `WEEK5_COMPLIANCE_MATRIX.md`, D001-D006, D054-D055 và schema hiện hành

Tài liệu này đặc tả **cái hệ thống phải làm** và acceptance criteria ở mức phân tích. Nó không phải design class, OpenAPI contract, database migration hoặc bằng chứng đã triển khai.

## 1. Mục tiêu hệ thống

Hệ thống phải cung cấp một website cho phép người dùng khám phá và tìm sản phẩm thời trang bằng:

1. hình ảnh;
2. mô tả ngôn ngữ tự nhiên;
3. ảnh kết hợp mô tả thay đổi mong muốn.

Hệ thống đồng thời phải hỗ trợ quản trị catalog, tài khoản/quyền, product processing, publication nhất quán và lưu vết cần thiết để kiểm thử, đánh giá và báo cáo kết quả trung thực.

Mục tiêu Week 5 là hoàn tất phân tích yêu cầu và tạo contract traceability cho use case, analysis class và data model. Week 5 không cam kết cài đặt website/backend.

## 2. Ranh giới hệ thống

### 2.1 Bên trong ranh giới core

- Website Next.js/TypeScript.
- Spring Boot API nghiệp vụ công khai.
- Python/FastAPI AI service nội bộ dùng chung core PyTorch/FAISS.
- Python background worker cho quality/tag/embedding/index job.
- PostgreSQL cho dữ liệu nghiệp vụ và metadata.
- Object storage cho ảnh/artifact; FAISS cho vector index.
- Identity, RBAC, catalog, profile, history, saved product, search, processing, publication, audit và evaluation evidence cần cho rubric.

### 2.2 Ngoài core

- mobile native;
- payment, shipping, POS, loyalty, accounting;
- multi-branch inventory và procurement đầy đủ;
- order/return/refund workflow phức tạp;
- outfit compatibility, VTON và 3D;
- multi-tenant marketplace nhiều seller.

Các nội dung ngoài core chỉ được mở bằng change proposal phù hợp; chúng không được làm thay đổi acceptance của ba search mode bắt buộc.

## 3. Stakeholder và actor

| ID | Actor/stakeholder | Mục tiêu chính | Ghi chú phạm vi |
|---|---|---|---|
| `ACT-01` | Guest | Xem catalog, tìm kiếm, xem kết quả/chi tiết, đăng ký hoặc đăng nhập. | Không có dữ liệu cá nhân gắn account. |
| `ACT-02` | Registered User | Quản lý profile, history, saved product và tương tác với kết quả. | Chỉ thao tác dữ liệu của mình. |
| `ACT-03` | Operations Staff | Tạo/sửa catalog draft, quản lý metadata/ảnh và theo dõi processing. | Không quản trị quyền đặc quyền, không tự publish. |
| `ACT-04` | Administrator | Quản lý user thường/role không đặc quyền và publication catalog. | Không tự cấp Super Administrator. |
| `ACT-05` | Super Administrator | Quản lý Administrator, role/permission bảo vệ và security configuration. | Chuyên biệt của Administrator; không cần xuất hiện như actor cấp gốc ở sơ đồ overview. |
| `STK-01` | Nhóm sinh viên | Xây dựng, kiểm thử, đánh giá và đóng gói hệ thống. | Owner theo stream phải được gán tên sau review. |
| `STK-02` | GVHD | Review phạm vi, semantics còn mở và deliverable học thuật. | Nguồn xác nhận cao nhất khi có chỉ đạo mới. |
| `STK-03` | Research/Evaluation role | Tạo snapshot/run/metric và error analysis. | Actor của subsystem đánh giá, không chi phối use-case website chính. |

Actor-permission matrix và 27 rule về actor/quyền nằm trong `WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md` và được coi là normative dependency của tài liệu này.

## 4. Quy ước requirement

- `MUST`: bắt buộc để đáp ứng đề cương/core.
- `SUPPORTING`: không được rubric gọi tên riêng nhưng cần cho tính đúng/an toàn/truy vết.
- `OPEN`: requirement source là bắt buộc nhưng semantics chưa được phép tự khóa.
- Mọi requirement dưới đây ở trạng thái `Draft` cho tới khi nhóm/GVHD review.
- Acceptance criterion mô tả bằng chứng cần có; không được đổi thành `Pass` nếu chưa chạy test hoặc chưa có artifact.

## 5. Functional requirements

### 5.1 Identity và authentication

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-AUTH-001` | MUST | Guest có thể đăng ký account bằng các trường bắt buộc và credential hợp lệ. | Với input hợp lệ, tạo đúng một active account và không trả password/secret; email/username trùng hoặc input sai bị từ chối có lỗi trường rõ ràng. |
| `FR-AUTH-002` | MUST | Người có account hợp lệ có thể đăng nhập. | Credential đúng tạo session/token theo policy; credential sai hoặc account bị khóa không tạo session và không tiết lộ account có tồn tại hay không. |
| `FR-AUTH-003` | MUST | Người đã xác thực có thể đăng xuất session hiện tại. | Session/token bị thu hồi hoặc vô hiệu hóa theo cơ chế đã chọn; request bảo vệ sau đó không còn được chấp nhận bằng session đó. |
| `FR-AUTH-004` | MUST | Người đã xác thực có thể đổi mật khẩu của mình sau khi chứng minh quyền sở hữu session/account. | Mật khẩu hiện tại hoặc re-authentication được kiểm tra; mật khẩu mới tuân policy; credential cũ không còn dùng để tạo session mới. |
| `FR-AUTH-005` | SUPPORTING | Hệ thống quản lý lifecycle session/token và account lock. | Token hết hạn đúng cấu hình; account disabled/locked bị chặn ở server; sự kiện nhạy cảm có audit record. |

### 5.2 Authorization và security governance

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-RBAC-001` | MUST | Spring Boot API kiểm tra permission server-side cho mọi hành động bảo vệ. | Request thiếu permission nhận 403, không làm đổi state; việc ẩn nút trên UI không phải bằng chứng authorization. |
| `FR-RBAC-002` | MUST | Administrator có thể gán/thu hồi role không đặc quyền theo policy. | Thay đổi hợp lệ cập nhật quyền hiệu lực và tạo audit event; yêu cầu cấp role bảo vệ bị từ chối. |
| `FR-RBAC-003` | SUPPORTING | Super Administrator có thể quản lý lifecycle Administrator và định nghĩa role/permission bảo vệ. | Chỉ actor có permission đặc quyền thực hiện được; thay đổi tạo audit event append-only và không làm mất Super Administrator hoạt động cuối cùng. |
| `FR-RBAC-004` | SUPPORTING | Permission có thể kiểm tra theo action, resource và ownership/scope. | Test chứng minh Registered User không đọc/sửa dữ liệu account khác và Operations Staff không publish khi không có permission. |

### 5.3 Profile

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-PROFILE-001` | MUST | Registered User có thể xem profile của mình. | API chỉ trả các trường được phép của current account; truy cập profile account khác bị từ chối. |
| `FR-PROFILE-002` | MUST | Registered User có thể cập nhật các trường profile được phép. | Chỉ allowlisted fields thay đổi; field bảo vệ như role/status không thay đổi qua profile API; dữ liệu sai bị từ chối theo trường. |

### 5.4 Public catalog

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-CAT-PUBLIC-001` | MUST | Guest và Registered User có thể xem danh sách sản phẩm được công bố. | Chỉ product/version thuộc active catalog publication được trả; hỗ trợ phân trang hoặc giới hạn kết quả có contract rõ. |
| `FR-CAT-PUBLIC-002` | MUST | Guest và Registered User có thể xem chi tiết sản phẩm. | Response gồm identifier/version, title, category, description và image phù hợp; product không active không lộ qua public endpoint. |

### 5.5 Catalog management

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-CAT-MGMT-001` | MUST | Operations Staff hoặc Administrator có permission có thể tạo Catalog Product draft. | Draft có stable product ID, version đầu, creator và timestamp; thiếu dữ liệu bắt buộc bị từ chối hoặc giữ ở draft với validation state rõ. |
| `FR-CAT-MGMT-002` | MUST | Actor có quyền có thể cập nhật product draft hoặc tạo version mới khi dữ liệu ảnh hưởng search thay đổi. | Thay đổi representation tạo Product Version mới; version đã publish không bị ghi đè. |
| `FR-CAT-MGMT-003` | MUST, semantics OPEN | Actor có quyền có thể xóa/quản lý sản phẩm theo nghĩa được nhóm/GVHD chốt. | Mặc định an toàn là archive/soft delete; hard delete dữ liệu đã publish chưa được phép cho tới khi `W5-O06` được quyết định. |
| `FR-CAT-MGMT-004` | MUST | Actor có quyền có thể gán/quản lý category trong ranh giới taxonomy MVP. | Root category chỉ nhận `TOP`, `BOTTOM`, `ONE_PIECE`; category khác bị reject hoặc giữ ở future draft theo policy đã chốt. |
| `FR-CAT-MGMT-005` | MUST | Actor có quyền có thể thêm, thay, chọn primary và loại ảnh khỏi draft/version. | Mỗi ảnh có ID, URI, checksum, processing/quality state; version publish có đúng một primary image theo policy. |
| `FR-CAT-MGMT-006` | MUST | Actor có quyền có thể quản lý title, description và metadata/facet liên quan. | Giá trị, source, confidence/model/taxonomy version được lưu khi áp dụng; raw prediction không bị ghi đè bởi reviewed value. |
| `FR-CAT-MGMT-007` | SUPPORTING | Hệ thống quản lý lifecycle `DRAFT -> PROCESSING -> NEEDS_REVIEW/INDEXED/FAILED -> ACTIVE -> ARCHIVED`. | Transition không hợp lệ bị từ chối; update đồng thời dùng version check; chỉ version đủ điều kiện mới Active. |

### 5.6 Processing và metadata review

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-PROCESS-001` | SUPPORTING | Actor có quyền có thể gửi product version vào processing/reprocessing. | Job tham chiếu exact product version và idempotency key; request lặp không tạo side effect trùng. |
| `FR-PROCESS-002` | SUPPORTING | Worker thực hiện quality check, tagging, embedding và chuẩn bị index artifact theo pipeline đã cấu hình. | Mỗi output gắn model/preprocessing/input version và checksum/provenance cần thiết; lỗi không tự chuyển product sang Active. |
| `FR-PROCESS-003` | SUPPORTING | Metadata confidence thấp hoặc conflict có thể đi vào review. | Reviewer/Operations Staff có permission có thể accept, edit hoặc cannot-judge; raw và reviewed values cùng được truy vết. |
| `FR-PROCESS-004` | SUPPORTING | Job thất bại có thể retry an toàn. | Retry không double-publish, không trộn version và lưu attempt/error state. |
| `FR-PROCESS-005` | SUPPORTING | Operations Staff/Administrator có thể theo dõi trạng thái job và lỗi được phép xem. | UI/API hiển thị state, product version, timestamps và actionable error summary; không lộ secret/stack trace nhạy cảm. |

### 5.7 Catalog/index publication

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-PUBLISH-001` | SUPPORTING | Administrator có quyền có thể publish một catalog/index snapshot tương thích. | Publication atomically trỏ tới một bộ catalog/model/index versions; search không thấy partial update. |
| `FR-PUBLISH-002` | SUPPORTING | Administrator có quyền có thể rollback về publication hợp lệ trước đó. | Rollback khôi phục pointer/manifest nhất quán, tạo audit event và không ghi đè artifact lịch sử. |
| `FR-PUBLISH-003` | SUPPORTING | Hệ thống kiểm tra compatibility và provenance trước khi activate publication. | Mismatch product/embedding/model/index bị chặn bằng lỗi rõ; manifest ghi publisher, timestamp và version/hash. |

### 5.8 Search bằng hình ảnh

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-SEARCH-IMG-001` | MUST | Guest hoặc Registered User có thể upload ảnh truy vấn hợp lệ. | Loại/kích thước/nội dung không xử lý được bị từ chối có lỗi rõ; AI service không tự tải URL tùy ý từ người dùng. |
| `FR-SEARCH-IMG-002` | MUST | Hệ thống biểu diễn ảnh thành embedding và retrieve/rank sản phẩm theo publication hiện hành. | Response dùng một catalog/model/index version nhất quán và trả product IDs, versions, rank, score/provenance theo contract. |
| `FR-SEARCH-IMG-003` | MUST | Website hiển thị danh sách kết quả image search theo thứ tự similarity/ranking. | Top-K giữ đúng rank API; mỗi item có ảnh/thông tin tối thiểu và mở được product detail. |

### 5.9 Search bằng mô tả tự nhiên

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-SEARCH-TEXT-001` | MUST | Guest hoặc Registered User có thể nhập mô tả tự nhiên. | Input rỗng/quá giới hạn/sai encoding bị xử lý rõ; raw query được giữ theo privacy policy khi cần trace. |
| `FR-SEARCH-TEXT-002` | MUST | Hệ thống biểu diễn text thành embedding và retrieve/rank sản phẩm. | Response gắn model/catalog/index version và không âm thầm chuyển model/index khi service lỗi. |
| `FR-SEARCH-TEXT-003` | MUST | Website hiển thị sản phẩm phù hợp với mô tả theo thứ tự ranking. | Top-K giữ đúng rank API, có empty/error states và cho phép mở chi tiết. |

### 5.10 Search đa phương thức ảnh-văn bản

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-SEARCH-MULTI-001` | MUST | User có thể gửi ảnh/anchor product cùng mô tả thay đổi trong một Search Request. | Request thiếu một trong hai thành phần bắt buộc bị từ chối; anchor product phải thuộc publication được resolve. |
| `FR-SEARCH-MULTI-002` | MUST | Hệ thống kết hợp embedding ảnh và text bằng strategy/version đã khai báo. | Fusion config/model version được trả trong provenance; không trộn embedding không tương thích. |
| `FR-SEARCH-MULTI-003` | MUST | Hệ thống xếp hạng và website hiển thị Top-K sản phẩm kèm thông tin và ảnh. | Response có K/rank rõ, product version hợp lệ và display không đổi thứ tự ngoài rule đã công bố. |

### 5.11 Hành vi chung của search/result

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-SEARCH-COMMON-001` | MUST | Mọi mode trả danh sách kết quả và cho phép xem product detail. | Ba mode dùng response contract tương thích và cùng semantics product/version. |
| `FR-SEARCH-COMMON-002` | SUPPORTING | Search response có query ID, mode, product/version, rank, score và model/index/catalog provenance. | Contract test xác nhận field bắt buộc; version mismatch không bị che giấu. |
| `FR-SEARCH-COMMON-003` | SUPPORTING | Hệ thống trả lỗi validation, unavailable, timeout và version mismatch có mã phân biệt. | UI có loading/empty/error states; retry chỉ áp dụng cho thao tác idempotent và có giới hạn. |
| `FR-SEARCH-COMMON-004` | SUPPORTING | Khi taxonomy/evidence stage được mở, kết quả có thể phân Exact/Substitute/Unverified mà không gọi UNKNOWN là Exact. | Test deterministic chứng minh category và explicit `must_not` không bị relax; feature có thể chưa bật ở vertical slice đầu. |

### 5.12 History, saved product và result interaction

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-HISTORY-001` | MUST | Search của Registered User có thể tạo history entry gắn owner và provenance tối thiểu. | Entry thuộc đúng account; Guest search không tạo history cá nhân gắn account. |
| `FR-HISTORY-002` | MUST | Registered User có thể xem và xóa history của mình. | Phân trang/ordering xác định; thao tác với history account khác bị từ chối; xóa tuân retention/audit policy. |
| `FR-SAVED-001` | MUST | Registered User có thể lưu/bỏ lưu Catalog Product quan tâm. | Cặp user-product là duy nhất; request lặp idempotent; user khác không sửa quan hệ này. |
| `FR-SAVED-002` | MUST | Registered User có thể xem danh sách sản phẩm đã lưu. | Chỉ trả quan hệ thuộc current account; product archived được biểu diễn theo policy chứ không trỏ sai version. |
| `FR-RESULT-001` | MUST, OPEN | Hệ thống phải hỗ trợ “chọn/hủy chọn” hoặc tương tác kết quả theo nghĩa được GVHD xác nhận. | Chưa thiết kế persistence/cardinality cho tới khi `W5-O01` chốt saved product, transient comparison hoặc feedback; acceptance sau đó phải tách khỏi các semantics còn lại. |

### 5.13 Audit và security operations

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-AUDIT-001` | SUPPORTING | Hành động nhạy cảm về account, role, catalog, review và publication tạo audit event append-only. | Event có actor, action, target, outcome, timestamp và correlation ID phù hợp; API nghiệp vụ không hỗ trợ sửa/xóa event. |
| `FR-AUDIT-002` | SUPPORTING | Administrator/Super Administrator có permission có thể xem audit log theo scope. | Administrator chỉ thấy phạm vi cho phép; Super Administrator thấy security trail toàn hệ thống; dữ liệu nhạy cảm được redact. |
| `FR-SEC-GOV-001` | SUPPORTING | Super Administrator có thể khóa/mở/hạ quyền/phục hồi Administrator theo rule bảo vệ. | Không thao tác được với Super Administrator cuối cùng theo cách làm mất toàn bộ quyền phục hồi. |
| `FR-SEC-GOV-002` | SUPPORTING | Super Administrator có thể quản lý role/permission definition bảo vệ. | Mọi thay đổi được validate, audit và không cho phép Administrator thường tự mở rộng đặc quyền. |
| `FR-SEC-GOV-003` | SUPPORTING | Hành động đặc quyền cao yêu cầu re-authentication; MFA là mục tiêu time-box nếu được duyệt. | Re-authentication được kiểm tra ở server; trạng thái MFA phải được ghi đúng là implemented hay deferred, không được claim mơ hồ. |

### 5.14 Evaluation và research evidence

| ID | Mức | Requirement | Acceptance criterion |
|---|---|---|---|
| `FR-EVAL-001` | MUST | Nhóm có thể tạo catalog/data snapshot tái lập được cho experiment. | Manifest có source, hash, schema version, timestamp và split/snapshot identity. |
| `FR-EVAL-002` | MUST | Mỗi model/checkpoint dùng trong đánh giá được đăng ký exact identity và preprocessing. | Manifest có model ID, revision/checkpoint, hash, preprocessing version và environment. |
| `FR-EVAL-003` | MUST | Hệ thống đánh giá phải sinh Precision@K, Recall@K và response time cho protocol đã chốt. | Output ghi độ đo được chọn (Cosine, Euclidean hoặc phương án tương đương có lý do), K, sample/query count, qrels version, environment, per-query result và aggregate; pilot/final được phân biệt. |
| `FR-EVAL-004` | SUPPORTING | Evaluation lưu run artifact và error/limitation evidence đủ để tái kiểm tra claim. | Run có config/seed/code/data/model hashes, status, metrics và failure reason nếu không thành công. |

## 6. Non-functional requirements

| ID | Nhóm | Mức | Requirement và acceptance criterion |
|---|---|---|---|
| `NFR-ARCH-001` | Architecture | MUST | Next.js gọi Spring Boot public API; Spring Boot sở hữu auth/catalog/history/quyền và orchestration; FastAPI/worker sở hữu thực thi AI, không có bản sao user/role/CRUD. Kiểm bằng component/contract review. |
| `NFR-INT-001` | Integration | MUST | Contract Java-Python version hóa request/error/provenance; ba search mode có contract tests và rank/product-version parity với core Python phù hợp. |
| `NFR-PERF-001` | Performance | MUST | Báo end-to-end p50/p95 cho workload/environment ghi rõ; final test có Precision@K, Recall@K và response time. Không dùng latency CLI Week 4 làm latency website. |
| `NFR-PERF-002` | Performance | SUPPORTING | Báo latency thành phần cho N=50, 100, 200 theo D042; threshold pass/fail được freeze sau validation, trước final test. |
| `NFR-SEC-001` | Security | MUST | Deployment dùng HTTPS; credential không log; password dùng adaptive password hash được cấu hình/version hóa. |
| `NFR-SEC-002` | Security | MUST | Authorization và ownership được kiểm tra server-side; các negative permission tests quan trọng phải pass. |
| `NFR-SEC-003` | Security | MUST | Upload kiểm tra type/size/content và lưu bằng reference an toàn; AI service không fetch arbitrary user URL. |
| `NFR-SEC-004` | Security | SUPPORTING | Secret/config nhạy cảm không nằm trong source hoặc response; log/error được redact. |
| `NFR-SEC-005` | Security | SUPPORTING | Hành động đặc quyền có re-authentication và audit; MFA chỉ được claim khi có test evidence. |
| `NFR-PRIV-001` | Privacy | MUST | Ảnh truy vấn/user có purpose, retention và delete policy; không dùng training mặc định nếu chưa có consent riêng. |
| `NFR-PRIV-002` | Privacy | MUST | User chỉ truy cập profile/history/saved product của mình; export/log không lộ PII ngoài mục đích. |
| `NFR-PRIV-003` | Privacy | SUPPORTING | Telemetry Guest không được biến thành personal history và phải tuân policy đã công bố. |
| `NFR-REL-001` | Reliability | MUST | Search/API có loading, empty, validation, timeout và unavailable states; lỗi AI không làm hỏng dữ liệu nghiệp vụ. |
| `NFR-REL-002` | Reliability | SUPPORTING | Background job idempotent; retry không double-publish; state transition dùng optimistic/version check. |
| `NFR-REL-003` | Reliability | SUPPORTING | Publication/rollback atomic; search không trộn catalog/model/index versions. |
| `NFR-DATA-001` | Data integrity | MUST | Published Product Version và experiment raw artifact là immutable; thay đổi tạo version mới. |
| `NFR-DATA-002` | Data integrity | MUST | Foreign key/unique/check constraints bảo vệ ownership, role mapping, one-save-per-user-product và version identity theo data model. |
| `NFR-DATA-003` | Data governance | MUST | Dataset/snapshot/manifest có provenance; self-collected data phải có quy trình collect/clean mô tả được. |
| `NFR-AUDIT-001` | Auditability | SUPPORTING | Product, facet, embedding, index, search và privileged action mang version/provenance đủ để truy vết. |
| `NFR-AUDIT-002` | Auditability | SUPPORTING | Audit event append-only trong API nghiệp vụ và có retention/access policy. |
| `NFR-REPRO-001` | Reproducibility | MUST | Research run có seed, code commit, data/model/config hash, dependency/environment record và status. |
| `NFR-REPRO-002` | Reproducibility | SUPPORTING | Reported table/figure/metric truy ngược được tới artifact; không nhập số không có nguồn như kết quả thực tế. |
| `NFR-OBS-001` | Observability | SUPPORTING | Request có trace/correlation ID qua browser, Spring Boot, FastAPI/worker và các bước AI chính. |
| `NFR-OBS-002` | Observability | SUPPORTING | Log/metric theo dõi latency, error, job và publication mà không lộ secret/PII. |
| `NFR-COMPAT-001` | Compatibility | MUST | Website hoạt động trên browser test matrix được ghi rõ và responsive trên desktop/màn hình nhỏ; Android/iOS native không phải acceptance MVP. |
| `NFR-ACC-001` | Accessibility | SUPPORTING | Flow chính có label, keyboard navigation, focus state và contrast/scalable text hợp lý; kiểm bằng checklist hoặc tool đã ghi phiên bản. |
| `NFR-USE-001` | Usability | SUPPORTING | Image/text/composed mode, loading/error/empty state và Top-K ranking được phân biệt rõ; user không phải đoán mode hay trạng thái xử lý. |
| `NFR-MAINT-001` | Maintainability | SUPPORTING | Identity, Catalog, Review, Search orchestration và AI core có ranh giới module rõ; Next.js không nhân bản nghiệp vụ backend. |
| `NFR-MAINT-002` | Maintainability | SUPPORTING | Public API, internal AI contract và schema/version có test/compatibility policy; thay đổi breaking tạo version/change record. |
| `NFR-DPLY-001` | Deployment | MUST | Có môi trường deploy chạy Next.js, Spring Boot, PostgreSQL/storage và AI service/worker; Colab notebook không làm production server. |
| `NFR-DPLY-002` | Deployment | MUST | Release có health/smoke/E2E, backup/demo fallback và kiểm tra model/index/catalog compatibility. |

## 7. Business rules

### 7.1 Rule về actor/quyền được nhập tham chiếu

Các rule sau được định nghĩa đầy đủ và duy nhất trong `WEEK5_SCOPE_ACTORS_AND_PERMISSIONS.md`; tài liệu này không sao chép nguyên văn để tránh drift:

| Nhóm rule | Phạm vi áp dụng |
|---|---|
| `BR-ACT-001..004` | Actor/account/generalization và system boundary. |
| `BR-AUTH-001..012` | Server-side authorization, role governance, Super Administrator cuối cùng, audit và re-authentication. |
| `BR-CAT-001..005` | Draft/publish separation, publication provenance, Active state và product versioning. |
| `BR-USER-001..003` | Ownership profile/history/saved, Guest telemetry và semantics result interaction. |
| `BR-EXT-001..003` | Extension phải tách khỏi core và cần change proposal. |

### 7.2 Rule về search và dữ liệu

- `BR-SEARCH-001`: Mỗi Search Request có đúng một mode `IMAGE`, `TEXT` hoặc `COMPOSED`.
- `BR-SEARCH-002`: `COMPOSED` cần cả anchor image/product và modification text; thiếu một thành phần là invalid request.
- `BR-SEARCH-003`: Một response chỉ dùng một bộ catalog/model/index publication tương thích; không trộn version giữa các result.
- `BR-SEARCH-004`: Thứ tự Top-K từ ranking service phải được giữ khi website hiển thị, trừ rule hậu xử lý đã version hóa và công bố.
- `BR-SEARCH-005`: Guest search không tạo personal search history; Registered User history luôn có owner.
- `BR-SEARCH-006`: UNKNOWN/không đủ evidence không được hiển thị như Exact; category và explicit `must_not` không được âm thầm relax.
- `BR-DATA-001`: Public catalog chỉ hiển thị Active Product Version thuộc current Catalog Publication.
- `BR-DATA-002`: Published Product Version là immutable; thay đổi ảnh/text ảnh hưởng representation phải tạo version và job mới.
- `BR-DATA-003`: Mỗi Saved Product là quan hệ duy nhất giữa một Registered User và một Catalog Product.
- `BR-DATA-004`: Metric/report phải ghi protocol, K, sample size, data/qrels/model version và environment; pilot không được đổi nhãn thành final.

## 8. Assumptions

| ID | Assumption | Rủi ro nếu sai |
|---|---|---|
| `ASM-001` | Core dùng một catalog do nhóm vận hành, không phải marketplace nhiều seller. | Cần thêm tenant/shop ownership, permission và ERD. |
| `ASM-002` | Một User Account có thể giữ nhiều role. | Permission model và actor generalization phải đổi nếu chỉ cho một role. |
| `ASM-003` | Operations Staff, Administrator và Super Administrator vẫn có thể dùng public search capability khi policy cho phép. | Sơ đồ generalization/permission matrix cần sửa. |
| `ASM-004` | AI model/index artifact được chuẩn bị và load qua internal service/worker, không train trong request Web. | Kiến trúc, latency và deployment sẽ đổi đáng kể. |
| `ASM-005` | Ba root category MVP là `TOP`, `BOTTOM`, `ONE_PIECE`. | Schema, data, UI và evaluation phải migrate nếu mở category. |
| `ASM-006` | Individual owner chưa được ghi trong nguồn hiện hành; owner theo discipline chỉ là placeholder. | Compliance không đủ dùng cho quản trị tiến độ nếu không gán tên. |

## 9. Constraints

| ID | Constraint |
|---|---|
| `CON-001` | Website là deliverable bắt buộc; mobile chỉ là extension theo D055. |
| `CON-002` | Public business API dùng Spring Boot; Next.js là website; FastAPI là AI adapter nội bộ theo D054. |
| `CON-003` | PostgreSQL lưu metadata nghiệp vụ, object storage lưu ảnh/artifact và FAISS là research index mặc định theo D006. |
| `CON-004` | Không xây full e-commerce, POS, payment, shipping, loyalty hoặc accounting trong core theo D003. |
| `CON-005` | Trước implementation phải có analysis baseline gồm scope, actor, permission, requirement, acceptance criteria và interface tối thiểu. Use case chi tiết, sequence, analysis class và ERD được hoàn thiện lặp lại sau mỗi vertical slice, nhưng phải đủ bộ trước khi đóng gói review Week 5-6. |
| `CON-006` | Precision@K, Recall@K và response time final thuộc Week 11; pilot Week 4 không thay thế final protocol. |

## 10. Out of scope

- Native Android/iOS client.
- Payment authorization/capture/refund và reconciliation.
- Shipping carrier integration/tracking.
- POS, accounting, loyalty, multi-branch stock và procurement.
- Complex order, return, exchange và dispute workflow.
- Supplier portal hoặc marketplace multi-tenancy.
- Outfit compatibility, VTON/3D và personalization trong core Week 5.
- Multilingual fine-tuning/model selection mới trong Week 5.

## 11. Open questions và default không làm vượt quyền

| ID | Câu hỏi | Requirement bị ảnh hưởng | Default cho tới khi chốt | Owner xác nhận |
|---|---|---|---|---|
| `W5-O01` | “Chọn/hủy chọn” là Saved Product, transient comparison hay feedback? | `FR-RESULT-001` | Không tạo persistence/entity riêng; giữ requirement `OPEN`. | GVHD |
| `W5-O02` | Operations Staff có review metadata hay cần Reviewer actor riêng? | `FR-PROCESS-003`, RBAC | Giữ permission bundle trong Operations Staff. | Nhóm/GVHD |
| `W5-O03` | Administrator được publish thay đổi do chính mình tạo? | `FR-PUBLISH-001`, audit | Cho phép trong demo nếu ghi tách `changed_by`/`published_by`; production maker-checker là future. | Nhóm |
| `W5-O04` | Commerce extension nào cần phân tích chi tiết? | Out-of-scope/diagram | Không đưa commerce extension vào core use case/class/ERD. | Nhóm/GVHD |
| `W5-O05` | MFA cho Super Administrator có triển khai trong đồ án? | `FR-SEC-GOV-003`, `NFR-SEC-005` | Re-authentication bắt buộc; MFA time-box/deferred phải ghi rõ. | Nhóm |
| `W5-O06` | Xóa product là hard delete hay archive? | `FR-CAT-MGMT-003`, ERD lifecycle | Archive/soft delete, không hard-delete published history. | Nhóm/GVHD |
| `W5-O07` | Category quản lý động đến đâu khi ba root category đã khóa? | `FR-CAT-MGMT-004` | Không đổi ba root category; subcategory/display taxonomy có thể quản lý có kiểm soát. | Nhóm/GVHD |
| `W5-O08` | Diagram source dùng Draw.io hay PlantUML/Mermaid + render? | Week 5 artifact format | Chọn một notation nhất quán, lưu cả source và render đã visual QA. | Nhóm/GVHD |
| `W5-O09` | D054 stack đã được GVHD chấp thuận chính thức chưa? | `CON-002`, report wording | Dùng decision nội bộ hiện hành, nhưng không claim GVHD approved nếu chưa có biên bản. | Nhóm/GVHD |

## 12. Traceability summary

| Requirement group | Đề cương | Business use case seed | System use case seed | Analysis class/entity seed |
|---|---|---|---|---|
| `FR-AUTH-*`, `FR-RBAC-*` | `PC-FN-01`, `PC-FN-05` | `BUC-04` | `SUC-AUTH-01..04`, `SUC-RBAC-01` | `UserAccount`, `Role`, `Permission`, `AuditEvent` |
| `FR-PROFILE-*` | `PC-FN-06` | `BUC-04` | `SUC-USER-01` | `UserAccount` |
| `FR-CAT-PUBLIC-*` | `PC-FN-07` | `BUC-02` | `SUC-CAT-PUBLIC-01..02` | `CatalogProduct`, `ProductVersion`, `ProductImage` |
| `FR-CAT-MGMT-*` | `PC-FN-02..04` | `BUC-01` | `SUC-CAT-01..02` | `CatalogProduct`, `ProductVersion`, `ProductImage`, `Category`, `ProductFacet` |
| `FR-PROCESS-*`, `FR-PUBLISH-*` | Supporting D004/D006 | `BUC-03` | `SUC-CAT-03..05` | `ProcessingJob`, `Embedding`, `IndexPublication`, `AuditEvent` |
| `FR-SEARCH-IMG-*` | `PC-FN-10` | `BUC-02` | `SUC-SEARCH-IMG-01` | `SearchRequest`, `SearchResult`, `Embedding` |
| `FR-SEARCH-TEXT-*` | `PC-FN-11` | `BUC-02` | `SUC-SEARCH-TEXT-01` | `SearchRequest`, `SearchResult`, `Embedding` |
| `FR-SEARCH-MULTI-*` | `PC-FN-12` | `BUC-02` | `SUC-SEARCH-MULTI-01` | `SearchRequest`, `SearchResult`, `Embedding` |
| `FR-HISTORY-*`, `FR-SAVED-*` | `PC-FN-08` | `BUC-02` | `SUC-USER-02..03` | `SearchHistoryEntry`, `SavedProduct` |
| `FR-RESULT-001` | `PC-FN-09` | `BUC-02` | `SUC-SEARCH-ACTION-01` | `OPEN` tới `W5-O01` |
| `FR-EVAL-*` | `PC-REQ-01..03`, `PC-REQ-06` | `BUC-05` | `SUC-EVAL-01` | Research manifest/artifact, không nhất thiết là business DB entity |

## 13. System acceptance scenarios

Đây là scenario seed; test case chi tiết sẽ được tạo ở mốc implementation/test.

| ID | Scenario | Kết quả cần chứng minh |
|---|---|---|
| `AC-01` | Đăng ký -> đăng nhập -> đổi mật khẩu -> đăng xuất | Account/session đúng lifecycle; credential cũ không còn hiệu lực theo policy; không lộ secret. |
| `AC-02` | Operations Staff gọi API gán role hoặc publish | Bị 403, không đổi state, có security/audit event phù hợp. |
| `AC-03` | Product draft thay ảnh -> processing -> review nếu cần -> publish | Tạo Product Version/job mới; current Active cũ phục vụ đến atomic publication mới. |
| `AC-04` | Guest tìm bằng ảnh | Trả Top-K theo publication nhất quán; không tạo personal history. |
| `AC-05` | Registered User tìm bằng text | Trả Top-K và tạo history đúng owner; account khác không đọc được. |
| `AC-06` | Registered User tìm bằng anchor + modification | Fusion/provenance có version; Top-K hiển thị đúng rank và product version. |
| `AC-07` | Registered User save/un-save product | Quan hệ idempotent, unique và chỉ owner thao tác được. |
| `AC-08` | AI timeout hoặc model/index mismatch | API/UI trả lỗi phân biệt; không fallback âm thầm sang version khác; dữ liệu nghiệp vụ không hỏng. |
| `AC-09` | Final evaluation | Có Precision@K, Recall@K và response-time artifact với protocol/version/environment; không gắn nhãn pilot thành final. |

## 14. Project/compliance requirements

| ID | Requirement | Acceptance/evidence |
|---|---|---|
| `PRJ-BIZ-001` | Hoàn tất khảo sát nghiệp vụ, business use case và đặc tả theo rubric. | Có source diagram, render đã QA, specification và traceability tới proposal. |
| `PRJ-GOV-001` | Mỗi milestone có owner, reviewer, status và evidence. | Owner theo tên được ghi; `Pass` chỉ khi có review/test evidence. |
| `PRJ-GOV-002` | Claim số liệu phải trung thực và truy vết được. | Mọi metric/claim trỏ tới artifact; limitation/pilot status không bị xóa. |
| `PRJ-GOV-003` | Câu hỏi/decision từ nhóm và GVHD phải được ghi lại. | Open question có owner; quyết định đủ rõ mới cập nhật Decision Register/change record. |
| `PRJ-GOV-004` | Kế hoạch phải bám khung 12 tuần từ 17/08/2026 đến 08/11/2026 trong đề cương. | Milestone/owner/deadline được đối chiếu lịch W1-W12; deviation có lý do và tác động. |
| `PRJ-GOV-005` | Nhóm gặp GVHD ít nhất một lần mỗi tuần và tích hợp phần được giao trước buổi báo cáo. | Có meeting note/action/decision và một bản tài liệu/phần mềm tích hợp chung trước mỗi buổi. |
| `PRJ-DELIV-001` | Tổng hợp báo cáo và đóng gói mã nguồn ở Week 12. | Bản nộp theo format trường, source/build/run instructions và artifact cần thiết được kiểm tra từ clean environment. |

## 15. Gate cho requirement specification

- [x] Mục tiêu, boundary, stakeholder/actor được nêu.
- [x] Functional requirements có ID và acceptance criterion.
- [x] Non-functional requirements có ID và acceptance criterion.
- [x] Business rules được nhập tham chiếu hoặc định nghĩa không trùng ID.
- [x] Assumption, constraint, out-of-scope và open question được tách riêng.
- [x] Website, ba search mode, Top-K, metrics và deployment được trace về đề cương.
- [x] Mobile, commerce và VTON/3D không bị nhập vào core.
- [x] Không claim implementation/test chưa có.
- [ ] Nhóm/GVHD review `W5-O01..09`.
- [ ] Gán owner theo tên thành viên.
- [ ] Tạo/review business use case, system use case, analysis class và ERD dùng đúng ID.
- [ ] Sau approval, đồng bộ Decision Register/scope cũ bằng change record nếu quyết định thật sự thay đổi.
