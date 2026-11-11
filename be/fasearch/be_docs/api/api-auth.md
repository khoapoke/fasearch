# TÀI LIỆU API: MODULE AUTH (XÁC THỰC & PHÂN QUYỀN)

Module `auth` chịu trách nhiệm quản lý đăng nhập, cấp phát JWT Token, đăng ký tài khoản khách hàng, kiểm soát phân quyền dựa trên vai trò (RBAC), quên/đặt lại mật khẩu, xác thực email và quản lý danh sách tài khoản hệ thống.

Trong `ApiResponse`, các trường `null` (bao gồm `result` và `errors`) được bỏ khỏi JSON; các ví dụ thành công bên dưới phản ánh điều này.

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ (code `400`, message `Dữ liệu không hợp lệ.`).
- **HTTP 401 Unauthorized:** `INVALID_CREDENTIALS` (401): `Tên đăng nhập hoặc mật khẩu không đúng.`
- **HTTP 403 Forbidden:** `ACCOUNT_LOCKED` (403): `Tài khoản đã bị khóa.`; `ACCOUNT_INACTIVE` (403): `Tài khoản đang không hoạt động.`; `EMAIL_NOT_VERIFIED` (403): `Tài khoản chưa xác thực email`.

---

## 2. Đăng ký tài khoản Khách hàng (FR-06)

- **Endpoint:** `POST /api/v1/auth/register`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Khách hàng mới tự tạo tài khoản mua sắm trực tuyến (tự động gán vai trò `CUSTOMER`) và thử gửi email xác thực; đăng ký vẫn thành công nếu gửi thất bại.

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation (code `400`, message `Dữ liệu không hợp lệ.`); `USERNAME_ALREADY_EXISTS` (400): `Tên đăng nhập đã tồn tại.`; `EMAIL_ALREADY_EXISTS` (400): `Email đã tồn tại.`; `PHONE_NUMBER_ALREADY_EXISTS` (400): `Số điện thoại đã tồn tại`.
- **HTTP 404 Not Found:** `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`

---

## 3. Xem thông tin tài khoản hiện tại (FR-07)

- **Endpoint:** `GET /api/v1/auth/my-info`
- **Quyền hạn:** Tài khoản đã xác thực (Cần Header `Authorization: Bearer <token>`; không có `@PreAuthorize`)
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
    "createdAt": "2026-10-25T08:00:00",
    "permissions": ["ORDER_VIEW", "ORDER_UPDATE_STATUS", "...", "TRASH_RESTORE"]
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `customerId` | Long | Mã hồ sơ khách hàng; `null` nếu tài khoản không có hồ sơ |
| `emailVerified` | Boolean | Trạng thái xác thực email |
| `permissions` | String[] | Mã quyền nghiệp vụ hiệu lực (mục 15): `ADMIN` = mọi mã; `STAFF` = các mã đang bật; `CUSTOMER` = `[]`. Chỉ để giao diện ẩn/hiện, BE vẫn kiểm tra quyền ở từng endpoint |

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 404 Not Found:** `USER_NOT_FOUND` (404): `Không tìm thấy người dùng.`

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation (code `400`, message `Dữ liệu không hợp lệ.`); `USERNAME_ALREADY_EXISTS` (400): `Tên đăng nhập đã tồn tại.`; `EMAIL_ALREADY_EXISTS` (400): `Email đã tồn tại.`
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`

---

## 6. Cập nhật tài khoản (FR-03)

- **Endpoint:** `PUT /api/v1/auth/accounts/{id}` (hoặc `PATCH`)
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Cập nhật email, trạng thái tài khoản, vai trò hoặc đặt lại mật khẩu; chỉ các trường được gửi lên mới đổi.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | Mã tài khoản |

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
| `role` | String | Không | `ADMIN`, `STAFF` (service từ chối `CUSTOMER`) |
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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation; `EMAIL_ALREADY_EXISTS` (400): `Email đã tồn tại.`; `INVALID_REQUEST` (400), mặc định `Dữ liệu yêu cầu không hợp lệ.`, được service ghi đè thành `Chỉ được đổi vai trò giữa Nhân viên và Quản trị viên.`
- **HTTP 403 Forbidden:** Không phải `ADMIN`; `ACCESS_DENIED` (403), mặc định `Bạn không có quyền truy cập tài nguyên này.`, được ghi đè thành `Không thể đổi vai trò hoặc trạng thái của chính tài khoản đang đăng nhập.` khi tự đổi role/status.
- **HTTP 404 Not Found:** `USER_NOT_FOUND` (404): `Không tìm thấy người dùng.`; `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`

---

## 7. Khóa / Xóa mềm tài khoản (FR-04)

- **Endpoint:** `DELETE /api/v1/auth/accounts/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Chuyển trạng thái tài khoản thành `DELETED` và cập nhật `da_xoa = true` (kèm `ngay_xoa`, `nguoi_xoa` từ security context, `ly_do_xoa`) để vô hiệu hóa tài khoản mà không mất dữ liệu lịch sử. `token_version` tăng ngay khi xóa, nên token đã cấp trước đó mất hiệu lực và không thể sống lại kể cả khi tài khoản được khôi phục rồi bật lại; bộ lọc JWT cũng từ chối mọi tài khoản không `ACTIVE` hoặc đã `da_xoa = true`. **Chặn** tự xóa tài khoản đang đăng nhập, chặn xóa `ADMIN` đang `ACTIVE` cuối cùng, và chặn khi còn hồ sơ `nhan_vien`/`khach_hang` liên kết.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | Mã tài khoản |

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa tài khoản thành công",
  "result": true,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation lý do (code `400`, message `Dữ liệu không hợp lệ.`, chi tiết `Lý do xóa tối đa 255 ký tự`).
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `USER_NOT_FOUND` (404): `Không tìm thấy người dùng.`
- **HTTP 409 Conflict:** `DELETE_NOT_ALLOWED` (4404): mặc định `Không thể xóa đối tượng này`; `DELETE_BLOCKED_BY_REFERENCES` (4403): mặc định `Không thể xóa vì còn dữ liệu tham chiếu`. Message thực tế lần lượt: `Không thể xóa tài khoản đang đăng nhập. Hãy dùng một tài khoản Quản trị viên khác.`, `Không thể xóa Quản trị viên đang hoạt động cuối cùng của hệ thống.`, hoặc `Không thể xóa tài khoản vì còn <số> hồ sơ nhân sự hoặc khách hàng liên kết. Hãy xử lý hồ sơ trước.`

---

## 8. Đổi mật khẩu

- **Endpoint:** `POST /api/v1/auth/change-password`
- **Quyền hạn:** Tài khoản đã xác thực (đổi mật khẩu của chính mình; không có `@PreAuthorize`)
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
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation; `INVALID_REQUEST` (400), mặc định `Dữ liệu yêu cầu không hợp lệ.`, được ghi đè thành `Mật khẩu mới phải khác mật khẩu cũ`.
- **HTTP 401 Unauthorized:** `INVALID_CREDENTIALS` (401), mặc định `Tên đăng nhập hoặc mật khẩu không đúng.`, được ghi đè thành `Mật khẩu cũ không đúng`; hoặc token không hợp lệ.
- **HTTP 404 Not Found:** `USER_NOT_FOUND` (404): `Không tìm thấy người dùng.`

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
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Email trống hoặc sai định dạng (validation, code `400`, message `Dữ liệu không hợp lệ.`).
- **HTTP 429 Too Many Requests:** `TOO_MANY_REQUESTS` (429): `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau`.

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
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation; `EMAIL_TOKEN_INVALID` (400): `Liên kết không hợp lệ hoặc đã hết hạn`.
- **HTTP 429 Too Many Requests:** `TOO_MANY_REQUESTS` (429): `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau`.

---

## 11. Gửi lại email xác thực

- **Endpoint:** `POST /api/v1/auth/email/verification-request`
- **Quyền hạn:** Tài khoản đã xác thực (không có `@PreAuthorize`)
- **Mô tả:** Gửi email xác thực (token hiệu lực 24 giờ, dùng một lần). Tài khoản đã xác thực vẫn trả `200` và không gửi lại; lỗi gửi email được ghi log và không làm yêu cầu thất bại. Giới hạn 5 lượt/giờ mỗi tài khoản và 20 lượt/giờ mỗi IP.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Email xác thực đã được gửi. Kiểm tra hộp thư (kể cả thư rác).",
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `EMAIL_ADDRESS_MISSING` (400): `Tài khoản chưa có địa chỉ email`.
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 404 Not Found:** `USER_NOT_FOUND` (404): `Không tìm thấy người dùng.`
- **HTTP 429 Too Many Requests:** `TOO_MANY_REQUESTS` (429): `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau`.

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
  "timestamp": "2026-11-05T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation; `EMAIL_TOKEN_INVALID` (400): `Liên kết không hợp lệ hoặc đã hết hạn`.
- **HTTP 429 Too Many Requests:** `TOO_MANY_REQUESTS` (429): `Bạn thao tác quá nhiều lần. Vui lòng thử lại sau`.

---

## 13. Thùng rác tài khoản đăng nhập (FR-04)

- **Endpoint:** `GET /api/v1/admin/trash/accounts`
- **Quyền hạn:** `ADMIN` (không liệt kê cho `STAFF (Quản lý)` ở giao diện, và API trả **HTTP 403** nếu `STAFF` gọi)
- **Mô tả:** Danh sách tài khoản đã xóa mềm, mới xóa trước. Đọc bằng SQL gốc vì `@SQLRestriction("da_xoa = false")` ẩn các dòng này khỏi JPA. Phản hồi chỉ có tên đăng nhập, email, vai trò, trạng thái, người/thời điểm xóa và lý do — **không bao giờ** có mật khẩu, hash hay token. Dòng xóa trước khi có cột `ngay_xoa`/`nguoi_xoa` trả `deletedAt`/`deletedBy` là `null` (giao diện hiển thị "Không rõ").

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `20`, tối đa `100`) |
| `sort` | String | Không | Tham số Pageable; truy vấn thùng rác dùng thứ tự xóa mới nhất |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách tài khoản đã xóa thành công",
  "result": {
    "content": [
      {
        "id": 92,
        "name": "qa_staff_trash",
        "status": "DELETED",
        "publicationStatus": null,
        "productId": null,
        "productName": null,
        "color": null,
        "size": null,
        "barcode": null,
        "parentDeleted": false,
        "phone": null,
        "email": "qa@example.com",
        "role": "STAFF",
        "linkedUsername": null,
        "linkedAccountStatus": null,
        "deletedAt": "2026-11-07T12:56:00",
        "deletedBy": "chapter5_admin",
        "deleteReason": "Dọn dữ liệu kiểm thử"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-07T13:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `ADMIN` (kể cả `STAFF`).

---

## 14. Khôi phục tài khoản đăng nhập (FR-04)

- **Endpoint:** `POST /api/v1/admin/trash/accounts/{id}/restore`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Cập nhật có điều kiện `da_xoa = true` → `false` (kiểm tra đúng một dòng thay đổi) và xóa dấu vết xóa. Tài khoản trở lại với trạng thái **`INACTIVE`**: chưa đăng nhập được cho tới khi `ADMIN` bật `ACTIVE` ở mục 6. `token_version` tăng thêm một lần nữa để mọi token cấp trước khi xóa không thể dùng lại sau khi bật. Từ chối khi còn hồ sơ nhân sự/khách hàng đang hoạt động liên kết, hoặc khi tên đăng nhập/email đã được tài khoản khác dùng.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | Mã tài khoản |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Khôi phục tài khoản thành công",
  "result": true,
  "timestamp": "2026-11-07T13:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `TRASH_ITEM_NOT_FOUND` (4407): mặc định `Không tìm thấy mục trong thùng rác`; service ghi đè `Không tìm thấy tài khoản này trong thùng rác.`
- **HTTP 409 Conflict:** `RESTORE_BLOCKED` (4406): mặc định `Không thể khôi phục đối tượng này`; `RESTORE_CONFLICT` (4405): mặc định `Không thể khôi phục vì dữ liệu đã trùng`. Message thực tế lần lượt: `Không thể khôi phục tài khoản vì còn <số> hồ sơ nhân sự hoặc khách hàng đang hoạt động liên kết.`, `Không thể khôi phục tài khoản: tên đăng nhập đã được một tài khoản khác sử dụng.`, hoặc `Không thể khôi phục tài khoản: email đã được một tài khoản khác sử dụng.`

---

## 15. Phân quyền theo vai trò: danh mục quyền và cách kiểm tra

- **Quyền hạn:** Áp dụng cho mọi endpoint quản trị.
- **Mô tả:** Hai vai trò nội bộ giữ nguyên: Quản trị viên (`ADMIN`) và Quản lý (`STAFF`). `ADMIN` luôn có **mọi** quyền (không lưu, không sửa được). Quản lý có đúng các quyền mà `ADMIN` bật ở mục 16 (bảng `quyen_vai_tro`, V27; mã lạ trong bảng bị bỏ qua). Khách hàng (`CUSTOMER`) không có quyền nào ở đây. Bộ lọc JWT đọc vai trò và bảng quyền **mỗi request**, cấp authority `ROLE_<vai trò>` và `PERM_<mã>`; đổi phân quyền có hiệu lực ngay ở request kế tiếp, không cần đăng nhập lại. Lỗi đọc bảng quyền thì Quản lý không có quyền nào (đóng khi lỗi). Seed V27: Quản lý giữ đúng phạm vi trước đây (mọi quyền) trừ `LOYALTY_ADJUST` (quyền mới, mặc định tắt).

Danh mục mã quyền (nhóm → mã: nhãn):

| Nhóm | Mã | Nhãn |
| :--- | :--- | :--- |
| Đơn hàng | `ORDER_VIEW` | Xem đơn hàng |
| Đơn hàng | `ORDER_UPDATE_STATUS` | Chuyển trạng thái đơn |
| Đơn hàng | `ORDER_CANCEL` | Hủy đơn |
| Đơn hàng | `ORDER_COLLECT_CASH` | Ghi nhận thu tiền COD |
| Đơn hàng | `POS_USE` | Bán tại quầy (POS) |
| Khách hàng | `CUSTOMER_VIEW` / `CUSTOMER_CREATE` / `CUSTOMER_EDIT` / `CUSTOMER_DELETE` | Xem / Thêm / Sửa / Xóa khách hàng |
| Nhân sự | `EMPLOYEE_VIEW` / `EMPLOYEE_CREATE` / `EMPLOYEE_EDIT` / `EMPLOYEE_DELETE` | Xem / Thêm / Sửa / Xóa hồ sơ nhân sự |
| Sản phẩm | `PRODUCT_VIEW` | Xem sản phẩm, Draft và Barcode |
| Sản phẩm | `PRODUCT_EDIT` | Thêm, sửa sản phẩm, SKU, ảnh và Draft |
| Sản phẩm | `PRODUCT_DELETE` | Xóa sản phẩm và SKU |
| Sản phẩm | `PRODUCT_PUBLISH` | Publish, Unpublish và đồng bộ AI search |
| Sản phẩm | `PRODUCT_IMPORT` | Import sản phẩm (CSV, đường dẫn) |
| Sản phẩm | `CATEGORY_MANAGE` | Thêm, sửa, xóa danh mục |
| Sản phẩm | `REVIEW_MODERATE` | Xem và ẩn/hiện đánh giá |
| Kho | `INVENTORY_VIEW` | Xem tồn kho, phiếu và kiểm kê |
| Kho | `INVENTORY_RECEIPT_CREATE` | Tạo phiếu nhập, phiếu xuất |
| Kho | `STOCKTAKE_CREATE` | Tạo phiếu kiểm kê |
| Khuyến mãi | `PROMOTION_VIEW` / `PROMOTION_MANAGE` | Xem / Tạo, sửa khuyến mãi và Voucher |
| Điểm | `LOYALTY_POLICY_VIEW` / `LOYALTY_POLICY_MANAGE` | Xem / Sửa chính sách điểm và hạng |
| Điểm | `LOYALTY_ADJUST` | Điều chỉnh điểm và tính lại điểm cho đơn (mặc định tắt) |
| Report | `AUDIT_VIEW` | Xem nhật ký hoạt động (mặc định tắt cho STAFF) |
| Report | `REPORT_VIEW` | Xem Report |
| Report | `DATA_EXPORT` | Export CSV |
| Thùng rác | `TRASH_VIEW` / `TRASH_RESTORE` | Xem / Khôi phục từ thùng rác |

**Luôn chỉ `ADMIN` (không bật được cho Quản lý):** tài khoản đăng nhập và vai trò (`/api/v1/auth/accounts/**`), phân quyền (`/api/v1/auth/roles/**`), tab tài khoản trong thùng rác, ghi nhận số dư điểm ban đầu (`POST /api/v1/quan-tri/thanh-vien/mo-dau`), liên kết/khóa tài khoản qua hồ sơ nhân sự và khách hàng, khôi phục hồ sơ nhân sự của Quản trị viên.

Bảng endpoint → quyền. "KH hoặc" = endpoint dùng chung: khách hàng vẫn dùng được (chỉ dữ liệu của mình, logic sở hữu không đổi), nhân viên nội bộ cần quyền.

| Endpoint | Quyền |
| :--- | :--- |
| `GET /api/v1/orders`, `GET /api/v1/orders/{id}` | KH hoặc `ORDER_VIEW` |
| `PATCH /api/v1/orders/{id}/status` | `ORDER_UPDATE_STATUS` |
| `POST /api/v1/orders/{id}/cancel` | KH hoặc `ORDER_CANCEL` |
| `POST /api/v1/orders/pos/draft`, `POST /api/v1/orders/pos/{orderId}/quote`, `GET /api/v1/orders/pos/drafts` | `POS_USE` |
| `GET /api/v1/products/pos-lookup`, `GET /api/v1/products/pos-search` | `POS_USE` |
| `POST /api/v1/payments/calculate` | KH hoặc `POS_USE` hoặc `ORDER_COLLECT_CASH` |
| `POST /api/v1/payments/process` | KH hoặc (đơn `POS-*`: `POS_USE`; đơn khác: `ORDER_COLLECT_CASH`, kiểm tra trong service) |
| `GET /api/v1/users/customers` | `CUSTOMER_VIEW` |
| `GET /api/v1/users/customers/{id}` | KH hoặc `CUSTOMER_VIEW` |
| `POST /api/v1/users/customers` | `CUSTOMER_CREATE` |
| `PUT/PATCH /api/v1/users/customers/{id}` | KH hoặc `CUSTOMER_EDIT` |
| `DELETE /api/v1/users/customers/{id}` | `CUSTOMER_DELETE` |
| `GET /api/v1/thanh-vien/khach-hang/{customerId}` | `CUSTOMER_VIEW` |
| `GET /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/lich-su` | `CUSTOMER_VIEW` |
| `GET /api/v1/users/employees`, `GET /api/v1/users/employees/{id}` | `EMPLOYEE_VIEW` |
| `POST /api/v1/users/employees` | `EMPLOYEE_CREATE` |
| `PUT/PATCH /api/v1/users/employees/{id}` | `EMPLOYEE_EDIT` |
| `DELETE /api/v1/users/employees/{id}` | `EMPLOYEE_DELETE` |
| `POST /api/v1/products`, `PUT/PATCH /api/v1/products/{id}` | `PRODUCT_EDIT` |
| `DELETE /api/v1/products/{id}`, `DELETE /api/v1/products/variants/{variantId}` | `PRODUCT_DELETE` |
| `POST /api/v1/products/{productId}/variants`, `PUT/PATCH /api/v1/products/variants/{variantId}` | `PRODUCT_EDIT` |
| `POST /api/v1/products/{id}/image`, `DELETE /api/v1/products/{id}/image` | `PRODUCT_EDIT` |
| `GET /api/v1/products/variants/{skuId}/barcode`, `GET .../barcode/image` | `PRODUCT_VIEW` |
| `GET /api/v1/products/variants/scan-lookup` | `INVENTORY_VIEW` |
| `GET /api/v1/products`, `GET /api/v1/products/{id}` (công khai; xem sản phẩm chưa Publish) | `PRODUCT_VIEW` |
| `POST /api/v1/admin/products/drafts`, `PUT/DELETE /api/v1/admin/products/drafts/{draftId}`, `POST .../drafts/{draftId}/images` | `PRODUCT_EDIT` |
| `GET /api/v1/admin/products/drafts`, `GET .../drafts/{draftId}`, `GET .../drafts/{draftId}/images/{fileName}`, `GET /api/v1/admin/products/{productId}/ai-sync` | `PRODUCT_VIEW` |
| `POST .../drafts/{draftId}/publish`, `POST /api/v1/admin/products/{productId}/unpublish`, `POST .../{productId}/ai-sync/retry` | `PRODUCT_PUBLISH` |
| `POST /api/v1/admin/products/import-url`, `POST /api/v1/admin/csv/products/import`, `GET /api/v1/admin/csv/products/template` | `PRODUCT_IMPORT` |
| `POST /api/v1/categories`, `PUT/PATCH/DELETE /api/v1/categories/{id}` | `CATEGORY_MANAGE` |
| `GET /api/v1/admin/reviews`, `PATCH /api/v1/admin/reviews/{reviewId}/visibility` | `REVIEW_MODERATE` |
| `GET /api/v1/inventory/**` (tồn kho, phiếu nhập, phiếu xuất, kiểm kê) | `INVENTORY_VIEW` |
| `POST /api/v1/inventory/import-receipts`, `POST /api/v1/inventory/export-receipts` | `INVENTORY_RECEIPT_CREATE` |
| `POST /api/v1/inventory/stocktakes` | `STOCKTAKE_CREATE` |
| `GET /api/v1/khuyen-mai`, `GET /api/v1/khuyen-mai/{id}` | `PROMOTION_VIEW` |
| `POST /api/v1/khuyen-mai`, `PUT /api/v1/khuyen-mai/{id}`, `POST /api/v1/khuyen-mai/{id}/codes` | `PROMOTION_MANAGE` |
| `GET /api/v1/thanh-vien/chinh-sach`, `GET /api/v1/thanh-vien/chinh-sach/hang` | `LOYALTY_POLICY_VIEW` |
| `POST /api/v1/thanh-vien/chinh-sach`, `PUT .../chinh-sach/{policyId}`, `PUT .../chinh-sach/hang/{tierId}` | `LOYALTY_POLICY_MANAGE` |
| `POST /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/dieu-chinh`, `GET/POST /api/v1/quan-tri/thanh-vien/don-hang/{orderId}/tinh-lai-diem` | `LOYALTY_ADJUST` (controller và service) |
| `GET /api/v1/admin/audit`, `GET /api/v1/admin/audit/{id}` | `AUDIT_VIEW` |
| `GET /api/v1/admin/audit/export` | `AUDIT_VIEW` và `DATA_EXPORT` |
| `GET /api/v1/analytics/**` (revenue, top-products, inventory-movement, overview) | `REPORT_VIEW` |
| `GET /api/v1/admin/csv/products` | `DATA_EXPORT` và `PRODUCT_VIEW` |
| `GET /api/v1/admin/csv/stock` | `DATA_EXPORT` và `INVENTORY_VIEW` |
| `GET /api/v1/admin/csv/orders` | `DATA_EXPORT` và `ORDER_VIEW` |
| `GET /api/v1/admin/csv/customers` | `DATA_EXPORT` và `CUSTOMER_VIEW` |
| `GET /api/v1/admin/trash/{products,variants,categories,customers,employees}` | `TRASH_VIEW` |
| `POST /api/v1/admin/trash/{products,variants,categories,customers,employees}/{id}/restore` | `TRASH_RESTORE` (hồ sơ nhân sự của Quản trị viên: chỉ `ADMIN`) |

Tầng URL (`SecurityConfig`) vẫn là cổng vai trò bên ngoài: `/api/v1/analytics/**`, `/api/v1/quan-tri/**`, `/api/v1/users/employees/**` chỉ cho `ADMIN`/`STAFF`; `/api/v1/auth/accounts/**` và `/api/v1/auth/roles/**` chỉ `ADMIN`.

---

### Thông báo đơn hàng — N1

| Endpoint | Quyền |
| :--- | :--- |
| GET `/api/v1/admin/notifications` | Ít nhất một ORDER_VIEW / RETURN_VIEW / INVENTORY_VIEW; từng sự kiện lọc theo VIEW tương ứng |
| POST `/api/v1/admin/notifications/{id}/read` | Như trên; chỉ read marker của tài khoản hiện tại và sự kiện được xem |
| GET/PUT `/api/v1/notifications/preferences` | CUSTOMER, tài khoản hiện tại |
| GET `/api/v1/notifications/favorites` | CUSTOMER, danh sách của mình |
| PUT `/api/v1/notifications/favorites/{productId}` | CUSTOMER, sản phẩm yêu thích của mình |

Không thêm permission code; xem [api-notification.md](./api-notification.md).

### Đổi/trả

| Endpoint | Quyền | Mặc định STAFF |
| :--- | :--- | :--- |
| `GET /api/v1/returns/orders/{orderId}` | `CUSTOMER` | Chỉ CUSTOMER, đơn của mình |
| `POST /api/v1/returns` | `CUSTOMER` | Chỉ CUSTOMER, đơn của mình |
| `GET /api/v1/returns/{id}` | `CUSTOMER` | Chỉ CUSTOMER, đơn của mình |
| `GET /api/v1/returns/{id}/photos/{position}` | `CUSTOMER` | Chỉ CUSTOMER, đơn của mình |
| `GET /api/v1/admin/returns` | `RETURN_VIEW` | Bật |
| `GET /api/v1/admin/returns/{id}` | `RETURN_VIEW` | Bật |
| `GET /api/v1/admin/returns/{id}/photos/{position}` | `RETURN_VIEW` | Bật |
| `POST /api/v1/admin/returns/{id}/decision` | `RETURN_PROCESS` | Bật |
| `POST /api/v1/admin/returns/{id}/receive` | `RETURN_PROCESS` | Bật |
| `POST /api/v1/admin/returns/{id}/refund` | `RETURN_REFUND` | Tắt |

---

## 16. Xem phân quyền của vai trò

- **Endpoint:** `GET /api/v1/auth/roles/{role}/permissions` (`role` = `STAFF` hoặc `ADMIN`)
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Trả danh mục quyền theo nhóm cùng trạng thái bật. Với `ADMIN`: mọi quyền bật, `editable = false`.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `role` | String (RoleType) | Có | Vai trò trong đường dẫn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy phân quyền thành công",
  "result": {
    "role": "STAFF",
    "editable": true,
    "enabled": ["ORDER_VIEW", "ORDER_UPDATE_STATUS", "..."],
    "groups": [
      {
        "code": "ORDERS",
        "label": "Đơn hàng",
        "permissions": [
          { "code": "ORDER_VIEW", "label": "Xem đơn hàng", "enabled": true },
          { "code": "POS_USE", "label": "Bán tại quầy (POS)", "enabled": true }
        ]
      }
    ]
  },
  "timestamp": "2026-11-08T10:37:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `CUSTOMER`: `INVALID_REQUEST` (400), mặc định `Dữ liệu yêu cầu không hợp lệ.`, được ghi đè thành `Chỉ chỉnh được phân quyền của vai trò Quản lý.`; giá trị enum sai bị từ chối khi chuyển kiểu.
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`

---

## 17. Lưu phân quyền của Quản lý

- **Endpoint:** `PUT /api/v1/auth/roles/{role}/permissions` (`role` = `STAFF`)
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Thay toàn bộ bộ quyền đang bật của Quản lý (gửi **đủ** danh sách sau khi lưu, không phải phần thay đổi). Mã trùng được gộp; mã không có trong danh mục bị từ chối và không ghi gì. Có thay đổi thì ghi một dòng nhật ký (`nhat_ky_phan_quyen`: người lưu, thời điểm, bộ quyền trước và sau); không đổi gì thì không ghi. Có hiệu lực ở request kế tiếp của mọi tài khoản Quản lý.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `role` | String (RoleType) | Có | Vai trò trong đường dẫn |

### Request Body
```json
{
  "permissions": ["ORDER_VIEW", "ORDER_UPDATE_STATUS", "CUSTOMER_VIEW"]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `permissions` | String[] | Có | Mã quyền thuộc danh mục ở mục 15; tối đa 200 phần tử |

### Response Thành công (HTTP 200 OK)
Giống mục 16 (đầy đủ `role`, `editable`, `enabled`, `groups` và các trường lồng nhau; bộ quyền sau khi lưu), `message` = `"Đã lưu phân quyền"`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Validation danh sách; `INVALID_REQUEST` (400), mặc định `Dữ liệu yêu cầu không hợp lệ.`, được ghi đè thành `Thiếu danh sách quyền.`, `Mã quyền không hợp lệ: <danh sách>`, `Quản trị viên luôn có toàn quyền, không chỉnh được.`, hoặc `Chỉ chỉnh được phân quyền của vai trò Quản lý.`
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`

---

## 18. Nhật ký phân quyền

- **Endpoint:** `GET /api/v1/auth/roles/{role}/permissions/audit` (`role` = `STAFF`)
- **Quyền hạn:** `ADMIN`
- **Mô tả:** 50 lần lưu gần nhất, mới nhất trước, kèm quyền được bật thêm và tắt bớt.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `role` | String (RoleType) | Có | Vai trò trong đường dẫn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy nhật ký phân quyền thành công",
  "result": [
    {
      "id": 4,
      "actorAccountId": 2,
      "actorUsername": "chapter5_admin",
      "changedAt": "2026-11-08T13:34:13",
      "added": [],
      "removed": ["CUSTOMER_DELETE", "INVENTORY_VIEW"]
    }
  ],
  "timestamp": "2026-11-08T13:35:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (400), mặc định `Dữ liệu yêu cầu không hợp lệ.`, được ghi đè thành `Quản trị viên luôn có toàn quyền, không chỉnh được.` hoặc `Chỉ chỉnh được phân quyền của vai trò Quản lý.`; giá trị enum sai bị từ chối khi chuyển kiểu.
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** `ROLE_NOT_FOUND` (404): `Không tìm thấy vai trò.`
