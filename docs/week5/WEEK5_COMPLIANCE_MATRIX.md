# Week 5 Compliance Matrix

## Trạng thái tài liệu

- Phiên bản: `0.1-draft`
- Ngày: 20/09/2026
- Nguồn gốc: đề cương chính thức CNTT-KLCN198, 7 trang
- Mục đích: ánh xạ yêu cầu đề cương tới requirement, use case, analysis class, ERD, owner, tuần thực hiện và bằng chứng
- Trạng thái phê duyệt: chưa được nhóm/GVHD phê duyệt; không thay thế Decision Register hoặc schema đã khóa

## Kết luận nhanh

- Website, Backend API, ba chế độ tìm kiếm, Top-K, kiểm thử chức năng, Precision@K, Recall@K và response time là phạm vi bắt buộc.
- Mobile không xuất hiện trong đề cương; theo D055 chỉ là extension sau khi website/search core, kiểm thử, triển khai và báo cáo đã sẵn sàng.
- Outfit compatibility, VTON và 3D không nằm trong rubric chính; chúng chỉ thuộc extension/future scope.
- Stack hiện hành là Next.js/TypeScript cho website, Spring Boot cho API nghiệp vụ công khai và Python/FastAPI cho AI nội bộ theo D054.
- Week 4 có bằng chứng pilot cho Dataset A, CLIP, FAISS và ba search mode; đó không phải bằng chứng website đã hoàn thiện hoặc mô hình cuối đã được chọn.
- Mốc actor đạt desk review có điều kiện. Requirement specification đã được lập ở mức draft; business/system use case, analysis class và ERD vẫn là mốc tiếp theo.

## Nguồn thẩm quyền

1. Đề cương chính thức và chỉ đạo mới của GVHD.
2. Decision Register và schema đã khóa.
3. Research Protocol cho nội dung nghiên cứu.
4. Master Blueprint, roadmap, phase playbook và tài liệu bàn giao.

Quy tắc đọc matrix:

- `CORE`: bắt buộc trực tiếp theo đề cương.
- `SUPPORTING`: cần để core vận hành đúng, an toàn hoặc truy vết được.
- `EXTENSION`: không phải cam kết triển khai core.
- `COVERED`: đã được ghi thành requirement draft; không đồng nghĩa đã code hoặc test.
- `EVIDENCED-PILOT`: có bằng chứng kỹ thuật pilot, với giới hạn nêu trong Week 4 report.
- `PLANNED`: có owner/tuần và downstream ID dự kiến nhưng chưa có artifact hoàn chỉnh.
- `OPEN`: cần quyết định hoặc xác nhận trước khi khóa.

Owner trong tài liệu này là owner theo chuyên môn, chưa phải phân công cá nhân: `PM/BA`, `Backend`, `Frontend`, `AI/Eval`, `QA/DevOps`, `Docs`, `Nhóm/GVHD`.

## Seed ID cho artifact downstream

Các ID dưới đây là seed để giữ traceability; chỉ trở thành bằng chứng khi artifact tương ứng được tạo và review.

| Nhóm | ID dự kiến |
|---|---|
| Business use case | `BUC-01` Quản trị catalog; `BUC-02` Khám phá/tìm kiếm sản phẩm; `BUC-03` Cập nhật embedding/index; `BUC-04` Quản trị identity/access; `BUC-05` Đánh giá chất lượng tìm kiếm |
| System use case | `SUC-AUTH-*`, `SUC-RBAC-*`, `SUC-USER-*`, `SUC-CAT-*`, `SUC-SEARCH-*`, `SUC-EVAL-*` |
| Analysis classes | `UserAccount`, `Role`, `Permission`, `CatalogProduct`, `ProductVersion`, `ProductImage`, `Category`, `ProductFacet`, `ProcessingJob`, `Embedding`, `IndexPublication`, `SearchRequest`, `SearchResult`, `SearchHistoryEntry`, `SavedProduct`, `AuditEvent` |
| ERD entities | `user_accounts`, `roles`, `permissions`, `user_roles`, `role_permissions`, `catalog_products`, `product_versions`, `product_images`, `categories`, `product_facets`, `processing_jobs`, `embeddings`, `index_publications`, `search_requests`, `search_results`, `saved_products`, `audit_events` |

## A. Mục tiêu và yêu cầu thực hiện trong đề cương

| ID | Nguồn | Yêu cầu chuẩn hóa sát đề cương | Mức | Requirement | Use case | Lớp/ERD liên quan | Status | Owner / hạn | Bằng chứng hiện tại |
|---|---|---|---|---|---|---|---|---|---|
| `PC-OBJ-01` | Mục 5, tr.1 | Khảo sát quy trình nghiệp vụ của website tìm kiếm sản phẩm thời trang. | CORE | `PRJ-BIZ-001` | `BUC-01`, `BUC-02`, `BUC-04` | Toàn bộ domain core | PARTIAL; BUC PLANNED | PM/BA / W5 | Mốc actor có boundary/actor; business process và BUC chưa hoàn tất. |
| `PC-OBJ-02` | Mục 5, tr.1 | Nghiên cứu biểu diễn ảnh trong không gian vector đa chiều bằng mô hình đa phương thức. | CORE | `FR-SEARCH-IMG-002`, `NFR-REPRO-001` | `BUC-03`, `SUC-SEARCH-IMG-01` | `Embedding`, `embeddings` | EVIDENCED-PILOT | AI/Eval / W2-W4 | Week 4 pilot dùng frozen CLIP 600x512; không phải model cuối. |
| `PC-OBJ-03` | Mục 5, tr.1 | Nghiên cứu chiến lược kết hợp embedding ảnh-văn bản, chọn metric và đánh giá response time. | CORE | `FR-SEARCH-MULTI-002`, `FR-EVAL-003`, `NFR-PERF-001` | `BUC-05`, `SUC-SEARCH-MULTI-01`, `SUC-EVAL-01` | `SearchRequest`, `SearchResult`, `Embedding` | EVIDENCED-PILOT; final PLANNED | AI/Eval / W4, W7, W11 | Pilot 0.5/0.5 và metric đã chạy; đánh giá cuối chưa có. |
| `PC-OBJ-04` | Mục 5, tr.1 | Phân tích chi tiết yêu cầu chức năng và phi chức năng. | CORE | Toàn bộ `FR-*`, `NFR-*` | Toàn bộ core use case | Toàn bộ class/ERD core | COVERED-DRAFT | PM/BA / W5 | `WEEK5_REQUIREMENTS_SPECIFICATION.md`. |
| `PC-OBJ-05` | Mục 5, tr.1 | Thiết kế kiến trúc website lưu trữ và tìm kiếm đa phương thức. | CORE | `NFR-ARCH-001`, `NFR-DPLY-001` | Toàn bộ core use case | Các bounded context và entity core | PARTIAL | Backend/Frontend/AI / W5-W10 | Kiến trúc D054 đã có; class/ERD Week 5 và triển khai còn thiếu. |
| `PC-OBJ-06` | Mục 5, tr.1 | Rèn tính chủ động và trách nhiệm khi làm việc nhóm. | CORE-PROCESS | `PRJ-GOV-001` | N/A | N/A | COVERED; evidence liên tục | Nhóm / hằng tuần | Roadmap có cadence/owner; cần minutes và sign-off thực tế. |
| `PC-OBJ-07` | Mục 5, tr.1 | Cẩn trọng, trung thực khi thu thập và báo cáo số liệu. | CORE-PROCESS | `NFR-REPRO-001`, `PRJ-GOV-002` | `BUC-05` | Experiment manifest | COVERED; evidence liên tục | AI/Eval + Docs / W4-W12 | Pilot report nêu rõ giới hạn, không claim chất lượng cuối. |
| `PC-OBJ-08` | Mục 5, tr.1 | Phân công, lắng nghe và trao đổi hiệu quả với GVHD. | CORE-PROCESS | `PRJ-GOV-003` | N/A | N/A | PLANNED/ONGOING | Nhóm / mỗi tuần | Cần lưu phân công, câu hỏi và quyết định sau mỗi buổi GVHD. |
| `PC-REQ-01` | Mục 6, tr.2 | Nghiên cứu Product Images Dataset hoặc dataset tự thu thập; nếu tự thu thập phải mô tả thu thập/xử lý/làm sạch. | CORE | `FR-EVAL-001`, `NFR-DATA-003` | `BUC-05` | Catalog snapshot/manifest | EVIDENCED-PILOT | AI/Eval / W3-W4 | Dataset A card, cleaning manifest và Week 4 gate; không thay benchmark cuối. |
| `PC-REQ-02` | Mục 6, tr.2 | Nghiên cứu mô hình embedding ảnh và văn bản như CLIP/BLIP hoặc tương tự. | CORE | `FR-EVAL-002`, `NFR-REPRO-001` | `BUC-05` | Model/embedding artifact | EVIDENCED-PILOT; final OPEN | AI/Eval / W2-W11 | Frozen CLIP engineering baseline; multilingual baseline còn mở. |
| `PC-REQ-03` | Mục 6, tr.2 | Thực nghiệm và đánh giá chiến lược kết hợp vector ảnh-văn bản. | CORE | `FR-EVAL-003`, `FR-SEARCH-MULTI-002` | `BUC-05`, `SUC-EVAL-01` | Experiment run, `SearchResult` | EVIDENCED-PILOT; RQ2 PLANNED | AI/Eval / W4, W7, W11 | Equal-weight pilot có artifact; chưa đủ kết luận khoa học cuối. |
| `PC-REQ-04` | Mục 6, tr.2 | Thiết kế và phát triển Backend API cho website và search. | CORE | `NFR-ARCH-001`, toàn bộ public `FR-*` | Toàn bộ `SUC-*` | Entity core | COVERED-DRAFT; implementation PLANNED | Backend / W6-W10 | D054/architecture xác định Spring Boot public API; chưa có bằng chứng triển khai. |
| `PC-REQ-05` | Mục 6, tr.2 | Hoàn thiện website tìm kiếm đa phương thức ảnh-văn bản. | CORE | `NFR-COMPAT-001`, `NFR-ACC-001`, search `FR-*` | `BUC-02`, `SUC-SEARCH-*` | Boundary classes; ERD search/catalog | COVERED-DRAFT; implementation PLANNED | Frontend / W6-W10 | Website là bắt buộc; mobile không thay thế website. |
| `PC-REQ-06` | Mục 6, tr.2 | Đánh giá Cosine hoặc Euclidean bằng Recall@K, Precision@K và response time. | CORE | `FR-EVAL-003`, `NFR-PERF-001`, `NFR-PERF-002` | `SUC-EVAL-01` | Experiment manifest/results | EVIDENCED-PILOT; final PLANNED | AI/Eval + QA / W11 | Pilot có Precision/Recall/latency; qrels yếu và không phải đánh giá cuối. |
| `PC-REQ-07` | Mục 6, tr.2 | Tổng hợp kết quả, hoàn thiện báo cáo và đóng gói mã nguồn. | CORE | `PRJ-DELIV-001` | N/A | N/A | PLANNED | Docs + Nhóm / W12 | Chưa đến mốc đóng gói cuối. |

## B. Môi trường thực hiện và ranh giới công nghệ

| ID | Nguồn | Yêu cầu/diễn giải | Phân loại | Ánh xạ hiện hành | Status | Owner / hạn | Bằng chứng |
|---|---|---|---|---|---|---|---|
| `PC-ENV-01` | Mục 7, tr.2 | C#, Java hoặc Python là các lựa chọn ngôn ngữ. | Constraint lựa chọn | Java cho API; Python cho AI theo D054. C# không bắt buộc phải dùng. | LOCKED | Backend + AI | D054. |
| `PC-ENV-02` | Mục 7, tr.2 | OpenCV, PyTorch, TensorFlow, Tesseract OCR là thư viện/nền tảng tham khảo. | Candidate, không phải mọi thư viện đều bắt buộc | PyTorch hiện hành; không suy diễn OCR/TensorFlow thành feature bắt buộc. | COVERED | AI/Eval | Architecture và Week 4 config. |
| `PC-ENV-03` | Mục 7, tr.2 | Spring Boot và Next.js cho Backend/Frontend. | CORE-CONSTRAINT | Spring Boot public API; Next.js website; FastAPI chỉ AI nội bộ. | LOCKED, chờ GVHD ghi nhận chính thức | Backend + Frontend / W6-W10 | D054; change record CP-20260910-STACK. |
| `PC-ENV-04` | Mục 7, tr.2 | Có thể dùng SQL Server, MySQL, PostgreSQL hoặc NoSQL. | Constraint lựa chọn | PostgreSQL metadata, object storage ảnh, FAISS index theo D006. | LOCKED | Backend/AI | D006 và architecture. |
| `PC-ENV-05` | Mục 7, tr.2 | Draw.io/Office là phần mềm hỗ trợ. | Tooling | Diagram tool Week 5 vẫn cần nhóm/GVHD xác nhận. | OPEN | PM/BA / W5 | `W5-O08` trong requirement specification. |

## C. Yêu cầu chức năng theo rubric

| ID | Nguồn | Yêu cầu chuẩn hóa | Mức | Requirement | Use case | Lớp/ERD | Status | Owner / tuần | Bằng chứng hiện tại |
|---|---|---|---|---|---|---|---|---|---|
| `PC-FN-01` | Mục 9.6, tr.3 | Đăng nhập, đăng xuất, đổi mật khẩu và phân quyền. | CORE | `FR-AUTH-002..004`, `FR-RBAC-001..004` | `BUC-04`, `SUC-AUTH-02..04`, `SUC-RBAC-01` | `UserAccount`, `Role`, `Permission`, join tables | COVERED-DRAFT; implementation PLANNED | Backend / W8-W9 | Actor-permission matrix và requirement spec. |
| `PC-FN-02` | Mục 9.6, tr.3 | Thêm mới sản phẩm và thông tin liên quan. | CORE | `FR-CAT-MGMT-001` | `BUC-01`, `SUC-CAT-01` | `CatalogProduct`, `ProductVersion` | COVERED-DRAFT | Backend / W6 | Requirement spec; chưa code. |
| `PC-FN-03` | Mục 9.6, tr.3 | Xem, xóa, cập nhật và quản lý danh mục sản phẩm. | CORE | `FR-CAT-MGMT-002..004` | `BUC-01`, `SUC-CAT-01`, `SUC-CAT-02` | Product/version/category entities | COVERED-DRAFT; delete semantics OPEN | Backend / W6 | `W5-O06` cần chốt archive hay hard delete. |
| `PC-FN-04` | Mục 9.6, tr.3 | Quản lý hình ảnh và dữ liệu mô tả sản phẩm. | CORE | `FR-CAT-MGMT-005..006` | `BUC-01`, `SUC-CAT-02` | `ProductImage`, `ProductFacet`, `product_images`, `product_facets` | COVERED-DRAFT | Backend / W6 | Product schema hiện hành. |
| `PC-FN-05` | Mục 9.6, tr.3 | Đăng ký tài khoản. | CORE | `FR-AUTH-001` | `BUC-04`, `SUC-AUTH-01` | `UserAccount`, `user_accounts` | COVERED-DRAFT | Backend + Frontend / W8 | Requirement spec. |
| `PC-FN-06` | Mục 9.6, tr.3 | Cập nhật thông tin cá nhân. | CORE | `FR-PROFILE-001..002` | `SUC-USER-01` | `UserAccount`, profile fields | COVERED-DRAFT | Backend + Frontend / W9 | Requirement spec. |
| `PC-FN-07` | Mục 9.6, tr.3 | Xem danh sách và chi tiết sản phẩm. | CORE | `FR-CAT-PUBLIC-001..002` | `BUC-02`, `SUC-CAT-PUBLIC-01..02` | `CatalogProduct`, `ProductVersion`, `ProductImage` | COVERED-DRAFT | Backend + Frontend / W6 | Requirement spec. |
| `PC-FN-08` | Mục 9.6, tr.3 | Xem lịch sử tìm kiếm và sản phẩm quan tâm. | CORE | `FR-HISTORY-001..002`, `FR-SAVED-001..002` | `SUC-USER-02`, `SUC-USER-03` | `SearchHistoryEntry`, `SavedProduct` | COVERED-DRAFT | Backend + Frontend / W9 | Requirement spec. |
| `PC-FN-09` | Mục 9.6, tr.3 | Chọn/hủy chọn và các tương tác với kết quả tìm kiếm. | CORE, semantics OPEN | `FR-RESULT-001` | `SUC-SEARCH-ACTION-01` | Chưa chốt: transient selection hoặc persisted entity | OPEN | Nhóm/GVHD / trước ERD | `W5-O01`; không đồng nhất âm thầm với Saved Product. |
| `PC-FN-10` | Mục 9.6, tr.3 | Upload ảnh truy vấn, trích vector, tìm/xếp hạng theo tương đồng và hiển thị danh sách theo thứ tự. | CORE | `FR-SEARCH-IMG-001..003` | `BUC-02`, `SUC-SEARCH-IMG-01` | `SearchRequest`, `SearchResult`, `Embedding` | COVERED-DRAFT; pilot EVIDENCED | Frontend + Backend + AI / W6 | CLI pilot chứng minh path AI; chưa chứng minh website/API. |
| `PC-FN-11` | Mục 9.6, tr.4 | Nhập mô tả tự nhiên, tạo text embedding, tìm/xếp hạng và hiển thị sản phẩm phù hợp. | CORE | `FR-SEARCH-TEXT-001..003` | `BUC-02`, `SUC-SEARCH-TEXT-01` | `SearchRequest`, `SearchResult` | COVERED-DRAFT; pilot EVIDENCED | Frontend + Backend + AI / W7 | Text pilot là engineering evidence, không phải Vietnamese quality claim. |
| `PC-FN-12` | Mục 9.6, tr.4 | Kết hợp ảnh+mô tả, fuse vector, xếp hạng và hiển thị Top-K kèm thông tin/ảnh. | CORE | `FR-SEARCH-MULTI-001..003`, `FR-SEARCH-COMMON-001` | `BUC-02`, `SUC-SEARCH-MULTI-01` | `SearchRequest`, `SearchResult`, `Embedding` | COVERED-DRAFT; pilot EVIDENCED | Frontend + Backend + AI / W7 | Equal-weight CLI pilot; website integration chưa có. |
| `PC-FN-13` | Mục 9.6, tr.4 | Tích hợp thuật toán image, text và fusion vào website. | CORE | `NFR-ARCH-001`, `NFR-INT-001` | `SUC-SEARCH-IMG/TEXT/MULTI-01` | Boundary/control + search entities | PLANNED | Backend + Frontend + AI / W7-W10 | Java-Python contract mới ở mức kiến trúc. |

## D. Artifact phân tích, thiết kế, kiểm thử và báo cáo theo thang điểm

| ID | Nguồn | Deliverable/yêu cầu | Mức | Artifact/trace | Status | Owner / tuần | Bằng chứng |
|---|---|---|---|---|---|---|---|
| `PC-RUB-01` | Mục 9.1, tr.2 | Lý do và mục tiêu đề tài. | CORE | Proposal mapping, report Ch.1 | COVERED-DRAFT | Docs / W1-W12 | `docs/09_THESIS_PROPOSAL_MAPPING.md`. |
| `PC-RUB-02` | Mục 9.1, tr.2 | Khảo sát hiện trạng: cơ cấu tổ chức, quy trình, biểu mẫu. | CORE | Business survey + `BUC-*` | PARTIAL | PM/BA / W1, W5 | Actor/boundary có; cơ cấu và biểu mẫu chưa có evidence đầy đủ. |
| `PC-RUB-03` | Mục 9.2, tr.2 | Kế hoạch và phân công. | CORE-PROCESS | Roadmap + assignment log | PARTIAL | Nhóm / W1-W12 | Roadmap có owner theo stream; chưa có phân công cá nhân trong nguồn hiện hành. |
| `PC-RUB-04` | Mục 9.3, tr.2 | Business use-case diagram và đặc tả. | CORE | `WEEK5_BUSINESS_USE_CASES.md`, `BUC-01..05` | PLANNED | PM/BA / W5 | Seed ID đã có; artifact chưa tạo. |
| `PC-RUB-05` | Mục 9.3, tr.2 | System use-case diagram và đặc tả. | CORE | `WEEK5_SYSTEM_USE_CASES.md`, `SUC-*` | PLANNED | PM/BA / W5 | Seed ID đã có; artifact chưa tạo. |
| `PC-RUB-06` | Mục 9.3, tr.2 | Analysis class diagram. | CORE | `WEEK5_ANALYSIS_CLASS_MODEL.md` | PLANNED | PM/BA + Backend / W5 | Danh sách class seed đã có; diagram chưa tạo. |
| `PC-RUB-07` | Mục 9.4, tr.2-3 | Design class diagram. | CORE, sau Week 5 | Design class artifact | PLANNED | Backend / sau analysis class | Không coi analysis class là design class. |
| `PC-RUB-08` | Mục 9.4, tr.3 | Mô hình dữ liệu. | CORE | `WEEK5_DATA_MODEL.md`, ERD + dictionary | PLANNED | Backend / W5 | Entity seed/schema có; ERD chưa tạo. |
| `PC-RUB-09` | Mục 9.4, tr.3 | UI người dùng và quản trị viên. | CORE | UI specification/mockup | PLANNED | Frontend / W5-W9 | Chưa có artifact Week 5 được review. |
| `PC-RUB-10` | Mục 9.5, tr.3 | Trình bày khái niệm, mô hình và kỹ thuật embedding ảnh/văn bản. | CORE | Literature/report Ch.2, research docs | PARTIAL | AI/Eval + Docs / W2-W12 | Research docs có nền; báo cáo cuối chưa hoàn thiện. |
| `PC-RUB-11` | Mục 9.5, tr.3 | Thực nghiệm CLIP/BLIP hoặc tương đương và chọn độ đo/phương pháp đánh giá. | CORE | Week 4 baseline + RQ runs | EVIDENCED-PILOT; final PLANNED | AI/Eval / W4-W11 | Frozen CLIP/FAISS pilot đã chạy. |
| `PC-RUB-12` | Mục 9.5, tr.3 | Phân tích và chọn mô hình phù hợp dựa trên kết quả. | CORE | Model selection decision | OPEN/PLANNED | AI/Eval + Nhóm / W11 | Không dùng Week 4 weak pilot để khóa model cuối. |
| `PC-TEST-01` | Mục 9.6, tr.4 | Kiểm thử chức năng hệ thống. | CORE | Functional/integration/E2E test evidence | PLANNED | QA + feature owners / W10 | Chưa có website/backend để kiểm thử. |
| `PC-TEST-02` | Mục 9.6, tr.4 | Đánh giá Precision@K, Recall@K và response time. | CORE | `SUC-EVAL-01`, final metrics artifact | EVIDENCED-PILOT; final PLANNED | AI/Eval + QA / W11 | Pilot values không phải final evidence. |
| `PC-TEST-03` | Mục 9.6, tr.4 | Triển khai và kiểm tra hoạt động thực tế. | CORE | Deployment record + smoke/E2E | PLANNED | QA/DevOps / W11 | Chưa triển khai hệ thống Web. |
| `PC-REP-01` | Mục 9.7, tr.4 | Nội dung kiến thức trong báo cáo. | CORE | Final report | PLANNED/ONGOING | Docs + Nhóm / W12 | Docs hiện tại là nguồn đầu vào, chưa phải báo cáo nộp. |
| `PC-REP-02` | Mục 9.8, tr.4 | Hình thức và định dạng báo cáo. | CORE | Word/PDF theo mẫu trường | PLANNED | Docs / W12 | Chưa xuất bản bản cuối. |
| `PC-REP-03` | Mục 9.9, tr.4 | Thái độ và tác phong. | CORE-PROCESS | Weekly evidence, review history | ONGOING | Từng thành viên / W1-W12 | Không thể xác nhận chỉ bằng tài liệu kỹ thuật. |
| `PC-REP-04` | Mục 9.10, tr.5 | Phong cách báo cáo và slide. | CORE | Slide + defense script | PLANNED | Docs + Nhóm / W12 | Chưa đến mốc. |
| `PC-BONUS-01` | Mục 9.11, tr.5 | NCKH liên quan là điểm khuyến khích. | EXTENSION/BONUS | Paper/competition evidence nếu có | OPTIONAL | Nhóm / ngoài critical path | Không dùng để thay core rubric. |
| `PC-SCHED-01` | Mục 8, tr.2 | Thực hiện trong 12 tuần, từ 17/08/2026 đến 08/11/2026. | CORE-PROCESS | `PRJ-GOV-004`, lịch W1-W12 | ONGOING | Nhóm / 08/11/2026 | Roadmap phải được đối chiếu với lịch đề cương, không thay thế lịch này. |
| `PC-OTHER-01` | Mục 12, tr.6 | Tối đa 3 sinh viên thực hiện. | ELIGIBILITY | N/A system/use case/class/ERD | SATISFIED-BY-PROPOSAL | Nhóm | Đề cương liệt kê đúng 3 sinh viên. |
| `PC-OTHER-02` | Mục 12, tr.6 | Thành viên có khả năng/tư duy lập trình và đọc hiểu tiếng Anh. | ELIGIBILITY | N/A system/use case/class/ERD | EXTERNAL-ASSESSMENT | Từng thành viên | Không thể xác nhận chỉ bằng artifact Week 5. |
| `PC-OTHER-03` | Mục 12, tr.7 | Gặp GVHD ít nhất mỗi tuần và tích hợp phần được phân công trước mỗi buổi báo cáo. | CORE-PROCESS | `PRJ-GOV-005` | ONGOING | Nhóm / hằng tuần | Cần meeting note và integration evidence; chưa được tự đánh dấu `Pass` cho toàn kỳ. |

## E. Tuân thủ lịch 12 tuần của đề cương

| Tuần | Yêu cầu đề cương | Mapping hiện hành | Trạng thái trung thực |
|---:|---|---|---|
| 1 | Vấn đề, mục tiêu, phạm vi, quy trình nghiệp vụ, kế hoạch nhóm | Scope/roadmap/briefing | Có tài liệu; mức khảo sát hiện trạng và biểu mẫu cần củng cố. |
| 2 | Tìm hiểu CLIP/BLIP hoặc tương đương | Research docs, baseline config | Có engineering baseline; literature/report vẫn tiếp tục. |
| 3 | Dataset và trường dữ liệu | Dataset A card/manifests | Có pilot evidence. |
| 4 | Cài đặt/thực nghiệm mô hình | Week 4 baseline | 13/14 gate; independent rerun chưa ký. |
| 5 | Requirements, business/system use case, analysis class, data model | Compliance + requirement spec là analysis baseline; UC/class/ERD hoàn thiện lặp lại theo `CP-20260921-IMPLEMENTATION-INFORMED-MODELING` | Chưa đóng Week 5 gate; không chặn Slice 1 khi interface tối thiểu đã khóa. |
| 6 | Product management, user functions, image search | Vertical Slice 1 image-search read path, sau đó Slice 2 catalog-to-searchable | Đang chuẩn bị monorepo và interface; chưa có implementation evidence. |
| 7 | Text search, multimodal search, result integration | Implementation | Chưa bắt đầu trong website/API. |
| 8 | Login/register | Implementation | Chưa bắt đầu. |
| 9 | Authorization, admin/user functions | Implementation | Chưa bắt đầu. |
| 10 | Hoàn thiện search website, integration/function testing | Integration/test | Chưa bắt đầu. |
| 11 | Precision@K, Recall@K, response time, deploy | Final evaluation/deployment | Chỉ có pilot Week 4; final chưa chạy. |
| 12 | Report, PowerPoint, submission | Final deliverables | Chưa đến mốc. |

## F. Ranh giới bắt buộc và extension

| Vấn đề | Kết luận compliance | Căn cứ | Tác động |
|---|---|---|---|
| Website | Bắt buộc | Mục 5, 6, 7, 9 và lịch W10 | Không được thay bằng CLI, notebook hoặc mobile demo. |
| Mobile | Extension tùy thời gian | Không có trong đề cương; D055 | Không nằm trong Week 5 ERD/use case core hoặc Gate 6. |
| Image search | Bắt buộc | Mục 9.6, tr.3 | Phải có upload, embedding, rank và display. |
| Natural-language text search | Bắt buộc | Mục 9.6, tr.4 | Phải có input, embedding, rank và display. |
| Image-text multimodal search | Bắt buộc | Mục 9.6, tr.4 | Phải có fusion, Top-K và product info/image. |
| Precision@K, Recall@K, response time | Bắt buộc, final ở W11 | Mục 6, 9.6 và lịch W11 | Pilot Week 4 chỉ là bằng chứng đường ống. |
| Outfit compatibility/VTON/3D | Không thuộc rubric chính | Không có trong đề cương; D044-D050 | Chỉ extension/future, có thể tắt mà core không hỏng. |
| Commerce/payment/shipping/POS/loyalty | Ngoài core | D003 | Không đưa vào use case/class/ERD core. |
| Stack | Next.js + Spring Boot + internal Python/FastAPI | Mục 7 và D054 | Cần contract Java-Python; chưa được ghi là GVHD đã duyệt nếu chưa có biên bản. |

## G. Điểm cần xác nhận

| ID | Câu hỏi | Ảnh hưởng | Mặc định an toàn |
|---|---|---|---|
| `W5-O01` | “Chọn/hủy chọn” là saved product, transient selection hay feedback? | `FR-RESULT-001`, use case, class, ERD | Không tạo entity mới trước khi GVHD chốt. |
| `W5-O02` | Operations Staff có đủ quyền review metadata hay cần Reviewer actor riêng? | Actor/use case/permission | Giữ permission bundle trong Operations Staff. |
| `W5-O03` | Administrator có được publish thay đổi do chính mình tạo? | Business rule/audit | Cho phép trong demo với `changed_by`/`published_by` riêng. |
| `W5-O04` | Commerce extension nào cần xuất hiện trong phân tích chi tiết? | Scope diagram/ERD | Không đưa extension vào sơ đồ core. |
| `W5-O05` | Có triển khai MFA cho Super Administrator trong đồ án không? | Security acceptance/timeline | Re-authentication là bắt buộc; MFA chỉ được claim khi có test evidence. |
| `W5-O06` | Xóa sản phẩm là archive/soft delete hay hard delete? | Product lifecycle/ERD | Dùng archive trong core; chưa xóa vật lý dữ liệu đã publish. |
| `W5-O07` | Category được quản lý động hay taxonomy cố định trong MVP? | `Category`, permission, UI | Cho quản lý danh mục hiển thị nhưng không tự ý đổi ba root category đã khóa. |
| `W5-O08` | GVHD ưu tiên Draw.io hay chấp nhận PlantUML/Mermaid kèm bản render? | Diagram source/render | Chọn một tool chỉnh sửa được và lưu cả source lẫn render. |
| `W5-O09` | Stack D054 đã được GVHD chấp thuận chính thức chưa? | Compliance/report wording | Dùng stack đã khóa nội bộ; mô tả đúng là chưa có xác nhận GVHD nếu chưa có biên bản. |

## Gate cho Compliance Matrix

- [x] Đề cương 7 trang được đối chiếu theo mục và trang.
- [x] Website, Backend API, ba search mode, Top-K và evaluation bắt buộc được nêu rõ.
- [x] Mỗi yêu cầu chức năng có requirement/use-case/class/ERD mapping hoặc lý do `N/A`/`OPEN`.
- [x] Pilot evidence được tách khỏi final evidence và implementation evidence.
- [x] Owner theo chuyên môn và deadline theo tuần được ghi.
- [x] Mobile, VTON/3D/outfit và commerce được phân loại đúng.
- [ ] Nhóm gán owner theo tên thành viên.
- [ ] Nhóm/GVHD review các điểm `W5-O01` đến `W5-O09`.
- [ ] Cập nhật status khi business/system use case, class model và ERD có artifact thật.
