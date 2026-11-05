# TỔNG QUAN HỆ THỐNG VÀ BỐI CẢNH DỰ ÁN (FA SEARCH BACKEND)

Tài liệu này cung cấp bức tranh toàn cảnh về **bối cảnh kinh doanh, giá trị cốt lõi, đối tượng người dùng và các phân hệ nghiệp vụ chính** của nền tảng **FaSearch Backend**.

> 📖 **Tài liệu liên quan:**
> - Bộ nhớ làm việc & Tiến độ 5 phiên gần nhất: **[be_docs/memory.md](./be_docs/memory.md)**
> - Danh mục 54 chức năng & Bảng theo dõi tiến độ: **[be_docs/module.md](./be_docs/module.md)**
> - Hướng dẫn cài đặt, cấu hình kỹ thuật và khởi chạy: **[README.md](./README.md)**
> - Quy chuẩn kiến trúc, quy trình làm việc và quy tắc dành cho AI Agent: **[AGENTS.md](./AGENTS.md)**
> - Đặc tả kỹ thuật chi tiết các Endpoint API: **[be_docs/api/README.md](./be_docs/api/README.md)**

---

## I. GIỚI THIỆU DỰ ÁN

**FaSearch** là giải pháp Backend cung cấp nền tảng RESTful API toàn diện cho chuỗi cửa hàng thời trang bán lẻ đa kênh (**Omnichannel Retail**). Hệ thống kết nối liền mạch giữa:
- **Kênh bán lẻ trực tiếp:** Điểm bán hàng tại quầy (**POS - Point of Sale**) với khả năng quét mã vạch và thanh toán tốc độ cao.
- **Kênh bán hàng số:** Website và Mobile App thương mại điện tử (**eCommerce**).
- **Công cụ tìm kiếm thông minh:** Tích hợp tìm kiếm đa phương thức bằng ngôn ngữ tự nhiên và hình ảnh sản phẩm thực tế (**AI Multimodal Search**).

---

## II. BỐI CẢNH BÀI TOÁN & GIẢI PHÁP

### 1. Thách thức trong ngành thời trang bán lẻ
- **Khó khăn trong tìm kiếm sản phẩm:** Khách hàng thời trang thường ghi nhớ sản phẩm qua hình ảnh hoặc mô tả kiểu dáng cảm quan (ví dụ: *"áo polo form rộng màu be phối viền"*) thay vì nhớ mã SKU hoặc tên chính xác của nhà sản xuất.
- **Đứt gãy tồn kho đa kênh:** Tồn kho giữa cửa hàng vật lý và sàn trực tuyến dễ bị sai lệch nếu không được đồng bộ theo thời gian thực, dẫn đến tình trạng hủy đơn do hết hàng.
- **Trải nghiệm khách hàng rời rạc:** Dữ liệu tích điểm, thói quen tiêu dùng và quyền lợi thành viên không được liên kết xuyên suốt khi khách vừa mua tại quầy vừa mua online.

### 2. Giải pháp từ FaSearch
- **Hệ thống dữ liệu tập trung (Single Source of Truth):** Toàn bộ giao dịch, tồn kho biến thể sản phẩm (Màu sắc, Size, Barcode) và giỏ hàng được quản lý đồng bộ theo thời gian thực.
- **Tích hợp tìm kiếm đa phương thức:** Hỗ trợ người dùng tìm kiếm sản phẩm tức thì bằng ảnh chụp hoặc mô tả tự nhiên.
- **Hệ sinh thái khách hàng thân thiết đa kênh:** Tự động tích lũy điểm thưởng theo giá trị chi tiêu, thăng hạng thành viên và đồng bộ voucher ưu đãi cho cả hai kênh online và offline.

---

## III. ĐỐI TƯỢNG NGƯỜI DÙNG & GIÁ TRỊ MANG LẠI

| Đối tượng | Vai trò trong hệ thống | Giá trị mang lại |
| :--- | :--- | :--- |
| **Khách hàng** (`CUSTOMER`) | Người mua sắm trực tuyến hoặc tại quầy | Trải nghiệm tìm kiếm sản phẩm thông minh, đặt hàng nhanh chóng, tích điểm thăng hạng và hưởng voucher giảm giá đồng bộ. |
| **Quản lý** (`STAFF`, trước đây gọi là Nhân viên bán hàng / Thu ngân) | Nhân sự tại cửa hàng vật lý | Thao tác bán hàng tại quầy (POS) tiện lợi qua quét mã vạch, tra cứu nhanh thông tin khách hàng bằng SĐT, áp dụng ưu đãi và in hóa đơn tức thì. |
| **Quản trị viên / Chủ chuỗi cửa hàng** (`ADMIN`) | Quản lý vận hành hệ thống | Giám sát tập trung sản phẩm, danh mục, xuất - nhập kho, quản lý phân quyền nhân sự, cấu hình khuyến mãi và xem báo cáo doanh thu theo kênh. |

---

## IV. CÁC PHÂN HỆ NGHIỆP VỤ CỐT LÕI

Hệ sinh thái FaSearch Backend được chia thành 10 phân hệ nghiệp vụ chính:

1. **Xác thực & Phân quyền (Authentication & Authorization):** Đăng ký, đăng nhập an toàn với mật khẩu mã hóa BCrypt, cấp phát và xác thực JWT Token theo cơ chế phân quyền RBAC (`ADMIN`, `STAFF`, `CUSTOMER`).
2. **Quản lý người dùng & Nhân sự (User & Employee Management):** Quản lý hồ sơ nhân viên (`nhan_vien`) và hồ sơ khách hàng (`khach_hang`). Quản trị viên (`ADMIN`) được quản lý trong hồ sơ nhân sự với tài khoản mang vai trò Admin.
3. **Khách hàng thân thiết (Loyalty & Membership):** Tự động quy đổi giá trị đơn hàng thành điểm tích lũy, tự động nâng bậc thành viên (Đồng, Bạc, Vàng, Kim Cương) và trừ điểm đổi mã giảm giá.
4. **Sản phẩm & Danh mục (Catalog & Variants):** Quản lý cây danh mục thời trang đa cấp, thông tin sản phẩm và quản lý ma trận biến thể theo Màu sắc, Kích cỡ (Size), Mã SKU và Mã vạch (Barcode).
5. **Kho hàng & Tồn kho (Inventory Management):** Quản lý số lượng tồn kho theo biến thể, ghi nhận lịch sử xuất - nhập kho, theo dõi ngưỡng tồn tối thiểu để kích hoạt cảnh báo nhập hàng.
6. **Bán hàng tại quầy (Point of Sale - POS):** Giao diện xử lý đơn hàng tại quầy cho thu ngân: tra cứu sản phẩm qua mã vạch, nhận diện khách hàng thân thiết, áp dụng khuyến mãi và ghi nhận thanh toán nhanh.
7. **Đơn hàng & Giỏ hàng trực tuyến (Cart & Order Processing):** Quản lý giỏ hàng online, xử lý vòng đời đơn hàng (`PENDING` -> `CONFIRMED` -> `SHIPPING` -> `COMPLETED`), tạm giữ và hoàn trả tồn kho tự động.
8. **Khuyến mãi & Mã giảm giá (Promotion & Voucher):** Thiết lập chiến dịch giảm giá theo phần trăm hoặc số tiền cố định, phát hành voucher có giới hạn lượt dùng và ràng buộc giá trị đơn tối thiểu.
9. **Đổi trả hàng hóa (Return & Exchange):** Tiếp nhận yêu cầu đổi trả, tra cứu lịch sử mua hàng, kiểm tra tính hợp lệ về thời hạn và tình trạng sản phẩm, tính toán chênh lệch giá khi đổi mẫu.
10. **Báo cáo & Thống kê (Analytics & Reporting):** Thống kê doanh thu theo kênh bán lẻ (POS vs Online), phân tích mặt hàng bán chạy và hiệu quả của các chương trình khuyến mãi.

---

## V. BẢN ĐỒ ĐIỀU HƯỚNG TÀI LIỆU DỰ ÁN

| Tài liệu | Đối tượng | Mục đích chính |
| :--- | :--- | :--- |
| **[OVERVIEW.md](./OVERVIEW.md)** | Quản lý, Khách hàng, Developer mới | Nắm bắt bối cảnh nghiệp vụ, giá trị bài toán và 10 phân hệ chức năng. |
| **[README.md](./README.md)** | Lập trình viên, Người đóng góp | Hướng dẫn cài đặt môi trường, chạy ứng dụng, cấu trúc mã nguồn và danh sách API. |
| **[AGENTS.md](./AGENTS.md)** | AI Agent, Tech Lead | Quy chuẩn kiến trúc, quy tắc "Hỏi trước khi làm", coding standards và lộ trình triển khai. |
