# TÀI LIỆU API: MODULE USER (NGƯỜI DÙNG, NHÂN SỰ & TÍCH ĐIỂM)

Module `user` quản lý thông tin khách hàng, nhân viên, quản trị viên, cơ chế tích điểm loyalty và nâng hạng thành viên.

---

## 1. Xem danh sách khách hàng (FR-10)

- **Endpoint:** `GET /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Lấy danh sách khách hàng có phân trang, hỗ trợ tìm kiếm theo Tên, SĐT, hoặc lọc theo Hạng thành viên.
- **Query Parameters:**
  - `page`: Số trang (0-indexed, mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).
  - `sort`: Tiêu chí sắp xếp (ví dụ: `id,desc`).
  - `keyword`: Tìm kiếm theo Họ tên hoặc SĐT.
  - `tierId`: Lọc theo ID hạng thành viên (`maHang`).

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
        "accumulatePoint": 150,
        "tierName": "Bạc"
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

---

## 2. Xem chi tiết khách hàng (FR-11)

- **Endpoint:** `GET /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER` (Khách hàng chỉ xem được hồ sơ của chính mình)
- **Mô tả:** Lấy thông tin chi tiết hồ sơ cá nhân và lịch sử tích điểm của một khách hàng.

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
    "tierName": "Bạc"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Thêm mới khách hàng (FR-12)

- **Endpoint:** `POST /api/v1/users/customers`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Mô tả:** Nhân viên tạo hồ sơ khách hàng mới trực tiếp tại quầy hoặc quản trị viên nhập dữ liệu.

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
    "accumulatePoint": 0,
    "tierName": "Đồng"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Cập nhật hồ sơ khách hàng (FR-12)

- **Endpoint:** `PUT /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`
- **Mô tả:** Thay đổi thông tin cá nhân như Họ tên, Ngày sinh, Địa chỉ, Giới tính.

### Request Body
```json
{
  "firstName": "Văn A Cập Nhật",
  "lastName": "Nguyễn",
  "gender": "MALE",
  "dob": "1995-05-15",
  "address": "999 Đường Nguyễn Huệ, Quận 1, TP.HCM"
}
```

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
    "address": "999 Đường Nguyễn Huệ, Quận 1, TP.HCM"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 5. Xóa mềm khách hàng (FR-13)

- **Endpoint:** `DELETE /api/v1/users/customers/{id}`
- **Quyền hạn:** `ADMIN`
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

---

## 6. Tra cứu nhanh khách hàng tại quầy POS (FR-14)

- **Endpoint:** `GET /api/v1/users/customers/lookup?phone={sdt}`
- **Quyền hạn:** `STAFF`
- **Mô tả:** Thu ngân nhập số điện thoại tại quầy POS để hiển thị ngay Họ tên, Điểm tích lũy và Chiết khấu hạng thành viên.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tra cứu khách hàng thành công",
  "result": {
    "id": 1,
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0987654321",
    "accumulatePoint": 150,
    "tierName": "Bạc",
    "discountPercent": 5.0
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 7. Quản lý Nhân viên (FR-15, FR-16, FR-17)

### 7.1. Xem danh sách nhân viên (FR-15)
- **Endpoint:** `GET /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`
- **Query Parameters:** `page`, `size`, `sort`, `keyword` (Tên/SĐT/CCCD).

### 7.2. Thêm mới nhân viên (FR-16)
- **Endpoint:** `POST /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`
- **Request Body:**
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

### 7.3. Cập nhật nhân viên (FR-16)
- **Endpoint:** `PUT /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`

### 7.4. Xóa mềm nhân viên (FR-17)
- **Endpoint:** `DELETE /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Đánh dấu nhân viên nghỉ việc (`da_xoa = true`), đồng thời khóa tài khoản tương ứng.

---

## 8. Khách hàng thân thiết & Tích điểm (FR-18, FR-19, FR-20)

### 8.1. Danh sách hạng thành viên & Quyền lợi (FR-19)
- **Endpoint:** `GET /api/v1/users/loyalty/tiers`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`
- **Response Thành công:**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách hạng thành viên thành công",
  "result": [
    {
      "tierId": 1,
      "tierName": "Đồng",
      "thresholdPoint": 0,
      "benefits": "Tích lũy 1% giá trị đơn hàng"
    },
    {
      "tierId": 2,
      "tierName": "Bạc",
      "thresholdPoint": 500,
      "benefits": "Giảm 5% toàn bộ hóa đơn"
    },
    {
      "tierId": 3,
      "tierName": "Vàng",
      "thresholdPoint": 2000,
      "benefits": "Giảm 10% toàn bộ hóa đơn"
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### 8.2. Đổi điểm tích lũy giảm trừ trực tiếp (FR-20)
- **Endpoint:** `POST /api/v1/users/loyalty/redeem`
- **Quyền hạn:** `CUSTOMER`, `STAFF`
- **Mô tả:** Đổi số điểm tích lũy của khách hàng thành số tiền khấu trừ vào hóa đơn (Quy đổi: 1 điểm = 1,000 VND).
- **Request Body:**
```json
{
  "customerId": 1,
  "pointsToRedeem": 50
}
```
- **Response Thành công:**
```json
{
  "success": true,
  "code": 200,
  "message": "Đổi điểm thành công",
  "result": {
    "customerId": 1,
    "pointsDeducted": 50,
    "discountAmount": 50000.00,
    "remainingPoints": 100
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```
