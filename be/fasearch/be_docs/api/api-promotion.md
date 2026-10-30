# TÀI LIỆU API: MODULE PROMOTION (KHUYẾN MÃI & MÃ GIẢM GIÁ)

Module `promotion` phụ trách cấu hình các chiến dịch ưu đãi, giảm giá phần trăm hoặc theo số tiền cố định, phát hành voucher và kiểm tra điều kiện áp dụng mã giảm giá khi tạo đơn hàng.

---

## 1. Xem danh sách chương trình khuyến mãi (FR-44)

- **Endpoint:** `GET /api/v1/promotions`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`, `ADMIN`
- **Mô tả:** Lấy danh sách các đợt khuyến mãi đang chạy hoặc sắp diễn ra.
- **Query Parameters:**
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).
  - `status`: Lọc theo trạng thái (`UPCOMING`, `ACTIVE`, `EXPIRED`, `DISABLED`).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách khuyến mãi thành công",
  "result": {
    "content": [
      {
        "promotionId": 1,
        "promotionName": "Chào Hè Sôi Động 2026",
        "discountType": "PERCENTAGE",
        "discountValue": 10.00,
        "startDate": "2026-05-01T00:00:00",
        "endDate": "2026-06-30T23:59:59",
        "status": "ACTIVE",
        "termsCondition": "Áp dụng cho hóa đơn từ 500,000 VND trở lên"
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

## 2. Thêm mới chương trình khuyến mãi & Mã Voucher (FR-45)

- **Endpoint:** `POST /api/v1/promotions`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Khởi tạo chiến dịch ưu đãi mới và tự động sinh danh sách mã voucher phát hành kèm số lượng giới hạn.

### Request Body
```json
{
  "promotionName": "Siêu Sale Black Friday 2026",
  "discountType": "FIXED_AMOUNT",
  "discountValue": 100000.00,
  "startDate": "2026-11-20T00:00:00",
  "endDate": "2026-11-30T23:59:59",
  "termsCondition": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
  "voucher": {
    "voucherCode": "BF2026",
    "totalIssuance": 500
  }
}
```

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo chương trình khuyến mãi thành công",
  "result": {
    "promotionId": 2,
    "promotionName": "Siêu Sale Black Friday 2026",
    "voucherCode": "BF2026",
    "totalIssuance": 500,
    "usedCount": 0,
    "status": "UPCOMING"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Sửa & Tạm dừng chương trình khuyến mãi (FR-46)

### 3.1. Cập nhật thông tin khuyến mãi
- **Endpoint:** `PUT /api/v1/promotions/{id}`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Thay đổi điều kiện áp dụng, thời gian diễn ra hoặc giá trị chiết khấu.

### 3.2. Tạm dừng / Kích hoạt lại khuyến mãi
- **Endpoint:** `PATCH /api/v1/promotions/{id}/status`
- **Quyền hạn:** `ADMIN`
- **Request Body:**
```json
{
  "status": "DISABLED",
  "reason": "Hết ngân sách khuyến mãi đợt 1"
}
```

---

## 4. Xác thực mã giảm giá (Voucher Validation) (FR-47)

- **Endpoint:** `POST /api/v1/promotions/validate-voucher`
- **Quyền hạn:** `CUSTOMER`, `STAFF`, `SYSTEM`
- **Mô tả:** Kiểm tra voucher có hợp lệ hay không trước khi áp dụng vào đơn hàng (kiểm tra hạn dùng, số lượt còn lại và giá trị đơn hàng tối thiểu).

### Request Body
```json
{
  "voucherCode": "BF2026",
  "orderTotalAmount": 600000.00
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Mã voucher hợp lệ",
  "result": {
    "voucherCode": "BF2026",
    "isValid": true,
    "discountType": "FIXED_AMOUNT",
    "discountAmount": 100000.00,
    "remainingUses": 482
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Khi Voucher không hợp lệ (HTTP 400 Bad Request)
```json
{
  "success": false,
  "code": 400,
  "message": "Mã voucher đã hết lượt sử dụng hoặc chưa đến thời gian áp dụng",
  "result": {
    "voucherCode": "BF2026",
    "isValid": false
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```
