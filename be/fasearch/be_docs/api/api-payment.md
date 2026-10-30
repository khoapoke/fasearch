# TÀI LIỆU API: MODULE PAYMENT (THANH TOÁN & HÓA ĐƠN)

Module `payment` xử lý tính tiền tổng thể hóa đơn (kết hợp khuyến mãi, điểm thưởng), tiếp nhận thanh toán qua nhiều phương thức (Tiền mặt, Chuyển khoản ngân hàng, VNPAY QR, Ví MoMo) và xuất hóa đơn bán lẻ.

---

## 1. Tính toán giá trị thanh toán (FR-42)

- **Endpoint:** `POST /api/v1/payments/calculate`
- **Quyền hạn:** `STAFF`, `CUSTOMER`, `SYSTEM`
- **Mô tả:** Nhận danh sách sản phẩm, mã giảm giá và số điểm tích lũy muốn dùng để tính toán số tiền thực trả cuối cùng kèm mức thuế VAT.

### Request Body
```json
{
  "orderId": 1001,
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 50
}
```

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tính toán hóa đơn thành công",
  "result": {
    "subTotal": 630000.00,
    "voucherDiscount": 63000.00,
    "pointDiscount": 50000.00,
    "shippingFee": 30000.00,
    "taxVat": 43760.00,
    "finalAmount": 547000.00
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Danh sách phương thức thanh toán hỗ trợ (FR-43)

- **Endpoint:** `GET /api/v1/payments/methods`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phương thức thanh toán thành công",
  "result": [
    {
      "methodId": 1,
      "methodCode": "CASH",
      "methodName": "Tiền mặt tại quầy",
      "status": "ACTIVE"
    },
    {
      "methodId": 2,
      "methodCode": "BANK_TRANSFER",
      "methodName": "Chuyển khoản qua số tài khoản ngân hàng",
      "status": "ACTIVE"
    },
    {
      "methodId": 3,
      "methodCode": "VNPAY_QR",
      "methodName": "Thanh toán quét mã VNPAY QR",
      "status": "ACTIVE"
    },
    {
      "methodId": 4,
      "methodCode": "MOMO",
      "methodName": "Ví điện tử MoMo",
      "status": "ACTIVE"
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Thực hiện thanh toán & Xuất hóa đơn (FR-43)

- **Endpoint:** `POST /api/v1/payments/process`
- **Quyền hạn:** `STAFF`, `CUSTOMER`
- **Mô tả:** Tiếp nhận thanh toán (tiền mặt tại quầy hoặc xác nhận chuyển khoản), lập tức xuất hóa đơn bán lẻ `hoa_don`, trừ tồn kho thực tế và chuyển trạng thái đơn hàng sang `PAID` / `COMPLETED`.

### Request Body
```json
{
  "orderId": 1001,
  "paymentMethodCode": "CASH",
  "amountPaid": 550000.00,
  "note": "Khách đưa 550,000đ - Tiền thừa trả lại: 3,000đ"
}
```

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thanh toán và xuất hóa đơn thành công",
  "result": {
    "invoiceId": 801,
    "invoiceCode": "HD-20261025-001",
    "orderId": 1001,
    "totalActualPaid": 547000.00,
    "vatAmount": 43760.00,
    "cashReceived": 550000.00,
    "cashChange": 3000.00,
    "paymentStatus": "PAID",
    "issuedAt": "2026-10-25T15:35:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 4. Tích hợp Cổng thanh toán VNPAY QR

### 4.1. Tạo URL thanh toán VNPAY
- **Endpoint:** `POST /api/v1/payments/vnpay/create-payment-url`
- **Quyền hạn:** `CUSTOMER`, `STAFF`
- **Request Body:**
```json
{
  "orderId": 1001,
  "amount": 547000.00,
  "bankCode": ""
}
```
- **Response Thành công (HTTP 200 OK):**
```json
{
  "success": true,
  "code": 200,
  "message": "Tạo URL thanh toán VNPAY thành công",
  "result": {
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=54700000&vnp_Command=pay&vnp_CreateDate=20261025153500&vnp_CurrCode=VND&vnp_TxnRef=1001..."
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### 4.2. Xử lý IPN / Callback từ VNPAY
- **Endpoint:** `GET /api/v1/payments/vnpay/callback`
- **Quyền hạn:** `PUBLIC` (Server-to-Server từ VNPAY Gateway)
- **Mô tả:** Nhận kết quả giao dịch thanh toán từ VNPAY, kiểm tra chữ ký số `vnp_SecureHash`, tự động cập nhật trạng thái hóa đơn sang `PAID`.
