# TÀI LIỆU API: MODULE AUTH (XÁC THỰC & PHÂN QUYỀN)

Module `auth` chịu trách nhiệm quản lý đăng nhập, cấp phát JWT Token, đăng ký tài khoản khách hàng, kiểm soát phân quyền dựa trên vai trò (RBAC) và quản lý danh sách tài khoản hệ thống.

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
    "role": "ADMIN"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Sai tên đăng nhập hoặc mật khẩu.
- **HTTP 403 Forbidden:** Tài khoản đã bị khóa (`LOCKED`) hoặc chưa kích hoạt.

---

## 2. Đăng ký tài khoản Khách hàng (FR-06)

- **Endpoint:** `POST /api/v1/auth/register`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Khách hàng mới tự tạo tài khoản mua sắm trực tuyến (tự động gán vai trò `CUSTOMER`).

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
| `password` | String | Có | Tối thiểu 6 ký tự | Mật khẩu đăng nhập |
| `email` | String | Có | Định dạng Email | Email nhận thông báo và xác thực |
| `firstName` | String | Không | Tối đa 50 ký tự | Tên đệm và tên gọi |
| `lastName` | String | Có | Tối đa 50 ký tự | Họ người dùng |
| `phoneNumber`| String | Có | 10 số, duy nhất | Số điện thoại liên hệ |
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
    "role": "CUSTOMER"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Xem thông tin tài khoản hiện tại (FR-07)

- **Endpoint:** `GET /api/v1/auth/my-info`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER` (Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Trích xuất định danh từ token JWT để lấy hồ sơ tài khoản đang đăng nhập.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin tài khoản thành công",
  "result": {
    "id": 1,
    "username": "admin",
    "email": "admin@fasearch.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2026-10-25T08:00:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Quản lý danh sách tài khoản (FR-01)

- **Endpoint:** `GET /api/v1/auth/accounts`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Xem danh sách toàn bộ tài khoản có phân trang và bộ lọc tìm kiếm.
- **Query Parameters:**
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi mỗi trang (mặc định: `10`).
  - `sort`: Tiêu chí sắp xếp (ví dụ: `ngayTao,desc`).
  - `keyword`: Tìm kiếm theo tên đăng nhập hoặc email.
  - `role`: Lọc theo vai trò (`ADMIN`, `STAFF`, `CUSTOMER`).
  - `status`: Lọc theo trạng thái (`ACTIVE`, `INACTIVE`, `LOCKED`, `DELETED`).

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
        "username": "admin",
        "email": "admin@fasearch.com",
        "role": "ADMIN",
        "status": "ACTIVE",
        "createdAt": "2026-10-25T08:00:00"
      },
      {
        "id": 2,
        "username": "staff01",
        "email": "staff01@fasearch.com",
        "role": "STAFF",
        "status": "ACTIVE",
        "createdAt": "2026-10-25T09:00:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 2,
    "totalPages": 1,
    "isLast": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 5. Thêm mới tài khoản nội bộ (FR-02)

- **Endpoint:** `POST /api/v1/auth/accounts`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Quản trị viên khởi tạo tài khoản nội bộ cho Nhân viên hoặc Admin mới.

### Request Body
```json
{
  "username": "staff02",
  "password": "Password@123",
  "email": "staff02@fasearch.com",
  "role": "STAFF"
}
```

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo tài khoản mới thành công",
  "result": {
    "id": 3,
    "username": "staff02",
    "email": "staff02@fasearch.com",
    "role": "STAFF",
    "status": "ACTIVE",
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 6. Cập nhật tài khoản (FR-03)

- **Endpoint:** `PUT /api/v1/auth/accounts/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Cập nhật thông tin email, trạng thái tài khoản hoặc thay đổi vai trò.

### Request Body
```json
{
  "email": "staff02_new@fasearch.com",
  "status": "ACTIVE",
  "role": "STAFF",
  "newPassword": "NewPassword@123"
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật tài khoản thành công",
  "result": {
    "id": 3,
    "username": "staff02",
    "email": "staff02_new@fasearch.com",
    "role": "STAFF",
    "status": "ACTIVE",
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

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
  "message": "Khóa tài khoản thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 8. Xem nhật ký hệ thống (FR-09)

- **Endpoint:** `GET /api/v1/auth/audit-logs`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Tra cứu các vết thay đổi dữ liệu được tự động ghi nhận khi Thêm / Sửa / Xóa.
- **Query Parameters:** `page`, `size`, `sort`, `username`, `action`.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy nhật ký hệ thống thành công",
  "result": {
    "content": [
      {
        "id": 1,
        "username": "admin",
        "action": "UPDATE_ACCOUNT",
        "changedData": "Cập nhật trạng thái tài khoản staff02 thành ACTIVE",
        "timestamp": "2026-10-25T15:35:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "isLast": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```
