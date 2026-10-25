# BẢNG DANH MỤC CHỨC NĂNG TOÀN HỆ THỐNG (FA SEARCH BACKEND)

Tài liệu này liệt kê toàn bộ yêu cầu chức năng (Functional Requirements) của hệ thống **FaSearch Backend**, phân nhóm theo từng Module nghiệp vụ.

> **Tài liệu liên quan:**
> - Bộ nhớ làm việc & Tiến độ 5 phiên gần nhất: **[memory.md](file:///d:/fasearch/be/fasearch/be_docs/memory.md)**
> - Bối cảnh bài toán & 10 phân hệ nghiệp vụ: **[OVERVIEW.md](file:///d:/fasearch/be/fasearch/OVERVIEW.md)**
> - Hướng dẫn kỹ thuật & cài đặt: **[README.md](file:///d:/fasearch/be/fasearch/README.md)**
> - Quy tắc phát triển & Coding Standards: **[AGENTS.md](file:///d:/fasearch/be/fasearch/AGENTS.md)**
> - Đặc tả kỹ thuật Request / Response API: **[be_docs/api/README.md](file:///d:/fasearch/be/fasearch/be_docs/api/README.md)**

### Chú giải cột Trạng thái & Vai trò

| Ký hiệu | Trạng thái | Ý nghĩa |
| :---: | :--- | :--- |
| X | Hoàn thành | Đã triển khai, đã test và sẵn sàng sử dụng |
| O | Đang làm | Đang trong quá trình triển khai |
| (để trống) | Chưa làm | Chưa bắt đầu code, nằm trong kế hoạch |

| Viết tắt | Vai trò | Mô tả |
| :---: | :--- | :--- |
| `A` | `ADMIN` | Quản trị viên hệ thống |
| `S` | `STAFF` | Nhân viên bán hàng / Thu ngân |
| `C` | `CUSTOMER` | Khách hàng mua sắm |
| `P` | `PUBLIC` | Không cần đăng nhập (Công khai) |
| `SYS` | `SYSTEM` | Hệ thống tự động xử lý (không cần giao diện) |

---

## 1. Quản lý Tài khoản & Xác thực (Module `auth`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-01 | Xem danh sách tài khoản | Hiển thị danh sách tài khoản, tìm kiếm/lọc theo Tên, Tên đăng nhập, SĐT hoặc Vai trò | `A` | |
| FR-02 | Thêm mới tài khoản | Tạo tài khoản mới với Họ tên, Tên đăng nhập, Mật khẩu, Email, SĐT và Vai trò | `A` | |
| FR-03 | Cập nhật tài khoản | Chỉnh sửa thông tin cá nhân, Email, SĐT hoặc thay đổi Mật khẩu / Vai trò | `A` | |
| FR-04 | Xóa / Khóa tài khoản | Chuyển trạng thái tài khoản sang `LOCKED` hoặc `DELETED` để ngăn đăng nhập | `A` | |
| FR-05 | Đăng nhập & Xác thực | Xác thực tên đăng nhập và mật khẩu, cấp JWT Token để truy cập hệ thống | `P` | X |
| FR-06 | Đăng ký tài khoản | Khách hàng tự đăng ký tài khoản mới với vai trò `CUSTOMER` | `P` | X |
| FR-07 | Xem thông tin tài khoản hiện tại | Lấy thông tin tài khoản đang đăng nhập từ JWT Token | `A` `S` `C` | X |
| FR-08 | Phân quyền truy cập (RBAC) | Giới hạn quyền truy cập chức năng và dữ liệu dựa trên Vai trò (`ADMIN`, `STAFF`, `CUSTOMER`) | `SYS` | X |
| FR-09 | Ghi nhật ký hệ thống | Tự động ghi vết người dùng, thời gian và dữ liệu thay đổi khi Thêm / Sửa / Xóa | `SYS` | |

---

## 2. Quản lý Người dùng & Nhân sự (Module `user`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-10 | Xem danh sách khách hàng | Hiển thị danh sách khách hàng, tìm kiếm/lọc theo Tên, SĐT, Hạng thành viên | `A` `S` | |
| FR-11 | Xem chi tiết khách hàng | Xem thông tin chi tiết hồ sơ khách hàng theo ID | `A` `S` `C` | O |
| FR-12 | Thêm / Sửa khách hàng | Tạo mới hoặc chỉnh sửa hồ sơ khách hàng (Họ tên, Ngày sinh, Địa chỉ, Email) | `A` `S` | |
| FR-13 | Xóa mềm khách hàng | Chuyển trạng thái `da_xoa = true`, không xóa vĩnh viễn khỏi CSDL | `A` | |
| FR-14 | Tra cứu khách hàng tại quầy | Hiển thị thông tin KH (Họ tên, Hạng, Điểm tích lũy) khi nhập SĐT tại quầy POS | `S` | |
| FR-15 | Xem danh sách nhân viên | Hiển thị danh sách nhân viên, tìm kiếm/lọc theo Tên, SĐT, CCCD | `A` | |
| FR-16 | Thêm / Sửa nhân viên | Tạo mới hoặc chỉnh sửa hồ sơ nhân viên (Họ tên, CCCD, SĐT, Giới tính, Địa chỉ) | `A` | |
| FR-17 | Xóa mềm nhân viên | Chuyển trạng thái `da_xoa = true` cho nhân viên nghỉ việc | `A` | |

---

## 3. Khách hàng thân thiết & Tích điểm (Module `user`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-18 | Tích điểm tự động | Tự động cộng điểm thưởng vào tài khoản KH dựa trên giá trị thanh toán thực tế | `SYS` | |
| FR-19 | Nâng hạng thành viên | Tự động cập nhật hạng thành viên khi tổng chi tiêu tích lũy đạt mốc quy định | `SYS` | |
| FR-20 | Trừ điểm đổi giảm giá | Quy đổi điểm tích lũy thành số tiền giảm giá trực tiếp vào hóa đơn | `C` `S` | |

---

## 4. Quản lý Sản phẩm & Danh mục (Module `product` / `category`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-21 | Quản lý danh mục sản phẩm | Xem, Thêm, Sửa, Xóa các danh mục (Áo sơ mi, Quần Jean, Phụ kiện...) | `A` | |
| FR-22 | Xem danh sách & Tìm kiếm SP | Hiển thị danh sách SP, tìm kiếm/lọc theo Tên, Mã SP, Danh mục, Khoảng giá, Trạng thái | `A` `S` `C` | |
| FR-23 | Thêm mới sản phẩm | Nhập thông tin: Tên, Danh mục, Chất liệu, Kiểu dáng, Mô tả, Giá bán, Giá nhập, Hình ảnh | `A` | |
| FR-24 | Cập nhật sản phẩm | Chỉnh sửa thông tin chi tiết, hình ảnh và giá niêm yết của sản phẩm đã tồn tại | `A` | |
| FR-25 | Xóa / Tạm ẩn sản phẩm | Xóa SP (nếu chưa có giao dịch) hoặc chuyển trạng thái `DISCONTINUED` để ẩn khỏi danh mục | `A` | |
| FR-26 | Quản lý biến thể (Màu/Size) | Thêm / Sửa / Xóa thuộc tính Màu sắc và Size, tự động sinh mã SKU duy nhất | `A` | |
| FR-27 | Xuất mã vạch (Barcode) | Xuất dữ liệu mã vạch chuẩn tương ứng từng mã SKU biến thể phục vụ in tem dán | `A` `S` | |
| FR-28 | Tìm kiếm SP tại quầy (POS) | Tìm nhanh sản phẩm bằng Mã SKU / Tên hoặc quét mã vạch (Barcode) | `S` | |

---

## 5. Tìm kiếm thông minh đa phương thức (Module `search` — AI Feature)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-NC1 | Tìm kiếm SP bằng mô tả tự nhiên | Tìm kiếm sản phẩm theo ngôn ngữ tự nhiên qua mô tả văn bản | `C` `S` | |
| FR-NC2 | Tìm kiếm SP bằng hình ảnh | Tìm kiếm sản phẩm bằng hình ảnh sản phẩm do người dùng tải lên | `C` `S` | |
| FR-NC3 | Tìm kiếm đa phương thức | Kết hợp cả mô tả văn bản và hình ảnh để tìm sản phẩm chính xác nhất | `C` `S` | |

---

## 6. Quản lý Kho hàng & Tồn kho (Module `inventory`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-29 | Tra cứu tồn kho | Xem số lượng tồn kho khả dụng của từng mã SKU theo từng chi nhánh / kho | `A` `S` | |
| FR-30 | Lập phiếu nhập kho | Tạo phiếu nhập kho từ nhà cung cấp, tự động cộng số lượng tồn kho theo SKU | `A` | |
| FR-31 | Lập phiếu xuất / Chuyển kho | Tạo phiếu xuất hủy (hàng lỗi) hoặc phiếu chuyển kho giữa các chi nhánh | `A` | |
| FR-32 | Kiểm kê kho | Tạo phiếu kiểm kê, ghi nhận số lượng đếm thực tế bằng quét mã vạch | `A` `S` | |
| FR-33 | Cân bằng kho | Tự động tạo phiếu cân bằng để điều chỉnh tồn phần mềm khớp với thực tế | `SYS` | |
| FR-34 | Cảnh báo tồn kho thấp | Gửi thông báo khi số lượng tồn kho SKU xuống bằng hoặc dưới ngưỡng tối thiểu | `SYS` | |

---

## 7. Quản lý Đơn hàng & Giỏ hàng (Module `order` / `cart`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-35 | Đặt hàng trực tuyến | Khách hàng chọn sản phẩm, thêm vào giỏ hàng và hoàn tất tạo đơn trên Web/App | `C` | |
| FR-36 | Xem danh sách & Chi tiết đơn hàng | Lọc đơn hàng theo Mã đơn, SĐT khách, Ngày đặt hoặc Trạng thái | `A` `S` `C` | |
| FR-37 | Cập nhật trạng thái đơn hàng | Chuyển trạng thái tuần tự: `PENDING` → `CONFIRMED` → `PACKING` → `SHIPPING` → `COMPLETED` | `A` `S` | |
| FR-38 | Hủy đơn hàng | Hủy đơn trước khi hoàn tất thanh toán, không ghi nhận doanh thu | `A` `S` `C` | |
| FR-39 | Tạm lưu đơn hàng (POS) | Lưu tạm đơn đang tính dở để phục vụ khách tiếp theo, mở lại khi cần | `S` | |
| FR-40 | Tạm giữ & Hoàn trả tồn kho | Tự động khóa tồn kho khi tạo đơn, hoàn trả nếu đơn bị Hủy / Giao thất bại | `SYS` | |
| FR-41 | Tính phí vận chuyển | Tự động tính phí giao hàng dựa trên Địa chỉ, Trọng lượng và đối tác vận chuyển | `SYS` | |

---

## 8. Quản lý Thanh toán & Hóa đơn (Module `payment`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-42 | Tính tiền đơn hàng | Tự động tính tổng tiền sau khi trừ chiết khấu khuyến mãi hoặc ưu đãi hạng thành viên | `SYS` | |
| FR-43 | Thanh toán & Xuất hóa đơn | Chọn phương thức (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`), trừ tồn kho và xuất hóa đơn | `S` `C` | |

---

## 9. Quản lý Khuyến mãi & Mã giảm giá (Module `promotion`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-44 | Xem danh sách khuyến mãi | Xem và lọc chương trình KM theo trạng thái (`UPCOMING`, `ACTIVE`, `EXPIRED`, `DISABLED`) | `A` | |
| FR-45 | Thêm mới chương trình KM | Thiết lập KM: Thời gian, SP áp dụng, Mức giảm (`PERCENTAGE` / `FIXED_AMOUNT`), Số lượng voucher | `A` | |
| FR-46 | Sửa / Tạm dừng KM | Chỉnh sửa điều kiện hoặc tạm dừng chương trình KM trước thời hạn | `A` | |
| FR-47 | Xác thực mã giảm giá | Kiểm tra và từ chối mã giảm giá khi đơn không thỏa điều kiện hoặc mã đã hết lượt | `SYS` | |

---

## 10. Quản lý Đổi / Trả hàng (Module `returnorder`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-48 | Tra cứu hóa đơn đổi trả | Tìm kiếm hóa đơn cũ theo Mã đơn hàng hoặc SĐT khách hàng | `A` `S` | |
| FR-49 | Kiểm tra điều kiện đổi trả | Tự động từ chối nếu thời hạn tính từ lúc mua vượt quá số ngày quy định | `SYS` | |
| FR-50 | Lập phiếu đổi / trả hàng | Tính chênh lệch giá khi đổi sang SP khác, hủy nếu chênh lệch vượt mức cho phép | `A` `S` | |
| FR-51 | Nhập kho hàng trả lại | Tự động tạo phiếu nhập kho thu hồi cho SP đủ điều kiện tái kinh doanh | `SYS` | |

---

## 11. Báo cáo & Thống kê (Module `analytics`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-52 | Báo cáo doanh thu | Xuất tổng doanh thu, lợi nhuận theo Ngày/Tuần/Tháng, lọc theo kênh bán (POS vs Online) | `A` | |
| FR-53 | Báo cáo hiệu quả sản phẩm | Xuất Top N SP/SKU bán chạy nhất hoặc danh sách hàng tồn chậm luân chuyển | `A` | |
| FR-54 | Báo cáo Xuất - Nhập - Tồn | Xuất biến động tồn kho (Tồn đầu kỳ, Nhập, Xuất bán, Tồn cuối kỳ) theo từng SKU | `A` | |

---

## Tổng kết tiến độ

| Trạng thái | Số lượng | Ghi chú |
| :--- | :---: | :--- |
| X (Hoàn thành) | 4 | FR-05, FR-06, FR-07, FR-08 (Module `auth`) |
| O (Đang làm) | 1 | FR-11 (Module `user` — Xem chi tiết khách hàng) |
| Chưa làm | 49 | Các chức năng còn lại trên toàn hệ thống |
