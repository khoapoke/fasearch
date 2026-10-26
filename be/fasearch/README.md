# FA SEARCH BACKEND — DEVELOPER GUIDE

Tài liệu này là cẩm nang kỹ thuật chi tiết dành cho lập trình viên và người đóng góp nhằm cài đặt, cấu hình, chạy thử và phát triển hệ sinh thái **FaSearch Backend**.

> 📖 **Tài liệu tham chiếu:**
> - Bối cảnh bài toán, giá trị kinh doanh và 10 phân hệ nghiệp vụ: **[OVERVIEW.md](./OVERVIEW.md)**
> - Quy chuẩn kiến trúc, quy tắc phát triển dành cho AI Agent: **[AGENTS.md](./AGENTS.md)**

---

## I. CÔNG NGHỆ SỬ DỤNG (TECH STACK)

| Thành phần | Công nghệ / Thư viện | Phiên bản | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Ngôn ngữ** | Java (OpenJDK / Eclipse Adoptium) | 21 LTS | Hỗ trợ Virtual Threads & Pattern Matching |
| **Framework** | Spring Boot | 4.1.2 | Nền tảng RESTful Web Services |
| **Bảo mật** | Spring Security & JJWT | 7.1.2 / 0.12.6 | Xác thực Stateless JWT Token & Phân quyền RBAC |
| **Database** | PostgreSQL | 15+ | Cơ sở dữ liệu quan hệ chính |
| **Database Migration** | Flyway | Tích hợp sẵn | Tự động quản lý phiên bản lược đồ CSDL |
| **ORM** | Spring Data JPA / Hibernate | 6+ | Quản lý thực thể CSDL & Tối ưu truy vấn |
| **Mapper** | MapStruct | 1.6.3 | Ánh xạ 2 chiều hiệu năng cao giữa Entity và DTO |
| **API Documentation** | Springdoc OpenAPI (Swagger UI) | 2.8.6 | Sinh tài liệu API tương tác tự động |
| **Quản lý biến môi trường**| Dotenv Java | 3.2.0 | Nạp cấu hình từ file `.env` cục bộ |
| **Tiện ích mã nguồn** | Project Lombok | Bản mới nhất | Giảm thiểu mã lặp (Getter, Setter, Builder...) |

---

## II. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

Để chạy dự án trên máy cục bộ, bạn cần chuẩn bị:
1. **Java Development Kit (JDK):** Phiên bản **Java 21 LTS** trở lên. Kiểm tra bằng lệnh:
   ```bash
   java -version
   ```
2. **PostgreSQL Database:** Phiên bản 15 trở lên đang chạy cục bộ hoặc qua Docker container.
3. **Maven:** Dự án đã tích hợp sẵn Maven Wrapper (`mvnw` cho Linux/macOS và `mvnw.cmd` cho Windows), không bắt buộc phải cài đặt Maven toàn cục.

---

## III. HƯỚNG DẪN KHỞI CHẠY NHANH (QUICK START)

### 1. Chuẩn bị file cấu hình môi trường (.env)
Tại thư mục gốc `be/fasearch`, tạo file `.env` từ file mẫu `.env.example`:

```bash
# Trên Windows PowerShell
Copy-Item .env.example .env

# Trên Linux / macOS
cp .env.example .env
```

Mở file `.env` và cập nhật thông tin kết nối PostgreSQL của bạn:
```properties
# Cấu hình Cơ sở dữ liệu PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fasearch_db
DB_USERNAME=postgres
DB_PASSWORD=your_password_here

# Cấu hình Bảo mật JWT
JWT_SECRET=your_jwt_secret_key_minimum_256_bits_length_here_123456789
JWT_EXPIRATION_MS=86400000

# Cổng khởi chạy máy chủ
PORT=8080
```

> [!IMPORTANT]
> - Cần đảm bảo database `fasearch_db` đã được tạo sẵn trong PostgreSQL trước khi chạy app (`CREATE DATABASE fasearch_db;`).
> - Khi ứng dụng khởi động, Flyway sẽ tự động chạy các script migration (`V1` -> `V4`) để tạo bảng và nạp dữ liệu mẫu ban đầu.

### 2. Kiểm tra biên dịch mã nguồn
Chạy lệnh biên dịch để đảm bảo toàn bộ mã nguồn và MapStruct mapper hoạt động chính xác:

```powershell
# Windows
.\mvnw.cmd test-compile

# Linux / macOS
./mvnw test-compile
```

### 3. Khởi chạy máy chủ phát triển (Development Server)
```powershell
# Windows
.\mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```

Sau khi máy chủ khởi động thành công trên cổng `8080`:
- **Giao diện Swagger UI:** [http://localhost:8080/swagger-ui/index.html](http://localhost:8080/swagger-ui/index.html)
- **Tài liệu OpenAPI Spec (JSON):** [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

---

## IV. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

Mã nguồn được tổ chức theo kiến trúc phân tách nghiệp vụ (**Vertical Slice + Layered Architecture**):

```text
be/fasearch/
├── .env.example                                # Mẫu cấu hình biến môi trường
├── pom.xml                                     # Cấu hình dependencies và plugin Maven
├── mvnw, mvnw.cmd                              # Maven Wrapper thực thi lệnh
├── be_docs/                                    # Tài liệu thiết kế hệ thống & đặc tả API
│   ├── memory.md                               # Bộ nhớ làm việc & bàn giao (tối đa 5 phiên)
│   ├── module.md                               # Danh mục 54 chức năng, vai trò & tiến độ (Roadmap)
│   └── api/                                    # Đặc tả chi tiết Request/Response 10 phân hệ API
│       ├── README.md                           # Mục lục & quy chuẩn chung ApiResponse
│       ├── api-auth.md                         # Đặc tả API xác thực & tài khoản
│       ├── api-user.md                         # Đặc tả API người dùng & tích điểm
│       └── ...                                 # (Các file đặc tả API phân hệ khác)
├── src/
│   ├── main/
│   │   ├── java/com/springboot/fasearch/
│   │   │   ├── FasearchApplication.java        # Entry point khởi chạy app & nạp .env
│   │   │   ├── common/
│   │   │   │   └── enums/                      # 11 Java Enums Type-Safety (AccountStatus, RoleType...)
│   │   │   ├── config/                         # Configuration Bean (SecurityConfig, JwtConfig)
│   │   │   ├── security/                       # Thành phần bảo mật (JwtProvider, JwtFilter, Handlers)
│   │   │   ├── exception/                      # Quản lý ngoại lệ (AppException, ErrorCode, Handler)
│   │   │   ├── shared/                         # DTO dùng chung (ApiResponse<T>)
│   │   │   └── modules/
│   │   │       ├── auth/                       # Phân hệ Xác thực & Phân quyền
│   │   │       │   ├── controller/             # AuthController (login, register, my-info)
│   │   │       │   ├── dto/                    # Request & Response DTOs
│   │   │       │   ├── entity/                 # Account, Role
│   │   │       │   ├── repository/             # AccountRepository, RoleRepository
│   │   │       │   └── service/                # AuthService & AuthServiceImpl
│   │   │       └── user/                       # Phân hệ Người dùng & Nhân sự
│   │   │           ├── controller/             # UserController
│   │   │           ├── dto/response/           # CustomerRes
│   │   │           ├── entity/                 # Customer (khach_hang)
│   │   │           ├── mapper/                 # CustomerMapper (MapStruct)
│   │   │           ├── repository/             # CustomerRepository
│   │   │           └── service/                # UserService & UserServiceImpl
│   │   └── resources/
│   │       ├── application.yaml                # Cấu hình Spring, JPA, Flyway
│   │       └── db/
│   │           └── migration/                  # Các bản cập nhật CSDL tự động qua Flyway
│   │               ├── V1__init_database.sql
│   │               ├── V2__refactor_enums_and_add_soft_delete.sql
│   │               ├── V3__update_seed_passwords_to_bcrypt.sql
│   │               └── V4__add_da_xoa_to_vai_tro.sql
│   └── test/                                   # Kiểm thử tự động (Unit & Integration Tests)
```

---

## V. TÀI KHOẢN MẪU & DANH SÁCH REST API ĐÃ TRIỂN KHAI

### 1. Tài khoản mẫu thử nghiệm (Seed Credentials)
Sau khi Flyway thực hiện migration `V3`, các tài khoản mẫu dưới đây đã sẵn sàng để kiểm thử (Mật khẩu mặc định: `123456`):

| Tên đăng nhập | Mật khẩu mặc định | Vai trò (`RoleType`) | Mục đích thử nghiệm |
| :--- | :--- | :--- | :--- |
| `admin` | `123456` | `ADMIN` | Kiểm thử các chức năng và quyền của Quản trị viên |
| `nhanvien1` | `123456` | `STAFF` | Kiểm thử nghiệp vụ của Nhân viên bán hàng / Thu ngân |
| `khachhang1` | `123456` | `CUSTOMER` | Kiểm thử nghiệp vụ mua sắm của Khách hàng |

### 2. Danh sách REST API sẵn sàng hoạt động

> 📖 **Tài liệu API đầy đủ:** Xem chi tiết Request/Response của toàn bộ 10 phân hệ tại **[be_docs/api/README.md](./be_docs/api/README.md)**.

| Phương thức | Đường dẫn Endpoint | Yêu cầu quyền (RBAC) | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Public (Mọi người) | Đăng nhập hệ thống, trả về JWT Token và thông tin tài khoản |
| `POST` | `/api/v1/auth/register` | Public (Mọi người) | Đăng ký tài khoản mới cho Khách hàng (`CUSTOMER`) |
| `GET` | `/api/v1/auth/my-info` | Đã đăng nhập (`Bearer Token`) | Lấy thông tin tài khoản hiện tại từ Token xác thực |
| `GET` | `/api/v1/users/customers/{id}` | Đã đăng nhập (`Bearer Token`) | Lấy thông tin chi tiết hồ sơ khách hàng theo ID |

---

## VI. BẢNG LỆNH CLI CHUẨN (CLI CHEATSHEET)

Thực hiện tại thư mục gốc backend `be/fasearch`:

| Thao tác | Lệnh Windows (PowerShell/CMD) | Lệnh Linux / macOS |
| :--- | :--- | :--- |
| **Kiểm tra biên dịch** | `.\mvnw.cmd test-compile` | `./mvnw test-compile` |
| **Chạy ứng dụng (Dev)** | `.\mvnw.cmd spring-boot:run` | `./mvnw spring-boot:run` |
| **Chạy toàn bộ Test** | `.\mvnw.cmd clean test` | `./mvnw clean test` |
| **Đóng gói file JAR** | `.\mvnw.cmd clean package -DskipTests` | `./mvnw clean package -DskipTests` |
| **Hiển thị Deprecation** | `.\mvnw.cmd compile "-Dmaven.compiler.showDeprecation=true"` | `./mvnw compile -Dmaven.compiler.showDeprecation=true` |
