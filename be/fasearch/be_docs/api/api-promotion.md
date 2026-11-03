# TÀI LIỆU API: MODULE PROMOTION (KHUYẾN MÃI & MÃ GIẢM GIÁ)

Module `promotion` phụ trách cấu hình các chiến dịch ưu đãi, giảm giá phần trăm hoặc theo số tiền cố định, phát hành voucher và kiểm tra điều kiện áp dụng mã giảm giá khi tạo đơn hàng.

---

## 1. Xem danh sách ưu đãi công khai (FR-44)

- **Endpoint:** `GET /api/v1/promotions`
- **Quyền hạn:** `PUBLIC` (không cần Bearer).
- **Mô tả:** Trả các ưu đãi đang hiệu lực, đang hoạt động và còn lượt mã. Không trả campaign tạm dừng, đã xóa, hết hạn, hết lượt, mã bị khóa hoặc số liệu quản trị nội bộ.
- **Query Parameters:** Không có. Endpoint trả tối đa một mã còn khả dụng cho mỗi campaign.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách ưu đãi công khai thành công",
  "result": [
    {
      "campaignId": 1,
      "title": "Ưu đãi chào mừng",
      "discountType": "PHAN_TRAM",
      "discountValue": 10.00,
      "conditionText": "Áp dụng cho mọi đơn hàng",
      "startAt": "2026-11-01T04:26:53",
      "endAt": "2026-12-02T04:26:53",
      "code": "WELCOME2026"
    }
  ],
  "errors": null,
  "timestamp": "2026-11-02T11:30:00"
}
```

- Schema hiện tại không có cờ targeted/private cho mã; endpoint chỉ công bố campaign công khai đang hoạt động. `POST /api/v1/cart/quote` và checkout vẫn là nơi quyết định điều kiện/giá trị cuối cùng.
- Không có trường minimum-order/cap riêng trong schema; không tự tạo giá trị.

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

## 5. Báo giá giỏ hàng với voucher và điểm S2

- **Endpoint:** `POST /api/v1/cart/quote`
- **Quyền hạn:** `CUSTOMER`; customer được xác định từ JWT.
- **Request Body:**
```json
{ "voucherCode": "SAVE10", "redeemedPoints": 2 }
```
`redeemedPoints` tùy chọn, mặc định 0; phải là số nguyên không âm trong miền signed 32-bit. Báo giá chỉ đọc, không giữ voucher quota, điểm hoặc tồn kho. Voucher được áp dụng trước; điểm giảm trên tổng merchandise còn lại, gồm cả dòng không đủ điều kiện voucher. Không giảm shipping và không làm `shippingFee` thành đầu vào authoritative.

- **Response (HTTP 200):**
```json
{
  "success": true,
  "code": 200,
  "message": "Quote calculated",
  "result": {
    "items": [{"skuId":11,"productName":"Item","quantity":1,"unitPrice":10000.00,"totalPrice":10000.00,"discountAmount":1000.00,"pointsDiscountAmount":2000.00}],
    "subTotal":10000.00,"voucherCode":"SAVE10","voucherDiscount":1000.00,
    "remainingMerchandiseAmount":9000.00,"redeemedPoints":2,"pointsDiscount":2000.00,
    "allowedRedeemedPoints":9,"availablePoints":20,"policyStatus":"ENABLED",
    "loyaltyPolicyId":7,"loyaltyPolicyVersion":2,"redeemCurrencyPerPoint":1000.00,
    "merchandiseAmountDue":7000.00,"quoteFingerprint":"opaque-server-token"
  },
  "errors": null,
  "timestamp": "2026-10-31T12:00:00"
}
```
`discountAmount` trên line vẫn là voucher allocation; `pointsDiscountAmount` là phân bổ điểm sau voucher. Fingerprint là token mờ do server phát sinh, bao gồm lines/customer/prices/voucher/policy/điểm/tổng merchandise; không gồm shipping và không phải bearer authorization token. Thiếu opening, policy unavailable/disabled hoặc vượt `allowedRedeemedPoints` với điểm dương trả HTTP 409 lần lượt business code `4201`, `4202`, `4203`, `4204`; lỗi 4204 nêu chính xác maximum hiện tại trong `errors`. Điểm âm, phân số hoặc overflow là HTTP 400. Response có `Cache-Control: no-store`.
