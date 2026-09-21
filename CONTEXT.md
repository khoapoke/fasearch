# Fashion Product Search

Ngôn ngữ miền thống nhất cho hệ thống tìm kiếm sản phẩm thời trang đa phương thức. Tài liệu này chỉ định nghĩa các khái niệm nghiệp vụ cốt lõi để requirement, use case, lớp phân tích và mô hình dữ liệu dùng cùng một tên.

## Identity and Access

**Guest**:
Người chưa xác thực sử dụng các khả năng khám phá và tìm kiếm công khai.
_Avoid_: Khách hàng ẩn danh, Customer

**Registered User**:
Người đã có account và có thể sở hữu profile, search history và saved products.
_Avoid_: Customer, Member

**Operations Staff**:
Nhân viên thực hiện công việc vận hành catalog và xử lý dữ liệu hằng ngày nhưng không quản trị quyền đặc quyền.
_Avoid_: Seller, Reviewer, Nhân viên kho, Nhân viên bán hàng

**Administrator**:
Quản trị viên quản lý người dùng thường, role không đặc quyền và publication của catalog.
_Avoid_: Manager, System Owner

**Super Administrator**:
Quản trị viên cấp cao quản lý Administrator, định nghĩa role và permission, cùng các cấu hình bảo mật được bảo vệ.
_Avoid_: God, Root User

## Catalog

**Catalog Product**:
Sản phẩm thời trang được quản lý để xuất hiện trong catalog tìm kiếm; không mặc định là một mặt hàng đang được bán hoặc còn tồn kho.
_Avoid_: Stock Item, Order Item

**Product Version**:
Ảnh chụp bất biến của nội dung sản phẩm tại một lần thay đổi có thể ảnh hưởng tới tìm kiếm hoặc publication.
_Avoid_: Product Update

**Catalog Publication**:
Tập product versions đã được phê duyệt và công bố đồng bộ để hệ thống tìm kiếm sử dụng.
_Avoid_: Product List, Inventory Snapshot

**Saved Product**:
Quan hệ thể hiện một Registered User lưu một Catalog Product để xem lại sau.
_Avoid_: Cart Item, Selected Result

## Search

**Search Request**:
Yêu cầu tìm kiếm theo một trong ba mode: text, image hoặc composed image-text.
_Avoid_: Keyword Search

**Search Result**:
Một Catalog Product được xếp hạng cho một Search Request cùng thông tin cần để giải thích và truy vết kết quả.
_Avoid_: Recommendation, Order Suggestion

**Composed Search**:
Tìm kiếm kết hợp ảnh tham chiếu với mô tả thay đổi mong muốn trong cùng một request.
_Avoid_: Advanced Search, Combined Filter

**Interested Product**:
Thuật ngữ trong đề cương chỉ sản phẩm người dùng quan tâm; trong mô hình hệ thống được hiện thực bằng Saved Product sau khi semantics được GVHD xác nhận.
_Avoid_: Favorite nếu chưa chốt đồng nghĩa

## Scope

**Supporting Core**:
Khả năng cần để core vận hành đúng, an toàn và có thể truy vết dù không được rubric gọi tên riêng.
_Avoid_: Bonus Feature

**Commerce Extension**:
Nhóm nghiệp vụ bán lẻ tùy chọn được tách khỏi core tìm kiếm và có thể loại bỏ mà không làm hỏng các luồng bắt buộc.
_Avoid_: Core E-commerce, Full Retail System
