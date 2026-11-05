# TÀI LIỆU API: MODULE AUTH (XÁC THỰC & PHÂN QUYỀN)

Module `auth` chịu trách nhiệm quản lý đăng nhập, cấp phát JWT Token, đăng ký tài khoản khách hàng, kiểm soát phân quyền dựa trên vai trò (RBAC), quên/đặt lại mật khẩu, xác thực email và quản lý danh sách tài khoản hệ thống.

---

## 1. Đăng nhập hệ thống (FR-05)

- **Endpoint:** `POST /api/v1/auth/login`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Xác thực tên đăng nhập và mật khẩu, trả về Access Token JWT có thời hạn.

### Request Body
```json
{
  "username": "admin",
  "password": "Password@123"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `username` | String | Có | Tên đăng nhập tài khoản |
| `password` | String | Có | Mật khẩu tài khoản |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Đăng nhập thành công",
  "result": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "username": "admin",
    "role": "ADMIN",
    "emailVerified": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `username` hoặc `password`.
- **HTTP 401 Unauthorized:** Sai tên đăng nhập hoặc mật khẩu (`INVALID_CREDENTIALS`).
- **HTTP 403 Forbidden:** Tài khoản đã bị khóa (`ACCOUNT_LOCKED`), chưa kích hoạt (`ACCOUNT_INACTIVE`) hoặc chưa xác thực email khi bật `EMAIL_VERIFICATION_REQUIRED` (`EMAIL_NOT_VERIFIED`).

---

## 2. Đăng ký tài khoản Khách hàng (FR-06)

- **Endpoint:** `POST /api/v1/auth/register`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Khách hàng mới tự tạo tài khoản mua sắm trực tuyến (tự động gán vai trò `CUSTOMER`) và nhận email xác thực.

### Request Body
```json
{
  "username": "customer01",
  "password": "Password@123",
  "email": "customer01@fasearch.com",
  "firstName": "Nguyễn",
  "lastName": "Văn A",
  "phoneNumber": "0987654321",
  "gender": "MALE"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Validation | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `username` | String | Có | 4 - 50 ký tự | Tên đăng nhập duy nhất |
| `password` | String | Có | 6 - 100 ký tự | Mật khẩu đăng nhập |
| `email` | String | Có | Định dạng Email | Email nhận thông báo và xác thực |
| `firstName` | String | Không | | Tên đệm và tên gọi |
| `lastName` | String | Có | Không để trống | Họ người dùng |
| `phoneNumber`| String | Có | Duy nhất | Số điện thoại liên hệ |
| `gender` | String | Không | `MALE`, `FEMALE`, `OTHER` | Giới tính |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Đăng ký tài khoản thành công",
  "result": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "username": "customer01",
    "role": "CUSTOMER",
    "emailVerified": false
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc trùng tên đăng nhập / email / số điện thoại (`USERNAME_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS`, `PHONE_NUMBER_ALREADY_EXISTS`).

---

## 3. Xem thông tin tài khoản hiện tại (FR-07)

- **Endpoint:** `GET /api/v1/auth/my-info`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Trích xuất định danh từ token JWT để lấy hồ sơ tài khoản đang đăng nhập.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin tài khoản thành công",
  "result": {
    "id": 1,
    "customerId": null,
    "username": "admin",
    "email": "admin@fasearch.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "emailVerified": true,
    "createdAt": "2026-10-25T08:00:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.

---

## 4. Quản lý danh sách tài khoản (FR-01)

- **Endpoint:** `GET /api/v1/auth/accounts`
- **Quyền hạn:** `ADMIN` (`STAFF (Quản lý)` không có quyền)
- **Mô tả:** Xem danh sách toàn bộ tài khoản có phân trang và bộ lọc tìm kiếm.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi mỗi trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo tên đăng nhập hoặc email |
| `role` | String | Không | `ADMIN`, `STAFF`, `CUSTOMER` |
| `status` | String | Không | `ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách tài khoản thành công",
  "result": {
    "content": [
      {
        "id": 1,
        "customerId": null,
        "username": "admin",
        "email": "admin@fasearch.com",
        "role": "ADMIN",
        "status": "ACTIVE",
        "emailVerified": true,
        "createdAt": "2026-10-25T08:00:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `ADMIN`.

---

## 5. Thêm mới tài khoản nội bộ (FR-02)

- **Endpoint:** `POST /api/v1/auth/accounts`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Quản trị viên khởi tạo tài khoản nội bộ cho Quản lý (`STAFF`) hoặc Admin mới.

### Request Body
```json
{
  "username": "staff02",
  "password": "Password@123",
  "email": "staff02@fasearch.com",
  "role": "STAFF"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `username` | String | Có | 3 - 50 ký tự, duy nhất |
| `password` | String | Có | Tối thiểu 6 ký tự |
| `email` | String | Có | Định dạng Email, duy nhất |
| `role` | String | Không | `ADMIN`, `STAFF`, `CUSTOMER` (mặc định `STAFF`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo tài khoản mới thành công",
  "result": {
    "id": 3,
    "customerId": null,
    "username": "staff02",
    "email": "staff02@fasearch.com",
    "role": "STAFF",
    "status": "ACTIVE",
    "emailVerified": false,
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc trùng tên đăng nhập / email.
- **HTTP 403 Forbidden:** Không phải `ADMIN`.

---

## 6. Cập nhật tài khoản (FR-03)

- **Endpoint:** `PUT /api/v1/auth/accounts/{id}` (hoặc `PATCH`)
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Cập nhật email, trạng thái tài khoản, vai trò hoặc đặt lại mật khẩu; chỉ các trường được gửi lên mới đổi.

### Request Body
```json
{
  "email": "staff02_new@fasearch.com",
  "status": "ACTIVE",
  "role": "STAFF",
  "newPassword": "NewPassword@123"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `email` | String | Không | Định dạng Email, duy nhất |
| `status` | String | Không | `ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED` |
| `role` | String | Không | `ADMIN`, `STAFF`, `CUSTOMER` |
| `newPassword` | String | Không | Tối thiểu 6 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật tài khoản thành công",
  "result": {
    "id": 3,
    "customerId": null,
    "username": "staff02",
    "email": "staff02_new@fasearch.com",
    "role": "STAFF",
    "status": "ACTIVE",
    "emailVerified": false,
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Email sai định dạng hoặc đã tồn tại (`EMAIL_ALREADY_EXISTS`).
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** Không tìm thấy tài khoản (`USER_NOT_FOUND`).

---

## 7. Khóa / Xóa mềm tài khoản (FR-04)

- **Endpoint:** `DELETE /api/v1/auth/accounts/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Chuyển trạng thái tài khoản thành `DELETED` và cập nhật `da_xoa = true` để vô hiệu hóa tài khoản mà không mất dữ liệu lịch sử.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa tài khoản thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** Không tìm thấy tài khoản (`USER_NOT_FOUND`).

---

## 8. Đổi mật khẩu

- **Endpoint:** `POST /api/v1/auth/change-password`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (đổi mật khẩu của chính mình)
- **Mô tả:** Đổi mật khẩu khi đang đăng nhập; mọi token cũ của tài khoản bị vô hiệu, client phải đăng nhập lại.

### Request Body
```json
{
  "oldPassword": "Password@123",
  "newPassword": "NewPassword@123"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `oldPassword` | String | Có | Mật khẩu hiện tại |
| `newPassword` | String | Có | 6 - 100 ký tự, khác mật khẩu cũ |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Đổi mật khẩu thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Mật khẩu mới trùng mật khẩu cũ hoặc sai định dạng.
- **HTTP 401 Unauthorized:** Mật khẩu cũ không đúng hoặc token không hợp lệ.

---

## 9. Quên mật khẩu - Gửi liên kết đặt lại

- **Endpoint:** `POST /api/v1/auth/password/forgot`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Gửi email chứa liên kết đặt lại mật khẩu (hiệu lực 30 phút, dùng một lần). Luôn trả cùng một thông báo dù email có tồn tại hay không. Giới hạn 5 lượt/giờ mỗi email và 20 lượt/giờ mỗi IP.

### Request Body
```json
{
  "email": "customer01@fasearch.com"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `email` | String | Có | Email đã đăng ký tài khoản |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Nếu email đã đăng ký, liên kết đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư (kể cả thư rác).",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Email trống hoặc sai định dạng.
- **HTTP 429 Too Many Requests:** Vượt giới hạn số lượt yêu cầu (`TOO_MANY_REQUESTS`).

---

## 10. Đặt lại mật khẩu bằng token

- **Endpoint:** `POST /api/v1/auth/password/reset`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Đặt mật khẩu mới bằng token nhận qua email; mọi phiên đăng nhập cũ bị vô hiệu. Giới hạn 20 lượt/giờ mỗi IP.

### Request Body
```json
{
  "token": "b7f3c0d2e9...",
  "newPassword": "NewPassword@123"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `token` | String | Có | Token trong liên kết email |
| `newPassword` | String | Có | 6 - 100 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Token sai, đã dùng hoặc hết hạn (`EMAIL_TOKEN_INVALID`); mật khẩu mới sai định dạng.
- **HTTP 429 Too Many Requests:** Vượt giới hạn số lượt yêu cầu.

---

## 11. Gửi lại email xác thực

- **Endpoint:** `POST /api/v1/auth/email/verification-request`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (tài khoản đang đăng nhập)
- **Mô tả:** Gửi email xác thực (token hiệu lực 24 giờ, dùng một lần). Tài khoản đã xác thực vẫn trả `200` và không gửi lại. Giới hạn 5 lượt/giờ mỗi tài khoản và 20 lượt/giờ mỗi IP.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Email xác thực đã được gửi. Kiểm tra hộp thư (kể cả thư rác).",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tài khoản chưa có email (`EMAIL_ADDRESS_MISSING`).
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 429 Too Many Requests:** Vượt giới hạn số lượt yêu cầu.
- **HTTP 503 Service Unavailable:** Không gửi được email (`EMAIL_SEND_FAILED`).

---

## 12. Xác thực email bằng token

- **Endpoint:** `POST /api/v1/auth/email/verify`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Xác nhận token trong liên kết email, đánh dấu tài khoản đã xác thực email. Giới hạn 20 lượt/giờ mỗi IP.

### Request Body
```json
{
  "token": "b7f3c0d2e9..."
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `token` | String | Có | Token trong liên kết email |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xác thực email thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Token sai, đã dùng hoặc hết hạn (`EMAIL_TOKEN_INVALID`).
- **HTTP 429 Too Many Requests:** Vượt giới hạn số lượt yêu cầu.
