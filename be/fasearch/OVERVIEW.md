# TỔNG QUAN DỰ ÁN & KIẾN TRÚC HỆ THỐNG (FA SEARCH BACKEND)

Tài liệu này cung cấp cái nhìn toàn cảnh về nghiệp vụ, kiến trúc phần mềm, danh mục thực thể CSDL và công nghệ của hệ sinh thái **FaSearch Backend**.

> 💡 **Dành cho AI Agent / Lập trình viên:** Vui lòng đọc tài liệu quy chuẩn quy trình làm việc và coding conventions tại [AGENTS.md](file:///d:/fasearch/be/fasearch/AGENTS.md).

---

## I. TỔNG QUAN BÀI TOÁN NGHIỆP VỤ

**FaSearch** là hệ thống Backend cung cấp nền tảng RESTful API cho chuỗi cửa hàng thời trang bán lẻ đa kênh (Omnichannel: Bán hàng tại quầy POS kết hợp Website/App eCommerce), tích hợp tìm kiếm thông minh bằng ngôn ngữ tự nhiên và đa phương thức (hình ảnh & text).

### Các phân hệ chính:
1. **Xác thực & Bảo mật (Auth):** Đăng ký, đăng nhập, cấp phát JWT token, phân quyền theo vai trò (`ADMIN`, `STAFF`, `CUSTOMER`).
2. **Quản lý con người (User):** Hồ sơ nhân viên (`nhan_vien`), hồ sơ khách hàng (`khach_hang`), quản trị viên (Admin thuộc `nhan_vien` với quyền `ADMIN`).
3. **Khách hàng thân thiết (Loyalty):** Tích điểm tự động theo giá trị đơn hàng, nâng hạng thành viên (Đồng, Bạc, Vàng, Kim Cương), trừ điểm đổi voucher giảm giá.
4. **Sản phẩm & Danh mục (Catalog):** Quản lý danh mục, thông tin sản phẩm, quản lý ma trận biến thể (Color / Size / SKU / Barcode).
5. **Kho hàng & Tồn kho (Inventory):** Tra cứu tồn kho theo chi nhánh, lập phiếu nhập kho, phiếu xuất/chuyển kho, kiểm kê và cảnh báo chạm ngưỡng tồn tối thiểu.
6. **Bán hàng tại quầy (POS):** Tra cứu nhanh sản phẩm qua Barcode, nhận diện khách hàng qua SĐT, tính tiền, áp dụng khuyến mãi, thanh toán và in hóa đơn.
7. **Đơn hàng & Giỏ hàng (Order & Cart):** Giỏ hàng online, đặt hàng trực tuyến, tính phí vận chuyển, khóa giữ và hoàn trả tồn kho tự động theo vòng đời đơn hàng.
8. **Khuyến mãi & Giảm giá (Promotion):** Thiết lập chiến dịch khuyến mãi, phát hành mã voucher, xác thực điều kiện áp dụng.
9. **Đổi / Trả hàng (Return & Exchange):** Tra cứu hóa đơn cũ, kiểm tra điều kiện thời hạn đổi trả, lập phiếu đổi hàng tính chênh lệch, tạo phiếu nhập kho thu hồi.
10. **Báo cáo & Thống kê (Analytics):** Báo cáo doanh thu theo kênh (POS vs Online), báo cáo sản phẩm bán chạy, báo cáo xuất - nhập - tồn theo mã SKU.

---

## II. PHÂN ĐỊNH MODULE & THỰC THỂ CSDL

### 1. Phân định giữa Module `auth` và Module `user`
- **Module `auth` (`com.springboot.fasearch.modules.auth`):**
  - Quản lý bảng `tai_khoan`: `ma_tk`, `ten_dang_nhap`, `mat_khau`, `email`, `trang_thai`, `ngay_tao`, `da_xoa`, `ma_vai_tro`.
  - Quản lý bảng `vai_tro`: `ma_vai_tro`, `ten_vai_tro`, `quyen`.
  - Nhiệm vụ: Đăng nhập, Đăng ký, Quản lý Token JWT, Cấu hình Spring Security.
- **Module `user` (`com.springboot.fasearch.modules.user`):**
  - Quản lý bảng `khach_hang`: `ma_kh`, `ho_kh`, `ten_kh`, `hinh_anh_kh`, `gioi_tinh`, `ngay_sinh`, `sdt`, `dia_chi`, `diem_tich_luy`, `ma_hang`, `ma_tk`, `da_xoa`.
  - Quản lý bảng `nhan_vien`: `ma_nv`, `ho_nv`, `ten_nv`, `hinh_anh_nv`, `gioi_tinh`, `ngay_sinh`, `sdt`, `cccd`, `dia_chi`, `ma_tk`, `da_xoa`.
  - **Quy tắc Admin:** **Không tạo bảng riêng cho Admin**. Quản trị viên (`ADMIN`) được lưu trữ tại bảng `nhan_vien`, tài khoản `tai_khoan` liên kết của nhân viên đó được gán vai trò `ADMIN` trong bảng `vai_tro`.

### 2. Thứ tự ưu tiên triển khai
1. **Module `auth`:** Hoàn thành trước tiên (Spring Security, JWT Filter, Login, Register, Middleware phân quyền).
2. **Module `user`:** Hoàn thiện CRUD Khách hàng, Nhân viên, tích điểm, phân quyền dữ liệu.
3. **Các Module tiếp theo:** `product`, `category`, `cart`, `order`, `payment`, `promotion`, `returnorder`.

### 3. Danh mục bảng CSDL (Theo Flyway Migration)
Căn cứ theo file [`V1__init_database.sql`](file:///d:/fasearch/be/fasearch/src/main/resources/db/migration/V1__init_database.sql):

| Cấp phụ thuộc | Tên bảng CSDL | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| **Cấp 0 (Độc lập)** | `vai_tro` | Danh mục vai trò (`ADMIN`, `STAFF`, `CUSTOMER`) |
| | `hang_thanh_vien` | Các mức hạng thành viên và ngưỡng điểm ưu đãi |
| | `danh_muc` | Danh mục thời trang (Áo thun, Quần jean...) |
| | `khuyen_mai` | Chương trình khuyến mãi tổng thể |
| | `phuong_thuc_thanh_toan`| Phương thức thanh toán (`CASH`, `BANK_TRANSFER`, `MOMO`...) |
| **Cấp 1** | `tai_khoan` | Tài khoản đăng nhập (FK -> `vai_tro`) |
| | `san_pham` | Thông tin sản phẩm chính (FK -> `danh_muc`) |
| | `ma_giam_gia` | Mã voucher cụ thể (FK -> `khuyen_mai`) |
| **Cấp 2** | `khach_hang` | Khách hàng (FK -> `tai_khoan`, `hang_thanh_vien`) |
| | `nhan_vien` | Nhân viên & Admin (FK -> `tai_khoan`) |
| | `bien_the_sp` | Biến thể sản phẩm theo SKU/Màu/Size/Barcode (FK -> `san_pham`) |
| | `nhat_ky_he_thong` | Nhật ký thay đổi dữ liệu (Audit Log, FK -> `tai_khoan`) |
| **Cấp 3 (Giao dịch)** | `gio_hang` | Giỏ hàng của khách (FK -> `khach_hang`) |
| | `don_hang` | Đơn hàng (FK -> `khach_hang`, `nhan_vien`, `ma_giam_gia`) |
| **Cấp 4 (Chi tiết)** | `ct_don_hang` | Chi tiết mặt hàng trong đơn (FK -> `don_hang`, `bien_the_sp`) |
| | `hoa_don` | Hóa đơn thanh toán (FK -> `don_hang`) |
| | `thanh_toan` | Lịch sử thanh toán hóa đơn (FK -> `hoa_don`, `phuong_thuc_thanh_toan`) |
| | `mat_hang_gio` | Mặt hàng trong giỏ (FK -> `gio_hang`, `san_pham`) |
| | `phieu_doi_tra` | Yêu cầu đổi trả đơn hàng (FK -> `don_hang`, `khach_hang`) |
| | `ct_doi_tra` | Chi tiết SKU cũ/mới khi đổi trả (FK -> `phieu_doi_tra`, `bien_the_sp`) |

---

## III. KIẾN TRÚC PHÂN TẦNG VÀ LUỒNG DỮ LIỆU

### 1. Kiến trúc phân tầng Module (Vertical Slice + Layered)
Mỗi nghiệp vụ nằm trong package con tương ứng tại `com.springboot.fasearch.modules.<module_name>`:
- **`controller/`:** Nhận HTTP request, kiểm tra `@Valid`, gọi Service, đóng gói kết quả trong `ApiResponse<T>`.
- **`service/interfaces/`:** Khai báo các hợp đồng (use cases) nghiệp vụ.
- **`service/impl/`:** Cài đặt logic nghiệp vụ, quản lý giao dịch `@Transactional`, điều phối repository và mapper.
- **`repository/`:** Kế thừa `JpaRepository`, chỉ đảm nhận truy vấn database.
- **`entity/`:** JPA Entity ánh xạ với bảng PostgreSQL.
- **`dto/request/`:** DTO nhận dữ liệu từ client gửi lên (kèm annotation validate).
- **`dto/response/`:** DTO trả về cho client (không expose JPA Entity trực tiếp).
- **`mapper/`:** MapStruct interface ánh xạ tự động giữa Entity và DTO.

### 2. Luồng dữ liệu chuẩn
```text
HTTP Request (Client)
   │
   ▼
Controller (Validate @Valid DTO)
   │
   ▼
Service Interface -> Service Implementation (Business Logic / Validation / Transaction)
   │
   ▼
Repository (Spring Data JPA) -> Database (PostgreSQL)
   │
   ▼
Entity -> MapStruct Mapper -> Response DTO
   │
   ▼
Controller (Wrap vào ApiResponse<T>) -> HTTP Response 200 (JSON)
```

---

## IV. TECH STACK & BẢNG LỆNH CLI CHUẨN

### 1. Tech Stack
- **Ngôn ngữ:** Java 21 (Eclipse Adoptium OpenJDK 21 LTS).
- **Framework:** Spring Boot 4.1.2.
- **Database & ORM:** PostgreSQL 15+, Spring Data JPA (Hibernate), Flyway Migration.
- **Bảo mật:** JJWT 0.12.6, Spring Security.
- **Tiện ích:** MapStruct 1.6.3, Project Lombok, Dotenv Java 3.2.0.
- **Tài liệu API:** Springdoc OpenAPI 2.8.6 (Swagger UI).

### 2. Bảng lệnh CLI chuẩn
Thực thi tại thư mục gốc backend `d:\fasearch\be\fasearch`:

| Thao tác | Lệnh Windows (PowerShell/CMD) | Lệnh Linux/macOS |
| :--- | :--- | :--- |
| **Kiểm tra biên dịch** | `.\mvnw.cmd test-compile` | `./mvnw test-compile` |
| **Chạy ứng dụng (Dev)** | `.\mvnw.cmd spring-boot:run` | `./mvnw spring-boot:run` |
| **Chạy toàn bộ Test** | `.\mvnw.cmd clean test` | `./mvnw clean test` |
| **Đóng gói JAR** | `.\mvnw.cmd clean package -DskipTests` | `./mvnw clean package -DskipTests` |
| **Swagger UI** | `http://localhost:8080/swagger-ui/index.html` (sau khi khởi động server) |
