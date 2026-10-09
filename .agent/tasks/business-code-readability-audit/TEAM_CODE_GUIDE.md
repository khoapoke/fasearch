# Hướng dẫn đọc source cho nhóm

Bản đầu ngày 09/10/2026. Đây là đường đọc đã đối chiếu với source, chưa phải đánh giá toàn bộ code.

Hai bản đang được xem là Qdrant `8f329f93` tại `/tmp/fasearch-ai-qdrant-web` và Console `868b752` tại `/tmp/fasearch-ops-console`. Root repo nằm ở SHA khác. Khi mở file, cần xác định đang xem bản nào.

## Thư mục nào dùng để làm gì?

| Thư mục | Trách nhiệm |
| --- | --- |
| `fe/src/app` | Các trang theo URL và endpoint Next.js chuyển request sang BE. |
| `fe/src/components` | Form, panel, danh sách và hành vi giao diện. |
| `fe/src/lib` | Các hàm dùng chung để đọc contract, xử lý state và chuyển request. Chỉ đọc helper mà chức năng đang xem import. |
| `be/.../identity` | Tài khoản, đăng nhập, session, CSRF, profile, mật khẩu và quyền. |
| `be/.../catalog` | Sản phẩm nháp, metadata, ảnh, phiên bản và audit. |
| `be/.../library` | Lịch sử tìm kiếm, consent và sản phẩm đã lưu của người dùng. |
| `be/.../search/api` | Nhận request HTTP, gọi xử lý và trả response. |
| `be/.../search/application` | Xử lý search: kiểm tra input, gọi AI, kiểm tra catalog/model/index và ghép metadata sản phẩm. |
| `be/.../search/infrastructure/ai` | Gọi HTTP tới Python, đọc response và ánh xạ lỗi. |
| `be/.../search/infrastructure/catalog` | Đọc catalog công khai đang dùng. Bản hiện tại đọc dữ liệu pilot cố định. |
| `ai/src` | Serving Qdrant được tích hợp từ code teammate đã harden. |
| `ai/ml/retrieval` | Core nghiên cứu embedding, fusion và FAISS baseline. |
| `ai/fasearch_ai` | Adapter FAISS được giữ cho reference và rollback có chủ đích. |
| `contracts` | Định nghĩa endpoint, request, response và mã lỗi. |
| `be/src/main/resources/db/migration` | Cấu trúc bảng và các thay đổi database. |
| Các thư mục `tests` / `src/test` | Ví dụ hành vi và regression có thể chạy; cần phân biệt mock với integration. |
| `docs`, `references` | Đề cương, nghiệp vụ, thiết kế và lịch sử. Xem ngày và trạng thái tài liệu trước khi coi là đã duyệt. |
| `.agent`, `.agents`, `.pi`, `.codex` | Công cụ và hồ sơ phối hợp agent; không phải nghiệp vụ ứng dụng. |
| `tools`, `.playwright-mcp` | Script kiểm chứng, vận hành, diagram, ảnh và lịch sử thực hiện. |
| `data`, `artifacts`, local environment | Dữ liệu, model, index và cấu hình runtime. Không xóa hoặc publish tùy tiện. |

## Luồng 1: người dùng tìm bằng ảnh

Mục tiêu: đưa một ảnh vào, nhận các sản phẩm phù hợp; không bắt Guest đăng nhập để tìm ảnh.

1. `fe/src/components/image-search-workbench.tsx`: chọn ảnh, gửi yêu cầu và hiển thị kết quả.
2. `fe/src/app/api/search/image/route.ts`: chuyển request sang Spring Boot.
3. `be/.../search/api/ImageSearchController.java`: nhận multipart, tạo trace và trả response; lưu history chỉ khi được phép.
4. `be/.../search/application/ImageSearchModule.java`: kiểm tra ảnh/K, gọi AI, kiểm tra đúng model/catalog/index rồi ghép thông tin sản phẩm.
5. `be/.../search/infrastructure/ai/HttpAiImageSearchAdapter.java`: gọi endpoint Python và ánh xạ response/lỗi.
6. `ai/src/api/endpoints.py`: nhận `/internal/v1/search/image`, kiểm tra/decode ảnh và điều phối inference.
7. `ai/src/services/search_service.py`: tạo embedding, truy vấn Qdrant exact và trả kết quả. `core/ai_model.py` giữ model; `core/qdrant_client.py` giữ client/readiness.
8. BE trả sản phẩm thật cho UI; history là tác dụng phụ có consent, không phải bước bắt buộc của mỗi lần tìm.

`publication/model/index` giúp tránh ghép vector với sai dữ liệu sản phẩm. Đây là kiểm tra kỹ thuật, không phải một thao tác mà người dùng phải hiểu hay thực hiện.

`UseCase` mô tả input/output; `Module` thực hiện xử lý; `Port` là cách gọi khả năng bên ngoài; `Adapter` là phần gọi HTTP hoặc đọc dữ liệu thật. Các tên này không phải bốn bước nghiệp vụ khác nhau.

## Luồng 2: tạo/sửa Draft và ảnh

1. Trang trong `fe/src/app/catalog/drafts` dùng `components/catalog-draft-form.tsx`.
2. Endpoint trong `app/api/catalog/drafts` chuyển sang BE.
3. `CatalogDraftController.java` nhận metadata; `CatalogDraftImageController.java` nhận ảnh.
4. `CatalogDraftModule.java` kiểm tra quyền, khóa sản phẩm, kiểm tra version và tạo phiên bản mới cùng audit trong transaction.
5. `CatalogImageModule.java` xử lý ảnh và version; `S3CatalogObjectStore.java` ghi/đọc bytes.
6. Console bổ sung `CatalogDraftOperations*.java` để đọc summary, phiên bản và audit theo cùng quyền sản phẩm.

Ý nghĩa lỗi 409: một người hoặc tab khác đã sửa sản phẩm trong lúc bạn giữ form cũ. `expected_version_no` giúp tránh ghi đè mất thay đổi của họ.

**Ranh giới hiện tại:** lưu Draft chưa làm sản phẩm xuất hiện trong catalog tìm kiếm. Nhóm cần thống nhất đường đi từ dữ liệu mới đến sản phẩm searchable; chưa thể báo luồng này đã hoàn tất.

## Luồng 3: đăng nhập và dữ liệu cá nhân

- Form đăng nhập qua Next.js proxy tới Spring Security/JdbcIdentityService.
- BE tạo session JDBC và trả cookie opaque HttpOnly. Không có JWT refresh-token flow.
- `AccountController/AccountModule` xử lý profile và mật khẩu; `PasswordVersionSessionGuard` xử lý session revocation.
- `LibraryController/LibraryModule` xử lý Saved và History; `HistoryCsrfAuthorizer` bảo vệ history side effect trên public IMAGE.

## Cách walkthrough một chức năng

Chọn một request thành công, một input sai và một trường hợp bị từ chối hoặc lỗi dịch vụ. Giải thích người dùng muốn gì, dữ liệu nào thay đổi, file nào xử lý và vì sao có các kiểm tra. Mỗi thành viên nên làm được điều này cho phần mình chịu trách nhiệm.
