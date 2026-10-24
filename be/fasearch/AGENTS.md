# HƯỚNG DẪN DÀNH CHO AI AGENT & QUY TẮC PHÁT TRIỂN (FA SEARCH BACKEND)

Tài liệu này là **kim chỉ nam hành vi, quy trình làm việc và quy chuẩn kỹ thuật bắt buộc** dành cho AI Agent khi tham gia phát triển dự án `fasearch`.

> 📖 **Tài liệu tham chiếu kiến trúc & nghiệp vụ:**
> Vui lòng đọc kỹ hồ sơ chi tiết về nghiệp vụ, danh mục thực thể CSDL và kiến trúc phân tầng tại **[OVERVIEW.md](file:///d:/fasearch/be/fasearch/OVERVIEW.md)** trước khi thực hiện bất kỳ phân tích nào.

---

## I. QUY TẮC LÀM VIỆC BẮT BUỘC: "HỎI TRƯỚC KHI LÀM"

Đối với **MỌI yêu cầu/task tiếp theo**, AI Agent **TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ Ý VIẾT CODE NGAY** mà phải tuân thủ nghiêm ngặt quy trình 2 bước sau:

### Bước 1: Phân tích & Hỏi xác nhận (Clarification & Confirmation)
1. **Liệt kê danh sách file:** Nêu rõ các file dự kiến sẽ tạo mới, chỉnh sửa hoặc xóa bỏ.
2. **Đặt câu hỏi làm rõ các điểm dễ sai sót:**
   - **Phân quyền (RBAC):** API / Chức năng này dành cho Role nào (`ADMIN`, `STAFF`, `CUSTOMER` hay Public)?
   - **Dữ liệu & Validation:** Các trường dữ liệu bắt buộc (Required), tùy chọn (Optional), regex định dạng, độ dài, các giá trị Enum/Status mới (phải là tiếng Anh in hoa).
   - **Logic ngoại lệ & Ràng buộc:** Điều kiện chặn lỗi là gì? Xử lý ràng buộc khóa ngoại (Foreign Key)? Chiến lược xóa mềm (Soft Delete)? Rollback giao dịch (`@Transactional`) khi nào?
3. **Tóm tắt ngắn gọn các bước thực hiện:** Trình bày thứ tự triển khai theo từng lớp kiến trúc (`DTO -> Entity/Repo -> Service -> Mapper -> Controller`).
4. **DỪNG LẠI CHỜ USER PHẢN HỒI:** Không tự ý code trước khi User trả lời các câu hỏi và chốt xác nhận.

### Bước 2: Thực thi (Execution)
- Chỉ khi User đã trả lời các câu hỏi và xác nhận rõ ràng: **"OK / Làm đi"**, mới bắt đầu viết code, chạy lệnh kiểm tra, tuân thủ đúng các quy chuẩn kiến trúc bên dưới.

---

## II. QUY CHUẨN PHÂN ĐỊNH MODULE & THỰC THỂ CỐT LÕI

- **Module `auth` (`com.springboot.fasearch.modules.auth`):**
  - Quản lý bảo mật, xác thực (Authentication) và phân quyền (Authorization).
  - Quản lý các bảng CSDL:
    - `tai_khoan`: Thông tin đăng nhập (`ten_dang_nhap`, `mat_khau`, `email`, `trang_thai`, `ngay_tao`, `da_xoa`).
    - `vai_tro`: Các nhóm quyền (`ma_vai_tro`, `ten_vai_tro`, `quyen`).
  - Chức năng: Đăng ký tài khoản, Đăng nhập, Cấp phát & Làm mới JWT Token, Xác thực chữ ký JWT, Spring Security Filter Chain.
- **Module `user` (`com.springboot.fasearch.modules.user`):**
  - Quản lý thông tin hồ sơ người dùng trong hệ thống.
  - Quản lý các bảng CSDL:
    - `khach_hang`: Khách hàng mua sắm, điểm tích lũy (`diem_tich_luy`), liên kết với `hang_thanh_vien` và `tai_khoan`.
    - `nhan_vien`: Hồ sơ nhân viên và quản trị viên, thông tin CCCD, SĐT, giới tính, liên kết với `tai_khoan`.
  - **Quy tắc về Admin:** **Không tạo bảng riêng cho Admin**. Quản trị viên (`ADMIN`) được lưu trữ trong bảng `nhan_vien`, tài khoản `tai_khoan` liên kết của nhân viên đó sẽ được gán quyền `ADMIN` trong bảng `vai_tro`.
- **Thứ tự ưu tiên triển khai toàn dự án:**
  1. **Module `auth`:** Hoàn thành trước tiên (Spring Security, JWT, Login, Register, Middleware phân quyền).
  2. **Module `user`:** Hoàn thiện CRUD Khách hàng, Nhân viên, tích điểm, phân quyền dữ liệu.
  3. **Các Module nghiệp vụ tiếp theo:** `product`, `category`, `cart`, `order`, `payment`, `promotion`, `returnorder`.

---

## III. QUY CHUẨN KỸ THUẬT BẮT BUỘC (CODING STANDARDS)

### 1. Quy tắc Enum, Status và Hằng số (Type Safety)
- **100% Enum, Status, Type, Role PHẢI VIẾT BẰNG TIẾNG ANH IN HOA (`UPPER_SNAKE_CASE`)**.
- Tuyệt đối không dùng hardcoded String trong Entity hay Service, phải định nghĩa Java Enum có Type Safety.
- Bảng quy chuẩn trạng thái:
  - **User / Account Status:** `ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED`.
  - **Roles:** `ADMIN`, `STAFF`, `CUSTOMER`.
  - **Gender:** `MALE`, `FEMALE`, `OTHER`.
  - **Product Status:** `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `DISCONTINUED`.
  - **Order Status:** `PENDING`, `CONFIRMED`, `PACKING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `RETURNED`.
  - **Payment Method:** `CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`.
  - **Payment Status:** `PENDING`, `PAID`, `FAILED`, `REFUNDED`.
  - **Voucher / Promo Status:** `UPCOMING`, `ACTIVE`, `EXPIRED`, `DISABLED`.
- **Cơ sở dữ liệu:** Sẽ tạo migration Flyway bổ sung để chuẩn hóa các giá trị seed cũ từ tiếng Việt (`HOAT_DONG`, `TIEN_MAT`...) sang tiếng Anh in hoa.

### 2. Chiến lược Xóa dữ liệu (Soft Delete)
- Áp dụng **Xóa mềm (Soft Delete)** thống nhất cho toàn bộ các thực thể cốt lõi.
- Bổ sung cột `da_xoa BOOLEAN DEFAULT FALSE` cho các bảng chưa có.
- Khi thực hiện hành động "Xóa": Cập nhật `da_xoa = true` và trạng thái sang `DELETED` hoặc `INACTIVE`, không dùng lệnh `DELETE FROM` trực tiếp trừ khi là bảng liên kết tạm.
- Các truy vấn lấy danh sách mặc định phải lọc điều kiện `WHERE da_xoa = false`.

### 3. Chuẩn hóa Phân trang & Lọc dữ liệu (Pagination & Filtering)
- Sử dụng công cụ chuẩn `org.springframework.data.domain.Pageable` và `Page<T>` của Spring Data JPA.
- Query Parameter chuẩn:
  - `page`: Số thứ tự trang (0-indexed theo chuẩn Spring Boot).
  - `size`: Số bản ghi trên mỗi trang (mặc định: 10 hoặc 20).
  - `sort`: Tiêu chí sắp xếp, ví dụ `sort=createdAt,desc`.
- Bổ sung metadata phân trang trong `ApiResponse<T>`:
  - Cấu trúc Response danh sách phân trang:
    ```json
    {
      "success": true,
      "code": 200,
      "message": "Lấy danh sách thành công",
      "result": {
        "content": [ ... ],
        "pageNumber": 0,
        "pageSize": 10,
        "totalElements": 45,
        "totalPages": 5,
        "isLast": false
      },
      "errors": null,
      "timestamp": "2026-10-24T20:00:00"
    }
    ```

### 4. Cơ chế Bắt lỗi Tập trung (Global Exception Handling)
- Quản lý qua `@RestControllerAdvice` tại `GlobalExceptionHandler`.
- **Quy tắc bắt buộc về HTTP Status Code:** HTTP Status Code của Header **phải tương ứng chính xác** với ý nghĩa của `ErrorCode`:
  - `CUSTOMER_NOT_FOUND`, `RESOURCE_NOT_FOUND`: Trả HTTP Status **404 Not Found**.
  - Lỗi validate dữ liệu, vi phạm ràng buộc dữ liệu: Trả HTTP Status **400 Bad Request**.
  - Lỗi chưa xác thực (Invalid / Expired Token): Trả HTTP Status **401 Unauthorized**.
  - Lỗi không đủ quyền truy cập (Access Denied): Trả HTTP Status **403 Forbidden**.
  - Lỗi phương thức không hỗ trợ (`HttpRequestMethodNotSupportedException`): Trả HTTP Status **405 Method Not Allowed**.
  - Lỗi không xử lý được / hệ thống (`RuntimeException`): Trả HTTP Status **500 Internal Server Error**.

### 5. Chuẩn phản hồi API (`ApiResponse<T>`)
- Tất cả các endpoint của Controller phải bọc kết quả trong `ApiResponse<T>`.
- Định dạng:
  ```json
  {
    "success": true,
    "code": 200,
    "message": "Thông điệp mô tả",
    "result": { ... },
    "errors": null,
    "timestamp": "2026-10-24T20:00:00"
  }
  ```

### 6. Quy ước đặt tên (Naming Conventions)
- **Entity:** PascalCase, danh từ tiếng Anh số ít (VD: `Customer.java`, `Employee.java`, `Account.java`, `Product.java`).
- **DTO Request:** PascalCase + hậu tố `Req` (VD: `CustomerCreateReq.java`, `LoginReq.java`).
- **DTO Response:** PascalCase + hậu tố `Res` (VD: `CustomerRes.java`, `AuthRes.java`).
- **Mapper:** PascalCase + hậu tố `Mapper` (VD: `CustomerMapper.java`).
- **Service Interface:** PascalCase + hậu tố `Service` (VD: `CustomerService.java` hoặc `CustomerServiceInterface.java`).
- **Service Implementation:** PascalCase + hậu tố `ServiceImpl` (VD: `CustomerServiceImpl.java`).
- **Controller:** PascalCase + hậu tố `Controller` (VD: `CustomerController.java`).
- **Endpoint URL:** `kebab-case`, số nhiều, có versioning: `/api/v1/customers`, `/api/v1/auth/login`.

---

## IV. BẢNG LỆNH CLI CHUẨN

Thực thi tại thư mục gốc backend `d:\fasearch\be\fasearch`:

| Thao tác | Lệnh Windows (PowerShell/CMD) | Lệnh Linux/macOS |
| :--- | :--- | :--- |
| **Kiểm tra biên dịch** | `.\mvnw.cmd test-compile` | `./mvnw test-compile` |
| **Chạy ứng dụng (Dev)** | `.\mvnw.cmd spring-boot:run` | `./mvnw spring-boot:run` |
| **Chạy toàn bộ Test** | `.\mvnw.cmd clean test` | `./mvnw clean test` |
| **Đóng gói JAR** | `.\mvnw.cmd clean package -DskipTests` | `./mvnw clean package -DskipTests` |
| **Swagger UI** | `http://localhost:8080/swagger-ui/index.html` (sau khi khởi động server) |
