# Phạm vi Week 5 và mô hình actor phân quyền

## Trạng thái tài liệu

- Phiên bản: `0.2-reviewed-draft`
- Ngày: 20/09/2026
- Phạm vi: mốc đầu tiên của gói phân tích nghiệp vụ và hệ thống Week 5
- Trạng thái quyết định: hướng actor đã được đại diện nhóm thống nhất trong phiên làm việc; còn cần nhóm và GVHD review trước khi ghi thành quyết định Locked trong Decision Register
- Kết quả desk review: đạt có điều kiện; không có lỗi chặn việc lập compliance matrix và requirement specification, nhưng 5 câu hỏi mở vẫn chưa được phê duyệt
- Tài liệu này chưa thay thế đề cương, Decision Register, schema hoặc các tài liệu kiến trúc hiện hành

## Mục đích

Tài liệu này khóa cách hiểu ban đầu về ranh giới hệ thống, actor, role, quyền và mức độ ưu tiên của các nhóm chức năng trước khi lập requirement specification, business use case, system use case, lớp phân tích và ERD.

Mục tiêu là giữ hệ thống đủ chiều sâu cho đồ án tốt nghiệp nhưng không để nghiệp vụ bán lẻ mở rộng che khuất yêu cầu chính thức về website tìm kiếm sản phẩm thời trang bằng ảnh và mô tả tự nhiên.

## Nguồn thẩm quyền

Thứ tự áp dụng:

1. Đề cương chính thức CNTT-KLCN198 và chỉ đạo mới của GVHD.
2. Decision Register và schema đã khóa.
3. Research Protocol khi nội dung liên quan nghiên cứu.
4. Master Blueprint, roadmap, phase playbook và tài liệu bàn giao dẫn xuất.

Các căn cứ trực tiếp cho tài liệu này:

- Đề cương yêu cầu website, Backend API, đăng ký, đăng nhập, đăng xuất, đổi mật khẩu, phân quyền, quản trị sản phẩm, chức năng người dùng và ba chế độ tìm kiếm.
- D001 xác định tìm kiếm sản phẩm thời trang bằng ảnh và mô tả tự nhiên là core.
- D003 loại full e-commerce, POS, thanh toán, vận chuyển, loyalty và kế toán khỏi core triển khai.
- D004 yêu cầu luồng catalog có CRUD, gắn nhãn, review, embedding, publish và audit.
- D054/D055 khóa kiến trúc Web-first: Next.js, Spring Boot, AI Python nội bộ; mobile không phải deliverable bắt buộc.

## Ranh giới hệ thống

### Ranh giới dùng cho system use case tổng quan

Tên ranh giới đề xuất:

> Hệ thống tìm kiếm sản phẩm thời trang đa phương thức

Ranh giới này bao gồm:

- website Next.js;
- Spring Boot API nghiệp vụ;
- PostgreSQL và object storage;
- AI service Python/FastAPI nội bộ;
- core `ai/ml/`, PyTorch và FAISS;
- background processing worker;
- job, model, embedding, index và catalog publication cần cho search.

Vì vậy, Next.js, Spring Boot, AI service và worker là thành phần bên trong hệ thống, không phải actor của system use case tổng quan. Chúng chỉ có thể xuất hiện như supporting actor khi vẽ use case cho một subsystem có ranh giới hẹp hơn, ví dụ riêng Spring Boot.

### Ranh giới không bao gồm trong core

- cổng thanh toán thật;
- đơn vị vận chuyển và tracking;
- POS tại quầy;
- kế toán và công nợ;
- quản lý kho nhiều chi nhánh;
- supplier procurement đầy đủ;
- loyalty engine;
- quy trình đổi trả và hoàn tiền phức tạp.

Các nội dung trên có thể được ghi nhận trong extension/future scope nhưng không nằm trên critical path của Week 5 và các tuần triển khai bắt buộc.

## Thuật ngữ chuẩn

| Thuật ngữ | Định nghĩa dùng trong tài liệu |
|---|---|
| Actor | Vai trò bên ngoài ranh giới hệ thống có mục tiêu và tương tác riêng với hệ thống. Actor không đồng nghĩa với một cá nhân hoặc một chức danh tổ chức. |
| User account | Danh tính đăng nhập của một cá nhân. Một account có thể giữ nhiều role nếu policy cho phép. |
| Role | Tập quyền có tên, được gán cho account. |
| Permission | Quyền thực hiện một hành động trên một loại tài nguyên và phạm vi cụ thể. |
| Primary actor | Actor khởi tạo use case để đạt mục tiêu của mình. |
| Supporting actor | Hệ thống hoặc vai trò bên ngoài cung cấp dịch vụ cho use case; chỉ xuất hiện khi thật sự nằm ngoài ranh giới đang vẽ. |
| Operations Staff | Nhân viên vận hành catalog và nghiệp vụ hằng ngày; không có quyền quản trị đặc quyền. |
| Administrator | Quản trị viên có quyền quản lý vận hành, người dùng thường và role không đặc quyền. |
| Super Administrator | Quản trị viên cấp cao, quản lý Administrator, định nghĩa role/permission và cấu hình bảo mật toàn hệ thống. Không dùng thuật ngữ “God” trong tài liệu chính thức. |
| Core | Phạm vi bắt buộc theo đề cương hoặc cần trực tiếp để hoàn thành luồng sản phẩm chính. |
| Supporting core | Khả năng không được rubric gọi tên riêng nhưng cần để core vận hành đúng, an toàn và có thể truy vết. |
| Commerce extension | Nghiệp vụ bán lẻ bổ sung được phân tích tách biệt; không phải cam kết triển khai cho tới khi core gate xanh và có quyết định mở scope. |

## Mô hình actor được đề xuất

### Bốn primary actors của sơ đồ tổng quan

#### ACT-01 Khách vãng lai

Tên tiếng Anh: `Guest`

Mục tiêu:

- khám phá catalog;
- tìm kiếm bằng ảnh, văn bản hoặc ảnh cộng văn bản;
- xem Top-K và chi tiết sản phẩm;
- đăng ký tài khoản khi muốn lưu dữ liệu cá nhân.

Giới hạn:

- không có lịch sử tìm kiếm gắn với account;
- không lưu sản phẩm quan tâm dài hạn;
- không truy cập chức năng back-office.

#### ACT-02 Người dùng đã đăng ký

Tên tiếng Anh: `Registered User`

Mục tiêu:

- thực hiện mọi luồng công khai của Guest;
- quản lý profile;
- xem hoặc xóa lịch sử tìm kiếm của mình;
- lưu hoặc bỏ lưu sản phẩm quan tâm;
- tương tác chọn/hủy chọn hoặc feedback với kết quả theo nghĩa được chốt trong requirement specification;
- sử dụng commerce extension nếu extension được mở.

Giới hạn:

- chỉ truy cập dữ liệu do mình sở hữu;
- không quản lý catalog, account khác hoặc quyền.

#### ACT-03 Nhân viên vận hành

Tên tiếng Anh: `Operations Staff`

Mục tiêu:

- tạo và cập nhật product draft;
- quản lý danh mục, ảnh và mô tả;
- kiểm tra hoặc chỉnh sửa metadata;
- gửi sản phẩm vào processing;
- theo dõi quality check, embedding/index job và lỗi xử lý;
- xử lý nghiệp vụ commerce extension đơn giản nếu extension được mở.

Giới hạn:

- không được quản lý Administrator hoặc Super Administrator;
- không được định nghĩa role/permission;
- không được thay đổi cấu hình bảo mật toàn hệ thống;
- không tự publish sản phẩm nếu policy yêu cầu bước duyệt của Administrator.

Lý do giữ actor:

- có mục tiêu và use case riêng với công việc vận hành hằng ngày;
- cần tập quyền khác Administrator;
- thể hiện nguyên tắc cấp quyền tối thiểu;
- thay thế việc tạo nhiều actor nhỏ như nhân viên bán hàng, nhân viên kho và reviewer khi các vai trò đó chưa có đủ quy trình độc lập.

#### ACT-04 Quản trị viên

Tên tiếng Anh: `Administrator`

Mục tiêu:

- thực hiện các khả năng vận hành được cho phép;
- quản lý người dùng thường;
- gán hoặc thu hồi role không đặc quyền;
- phê duyệt, publish, archive hoặc rollback product/catalog publication;
- xem audit log trong phạm vi quản trị;
- xem báo cáo vận hành và chất lượng hệ thống.

Giới hạn:

- không được tự nâng mình hoặc account khác thành Super Administrator;
- không được khóa, hạ quyền hoặc xóa Super Administrator;
- không được sửa/xóa audit log;
- không được thay đổi các permission hệ thống được bảo vệ nếu chưa có quyền Super Administrator.

### Actor chuyên biệt có đặc quyền

#### ACT-05 Quản trị viên cấp cao

Tên tiếng Anh: `Super Administrator`

Phân loại:

- actor chuyên biệt của Administrator;
- không tính vào bốn primary actors của sơ đồ tổng quan;
- xuất hiện trong sơ đồ chi tiết Identity and Access và trong permission model.

Mục tiêu riêng:

- tạo, khóa, hạ quyền hoặc phục hồi Administrator;
- quản lý định nghĩa role và permission;
- cấp hoặc thu hồi role Super Administrator theo business rule;
- quản lý cấu hình bảo mật toàn hệ thống;
- xem toàn bộ security audit trail;
- thực hiện hoặc phê duyệt hành động khôi phục đặc quyền khi có sự cố.

Lý do giữ actor:

- có use case riêng mà Administrator không được thực hiện;
- giải quyết bootstrap và governance của chính vai trò Administrator;
- ngăn Administrator tự mở rộng quyền;
- tạo ranh giới kiểm soát rõ cho các thao tác có ảnh hưởng toàn hệ thống.

Không giữ Super Administrator nếu implementation cuối chỉ tạo một role `ADMIN` có toàn quyền mà không có use case hoặc business rule riêng.

## Quan hệ generalization giữa actor

```text
Registered User --|> Guest
Administrator --|> Operations Staff
Super Administrator --|> Administrator
```

Ý nghĩa:

- Registered User có thể thực hiện các use case công khai của Guest.
- Administrator có thể thực hiện các nghiệp vụ của Operations Staff khi được policy cho phép.
- Super Administrator có các khả năng của Administrator và thêm use case đặc quyền.

Các mũi tên này biểu diễn kế thừa khả năng sử dụng hệ thống, không phải sơ đồ cấp trên/cấp dưới trong cơ cấu tổ chức.

## Ánh xạ actor từ tài liệu cũ

| Actor cũ | Ánh xạ Week 5 | Cách xử lý |
|---|---|---|
| Khách hàng | Guest hoặc Registered User | Tách theo trạng thái xác thực và quyền sở hữu dữ liệu. |
| Nhân viên bán hàng | Operations Staff | Chỉ giữ những use case thuộc catalog hoặc commerce extension đã được chấp thuận. |
| Nhân viên kho | Operations Staff trong extension | Không tạo actor riêng nếu chỉ có cập nhật availability/tồn kho đơn giản. |
| Quản lý | Administrator | Không dùng chức danh chung nếu không chỉ rõ quyền. |
| Quản trị viên hệ thống | Administrator hoặc Super Administrator | Phân loại theo việc có quyền quản lý Administrator/role definition hay không. |
| Seller | Operations Staff | Gộp catalog ingestion vào role vận hành trong phạm vi website demo. |
| Reviewer | Permission bundle của Operations Staff | Chỉ tách actor nếu review queue có owner, quyền và workflow độc lập được GVHD chấp thuận. |
| Researcher | Actor của research/evaluation subsystem | Không đưa vào sơ đồ use case website chính; giữ trong sơ đồ nghiên cứu riêng nếu cần. |
| Nhà cung cấp | Future scope | Không thuộc core search/catalog hiện tại. |

## Phân tầng phạm vi chức năng

### Nguyên tắc phân tầng

- `CORE`: yêu cầu trực tiếp từ đề cương hoặc luồng bắt buộc để người dùng đạt mục tiêu tìm kiếm.
- `SUPPORTING`: cần cho core vận hành nhất quán, an toàn, bất đồng bộ hoặc có thể truy vết.
- `EXTENSION`: làm hệ thống phong phú hơn nhưng chỉ mở sau core; phải có feature flag hoặc có thể bỏ mà core không hỏng.
- `FUTURE`: không phân tích chi tiết hoặc triển khai trong giai đoạn hiện tại; chỉ ghi nhận ranh giới.

### Ma trận phạm vi

| Nhóm chức năng | Mức | Nội dung tối thiểu | Actor chính | Căn cứ |
|---|---|---|---|---|
| Identity cơ bản | CORE | Đăng ký, đăng nhập, đăng xuất, đổi mật khẩu, session/token | Guest, Registered User | Đề cương |
| Profile | CORE | Xem/sửa thông tin cá nhân được phép | Registered User | Đề cương |
| RBAC | CORE | Role, permission, kiểm tra quyền server-side | Administrator | Đề cương |
| Catalog public | CORE | Danh sách, chi tiết, ảnh, mô tả và category | Guest, Registered User | Đề cương |
| Catalog management | CORE | Thêm, xem, sửa, archive/xóa logic, category, image, description | Operations Staff, Administrator | Đề cương, D004 |
| Image search | CORE | Upload ảnh, encode, retrieve, rank và hiển thị kết quả | Guest, Registered User | Đề cương |
| Text search | CORE | Nhập mô tả, encode, retrieve, rank và hiển thị kết quả | Guest, Registered User | Đề cương |
| Multimodal search | CORE | Kết hợp ảnh và mô tả, xếp hạng Top-K | Guest, Registered User | Đề cương |
| Search history | CORE | Lưu, xem và xóa lịch sử của chính user | Registered User | Đề cương |
| Interested/saved product | CORE | Lưu và bỏ lưu sản phẩm quan tâm | Registered User | Đề cương |
| Result interaction | CORE | Chọn/hủy chọn hoặc feedback sau khi chốt semantics | Registered User | Đề cương; còn open question |
| Product lifecycle/version | SUPPORTING | Draft, processing, review, indexed, active, failed, archived; optimistic/version check | Operations Staff, Administrator | D004, schema hiện hành |
| Processing job | SUPPORTING | Quality check, tag, embedding, index; trạng thái và retry idempotent | Operations Staff | Kiến trúc hiện hành |
| Metadata review | SUPPORTING | Xem confidence, accept/edit/cannot-judge, lưu provenance | Operations Staff, Administrator | D004 |
| Index publication | SUPPORTING | Atomic publication, version compatibility, rollback | Administrator | D006, D054 |
| Audit log | SUPPORTING | Append-only log cho thao tác tài khoản, quyền, catalog và publication | Administrator, Super Administrator | NFR auditability |
| Search provenance | SUPPORTING | Query/mode/model/index/catalog version và latency | Administrator, research subsystem | NFR reproducibility |
| Security governance | SUPPORTING | Quản lý Administrator, role definition, protected configuration | Super Administrator | Quyết định actor Week 5 |
| Giỏ hàng đơn giản | EXTENSION | Thêm/xóa sản phẩm, xem danh sách tạm | Registered User | Không có trong đề cương; chỉ mở sau core |
| Đơn hàng demo | EXTENSION | Tạo và xem đơn đơn giản, không settlement | Registered User, Operations Staff | Không có trong đề cương; cần change proposal nếu triển khai |
| Availability đơn giản | EXTENSION | Có hàng/hết hàng hoặc tổng quantity; không quản lý kho nhiều chi nhánh | Operations Staff | Hỗ trợ demo, không thay hệ thống kho |
| Giá khuyến mãi hiển thị | EXTENSION | Giá giảm hoặc campaign metadata đơn giản | Operations Staff | Không xây discount engine |
| Cổng thanh toán thật | FUTURE | Payment authorization, capture, refund, reconciliation | External payment actor | D003; ngoài core |
| Shipping/tracking | FUTURE | Đơn vị vận chuyển, phí, tracking và failure flow | External shipping actor | D003; ngoài core |
| POS tại quầy | FUTURE | Giao dịch tại cửa hàng vật lý | Retail staff | D003; ngoài core |
| Kho nhiều chi nhánh | FUTURE | Nhập, xuất, chuyển kho, kiểm kê và reservation | Warehouse roles | D003; ngoài core |
| Supplier/procurement | FUTURE | Nhà cung cấp, phiếu nhập và công nợ | Supplier, procurement staff | D003; ngoài core |
| Loyalty/kế toán | FUTURE | Hạng thành viên, điểm, sổ thu chi và công nợ | Finance roles | D003; ngoài core |
| Đổi trả phức tạp | FUTURE | Exchange SKU, refund, restock và dispute | Operations/payment actors | D003; ngoài core |

## Ma trận actor và quyền

Ký hiệu:

- `Có`: actor được thực hiện.
- `Của mình`: chỉ trên dữ liệu thuộc account hiện tại.
- `Giới hạn`: chỉ trong phạm vi được phân quyền hoặc tài nguyên được giao.
- `Không`: bị từ chối ở server-side.
- `Khi mở extension`: không phải quyền core hiện tại.

| Khả năng | Guest | Registered User | Operations Staff | Administrator | Super Administrator |
|---|---|---|---|---|---|
| Xem catalog và chi tiết sản phẩm | Có | Có | Có | Có | Có |
| Tìm bằng text, image, multimodal | Có | Có | Có | Có | Có |
| Đăng ký account | Có | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng |
| Đăng nhập bằng account hợp lệ | Có, nếu có account | Có | Có | Có | Có |
| Đăng xuất khỏi session hiện tại | Không áp dụng | Của mình | Của mình | Của mình | Của mình |
| Đổi mật khẩu | Không | Của mình | Của mình | Của mình | Của mình |
| Quản lý profile | Không | Của mình | Của mình | Của mình | Của mình |
| Xem/xóa search history | Không | Của mình | Của mình | Của mình | Của mình |
| Lưu/bỏ lưu sản phẩm quan tâm | Không | Của mình | Của mình | Của mình | Của mình |
| Tạo/sửa product draft | Không | Không | Giới hạn | Có | Có |
| Quản lý category, image, description | Không | Không | Giới hạn | Có | Có |
| Gửi processing/reprocessing job | Không | Không | Giới hạn | Có | Có |
| Review metadata/confidence | Không | Không | Giới hạn | Có | Có |
| Publish/archive/rollback product | Không | Không | Không | Có | Có |
| Quản lý user thường | Không | Không | Không | Có | Có |
| Gán role không đặc quyền | Không | Không | Không | Có | Có |
| Tạo/khóa/hạ quyền Administrator | Không | Không | Không | Không | Có |
| Định nghĩa role/permission | Không | Không | Không | Không | Có |
| Cấp/thu hồi Super Administrator | Không | Không | Không | Không | Có, theo business rule |
| Xem audit log | Không | Không | Không | Giới hạn | Có |
| Sửa/xóa audit log | Không | Không | Không | Không | Không |
| Quản lý cấu hình bảo mật bảo vệ | Không | Không | Không | Không | Có |
| Vận hành cart/order/availability | Không | Khi mở extension | Khi mở extension | Khi mở extension | Khi mở extension |

## Business rules về actor và phân quyền

### Actor và account

- `BR-ACT-001`: Actor được xác định theo mục tiêu và quyền tương tác với hệ thống, không chỉ theo chức danh tổ chức.
- `BR-ACT-002`: Một account có thể giữ nhiều role; quyền hiệu lực là hợp của permission được cấp, trừ explicit deny nếu policy sau này hỗ trợ deny.
- `BR-ACT-003`: Actor generalization biểu diễn kế thừa capability, không biểu diễn quan hệ quản lý nhân sự.
- `BR-ACT-004`: AI service, worker và database không phải actor trong sơ đồ toàn hệ thống vì nằm bên trong system boundary.

### Authentication và authorization

- `BR-AUTH-001`: Mọi permission nhạy cảm phải được kiểm tra tại Spring Boot API; ẩn nút ở UI không thay thế authorization.
- `BR-AUTH-002`: Account bị khóa hoặc vô hiệu hóa không được tạo session mới.
- `BR-AUTH-003`: Operations Staff không được cấp role, quản lý Administrator hoặc thay đổi security configuration.
- `BR-AUTH-004`: Administrator chỉ được gán/thu hồi role không đặc quyền trong phạm vi policy.
- `BR-AUTH-005`: Administrator không được tự nâng mình hoặc account khác thành Super Administrator.
- `BR-AUTH-006`: Chỉ Super Administrator được quản lý lifecycle của Administrator và định nghĩa role/permission được bảo vệ.
- `BR-AUTH-007`: Hệ thống phải luôn còn ít nhất một Super Administrator hoạt động.
- `BR-AUTH-008`: Không được khóa, xóa hoặc hạ quyền Super Administrator cuối cùng.
- `BR-AUTH-009`: Super Administrator cuối cùng không được tự vô hiệu hóa hoặc tự hạ quyền.
- `BR-AUTH-010`: Thao tác cấp/hạ quyền, khóa/mở account quản trị và đổi security configuration phải tạo audit event append-only.
- `BR-AUTH-011`: Audit event không được sửa hoặc xóa qua giao diện/API nghiệp vụ thông thường.
- `BR-AUTH-012`: Thao tác đặc quyền cao phải yêu cầu xác thực lại; MFA là NFR khuyến nghị và có thể time-box khi triển khai.

### Catalog và publication

- `BR-CAT-001`: Operations Staff được tạo/sửa draft nhưng không được publish hoặc rollback catalog publication.
- `BR-CAT-002`: Chỉ Administrator hoặc Super Administrator được publish, archive hoặc rollback sản phẩm/catalog theo policy.
- `BR-CAT-003`: Mọi publication phải ghi `changed_by`, `published_by`, product version, model version, index version và timestamp; hai actor có thể trùng trong demo nhưng phải truy vết được.
- `BR-CAT-004`: Product chỉ chuyển Active khi metadata bắt buộc, ảnh, embedding và index publication tương thích cùng version.
- `BR-CAT-005`: Thay đổi ảnh hoặc text ảnh hưởng representation phải tạo product version và reprocessing job mới, không ghi đè artifact đã publish.

### Dữ liệu của người dùng

- `BR-USER-001`: Registered User chỉ xem/sửa/xóa profile, history và saved product thuộc account của mình.
- `BR-USER-002`: Guest search không được gắn vào một account; telemetry nếu có phải theo privacy policy và không biến thành history cá nhân.
- `BR-USER-003`: Ý nghĩa “chọn/hủy chọn” phải được chốt trước khi thiết kế ERD để tránh trùng với saved product, comparison list hoặc feedback.

### Commerce extension

- `BR-EXT-001`: Commerce extension phải có thể tắt hoặc bỏ mà không làm hỏng catalog, search, history hoặc saved product.
- `BR-EXT-002`: Không dùng cart/order extension để tuyên bố đã hoàn thành payment, shipping, POS hoặc inventory management.
- `BR-EXT-003`: Mọi triển khai commerce extension cần change proposal nếu ảnh hưởng D003, timeline Week 6-11, ERD core hoặc API core.

## Kịch bản kiểm tra ranh giới quyền

| Kịch bản | Kết quả mong đợi |
|---|---|
| Operations Staff gọi API gán role cho user | Bị từ chối; không thay đổi dữ liệu; ghi security event phù hợp. |
| Administrator cố cấp `SUPER_ADMIN` cho chính mình | Bị từ chối; yêu cầu Super Administrator thực hiện. |
| Super Administrator cuối cùng tự hạ quyền | Bị từ chối vì vi phạm `BR-AUTH-007/008/009`. |
| Operations Staff sửa ảnh sản phẩm đang Active | Tạo version/job mới; bản Active cũ tiếp tục phục vụ search cho tới publication mới. |
| Operations Staff cố publish sản phẩm vừa sửa | Bị từ chối; Administrator hoặc Super Administrator phải publish. |
| Administrator publish thay đổi do chính mình tạo trong demo | Được phép nếu policy demo cho phép, nhưng phải ghi riêng `changed_by` và `published_by`. |
| Registered User đọc search history của account khác | Bị từ chối ở API dù biết ID. |
| Guest dùng search | Được trả Top-K nhưng không tạo history gắn account. |
| Tắt commerce extension | Ba search mode, catalog, profile, history và saved product vẫn hoạt động. |

## Traceability seed cho requirement specification

| Nhóm requirement dự kiến | Actor | Phạm vi | Nguồn chính |
|---|---|---|---|
| FR-AUTH | Guest, Registered User | CORE | Đề cương: đăng ký, đăng nhập, đăng xuất, đổi mật khẩu |
| FR-RBAC | Administrator, Super Administrator | CORE/SUPPORTING | Đề cương: phân quyền; NFR security/audit |
| FR-PROFILE | Registered User | CORE | Đề cương: cập nhật thông tin cá nhân |
| FR-CATALOG-PUBLIC | Guest, Registered User | CORE | Đề cương: danh sách và chi tiết sản phẩm |
| FR-CATALOG-MGMT | Operations Staff, Administrator | CORE | Đề cương: quản trị sản phẩm, danh mục, ảnh, mô tả |
| FR-SEARCH-IMAGE | Guest, Registered User | CORE | Đề cương: tìm kiếm bằng ảnh |
| FR-SEARCH-TEXT | Guest, Registered User | CORE | Đề cương: tìm kiếm bằng mô tả tự nhiên |
| FR-SEARCH-MULTI | Guest, Registered User | CORE | Đề cương: tìm kiếm ảnh cộng văn bản, Top-K |
| FR-HISTORY | Registered User | CORE | Đề cương: lịch sử tìm kiếm |
| FR-SAVED | Registered User | CORE | Đề cương: sản phẩm quan tâm |
| FR-RESULT-ACTION | Registered User | CORE | Đề cương: chọn/hủy chọn; semantics còn cần chốt |
| FR-PROCESSING | Operations Staff | SUPPORTING | D004, kiến trúc worker/job |
| FR-PUBLICATION | Administrator | SUPPORTING | D006/D054, version/provenance |
| FR-SECURITY-GOV | Super Administrator | SUPPORTING | Quyết định actor Week 5 |
| FR-COMMERCE-X | Registered User, Operations Staff | EXTENSION | Đề xuất mở rộng; không phải đề cương bắt buộc |

## Conflict và tác động cần xử lý sau khi review

### Actor hiện hành trong tài liệu scope

`docs/01_PROJECT_SCOPE_AND_REQUIREMENTS.md` hiện liệt kê Guest Shopper, Registered Shopper, Seller, Reviewer, Admin và Researcher. Mô hình Week 5 đề xuất bốn primary actors và một privileged specialization.

Hướng xử lý sau khi nhóm duyệt:

- gộp Seller vào Operations Staff cho catalog workflow;
- giữ Reviewer như permission bundle hoặc secondary actor trong review subsystem nếu cần;
- chuyển Researcher sang research/evaluation subsystem;
- thêm Super Administrator vào Identity and Access;
- cập nhật requirement/diagram/ERD đồng bộ thay vì chỉ đổi tên trong một file.

### D004 và thuật ngữ Seller/Reviewer

D004 vẫn đúng về luồng nghiệp vụ catalog. Tài liệu Week 5 thay đổi cách gom actor, không xóa các bước create, tag, review, embed và publish.

Nếu nhóm muốn xóa hoàn toàn Seller/Reviewer khỏi mọi tài liệu hoặc thay đổi ownership của catalog, cần change record vì tác động tới scope, API, UI, data ownership và roadmap.

### D003 và commerce extension

D003 tiếp tục có hiệu lực. Việc liệt kê cart/order/availability trong `EXTENSION` không tự động cấp quyền triển khai full e-commerce.

Nếu nhóm quyết định triển khai một extension, change proposal phải nêu:

- tính năng cụ thể và non-goal;
- owner và time-box;
- tác động tới ERD/API/UI/test;
- điều kiện dừng khi core gate đỏ;
- xác nhận rằng payment/shipping/POS/loyalty không bị suy diễn là đã hoàn thành.

## Câu hỏi còn mở

| ID | Câu hỏi | Đề xuất mặc định | Cần xác nhận bởi |
|---|---|---|---|
| W5-O01 | “Chọn/hủy chọn” là saved product, comparison selection hay feedback? | Tách saved product và transient comparison; feedback là action riêng. | GVHD |
| W5-O02 | Operations Staff có được review metadata hay cần Reviewer actor riêng? | Giữ permission bundle trong Operations Staff để sơ đồ tổng quan gọn. | Nhóm/GVHD |
| W5-O03 | Administrator có được publish thay đổi do chính mình tạo? | Cho phép trong demo nhưng ghi đầy đủ changed_by/published_by; production nên maker-checker. | Nhóm |
| W5-O04 | Commerce extension nào được phân tích chi tiết? | Chỉ cart, order demo, availability và promotion metadata; phần còn lại Future. | Nhóm/GVHD |
| W5-O05 | Có triển khai MFA cho Super Administrator trong đồ án không? | Đưa vào NFR/acceptance; triển khai nếu timeline cho phép. | Nhóm |

## Gate review cho mốc 1

- [x] System boundary được nêu rõ.
- [x] Bốn primary actors có mục tiêu và giới hạn riêng.
- [x] Super Administrator có use case và business rule riêng.
- [x] Actor generalization không bị nhầm với cơ cấu tổ chức.
- [x] Core, supporting, extension và future scope được tách.
- [x] Ma trận actor-permission có server-side boundary.
- [x] Business rule bảo vệ Super Administrator cuối cùng tồn tại.
- [x] Role cũ được ánh xạ, không bị xóa im lặng.
- [x] Conflict với D003/D004 và tài liệu scope hiện hành được ghi công khai.
- [ ] Nhóm review và chốt các câu hỏi mở.
- [ ] GVHD xác nhận actor/scope extension khi cần.
- [ ] Decision Register và tài liệu scope được cập nhật sau approval.

## Kết quả desk review mốc 1

Ngày review: 20/09/2026.

Phạm vi review: đối chiếu với đề cương chính thức 7 trang, D001/D003/D004/D054/D055, `CONTEXT.md` và tài liệu scope hiện hành. Đây là review nội bộ của artifact, không thay thế xác nhận của nhóm hoặc GVHD.

Kết luận: **Đạt có điều kiện**.

- Không phát hiện việc đưa commerce, payment, shipping, POS, loyalty hoặc inventory phức tạp vào core.
- Bốn actor cấp gốc và Super Administrator chuyên biệt có mục tiêu, giới hạn và quyền phân biệt được.
- Seller, Reviewer và Researcher cũ không bị xóa im lặng; mỗi actor đều có ánh xạ và tác động downstream.
- 27 business-rule ID là duy nhất; các rule bảo vệ Super Administrator cuối cùng và server-side authorization không mâu thuẫn đề cương.
- Đã sửa một lỗi trình bày trong ma trận quyền: đăng nhập, đăng xuất và đổi mật khẩu được tách thành ba hành vi để Guest có thể khởi tạo đăng nhập khi có account.
- Chưa được coi là `Approved` hoặc `Locked` cho tới khi các câu hỏi `W5-O01` đến `W5-O05` được review theo đúng owner.

Điều kiện để đóng mốc:

1. Nhóm xác nhận mô hình actor và quyền publish/review.
2. GVHD xác nhận semantics của “chọn/hủy chọn” và mức extension cần trình bày.
3. Chỉ sau hai bước trên mới đồng bộ Decision Register, tài liệu scope, use case, class model và ERD.

## Bước tiếp theo sau khi duyệt mốc 1

1. Tạo Week 5 compliance matrix từ đề cương.
2. Viết requirement specification với FR/NFR/business rule ID và acceptance criteria.
3. Chốt semantics của result interaction trước khi thiết kế ERD.
4. Lập business use case và đặc tả.
5. Lập system use case overview, sau đó tách Identity, Catalog, Search và Extension diagram.
