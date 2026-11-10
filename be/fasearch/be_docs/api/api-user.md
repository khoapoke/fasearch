# TÀI LIỆU API: MODULE USER (NGƯỜI DÙNG, NHÂN SỰ & TÍCH ĐIỂM)

Module `user` quản lý thông tin khách hàng, nhân viên, quản trị viên, cơ chế tích điểm loyalty (`/thanh-vien`) và nâng hạng thành viên theo doanh số.

---

Các ví dụ thành công bỏ qua `errors` vì `ApiResponse` không tuần tự hóa trường null. `CustomerRes` và `EmployeeRes` cũng bỏ qua trường null; `avatar` là trường tùy chọn của `EmployeeRes`, còn tọa độ giao hàng và hạng legacy là các trường tùy chọn của `CustomerRes`.

## 1. Xem danh sách khách hàng (FR-10)

- **Endpoint:** `GET /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CUSTOMER_VIEW`
- **Mô tả:** Lấy danh sách khách hàng có phân trang, hỗ trợ tìm kiếm theo Tên, SĐT, Email hoặc lọc theo Hạng thành viên. Tìm kiếm không phân biệt hoa/thường và dấu tiếng Việt (kể cả `đ`), tối đa 100 ký tự; `%` và `_` do người dùng nhập được hiểu là ký tự thường.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (0-indexed, mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo Họ tên, SĐT hoặc Email; tối đa 100 ký tự |
| `tierId` | Long | Không | Lọc theo hạng thành viên legacy |
| `salesTierId` | Long | Không | Lọc theo hạng doanh số (chỉ khách có `salesTierStatus = KNOWN`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách khách hàng thành công",
  "result": {
    "content": [
      {
        "id": 1,
        "firstName": "Văn A",
        "lastName": "Nguyễn",
        "gender": "MALE",
        "phoneNumber": "0987654321",
        "dob": "1995-05-15",
        "address": "123 Đường Lê Lợi, Quận 1, TP.HCM",
        "accumulatePoint": 150,
        "tierId": 2,
        "tierName": "Bạc",
        "cumulativePaidSales": null,
        "salesTierId": null,
        "salesTierName": null,
        "salesTierStatus": "HISTORY_UNKNOWN",
        "deliveryLatitude": 10.8070354,
        "deliveryLongitude": 106.6287031
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
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 2. Xem chi tiết khách hàng (FR-11)

- **Endpoint:** `GET /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ xem hồ sơ của chính mình) — Quản lý cần quyền `CUSTOMER_VIEW`
- **Mô tả:** Lấy thông tin chi tiết hồ sơ cá nhân, điểm tích lũy và hạng của một khách hàng.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin khách hàng thành công",
  "result": {
    "id": 1,
    "firstName": "Văn A",
    "lastName": "Nguyễn",
    "gender": "MALE",
    "phoneNumber": "0987654321",
    "dob": "1995-05-15",
    "address": "123 Đường Lê Lợi, Quận 1, TP.HCM",
    "accumulatePoint": 150,
    "tierId": 2,
    "tierName": "Bạc",
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": "HISTORY_UNKNOWN",
    "deliveryLatitude": 10.8070354,
    "deliveryLongitude": 106.6287031
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** `CUSTOMER` xem hồ sơ của người khác.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 3. Thêm mới khách hàng (FR-12)

- **Endpoint:** `POST /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CUSTOMER_CREATE`
- **Mô tả:** Tạo hồ sơ khách hàng mới trực tiếp tại quầy hoặc do quản trị nhập dữ liệu.

### Request Body
```json
{
  "firstName": "Thị B",
  "lastName": "Trần",
  "phoneNumber": "0912345678",
  "gender": "FEMALE",
  "dob": "1998-10-20",
  "address": "456 Đường CMT8, Quận 3, TP.HCM"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `firstName` | String | Không | Họ đệm, tối đa 50 ký tự |
| `lastName` | String | Có | Tên, tối đa 50 ký tự |
| `phoneNumber` | String | Có | SĐT Việt Nam (`0xxxxxxxxx` hoặc `+84xxxxxxxxx`), duy nhất |
| `gender` | String | Không | `MALE`, `FEMALE`, `OTHER` |
| `dob` | String | Không | Ngày sinh `yyyy-MM-dd` |
| `address` | String | Không | Địa chỉ |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm khách hàng thành công",
  "result": {
    "id": 2,
    "firstName": "Thị B",
    "lastName": "Trần",
    "gender": "FEMALE",
    "phoneNumber": "0912345678",
    "dob": "1998-10-20",
    "address": "456 Đường CMT8, Quận 3, TP.HCM",
    "accumulatePoint": 0,
    "tierId": 2,
    "tierName": "Bạc",
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": null
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

- Các trường doanh số luôn là `null` trong phản hồi tạo/cập nhật vì dịch vụ không làm giàu dữ liệu doanh số ở hai thao tác này.

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `PHONE_NUMBER_ALREADY_EXISTS` (400): “Số điện thoại đã tồn tại”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc SĐT đã tồn tại (`PHONE_NUMBER_ALREADY_EXISTS`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 4. Cập nhật hồ sơ khách hàng (FR-12)

- **Endpoint:** `PATCH /api/v1/users/customers/{id}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ sửa hồ sơ của chính mình) — Quản lý cần quyền `CUSTOMER_EDIT`
- **Mô tả:** Cập nhật từng phần (chỉ các trường được gửi lên). Đổi `address` mà không gửi tọa độ mới sẽ xóa tọa độ giao hàng cũ.

### Request Body
```json
{
  "firstName": "Văn A Cập Nhật",
  "lastName": "Nguyễn",
  "gender": "MALE",
  "dob": "1995-05-15",
  "address": "999 Đường Nguyễn Huệ, Quận 1, TP.HCM",
  "deliveryLatitude": 10.7769,
  "deliveryLongitude": 106.7009
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `firstName` | String | Không | Họ đệm, tối đa 50 ký tự |
| `lastName` | String | Không | Tên, tối đa 50 ký tự |
| `phoneNumber` | String | Không | SĐT Việt Nam, duy nhất |
| `gender` | String | Không | `MALE`, `FEMALE`, `OTHER` |
| `dob` | String | Không | Ngày sinh `yyyy-MM-dd` |
| `address` | String | Không | Địa chỉ |
| `deliveryLatitude` | Number | Không | Vĩ độ giao hàng `[-90, 90]`, gửi cùng `deliveryLongitude` |
| `deliveryLongitude` | Number | Không | Kinh độ giao hàng `[-180, 180]`, gửi cùng `deliveryLatitude` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật hồ sơ khách hàng thành công",
  "result": {
    "id": 1,
    "firstName": "Văn A Cập Nhật",
    "lastName": "Nguyễn",
    "gender": "MALE",
    "phoneNumber": "0987654321",
    "dob": "1995-05-15",
    "address": "999 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    "accumulatePoint": 150,
    "tierId": 2,
    "tierName": "Bạc",
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": null,
    "deliveryLatitude": 10.7769,
    "deliveryLongitude": 106.7009
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

- Các trường doanh số luôn là `null` trong phản hồi tạo/cập nhật vì dịch vụ không làm giàu dữ liệu doanh số ở hai thao tác này.

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `PHONE_NUMBER_ALREADY_EXISTS` (400): “Số điện thoại đã tồn tại”; `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, tọa độ lệch cặp / ngoài miền hoặc SĐT đã tồn tại.
- **HTTP 403 Forbidden:** `CUSTOMER` sửa hồ sơ của người khác.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 5. Xóa mềm khách hàng (FR-13)

- **Endpoint:** `DELETE /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` (hồ sơ có tài khoản đăng nhập liên kết chỉ `ADMIN` xóa được) — Quản lý cần quyền `CUSTOMER_DELETE`
- **Mô tả:** Cập nhật `da_xoa = true` và ghi `ngay_xoa`, `nguoi_xoa` (từ security context), `ly_do_xoa`; không xóa vật lý khỏi CSDL nhằm bảo toàn lịch sử hóa đơn. **Chặn khi khách đã có** đơn hàng, hóa đơn, bút toán điểm (`loyalty_ledger_entry`) hoặc phiếu đổi trả.
- **Hồ sơ có tài khoản đăng nhập liên kết:** xóa hồ sơ mà để tài khoản `ACTIVE` sẽ tạo ra một thông tin đăng nhập còn sống gắn với hồ sơ đã xóa (mọi lời gọi của khách trả `CUSTOMER_NOT_FOUND` nhưng vẫn đăng nhập được), nên khóa tài khoản là một phần của thao tác xóa. Việc này thuộc quản trị tài khoản: `STAFF (Quản lý)` bị **HTTP 403**, `ADMIN` thực hiện và tài khoản liên kết chuyển sang `LOCKED`, `token_version` tăng để token đã cấp mất hiệu lực. Khôi phục hồ sơ **không** tự mở khóa tài khoản (xem mục 23).

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa khách hàng thành công",
  "result": true,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”; `DELETE_BLOCKED_BY_HISTORY` (4401): “Không thể xóa vì dữ liệu đã phát sinh giao dịch”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Lý do xóa dài quá 255 ký tự (`INVALID_REQUEST`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền; `STAFF (Quản lý)` xóa hồ sơ đang liên kết tài khoản đăng nhập (`ACCESS_DENIED`).
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).
- **HTTP 409 Conflict:** Khách đã có đơn hàng/hóa đơn/bút toán điểm/phiếu đổi trả (`DELETE_BLOCKED_BY_HISTORY`); thông báo nêu từng con số.

---

## 6. Xem danh sách nhân viên (FR-15)

- **Endpoint:** `GET /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `EMPLOYEE_VIEW`
- **Mô tả:** Lấy danh sách hồ sơ nhân viên có phân trang, tìm theo Tên / SĐT / CCCD.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo Tên, SĐT hoặc CCCD |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách nhân viên thành công",
  "result": {
    "content": [
      {
        "id": 1,
        "firstName": "Thanh",
        "lastName": "Lê",
        "avatar": "https://example.com/avatar.jpg",
        "gender": "MALE",
        "phoneNumber": "0901234567",
        "cccd": "079201001234",
        "dob": "1992-03-12",
        "address": "Quận Phú Nhuận, TP.HCM",
        "accountId": 2,
        "username": "staff01",
        "role": "STAFF"
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
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 7. Xem chi tiết nhân viên (FR-15)

- **Endpoint:** `GET /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `EMPLOYEE_VIEW`
- **Mô tả:** Lấy hồ sơ chi tiết của một nhân viên theo ID.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin nhân viên thành công",
  "result": {
    "id": 1,
    "firstName": "Thanh",
    "lastName": "Lê",
    "avatar": "https://example.com/avatar.jpg",
    "gender": "MALE",
    "phoneNumber": "0901234567",
    "cccd": "079201001234",
    "dob": "1992-03-12",
    "address": "Quận Phú Nhuận, TP.HCM",
    "accountId": 2,
    "username": "staff01",
    "role": "STAFF"
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `EMPLOYEE_NOT_FOUND` (404): “Không tìm thấy nhân viên.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 404 Not Found:** Không tìm thấy nhân viên (`EMPLOYEE_NOT_FOUND`).

---

## 8. Thêm mới nhân viên (FR-16)

- **Endpoint:** `POST /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `EMPLOYEE_CREATE`
- **Mô tả:** Tạo hồ sơ nhân viên. Gửi `accountId` (liên kết tài khoản đăng nhập) chỉ `ADMIN` được phép.

### Request Body
```json
{
  "firstName": "Thanh",
  "lastName": "Lê",
  "phoneNumber": "0901234567",
  "cccd": "079201001234",
  "gender": "MALE",
  "dob": "1992-03-12",
  "address": "Quận Phú Nhuận, TP.HCM",
  "accountId": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `firstName` | String | Không | Họ đệm, tối đa 50 ký tự |
| `lastName` | String | Có | Tên, tối đa 50 ký tự |
| `phoneNumber` | String | Có | SĐT Việt Nam, duy nhất |
| `cccd` | String | Có | Đúng 12 chữ số, duy nhất |
| `gender` | String | Không | `MALE`, `FEMALE`, `OTHER` |
| `dob` | String | Không | Ngày sinh `yyyy-MM-dd` |
| `address` | String | Không | Địa chỉ |
| `accountId` | Long | Không | ID tài khoản đăng nhập liên kết (chỉ `ADMIN`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm mới nhân viên thành công",
  "result": {
    "id": 3,
    "firstName": "Thanh",
    "lastName": "Lê",
    "gender": "MALE",
    "phoneNumber": "0901234567",
    "cccd": "079201001234",
    "dob": "1992-03-12",
    "address": "Quận Phú Nhuận, TP.HCM",
    "accountId": 2,
    "username": "staff01",
    "role": "STAFF"
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `PHONE_NUMBER_ALREADY_EXISTS` (400): “Số điện thoại đã tồn tại”; `CCCD_ALREADY_EXISTS` (400): “Số CCCD đã tồn tại”; `ACCOUNT_NOT_FOUND` (404): “Không tìm thấy tài khoản.”; `ACCOUNT_ALREADY_LINKED` (400): “Tài khoản đã được liên kết với nhân viên khác.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, trùng SĐT / CCCD hoặc tài khoản đã liên kết nhân viên khác (`ACCOUNT_ALREADY_LINKED`).
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` gửi `accountId` (`ACCESS_DENIED`).
- **HTTP 404 Not Found:** Không tìm thấy tài khoản (`ACCOUNT_NOT_FOUND`).

---

## 9. Cập nhật nhân viên (FR-16)

- **Endpoint:** `PATCH /api/v1/users/employees/{id}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `EMPLOYEE_EDIT`
- **Mô tả:** Cập nhật từng phần hồ sơ nhân viên. Đổi liên kết `accountId` chỉ `ADMIN` được phép (gửi lại đúng giá trị hiện tại thì bỏ qua). `STAFF (Quản lý)` không được sửa hồ sơ đang liên kết tài khoản `ADMIN` (403).

### Request Body
```json
{
  "phoneNumber": "0907654321",
  "address": "Quận 1, TP.HCM"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `firstName` | String | Không | Họ đệm, tối đa 50 ký tự |
| `lastName` | String | Không | Tên, tối đa 50 ký tự |
| `phoneNumber` | String | Không | SĐT Việt Nam, duy nhất |
| `cccd` | String | Không | Đúng 12 chữ số, duy nhất |
| `gender` | String | Không | `MALE`, `FEMALE`, `OTHER` |
| `dob` | String | Không | Ngày sinh `yyyy-MM-dd` |
| `address` | String | Không | Địa chỉ |
| `accountId` | Long | Không | ID tài khoản liên kết (chỉ `ADMIN` đổi được) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật hồ sơ nhân viên thành công",
  "result": {
    "id": 3,
    "firstName": "Thanh",
    "lastName": "Lê",
    "avatar": "https://example.com/avatar.jpg",
    "gender": "MALE",
    "phoneNumber": "0907654321",
    "cccd": "079201001234",
    "dob": "1992-03-12",
    "address": "Quận 1, TP.HCM",
    "accountId": 2,
    "username": "staff01",
    "role": "STAFF"
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `EMPLOYEE_NOT_FOUND` (404): “Không tìm thấy nhân viên.”; `PHONE_NUMBER_ALREADY_EXISTS` (400): “Số điện thoại đã tồn tại”; `CCCD_ALREADY_EXISTS` (400): “Số CCCD đã tồn tại”; `ACCOUNT_NOT_FOUND` (404): “Không tìm thấy tài khoản.”; `ACCOUNT_ALREADY_LINKED` (400): “Tài khoản đã được liên kết với nhân viên khác.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, trùng SĐT / CCCD hoặc tài khoản đã liên kết (`ACCOUNT_ALREADY_LINKED`).
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` đổi `accountId` hoặc sửa hồ sơ đang liên kết tài khoản `ADMIN` (`ACCESS_DENIED`).
- **HTTP 404 Not Found:** Không tìm thấy nhân viên (`EMPLOYEE_NOT_FOUND`) hoặc tài khoản.

---

## 10. Xóa mềm nhân viên (FR-17)

- **Endpoint:** `DELETE /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` (hồ sơ đã liên kết tài khoản chỉ `ADMIN` xóa được; hồ sơ liên kết `ADMIN` thì `STAFF` luôn 403) — Quản lý cần quyền `EMPLOYEE_DELETE`
- **Mô tả:** Đánh dấu nhân viên nghỉ việc (`da_xoa = true`, kèm `ngay_xoa`/`nguoi_xoa`/`ly_do_xoa`), đồng thời khóa tài khoản đăng nhập đã liên kết (nếu có). Hồ sơ đã xóa không tự mở khóa tài khoản.

### Request Body (không bắt buộc)
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Không | Lý do xóa, được cắt khoảng trắng, tối đa 255 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa nhân viên thành công",
  "result": true,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `EMPLOYEE_NOT_FOUND` (404): “Không tìm thấy nhân viên.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Lý do xóa dài quá 255 ký tự (`INVALID_REQUEST`).
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` xóa hồ sơ đang liên kết tài khoản, kể cả hồ sơ liên kết `ADMIN` (`ACCESS_DENIED`). Xóa không lan sang tài khoản đăng nhập, chỉ khóa tài khoản (ADMIN thực hiện).
- **HTTP 404 Not Found:** Không tìm thấy nhân viên (`EMPLOYEE_NOT_FOUND`).

---

## 11. Xem số dư điểm của tôi (FR-19)

- **Endpoint:** `GET /api/v1/thanh-vien`
- **Quyền hạn:** `CUSTOMER` (lấy khách hàng từ JWT)
- **Mô tả:** Số dư điểm, điểm đang giữ chỗ, hạng doanh số và trạng thái chính sách. Giá trị chưa xác định trả `null`, không đổi thành 0. Response `Cache-Control: no-store`.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Loyalty balance",
  "result": {
    "customerId": 42,
    "balancePoints": 150,
    "heldPoints": 10,
    "availablePoints": 140,
    "cumulativePaidSales": 2500000.00,
    "salesTierId": 2,
    "salesTierName": "Bạc",
    "salesTierStatus": "KNOWN",
    "openingRecorded": true,
    "policyStatus": "ENABLED",
    "currentPolicyId": 7,
    "currentPolicyVersion": 2
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

| Trường | Mô tả |
| :--- | :--- |
| `availablePoints` | `balancePoints - heldPoints`; không cần opening. `openingRecorded` chỉ cho biết đã có bút toán `OPENING` (tự ghi khi khách đổi điểm lần đầu) |
| `cumulativePaidSales` | Tổng thực trả trừ các khoản đã hoàn (V28); `null` nếu chưa đủ lịch sử hóa đơn |
| `salesTierStatus` | `HISTORY_UNKNOWN`, `NO_CONFIGURED_THRESHOLDS`, `KNOWN` |
| `policyStatus` | `UNCONFIGURED`, `DISABLED`, `ENABLED` |

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Tài khoản chưa có hồ sơ khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 12. Xem lịch sử điểm của tôi (FR-18)

- **Endpoint:** `GET /api/v1/thanh-vien/lich-su`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Sổ cái điểm của chính khách hàng, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang, tối thiểu `0` (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, `1` - `100` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Loyalty history",
  "result": {
    "content": [
      {
        "entryId": 301,
        "type": "EARN",
        "points": 5,
        "orderId": 1001,
        "occurredAt": "2026-11-05T09:00:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- `type`: `OPENING` (ghi nhận điểm cũ), `HOLD`, `RELEASE`, `REDEEM`, `EARN`, `RETURN_REVERSE` (thu hồi điểm đơn trả, số không âm; có thể 0 khi thiếu điểm), `RETURN_REDEEM` (hoàn điểm đã đổi), `ADJUST` (cửa hàng điều chỉnh thủ công; `points` có dấu, âm là trừ điểm). Lý do, ghi chú nội bộ và người thực hiện không bao giờ trả về cho khách hàng.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy hồ sơ khách hàng (`CUSTOMER_NOT_FOUND`).
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** `page` / `size` ngoài miền cho phép.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.

---

## 13. Xem chính sách tích điểm của tôi

- **Endpoint:** `GET /api/v1/thanh-vien/chinh-sach-cua-toi`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Số dư của chính mình kèm chính sách hiện hành và các ngưỡng hạng doanh số.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Customer loyalty policy",
  "result": {
    "balance": { "customerId": 42, "balancePoints": 150, "heldPoints": 0, "availablePoints": 150, "cumulativePaidSales": 2500000.00, "salesTierId": 2, "salesTierName": "Bạc", "salesTierStatus": "KNOWN", "openingRecorded": true, "policyStatus": "ENABLED", "currentPolicyId": 7, "currentPolicyVersion": 2 },
    "policy": {
      "policyId": 7,
      "version": 2,
      "earnCurrencyPerPoint": 100000.00,
      "redeemCurrencyPerPoint": 1000.00,
      "status": "ENABLED",
      "createdAt": null
    },
    "tiers": [
      { "tierId": 1, "name": "Đồng", "minimumCumulativePaidSales": 0.00, "version": 1 }
    ]
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy hồ sơ khách hàng (`CUSTOMER_NOT_FOUND`).
- **Mã và thông báo mặc định trong `ErrorCode`:** `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.

---

## 14. Xem số dư điểm của khách hàng

- **Endpoint:** `GET /api/v1/thanh-vien/khach-hang/{customerId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CUSTOMER_VIEW`
- **Mô tả:** Tra cứu số dư điểm và hạng của một khách hàng (không trả lịch sử sổ cái). Cùng dạng `result` như mục 11.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Customer loyalty balance",
  "result": {
    "customerId": 42,
    "balancePoints": 150,
    "heldPoints": 0,
    "availablePoints": 150,
    "cumulativePaidSales": 2500000.00,
    "salesTierId": 2,
    "salesTierName": "Bạc",
    "salesTierStatus": "KNOWN",
    "openingRecorded": true,
    "policyStatus": "ENABLED",
    "currentPolicyId": 7,
    "currentPolicyVersion": 2
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 15. Xem lịch sử chính sách tích điểm (FR-18)

- **Endpoint:** `GET /api/v1/thanh-vien/chinh-sach`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_POLICY_VIEW`
- **Mô tả:** Lịch sử các phiên bản chính sách, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang, tối thiểu `0` (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, `1` - `100` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Loyalty policies",
  "result": {
    "content": [
      {
        "policyId": 7,
        "version": 2,
        "earnCurrencyPerPoint": 100000.00,
        "redeemCurrencyPerPoint": 1000.00,
        "status": "ENABLED",
        "createdAt": "2026-11-01T10:00:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 16. Tạo chính sách tích điểm (FR-18)

- **Endpoint:** `POST /api/v1/thanh-vien/chinh-sach`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_POLICY_MANAGE`
- **Mô tả:** Tạo phiên bản chính sách mới; mặc định `DISABLED`, muốn bật phải gửi `ENABLED` rõ ràng. Chỉ có tối đa một chính sách `ENABLED`.

### Request Body
```json
{
  "earnCurrencyPerPoint": 100000.00,
  "redeemCurrencyPerPoint": 1000.00,
  "status": "DISABLED"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `earnCurrencyPerPoint` | Decimal | Có | Số tiền để được 1 điểm, `>= 0.01`, tối đa 2 chữ số thập phân |
| `redeemCurrencyPerPoint` | Decimal | Có | Giá trị tiền của 1 điểm khi đổi, `>= 0.01`, tối đa 2 chữ số thập phân |
| `status` | String | Không | `ENABLED`, `DISABLED` (mặc định `DISABLED`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Loyalty policy created",
  "result": {
    "policyId": 8,
    "version": 1,
    "earnCurrencyPerPoint": 100000.00,
    "redeemCurrencyPerPoint": 1000.00,
    "status": "DISABLED",
    "createdAt": "2026-11-05T09:00:00"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Tỷ lệ hoặc trạng thái không hợp lệ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 17. Cập nhật chính sách tích điểm (FR-18)

- **Endpoint:** `PUT /api/v1/thanh-vien/chinh-sach/{policyId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_POLICY_MANAGE`
- **Mô tả:** Ghi phiên bản mới (bất biến) của chính sách; phải gửi đúng `version` hiện hành.

### Request Body
```json
{
  "version": 2,
  "earnCurrencyPerPoint": 100000.00,
  "redeemCurrencyPerPoint": 1000.00,
  "status": "ENABLED"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `version` | Long | Có | Phiên bản hiện hành (`> 0`) |
| `earnCurrencyPerPoint` | Decimal | Có | `>= 0.01`, tối đa 2 chữ số thập phân |
| `redeemCurrencyPerPoint` | Decimal | Có | `>= 0.01`, tối đa 2 chữ số thập phân |
| `status` | String | Có | `ENABLED`, `DISABLED` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Loyalty policy updated",
  "result": {
    "policyId": 7,
    "version": 3,
    "earnCurrencyPerPoint": 100000.00,
    "redeemCurrencyPerPoint": 1000.00,
    "status": "ENABLED",
    "createdAt": "2026-11-05T09:00:00"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `RESOURCE_NOT_FOUND` (404): “Không tìm thấy tài nguyên.”; `LOYALTY_POLICY_VERSION_CHANGED` (4206): “Chính sách điểm đã thay đổi. Tải lại trước khi lưu.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ.
- **HTTP 404 Not Found:** Không tìm thấy chính sách.
- **HTTP 409 Conflict:** Phiên bản đã đổi, tải lại trước khi lưu (`4206 LOYALTY_POLICY_VERSION_CHANGED`).

---

## 18. Xem ngưỡng hạng doanh số (FR-19)

- **Endpoint:** `GET /api/v1/thanh-vien/chinh-sach/hang`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_POLICY_VIEW`
- **Mô tả:** Danh sách hạng theo ngưỡng doanh số tích lũy tăng dần.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Sales tiers",
  "result": [
    { "tierId": 1, "name": "Đồng", "minimumCumulativePaidSales": 0.00, "version": 1 },
    { "tierId": 2, "name": "Bạc", "minimumCumulativePaidSales": 2500000.00, "version": 1 }
  ],
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 19. Cập nhật ngưỡng hạng doanh số (FR-19)

- **Endpoint:** `PUT /api/v1/thanh-vien/chinh-sach/hang/{tierId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_POLICY_MANAGE`
- **Mô tả:** Đổi ngưỡng doanh số của một hạng; ngưỡng không âm, duy nhất và tăng nghiêm ngặt theo `tierId`.

### Request Body
```json
{
  "version": 1,
  "minimumCumulativePaidSales": 2500000.00
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `version` | Long | Có | Phiên bản hiện hành của hạng (`>= 0`) |
| `minimumCumulativePaidSales` | Decimal | Có | Ngưỡng doanh số tối thiểu (`>= 0`, 2 chữ số thập phân) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Sales tier updated",
  "result": { "tierId": 2, "name": "Bạc", "minimumCumulativePaidSales": 2500000.00, "version": 2 },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `RESOURCE_NOT_FOUND` (404): “Không tìm thấy tài nguyên.”; `LOYALTY_TIER_VERSION_CHANGED` (4207): “Hạng thành viên đã thay đổi. Tải lại trước khi lưu.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Ngưỡng không hợp lệ (âm, trùng hoặc sai thứ tự).
- **HTTP 404 Not Found:** Không tìm thấy hạng.
- **HTTP 409 Conflict:** Phiên bản đã đổi (`4207 LOYALTY_TIER_VERSION_CHANGED`).

---

## 20. Mở đầu số dư điểm cũ (FR-18)

- **Endpoint:** `POST /api/v1/quan-tri/thanh-vien/mo-dau`
- **Quyền hạn:** `ADMIN` (`STAFF (Quản lý)` không có quyền)
- **Mô tả:** Ghi nhận số dư điểm legacy hiện tại làm baseline đúng một lần cho khách hàng; không đổi số dư.

### Request Body
```json
{
  "customerId": 42
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `customerId` | Long | Có | ID khách hàng (`> 0`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Legacy balance opened",
  "result": {
    "customerId": 42,
    "openingRecorded": true,
    "openingPoints": 150,
    "entryId": 300,
    "occurredAt": "2026-11-05T09:00:00"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `OPENING_ALREADY_RECORDED` (4205): “Số dư điểm mở đầu đã được ghi nhận trước đó.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).
- **Ghi chú:** `points` của bút toán `OPENING` = số dư hiện tại trừ phần EARN/REDEEM đã có trong sổ cái, để tổng sổ cái khớp `balancePoints`. Khi khách đổi điểm lần đầu tại checkout, hệ thống tự ghi `OPENING` cùng giao dịch (cùng `sourceKey` `opening:<customerId>`), nên bước này của ADMIN là tùy chọn.
- **HTTP 409 Conflict:** Đã mở đầu trước đó (`4205 OPENING_ALREADY_RECORDED`) hoặc số dư không hợp lệ (`4208 LOYALTY_STATE_CONFLICT`).

---

## 21. Xuất CSV khách hàng (FR-10)

- **Endpoint:** `GET /api/v1/admin/csv/customers`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `DATA_EXPORT` và `CUSTOMER_VIEW`
- **Mô tả:** Xuất CSV toàn bộ khách hàng khớp bộ lọc của `GET /api/v1/users/customers` (mục 1), không chỉ trang hiện tại. Khách hàng đã xóa mềm không được xuất. Tệp UTF-8 **có BOM**, phân tách bằng **dấu phẩy**, CRLF, quote RFC 4180; header tiếng Việt. Tối đa **50.000 dòng**.

> Tệp chứa **dữ liệu cá nhân**: số điện thoại, địa chỉ và ngày sinh. Không lưu tệp trên máy chủ; FE hiển thị xác nhận trước khi tải và tên tệp không chứa dữ liệu cá nhân. Không xuất mật khẩu, token hay hash.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `keyword` | String | Không | Tên, số điện thoại hoặc email liên kết; tối đa 100 ký tự |
| `tierId` | Long | Không | Lọc theo hạng thành viên hiện tại |
| `salesTierId` | Long | Không | Lọc theo hạng doanh số |

### Response Thành công (HTTP 200 OK)
- `X-Export-Rows`: số dòng; `X-Content-Type-Options: nosniff`
- `Content-Type: text/csv; charset=UTF-8`
- `Content-Disposition: attachment; filename="khach-hang-YYYY-MM-DD.csv"`
- `Cache-Control: no-store`

| Cột | Nguồn |
| :--- | :--- |
| `Mã khách hàng`, `Họ`, `Tên`, `Giới tính`, `Số điện thoại`, `Ngày sinh`, `Địa chỉ`, `Điểm tích lũy`, `Hạng thành viên` | Hồ sơ khách hàng |
| `Tổng chi tiêu đã thanh toán`, `Hạng doanh số` | Tổng hóa đơn `PAID`; để trống khi lịch sử doanh số chưa đầy đủ |

- `Ngày sinh` theo `dd/MM/yyyy`; tiền là số nguyên, không dấu phân cách nghìn; giới tính bằng nhãn tiếng Việt.
- Ô văn bản bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR được thêm tiền tố `'`; ô số giữ nguyên dạng số.
- Dòng được ghi theo lô 500, sắp xếp theo mã khách hàng tăng dần; mỗi lô đọc hồ sơ và tổng chi tiêu bằng một truy vấn gộp, không N+1.

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** Bộ lọc sai kiểu/độ dài hoặc tập dữ liệu vượt 50.000 dòng.
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 22. Thùng rác khách hàng và hồ sơ nhân sự (FR-13, FR-17)

- **Endpoint:** `GET /api/v1/admin/trash/customers` · `GET /api/v1/admin/trash/employees`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `TRASH_VIEW`
- **Mô tả:** Danh sách hồ sơ khách hàng / nhân sự đã xóa mềm, mới xóa trước. Đọc bằng SQL gốc vì `@SQLRestriction("da_xoa = false")` ẩn các dòng này khỏi JPA. Dòng xóa trước khi có cột `ngay_xoa`/`nguoi_xoa` trả `deletedAt`/`deletedBy` là `null` và giao diện hiển thị "Không rõ". Phản hồi chỉ có trường mà danh sách khách hàng/nhân sự vẫn hiển thị (tên, số điện thoại, tài khoản liên kết) — **không** có mật khẩu, token hay CCCD đầy đủ. Tab tài khoản đăng nhập ở mục 13 của `api-auth.md` (chỉ `ADMIN`).

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `20`, tối đa `100`) |
| `sort` | String | Không | Pageable tiếp nhận tham số; truy vấn dịch vụ vẫn sắp xếp theo thời gian xóa |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách khách hàng đã xóa thành công",
  "result": {
    "content": [
      {
        "id": 61,
        "name": "Nguyễn An",
        "status": null,
        "publicationStatus": null,
        "productId": null,
        "productName": null,
        "color": null,
        "size": null,
        "barcode": null,
        "parentDeleted": false,
        "phone": "0901000001",
        "email": null,
        "role": null,
        "linkedUsername": "an.khach",
        "linkedAccountStatus": "LOCKED",
        "deletedAt": "2026-11-07T09:30:00",
        "deletedBy": "Trần Quản Lý",
        "deleteReason": "Khách yêu cầu"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-07T09:35:00"
}
```

- `linkedUsername`/`linkedAccountStatus` là tài khoản đăng nhập liên kết (nếu có) và trạng thái hiện tại của nó, kể cả `LOCKED`/`DELETED`; giúp giao diện nói đúng hệ quả khi khôi phục.

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `ADMIN`/`STAFF`.

---

## 23. Khôi phục khách hàng và hồ sơ nhân sự (FR-13, FR-17)

- **Endpoint:** `POST /api/v1/admin/trash/customers/{id}/restore` · `POST /api/v1/admin/trash/employees/{id}/restore`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `TRASH_RESTORE`
- **Mô tả:** Cập nhật có điều kiện `da_xoa = true` → `false` (kiểm tra đúng một dòng thay đổi) và xóa dấu vết xóa; các trạng thái khác của hồ sơ giữ nguyên.
  - **Không mở khóa tài khoản liên kết:** hồ sơ nhân sự bị khóa tài khoản khi nghỉ việc, hoặc hồ sơ khách hàng bị khóa tài khoản khi xóa, vẫn ở trạng thái `LOCKED` sau khi khôi phục. `ADMIN` quyết định bật lại ở màn hình tài khoản (mục 6 của `api-auth.md`).
  - `STAFF` không được khôi phục hồ sơ nhân sự liên kết tài khoản `ADMIN` (`ACCESS_DENIED`).
  - Từ chối khi tài khoản đăng nhập liên kết vẫn đang ở trong thùng rác — khôi phục tài khoản trước (mục 14 của `api-auth.md`).
  - Từ chối khi số điện thoại (khách hàng, nhân sự) hoặc số CCCD (nhân sự) đã được hồ sơ khác đang hoạt động sử dụng.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Khôi phục khách hàng thành công",
  "result": true,
  "timestamp": "2026-11-07T09:40:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `TRASH_ITEM_NOT_FOUND` (4407): “Không tìm thấy mục trong thùng rác”; `RESTORE_BLOCKED` (4406): “Không thể khôi phục đối tượng này”; `RESTORE_CONFLICT` (4405): “Không thể khôi phục vì dữ liệu đã trùng”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 404 Not Found:** Mục không còn trong thùng rác (`TRASH_ITEM_NOT_FOUND`).
- **HTTP 409 Conflict:** Tài khoản đăng nhập liên kết đang bị xóa (`RESTORE_BLOCKED`); trùng số điện thoại hoặc CCCD (`RESTORE_CONFLICT`).

---

## 24. Xem sổ cái điểm của khách hàng (quản trị)

- **Endpoint:** `GET /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/lich-su`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `CUSTOMER_VIEW`
- **Mô tả:** Sổ cái điểm của một khách hàng, mới nhất trước, kèm lý do, ghi chú nội bộ, người thực hiện và số dư sau mỗi dòng.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang, tối thiểu `0` (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, `1` - `100` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Customer loyalty history",
  "result": {
    "content": [
      {
        "entryId": 412,
        "type": "ADJUST",
        "points": -30,
        "delta": -30,
        "balanceAfter": 90,
        "orderId": null,
        "orderCode": null,
        "reasonCode": "BOI_THUONG",
        "note": "Khách phản ánh sai điểm",
        "actor": "admin",
        "occurredAt": "2026-11-08T10:30:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-08T10:30:00"
}
```

- `delta`: ảnh hưởng có dấu lên số dư (`EARN`, `ADJUST`, `RETURN_REDEEM` cộng theo dấu; `REDEEM`, `RETURN_REVERSE` trừ; `OPENING`, `HOLD`, `RELEASE` bằng `0`).
- `balanceAfter`: số dư ngay sau dòng này = số dư hiện tại trừ `delta` của các dòng mới hơn. Trả `null` khi chưa có `OPENING` và tổng hiệu ứng sổ cái không khớp số dư hiện tại.
- `reasonCode`: `BOI_THUONG`, `DIEU_CHINH_SAI_SOT`, `TANG_THEM`, `HOAN_DON`, `KHAC` (điều chỉnh) hoặc `TINH_LAI_DON` (bút toán `EARN` do tính lại điểm đơn).

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** `page` / `size` ngoài miền cho phép.
- **HTTP 403 Forbidden:** Không phải `ADMIN` hoặc `STAFF`.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 25. Điều chỉnh điểm thủ công (quản trị)

- **Endpoint:** `POST /api/v1/quan-tri/thanh-vien/khach-hang/{customerId}/dieu-chinh`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_ADJUST` (mặc định tắt)
- **Mô tả:** Cộng hoặc trừ điểm của khách hàng và ghi một bút toán `ADJUST` bất biến (sổ cái chỉ thêm, không sửa/xóa). Mỗi lần ghi nhận người thực hiện, số điểm, lý do, ghi chú và thời gian.

### Request Body
```json
{
  "delta": -30,
  "reasonCode": "BOI_THUONG",
  "note": "Khách phản ánh sai điểm",
  "requestId": "6f1c2a9e-3b7d-4c1a-9a55-0d2f8e4b7a10"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `delta` | Integer | Có | Số điểm thay đổi, có dấu, khác `0` |
| `reasonCode` | String | Có | `BOI_THUONG`, `DIEU_CHINH_SAI_SOT`, `TANG_THEM`, `HOAN_DON`, `KHAC` |
| `note` | String | Có khi `reasonCode = KHAC` | Tối đa 500 ký tự, chỉ nhân viên thấy |
| `requestId` | String | Có | 8-36 ký tự `[A-Za-z0-9-]`, khóa chống gửi trùng (`sourceKey` = `adjust:<requestId>`) |

### Response Thành công (HTTP 201 Created, HTTP 200 khi gửi lại cùng `requestId`)
```json
{
  "success": true,
  "code": 201,
  "message": "Points adjusted",
  "result": {
    "entryId": 412,
    "customerId": 42,
    "delta": -30,
    "balanceBefore": 120,
    "balanceAfter": 90,
    "reasonCode": "BOI_THUONG",
    "occurredAt": "2026-11-08T10:30:00",
    "replayed": false
  },
  "timestamp": "2026-11-08T10:30:00"
}
```

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `INVALID_REQUEST` (400): “Dữ liệu yêu cầu không hợp lệ.”; `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”; `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 400 Bad Request:** `errors[].reason` là một trong `NON_ZERO` (delta = 0), `INVALID_REASON`, `REQUIRED_FOR_OTHER` (thiếu ghi chú cho `KHAC`), `TOO_LONG`, `BELOW_ZERO` (số dư sau < 0), `BELOW_HELD` (số dư sau thấp hơn điểm đang giữ cho đơn chưa hoàn tất), `OVER_MAX` (vượt giới hạn Integer).
- **HTTP 403 Forbidden:** Thiếu quyền `LOYALTY_ADJUST`.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).
- **HTTP 409 Conflict:** Dùng lại `requestId` với `delta` khác (`4208 LOYALTY_STATE_CONFLICT`).
- **Ghi chú:** Khi gửi lại thành công, `balanceBefore` và `balanceAfter` đều là `null`. Khách còn số dư cũ chưa có `OPENING` vẫn điều chỉnh được; khi `OPENING` được ghi sau đó, `points` của nó = số dư hiện tại trừ phần EARN/ADJUST/REDEEM đã có trong sổ cái nên tổng sổ cái vẫn khớp số dư.

---

## 26. Xem trước tính lại điểm của đơn (quản trị)

- **Endpoint:** `GET /api/v1/quan-tri/thanh-vien/don-hang/{orderId}/tinh-lai-diem`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_ADJUST` (mặc định tắt)
- **Mô tả:** Cho đơn đã thanh toán nhưng chưa có bút toán `EARN` (`earn:<orderId>`): trả số điểm sẽ được cộng theo đúng công thức tích điểm thông thường (`floor(tiền thực trả / earnCurrencyPerPoint)`). Không ghi dữ liệu.
- **Chính sách áp dụng:** nếu đơn có chính sách điểm riêng (`loyalty_policy_id/version`), dùng đúng phiên bản đó (`policySource = ORDER_SNAPSHOT`, giống lúc thanh toán). Đơn tạo trước khi có chính sách dùng phiên bản hiện hành của chính sách đang `ENABLED` (`CURRENT_POLICY`).
- **Điều kiện:** đơn có khách hàng; trạng thái `CONFIRMED`, `PACKING`, `SHIPPING` hoặc `COMPLETED`; hóa đơn `PAID`; chưa có `EARN`; số điểm > 0; nếu đơn có dùng điểm thì khoản giữ điểm phải đã `CONSUMED`.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Earn recalculation preview",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-1001",
    "customerId": 42,
    "eligible": true,
    "reason": null,
    "paidAmount": 500000.00,
    "points": 20,
    "policyId": 81,
    "policyVersion": 1,
    "earnCurrencyPerPoint": 25000.00,
    "policySource": "CURRENT_POLICY",
    "balanceBefore": 100,
    "balanceAfter": 120,
    "applied": false
  },
  "timestamp": "2026-11-08T10:30:00"
}
```

- `reason` khi `eligible = false`: `NO_CUSTOMER`, `STATUS`, `NOT_PAID`, `ALREADY_EARNED`, `NO_POLICY`, `ZERO_POINTS`, `STATE_CONFLICT`.

### Response Lỗi thường gặp
- **Mã và thông báo mặc định trong `ErrorCode`:** `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”; `ORDER_NOT_FOUND` (404): “Không tìm thấy đơn hàng.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Không phải `ADMIN` hoặc `STAFF`.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).

---

## 27. Tính lại điểm của đơn (quản trị)

- **Endpoint:** `POST /api/v1/quan-tri/thanh-vien/don-hang/{orderId}/tinh-lai-diem`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `LOYALTY_ADJUST` (mặc định tắt)
- **Mô tả:** Ghi bút toán `EARN` còn thiếu qua cùng đường tích điểm với thanh toán thường (cùng công thức, cùng khóa `earn:<orderId>`). Khóa hàng đơn và hàng khách, kiểm tra lại điều kiện trong khóa, đặt `earned_points` của đơn, nên bấm lần hai hoặc luồng thanh toán thường chạy sau đó không bao giờ cộng thêm. Bút toán ghi `reasonCode = TINH_LAI_DON` và người thực hiện. Hạng thành viên tính từ doanh số đã thanh toán nên không có bước nâng hạng riêng.
- **Request Body:** không có (hoặc `{}`).

### Response Thành công (HTTP 200 OK)
Cùng cấu trúc mục 26, với `message` là `Earn recalculated`. Lần ghi thành công có `applied = true`, `balanceBefore` / `balanceAfter` là số dư trước và sau. Gọi lại khi đã có `EARN` trả `eligible = false`, `reason = ALREADY_EARNED`, `applied = false` và không đổi số dư.

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Khách hàng của đơn không còn tồn tại (`CUSTOMER_NOT_FOUND`).
- **HTTP 409 Conflict:** Trạng thái điểm không hợp lệ (`LOYALTY_STATE_CONFLICT`).
- **Mã và thông báo mặc định trong `ErrorCode`:** `ACCESS_DENIED` (403): “Bạn không có quyền truy cập tài nguyên này.”; `UNAUTHENTICATED` (401): “Bạn cần đăng nhập để truy cập tài nguyên này.”; `ORDER_NOT_FOUND` (404): “Không tìm thấy đơn hàng.”; `CUSTOMER_NOT_FOUND` (404): “Không tìm thấy khách hàng.”; `LOYALTY_STATE_CONFLICT` (4208): “Trạng thái điểm đã thay đổi. Tải lại và thử lại.”. Thông báo thực tế có thể được dịch vụ thay bằng thông báo cụ thể.
- **HTTP 403 Forbidden:** Không phải `ADMIN` hoặc `STAFF`.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).

### Lọc hạng doanh số sau hoàn (R1F)
CustomerSpecifications salesTierId và Export CSV khách dùng hóa đơn PAID/REFUNDED trừ tổng yêu cầu REFUNDED. Hóa đơn hoàn đủ vẫn là giao dịch đã thanh toán rồi hoàn, đóng góp net 0. Chi tiết đơn bổ sung paidAmount/refundedAmount; [quy tắc đổi/trả](./api-return.md).
