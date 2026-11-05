# TÀI LIỆU API: MODULE USER (NGƯỜI DÙNG, NHÂN SỰ & TÍCH ĐIỂM)

Module `user` quản lý thông tin khách hàng, nhân viên, quản trị viên, cơ chế tích điểm loyalty (`/thanh-vien`) và nâng hạng thành viên theo doanh số.

---

## 1. Xem danh sách khách hàng (FR-10)

- **Endpoint:** `GET /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Lấy danh sách khách hàng có phân trang, hỗ trợ tìm kiếm theo Tên, SĐT hoặc lọc theo Hạng thành viên.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (0-indexed, mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `id,desc`) |
| `keyword` | String | Không | Tìm theo Họ tên hoặc SĐT |
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
        "salesTierStatus": "HISTORY_UNKNOWN"
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
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 2. Xem chi tiết khách hàng (FR-11)

- **Endpoint:** `GET /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ xem hồ sơ của chính mình)
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
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** `CUSTOMER` xem hồ sơ của người khác.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 3. Thêm mới khách hàng (FR-12)

- **Endpoint:** `POST /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": "HISTORY_UNKNOWN"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc SĐT đã tồn tại (`PHONE_NUMBER_ALREADY_EXISTS`).
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 4. Cập nhật hồ sơ khách hàng (FR-12)

- **Endpoint:** `PATCH /api/v1/users/customers/{id}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ sửa hồ sơ của chính mình)
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
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": "HISTORY_UNKNOWN",
    "deliveryLatitude": 10.7769,
    "deliveryLongitude": 106.7009
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, tọa độ lệch cặp / ngoài miền hoặc SĐT đã tồn tại.
- **HTTP 403 Forbidden:** `CUSTOMER` sửa hồ sơ của người khác.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 5. Xóa mềm khách hàng (FR-13)

- **Endpoint:** `DELETE /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Cập nhật `da_xoa = true`, không xóa vật lý khỏi CSDL nhằm bảo toàn lịch sử hóa đơn.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa khách hàng thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 6. Xem danh sách nhân viên (FR-15)

- **Endpoint:** `GET /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 7. Xem chi tiết nhân viên (FR-15)

- **Endpoint:** `GET /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
    "gender": "MALE",
    "phoneNumber": "0901234567",
    "cccd": "079201001234",
    "dob": "1992-03-12",
    "address": "Quận Phú Nhuận, TP.HCM",
    "accountId": 2,
    "username": "staff01",
    "role": "STAFF"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy nhân viên (`EMPLOYEE_NOT_FOUND`).

---

## 8. Thêm mới nhân viên (FR-16)

- **Endpoint:** `POST /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, trùng SĐT / CCCD hoặc tài khoản đã liên kết nhân viên khác (`ACCOUNT_ALREADY_LINKED`).
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` gửi `accountId` (`ACCESS_DENIED`).
- **HTTP 404 Not Found:** Không tìm thấy tài khoản (`ACCOUNT_NOT_FOUND`).

---

## 9. Cập nhật nhân viên (FR-16)

- **Endpoint:** `PATCH /api/v1/users/employees/{id}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Cập nhật từng phần hồ sơ nhân viên. Đổi liên kết `accountId` chỉ `ADMIN` được phép (gửi lại đúng giá trị hiện tại thì bỏ qua).

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
    "gender": "MALE",
    "phoneNumber": "0907654321",
    "cccd": "079201001234",
    "dob": "1992-03-12",
    "address": "Quận 1, TP.HCM",
    "accountId": 2,
    "username": "staff01",
    "role": "STAFF"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, trùng SĐT / CCCD hoặc tài khoản đã liên kết (`ACCOUNT_ALREADY_LINKED`).
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` đổi `accountId` (`ACCESS_DENIED`).
- **HTTP 404 Not Found:** Không tìm thấy nhân viên (`EMPLOYEE_NOT_FOUND`) hoặc tài khoản.

---

## 10. Xóa mềm nhân viên (FR-17)

- **Endpoint:** `DELETE /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` (hồ sơ đã liên kết tài khoản chỉ `ADMIN` xóa được)
- **Mô tả:** Đánh dấu nhân viên nghỉ việc (`da_xoa = true`), đồng thời khóa tài khoản đăng nhập đã liên kết (nếu có).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa nhân viên thành công",
  "result": true,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** `STAFF (Quản lý)` xóa hồ sơ đang liên kết tài khoản (`ACCESS_DENIED`).
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

| Trường | Mô tả |
| :--- | :--- |
| `availablePoints` | `null` trước khi mở đầu (opening) |
| `cumulativePaidSales` | `null` nếu chưa đủ lịch sử hóa đơn |
| `salesTierStatus` | `HISTORY_UNKNOWN`, `NO_CONFIGURED_THRESHOLDS`, `KNOWN` |
| `policyStatus` | `UNCONFIGURED`, `DISABLED`, `ENABLED` |

### Response Lỗi thường gặp
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- `type`: `OPENING` (ghi nhận điểm cũ), `HOLD`, `RELEASE`, `REDEEM`, `EARN`.

### Response Lỗi thường gặp
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
    "balance": { "customerId": 42, "balancePoints": 150, "heldPoints": 0, "availablePoints": 150, "openingRecorded": true, "policyStatus": "ENABLED" },
    "policy": {
      "policyId": 7,
      "version": 2,
      "earnCurrencyPerPoint": 100000.00,
      "redeemCurrencyPerPoint": 1000.00,
      "status": "ENABLED",
      "createdAt": "2026-11-01T10:00:00"
    },
    "tiers": [
      { "tierId": 1, "name": "Đồng", "minimumCumulativePaidSales": 0.00, "version": 1 }
    ]
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.

---

## 14. Xem số dư điểm của khách hàng

- **Endpoint:** `GET /api/v1/thanh-vien/khach-hang/{customerId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 15. Xem lịch sử chính sách tích điểm (FR-18)

- **Endpoint:** `GET /api/v1/thanh-vien/chinh-sach`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 16. Tạo chính sách tích điểm (FR-18)

- **Endpoint:** `POST /api/v1/thanh-vien/chinh-sach`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tỷ lệ hoặc trạng thái không hợp lệ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 17. Cập nhật chính sách tích điểm (FR-18)

- **Endpoint:** `PUT /api/v1/thanh-vien/chinh-sach/{policyId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ.
- **HTTP 404 Not Found:** Không tìm thấy chính sách.
- **HTTP 409 Conflict:** Phiên bản đã đổi, tải lại trước khi lưu (`4206 LOYALTY_POLICY_VERSION_CHANGED`).

---

## 18. Xem ngưỡng hạng doanh số (FR-19)

- **Endpoint:** `GET /api/v1/thanh-vien/chinh-sach/hang`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 19. Cập nhật ngưỡng hạng doanh số (FR-19)

- **Endpoint:** `PUT /api/v1/thanh-vien/chinh-sach/hang/{tierId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không phải `ADMIN`.
- **HTTP 404 Not Found:** Không tìm thấy khách hàng (`CUSTOMER_NOT_FOUND`).
- **HTTP 409 Conflict:** Đã mở đầu trước đó (`4205 OPENING_ALREADY_RECORDED`) hoặc số dư không hợp lệ (`4208 LOYALTY_STATE_CONFLICT`).
