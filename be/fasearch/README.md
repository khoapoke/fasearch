# FA Search Backend

Tài liệu này mô tả cấu trúc và luồng hoạt động của backend `fasearch`. Backend
được xây dựng bằng Spring Boot, Java 21, Spring Data JPA, PostgreSQL và Flyway.

## 1. Mục tiêu của backend

Backend cung cấp REST API cho hệ thống bán hàng và tìm kiếm sản phẩm. Database
đã được thiết kế cho các nhóm nghiệp vụ:

- tài khoản, vai trò và khách hàng;
- sản phẩm, danh mục và biến thể sản phẩm;
- khuyến mãi, mã giảm giá và hạng thành viên;
- giỏ hàng, đơn hàng, hóa đơn và thanh toán;
- đổi trả và nhật ký hệ thống.

Hiện tại code nghiệp vụ đã triển khai mới có module `user` với API lấy thông
tin khách hàng theo ID. Các bảng còn lại đã được tạo trong migration/seed để
chuẩn bị cho các module tiếp theo.

## 2. Cấu trúc thư mục hiện tại

```text
be/fasearch/
├── .env.example                         # Mẫu biến môi trường cho local
├── pom.xml                              # Dependency và cấu hình Maven
├── mvnw, mvnw.cmd                       # Maven Wrapper
├── HELP.md                              # Ghi chú được Spring Initializr tạo
├── src/
│   ├── main/
│   │   ├── java/com/springboot/fasearch/
│   │   │   ├── FasearchApplication.java
│   │   │   ├── common/                  # Đang để trống, dành cho tiện ích dùng chung
│   │   │   ├── config/                  # Đang để trống, dành cho cấu hình Spring
│   │   │   ├── exception/
│   │   │   │   ├── AppException.java
│   │   │   │   ├── ErrorCode.java
│   │   │   │   ├── FieldErrorDetail.java
│   │   │   │   └── GlobalExceptionHandler.java
│   │   │   ├── modules/
│   │   │   │   ├── auth/                # Đã tạo namespace, chưa có class nghiệp vụ
│   │   │   │   └── user/
│   │   │   │       ├── controller/
│   │   │   │       ├── dto/
│   │   │   │       │   ├── request/
│   │   │   │       │   └── response/
│   │   │   │       ├── entity/
│   │   │   │       ├── mapper/
│   │   │   │       ├── repository/
│   │   │   │       └── service/
│   │   │   │           ├── impl/
│   │   │   │           └── interfaces/
│   │   │   └── shared/
│   │   │       └── ApiResponse.java
│   │   ├── resources/
│   │   │   ├── application.yaml          # Cấu hình app, datasource, JPA, Flyway
│   │   │   └── db/
│   │   │       ├── migration/
│   │   │       │   └── V1__init_database.sql
│   │   │       ├── seed/                 # Dữ liệu mẫu chạy qua Flyway
│   │   │       └── scripts/
│   │   │           └── drop_all_table.sql
│   │   └── test/
│   │       └── java/com/springboot/fasearch/
│   │           └── FasearchApplicationTests.java
└── target/                               # Output build, không commit
```

> `target/` có thể xuất hiện sau khi build và nên được bỏ qua bởi Git. Các
> thư mục `common`, `config`, `auth` và `user/dto/request` hiện là namespace
> chuẩn bị trước; không nên giả định chúng đã có chức năng khi viết code.

## 3. Trách nhiệm của từng thư mục

### 3.1. Package gốc

`FasearchApplication.java` là entry point của ứng dụng. Khi khởi động, ứng dụng
đọc file `.env` nếu file tồn tại, đưa các giá trị vào system properties rồi
khởi chạy Spring Boot.

### 3.2. `modules`

Đây là nơi chứa code theo **nghiệp vụ**. Mỗi nghiệp vụ nên có một thư mục riêng,
ví dụ `user`, `auth`, `product`, `order`. Cách tổ chức này giúp các thành phần
của cùng một nghiệp vụ nằm gần nhau thay vì chia toàn bộ project thành một
`controller/`, một `service/` và một `repository/` dùng chung cho mọi nghiệp vụ.

### 3.3. `modules/user`

Module user hiện có các lớp sau:

| Thư mục | Vai trò |
|---|---|
| `controller` | Nhận HTTP request, lấy path/query/body parameter, gọi service và trả HTTP response. Không đặt business logic ở đây. |
| `service/interfaces` | Khai báo use case mà controller hoặc module khác được phép gọi. |
| `service/impl` | Cài đặt business logic, điều phối repository và mapper. |
| `repository` | Truy cập database qua Spring Data JPA; chỉ nên chứa logic truy vấn dữ liệu. |
| `entity` | Ánh xạ bảng database sang object JPA. `User` ánh xạ bảng `khach_hang`. |
| `dto/request` | Kiểu dữ liệu cho dữ liệu client gửi lên; hiện chưa có DTO. |
| `dto/response` | Kiểu dữ liệu trả ra ngoài API. `UserResponse` tránh expose trực tiếp entity. |
| `mapper` | Chuyển đổi giữa entity và DTO. `UserMapper` hiện gộp `ho` và `ten` thành `hoTen`. |

### 3.4. `exception`

- `AppException`: exception nghiệp vụ có mã lỗi.
- `ErrorCode`: danh sách mã và message lỗi chuẩn hóa.
- `FieldErrorDetail`: mô tả lỗi theo từng field khi validation thất bại.
- `GlobalExceptionHandler`: bắt exception ở toàn ứng dụng và chuyển thành
  response JSON thống nhất.

Khi thêm lỗi nghiệp vụ, ưu tiên thêm `ErrorCode` và ném `AppException` thay vì
tự tạo message rải rác trong controller/service. Các exception chưa được định
nghĩa cụ thể hiện được xử lý như lỗi HTTP 500 bởi handler chung.

### 3.5. `shared`

Chứa các kiểu dùng chung giữa nhiều module. `ApiResponse<T>` hỗ trợ format
`success`, `code`, `message`, `result`, `errors` và `timestamp`.

API user hiện tại trả trực tiếp `UserResponse`, chưa bọc trong `ApiResponse`.
Khi thay đổi format response, cần thống nhất trên toàn team và cập nhật cả
controller, tài liệu API và frontend.

### 3.6. `common` và `config`

Hai package này hiện chưa có class:

- `common`: phù hợp cho constant, pagination, utility hoặc abstract type dùng
  ở nhiều module; không đặt business logic riêng của một module vào đây.
- `config`: phù hợp cho CORS, Jackson, OpenAPI, security, database hoặc các
  bean cấu hình toàn ứng dụng.

### 3.7. `resources/db`

- `migration`: migration cấu trúc database. File Flyway dùng format
  `V<version>__<description>.sql` và không được sửa sau khi đã chạy trên môi
  trường dùng chung.
- `seed`: dữ liệu khởi tạo/mẫu. Các file seed đang được Flyway load cùng
  `migration` nhờ `application.yaml`.
- `scripts`: script thao tác thủ công, ví dụ xóa toàn bộ bảng; không tự động
  chạy khi ứng dụng khởi động.

## 4. Luồng request hiện tại

Ví dụ với request:

```http
GET /api/v1/users/{id}
```

Luồng xử lý:

```text
Client
  -> UserController.getUserById(id)
  -> UserService.getUserById(id)
  -> UserRepository.findById(id)
  -> User entity
  -> UserMapper.toResponseDTO(user)
  -> UserResponse
  -> HTTP 200
```

Chi tiết:

1. `UserController` nhận `id` từ URL và gọi `UserServiceInterface`.
2. `UserService` truy vấn `UserRepository`.
3. Nếu không tìm thấy user, service ném exception.
4. `UserMapper` chuyển `User` thành `UserResponse`, trong đó họ và tên được
   gộp thành `hoTen`.
5. Controller trả `ResponseEntity.ok(...)`.
6. Nếu xảy ra exception, `GlobalExceptionHandler` chuyển exception thành JSON
   lỗi theo rule tương ứng.

Endpoint hiện tại:

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/api/v1/users/{id}` | Lấy thông tin khách hàng theo `ma_kh` |

## 5. Luồng khởi động và database

```text
FasearchApplication
  -> đọc .env
  -> nạp application.yaml
  -> kết nối PostgreSQL
  -> Flyway chạy migration/seed
  -> JPA validate schema (ddl-auto: validate)
  -> Spring Boot sẵn sàng nhận request
```

`application.yaml` dùng các biến:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=<database-name>
DB_USERNAME=<username>
DB_PASSWORD=<password>
```

Tạo bản sao từ `.env.example` thành `.env`, điền thông tin PostgreSQL rồi chạy
ứng dụng. Không commit `.env` hoặc mật khẩu thật.

Các dependency chính:

- Java 21;
- Spring Boot Web MVC;
- Spring Data JPA;
- PostgreSQL;
- Flyway;
- Spring Validation;
- Springdoc OpenAPI;
- Lombok.

## 6. Quy ước viết code cho team

1. Tạo code theo module nghiệp vụ: `modules/<module-name>/...`.
2. Controller chỉ xử lý HTTP; business rule đặt trong service.
3. Repository chỉ truy vấn/persistence; không trả DTO từ repository.
4. Không trả JPA entity trực tiếp ra API; dùng DTO và mapper.
5. Request dùng `dto/request`, response dùng `dto/response`.
6. Dùng `@Valid` cho request DTO và bổ sung validation annotation phù hợp.
7. Dùng `AppException`/`ErrorCode` cho lỗi nghiệp vụ có thể dự đoán.
8. Đặt tên endpoint theo số nhiều và giữ version, ví dụ `/api/v1/users`.
9. Mỗi use case quan trọng nên có unit test service và integration test
   controller/repository tương ứng.
10. Migration mới phải có version tăng dần; không sửa migration cũ đã chạy trên
    môi trường dùng chung.

## 7. Cách chạy và kiểm tra

Từ thư mục `be/fasearch`:

```powershell
# Windows
.\mvnw.cmd spring-boot:run

# Build và chạy test
.\mvnw.cmd clean test
```

OpenAPI UI được cung cấp bởi Springdoc sau khi ứng dụng khởi động. URL mặc định
có thể dùng là `/swagger-ui/index.html`; nếu thay đổi cấu hình server thì cần
điều chỉnh lại URL tương ứng.

## 8. Cấu trúc đề xuất khi project phát triển

Đây là cấu trúc đề xuất, chưa phải các thư mục đã có trong repository:

```text
modules/
├── auth/
│   ├── controller/
│   ├── dto/request/
│   ├── dto/response/
│   ├── security/
│   └── service/
├── user/
├── product/
├── category/
├── promotion/
├── cart/
├── order/
├── payment/
└── returnorder/

common/
├── constant/
├── pagination/
├── util/
└── validation/

config/
├── OpenApiConfig.java
├── SecurityConfig.java
├── CorsConfig.java
└── JacksonConfig.java

infrastructure/
├── storage/             # Upload ảnh/file
├── payment/             # Adapter tới cổng thanh toán
└── search/              # Adapter tới engine tìm kiếm hoặc AI service

resources/
├── db/migration/
├── db/seed/
└── db/scripts/
```

### Thứ tự ưu tiên nên bổ sung

1. **`config/SecurityConfig.java` và hoàn thiện `modules/auth`**: xác thực,
   phân quyền và bảo vệ endpoint trước khi mở rộng API quản trị.
2. **`modules/product` và `modules/category`**: đây là dữ liệu lõi cho chức
   năng search.
3. **`common/pagination`**: thống nhất `Pageable`, metadata phân trang và filter.
4. **`infrastructure/search`**: gom logic kết nối search/AI bên ngoài, tránh để
   SDK hoặc HTTP client rải trong các service nghiệp vụ.
5. **`config/OpenApiConfig.java`**: mô tả API, security scheme và response mẫu.
6. **Test theo module**: thêm `src/test` tương ứng với từng use case, repository
   và endpoint.

Khi thêm module mới, hãy bắt đầu từ use case và contract API, sau đó triển khai
theo thứ tự `dto -> entity/repository -> service -> mapper -> controller ->
test`. Cách này giúp luồng phụ thuộc rõ ràng và tránh đưa business logic vào
controller.
