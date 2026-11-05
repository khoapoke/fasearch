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


## Đổi mật khẩu hiện tại

- **Endpoint:** `POST /api/v1/auth/change-password`
- **Quyền hạn:** Bearer (own account).
- **Body:** `{ "oldPassword": "...", "newPassword": "..." }`.
- **Hành vi:** sai mật khẩu cũ → `401`, không đổi dữ liệu; đúng → `200`, cập nhật BCrypt hash và tăng `tai_khoan.token_version`. JWT mang claim `tokenVersion`; filter so khớp với DB nên mọi token cũ bị từ chối (`401`) ngay sau khi đổi. Token của tài khoản khác không bị ảnh hưởng. Client phải đăng nhập lại.
- **Migration:** `V13__account_token_version.sql` (candidate-only additive).
- **Thông báo email:** đổi mật khẩu thành công gửi thêm email "Mật khẩu vừa được thay đổi" (best-effort: gửi lỗi không làm thất bại request). Chế độ gửi theo `brevo|log` (mục 13).

---

## 9. Trường `emailVerified` (FR-05..07 mở rộng)

- `POST /api/v1/auth/login`, `POST /api/v1/auth/register` và `GET /api/v1/auth/my-info` trả thêm `result.emailVerified: boolean` (true khi `tai_khoan.ngay_xac_thuc_email` đã set).
- **Quy tắc backfill (V22):** mọi tài khoản tồn tại trước V22 được coi như ĐÃ xác thực (`ngay_xac_thuc_email = ngay_tao`) để không khóa ai ra khỏi hệ thống. Chỉ tài khoản tạo MỚI sau V22 có `NULL` (chưa xác thực) cho đến khi xác nhận qua email.
- **Round này login KHÔNG chặn tài khoản chưa xác thực** (FE hiện banner + nút gửi lại). Bật chặn đăng nhập bằng `EMAIL_VERIFICATION_REQUIRED=true` → login trả `403 EMAIL_NOT_VERIFIED`.

---

## 10. Quên mật khẩu — yêu cầu liên kết đặt lại

- **Endpoint:** `POST /api/v1/auth/password/forgot`
- **Quyền hạn:** `PUBLIC` (không đăng nhập). Rate-limit: tối đa 5 lượt/giờ cho mỗi email, 20 lượt/giờ cho mỗi IP (vượt quá → `429 TOO_MANY_REQUESTS`).
- **Body:** `{ "email": "customer01@fasearch.com" }`.
- **Hành vi:** LUÔN trả `200` với cùng một message dù email có tồn tại hay không (không lộ tài khoản). Nếu tài khoản `ACTIVE` tồn tại: vô hiệu token reset cũ, tạo token mới (SHA-256 hash trong DB, hiệu lực 30 phút, dùng một lần) và gửi email chứa liên kết `{APP_FRONTEND_URL}/dat-lai-mat-khau?token=...`.

### Response (cả hai trường hợp, HTTP 200 OK)
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

---

## 11. Đặt lại mật khẩu bằng token

- **Endpoint:** `POST /api/v1/auth/password/reset`
- **Quyền hạn:** `PUBLIC`. Rate-limit 20 lượt/giờ cho mỗi IP.
- **Body:** `{ "token": "...", "newPassword": "..." }` (quy tắc mật khẩu mới = quy tắc đổi mật khẩu: 6–100 ký tự).
- **Hành vi:** token sai/đã dùng/hết hạn → `400 EMAIL_TOKEN_INVALID`. Đúng → `200`: cập nhật BCrypt hash, **tăng `token_version` (mọi phiên cũ chết ngay, kể cả thiết bị này)**, đánh dấu token đã dùng, gửi thông báo email "Mật khẩu vừa được thay đổi". Client đăng nhập lại bằng mật khẩu mới.

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

---

## 12. Xác thực email

- **Yêu cầu gửi lại email:** `POST /api/v1/auth/email/verification-request` — Bearer (own account). Tài khoản chưa có email → `400 EMAIL_ADDRESS_MISSING`; đã xác thực rồi → vẫn `200` (không gửi lại). Rate-limit 5 lượt/giờ cho mỗi tài khoản, 20 lượt/giờ cho mỗi IP. Token hiệu lực 24 giờ, dùng một lần; liên kết `{APP_FRONTEND_URL}/xac-thuc-email?token=...`.
- **Xác nhận token:** `POST /api/v1/auth/email/verify` — `PUBLIC`, body `{ "token": "..." }`. Đúng → `200 "Xác thực email thành công"` (set `ngay_xac_thuc_email`, vô hiệu token verify còn lại); sai/hết hạn/đã dùng → `400 EMAIL_TOKEN_INVALID`. Rate-limit 20 lượt/giờ cho mỗi IP.
- **Đăng ký** (`POST /api/v1/auth/register`) tự gửi email xác thực sau khi tạo tài khoản (best-effort: gửi lỗi không làm thất bại đăng ký; FE hiện banner + nút gửi lại).

---

## 13. Chế độ gửi email `brevo|log`

- Có `BREVO_API_KEY` (non-blank) → chế độ `brevo`: gọi thật Brevo API v3 (`POST {BREVO_API_URL}/v3/smtp/email`), timeout `BREVO_TIMEOUT_SECONDS` (mặc định 10s), lỗi mạng/timeout tự thử lại đúng một lần rồi mới báo `502 EMAIL_SEND_FAILED`. Không bao giờ in API key ra log.
- Chưa có key → chế độ `log`: render đầy đủ email (to/subject/text+html) rồi ghi log `[mail:log]`, không gửi thật.
- Cấu hình (`application.yaml` + env): `BREVO_API_URL`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `EMAIL_VERIFICATION_REQUIRED` (mặc định `false`), `EMAIL_VERIFY_TOKEN_HOURS` (24), `EMAIL_RESET_TOKEN_MINUTES` (30), `APP_FRONTEND_URL`.
- Mẫu email tiếng Việt tối giản (HTML + text): xác thực email, đặt lại mật khẩu, mật khẩu vừa thay đổi (`client/EmailTemplates`).
- Giới hạn: rate-limit nằm trong bộ nhớ của từng instance (chạy nhiều replica cần thay bằng Redis/DB).
