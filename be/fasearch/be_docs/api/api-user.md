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
  - `tierId`: Lọc theo ID hạng thành viên legacy (`maHang`), không thay đổi nghĩa cũ.
  - `salesTierId`: Lọc theo ngưỡng doanh số tích lũy đã cấu hình; chỉ khách hàng có `salesHistoryComplete=true` được tính.

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
    "tierName": "Bạc",
    "cumulativePaidSales": null,
    "salesTierId": null,
    "salesTierName": null,
    "salesTierStatus": "HISTORY_UNKNOWN"
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

- **Endpoint:** `PATCH /api/v1/users/customers/{id}` (hoặc `PUT`)
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`
- **Mô tả:** Cập nhật từng phần (Partial Update) thông tin cá nhân như Họ tên, Ngày sinh, Địa chỉ, Giới tính (chỉ cập nhật các trường được gửi lên, giữ nguyên các trường null).

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
- **Quyền hạn:** `ADMIN`, `STAFF`
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
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Query Parameters:** `page`, `size`, `sort`, `keyword` (Tên/SĐT/CCCD).

### 7.2. Thêm mới nhân viên (FR-16)
- **Endpoint:** `POST /api/v1/users/employees`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Phân quyền (Quản lý):** `STAFF` (Quản lý) chỉ được tạo/sửa **hồ sơ** nhân sự; gửi `accountId` (liên kết tài khoản đăng nhập) yêu cầu `ADMIN`, nếu không trả `403 ACCESS_DENIED`.
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
- **Endpoint:** `PATCH /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Phân quyền (Quản lý):** `STAFF` không được đổi liên kết `accountId` (giá trị trùng liên kết hiện tại thì bỏ qua); đổi liên kết yêu cầu `ADMIN` (`403`).
- **Mô tả:** cập nhật từng phần (partial part) cho nhân viên tránh việc không để field bị cập nhật thành null hết
### 7.4. Xóa mềm nhân viên (FR-17)
- **Endpoint:** `DELETE /api/v1/users/employees/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF`
- **Phân quyền (Quản lý):** hồ sơ đang liên kết tài khoản đăng nhập khi xóa sẽ khóa tài khoản đó, nên chỉ `ADMIN` xóa được hồ sơ có liên kết; `STAFF` chỉ xóa hồ sơ chưa liên kết tài khoản (`403` nếu vi phạm).
- **Mô tả:** Đánh dấu nhân viên nghỉ việc (`da_xoa = true`), đồng thời khóa tài khoản tương ứng.

---

## 8. Khách hàng thân thiết & Tích điểm (FR-18, FR-19, FR-20; S2 contract v1.4)

> Các ví dụ lịch sử về đổi điểm theo tỷ lệ cố định hoặc nâng hạng theo `thresholdPoint` không còn là quy tắc thực thi. S2 dùng policy version được ADMIN cấu hình, opening baseline một lần, số dư điểm legacy giữ nguyên, và ngưỡng hạng dựa trên doanh số hóa đơn thực trả. Không tự suy diễn tỷ lệ mặc định hoặc coi lịch sử chưa đủ là 0.

### 8.1. Số dư và lịch sử của chính khách hàng
- `GET /api/v1/thanh-vien` — `CUSTOMER`, lấy customer từ JWT; không nhận customerId.
- `GET /api/v1/thanh-vien/lich-su?page=0&size=20` — `CUSTOMER`, ledger của chính khách hàng, mới nhất trước, `size` tối đa 100.
- `GET /api/v1/thanh-vien/khach-hang/{customerId}` — `STAFF`, `ADMIN`, chỉ tra cứu số dư, không trả lịch sử ledger.

Các trường số dư gồm `customerId`, `balancePoints`, `heldPoints`, `availablePoints`, `cumulativePaidSales`, `salesTierId`, `salesTierName`, `salesTierStatus`, `openingRecorded`, `policyStatus`, `currentPolicyId`, `currentPolicyVersion`. `availablePoints` là `null` trước opening; `cumulativePaidSales` là `null` nếu chưa chứng minh được độ bao phủ invoice; `salesTierStatus` là `HISTORY_UNKNOWN`, `NO_CONFIGURED_THRESHOLDS` hoặc `KNOWN`; `policyStatus` là `UNCONFIGURED`, `DISABLED` hoặc `ENABLED`. Các giá trị không biết được trả về tường minh là `null`, không biến thành zero.

Ledger item: `{entryId,type,points,orderId,occurredAt}`, với type `OPENING`, `HOLD`, `RELEASE`, `REDEEM`, `EARN`. `OPENING` chỉ ghi nhận điểm cũ, không cộng lại số dư; HOLD/RELEASE thay đổi điểm giữ chỗ, không thay đổi net balance.

### 8.2. Cấu hình policy và ngưỡng doanh số (ADMIN)
- `GET /api/v1/thanh-vien/chinh-sach-cua-toi` — `CUSTOMER`, projection an toàn gồm balance của chính mình, policy hiện hành (`policyId/version/earn/redeem/status`) và danh sách tier thresholds; không cấp quyền admin.
- `GET /api/v1/thanh-vien/chinh-sach?page=0&size=20` — `ADMIN`, lịch sử version, `PageResponse` mới nhất trước.
- `POST /api/v1/thanh-vien/chinh-sach` — body `{ "earnCurrencyPerPoint":100000.00, "redeemCurrencyPerPoint":1000.00, "status":"DISABLED" }`; status mặc định `DISABLED`, kích hoạt phải rõ ràng.
- `PUT /api/v1/thanh-vien/chinh-sach/{policyId}` — yêu cầu `version` hiện hành và cả hai rate/status mới; ghi version mới bất biến. Rate phải `>0`, tối đa hai chữ số thập phân, nằm trong `DECIMAL(19,2)`. Chỉ có tối đa một policy `ENABLED`.
- `GET /api/v1/thanh-vien/chinh-sach/hang` — `ADMIN`, danh sách `{tierId,name,minimumCumulativePaidSales,version}` theo ngưỡng tăng dần rồi tierId.
- `PUT /api/v1/thanh-vien/chinh-sach/hang/{tierId}` — body `{ "version":1, "minimumCumulativePaidSales":2500000.00 }`; ngưỡng không âm, duy nhất, tăng nghiêm ngặt theo tierId.
- `POST /api/v1/quan-tri/thanh-vien/mo-dau` — `ADMIN`, body `{ "customerId":42 }`; ghi opening baseline hiện tại đúng một lần, không thay số dư.

Policy response: `{policyId,version,earnCurrencyPerPoint,redeemCurrencyPerPoint,status,createdAt}`. Sales tier là ngưỡng cao nhất không vượt cumulative paid sales; không thay đổi `tierId`, `tierName` hay `thresholdPoint` legacy.

### 8.3. Hồ sơ khách hàng và lỗi ổn định
`GET /api/v1/users/customers` và `GET /api/v1/users/customers/{id}` giữ nguyên fields cũ, bổ sung `cumulativePaidSales`, `salesTierId`, `salesTierName`, `salesTierStatus`. Filter mới `salesTierId` độc lập với filter legacy `tierId`. Write request không nhận điểm/tier.

Cumulative paid sales là tổng `Invoice.totalActualPaid` có trạng thái `PAID`, gồm shipping nếu đã nằm trong invoice, không gồm tender/change. Redemption không trừ doanh số lịch sử. Khách hàng chưa đủ lịch sử được đánh dấu `HISTORY_UNKNOWN` và trả sales null.

S2 business code không đồng nhất với HTTP status: `4201 LEGACY_OPENING_REQUIRED`, `4202 LOYALTY_POLICY_UNAVAILABLE`, `4203 LOYALTY_POLICY_DISABLED`, `4204 INSUFFICIENT_POINTS`, `4205 OPENING_ALREADY_RECORDED`, `4206 LOYALTY_POLICY_VERSION_CHANGED`, `4207 LOYALTY_TIER_VERSION_CHANGED`, `4208 LOYALTY_STATE_CONFLICT` đều dùng HTTP 409. `4107 QUOTE_CHANGED` và `4108 IDEMPOTENCY_CONFLICT` cũng HTTP 409. Malformed/fractional/negative/overflow point hoặc policy inputs là HTTP 400. Lỗi S2 trả `Cache-Control: no-store`.
