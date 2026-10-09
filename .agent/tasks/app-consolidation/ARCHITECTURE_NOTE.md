# Vertical slice, monolith và source đang có

09/10/2026, Control giải thích hiện trạng; chưa đổi kiến trúc hay chốt ý định của teammate.

| Khái niệm | Câu hỏi nó trả lời | FaSearch hiện tại |
| --- | --- | --- |
| Vertical-slice delivery | Chia công việc thế nào để có một luồng dùng được từ đầu đến cuối? | Các task search/account/library/console được giao theo outcome FE→BE→data/AI và kiểm chứng. |
| Vertical-slice code organization | Để code của một feature/use case gần nhau thế nào? | Chia theo nhóm identity/catalog/library/search ở BE, nhưng search còn chia api/application/infrastructure. Đây là tổ chức hỗn hợp, chưa thuần mỗi use case một folder. |
| Monolithic deployment | Backend nghiệp vụ được build/deploy thành một ứng dụng hay nhiều service nghiệp vụ độc lập? | Một Spring Boot app/JAR chứa identity/catalog/library/search. Không có identity-service/catalog-service/library-service riêng. |
| AI process | Python inference chạy ở đâu? | FastAPI nội bộ riêng vì model/runtime Python. Toàn hệ thống không phải một process duy nhất; backend nghiệp vụ vẫn tập trung trong Boot. |
| Monorepo / integration branch | Source được giữ ở đâu, bản nào cả nhóm đang xem? | Một repo có nhiều component; hiện nhiều feature branch. Consolidation sẽ tạo một branch đọc chung, không tự biến kiến trúc thành monolith hay microservices. |

Vertical slice và monolith có thể cùng tồn tại: một backend deploy chung nhưng chia chức năng trong source. Nhiều folder/module không tự biến ứng dụng thành microservices. Ngược lại, đổi tên branch cũng không thay cách bố trí code.

Điều chưa nên giả định: teammate nói “monolithic” có thể muốn một deployable backend, một layout Controller→Service→Repository dễ quen, ít interface hơn, hoặc một source tích hợp thay vì nhiều branch. Chờ chính teammate giải thích trong Discord trước khi chọn refactor. Không bỏ Python/đổi runtime hay xóa abstraction vì một từ chưa rõ.

Gợi ý câu hỏi trong buổi trao đổi: “Ý bạn là gộp deployment, thống nhất package Controller/Service/Repository, hay gom code theo feature? Với luồng tạo sản phẩm và search, bạn muốn đường đọc cụ thể thế nào?” Đối chiếu trên cùng integration SHA và ví dụ một request thật, không tranh luận chỉ bằng tên pattern.

Source xác minh: be là một Spring Boot build; packageidentity/catalog/library/search trong inspected8f/868; D054 giữ Boot nghiệp vụ và FastAPI nội bộ. Microsoft architecture guide phân biệt logical layers với deployment unit: https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures . Đây là giải thích khái niệm, không nguồn thay thế quyết định nhóm.
