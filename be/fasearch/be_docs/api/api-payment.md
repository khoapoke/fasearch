# TÀI LIỆU API: MODULE PAYMENT (THANH TOÁN & HÓA ĐƠN)

Module `payment` xử lý tính tiền tổng thể hóa đơn (kết hợp khuyến mãi, điểm thưởng), tiếp nhận thanh toán tiền mặt tại quầy / khi nhận hàng, thanh toán trực tuyến qua cổng Stripe (test) và VNPAY (sandbox) và xuất hóa đơn bán lẻ.

Các ví dụ `ApiResponse` bỏ qua các trường envelope có giá trị `null` (bao gồm `errors`). Các thông báo lỗi dưới đây là thông báo mặc định trong `ErrorCode.java`; service có thể thay bằng thông báo cụ thể khi ném lỗi.

---

## 1. Tính toán giá trị thanh toán (FR-42)

- **Endpoint:** `POST /api/v1/payments/calculate`
- **Quyền hạn:** `CUSTOMER` hoặc authority `PERM_POS_USE` hoặc `PERM_ORDER_COLLECT_CASH`; khách chỉ tính đơn của mình, nhân viên cần `POS_USE` cho đơn POS và `ORDER_COLLECT_CASH` cho đơn khác
- **Mô tả:** Xem trước số tiền thực trả của đơn hàng sau voucher, điểm và phí vận chuyển kèm VAT. Chỉ để hiển thị: không sửa đơn, không giữ điểm/voucher.

### Request Body
```json
{
  "orderId": 1001,
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `voucherCode` | String | Không | Mã giảm giá |
| `redeemedPoints` | BigDecimal (Number) | Không | Số điểm muốn dùng (`>= 0`, số nguyên) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tính toán hóa đơn thành công",
  "result": {
    "subTotal": 630000.00,
    "redeemedPoints": 2,
    "voucherDiscount": 63000.00,
    "pointDiscount": 2000.00,
    "shippingFee": 30000.00,
    "taxVat": 47600.00,
    "finalAmount": 595000.00
  },
  "timestamp": "2026-10-31T12:00:00"
}
```

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`403 ACCESS_DENIED`:** Bạn không có quyền truy cập tài nguyên này.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`4107 QUOTE_CHANGED`:** Báo giá giỏ hàng đã thay đổi. Tải lại và xác nhận.

---

## 2. Danh sách phương thức thanh toán hỗ trợ (FR-43)

- **Endpoint:** `GET /api/v1/payments/methods`
- **Quyền hạn:** `PUBLIC`
- **Mô tả:** Trả các phương thức thanh toán đang `ACTIVE` trong CSDL.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách phương thức thanh toán thành công",
  "result": [
    {
      "id": 1,
      "methodCode": "CASH",
      "methodName": "Tiền mặt tại quầy",
      "status": "ACTIVE",
      "note": null
    },
    {
      "id": 2,
      "methodCode": "BANK_TRANSFER",
      "methodName": "Chuyển khoản qua số tài khoản ngân hàng",
      "status": "ACTIVE",
      "note": null
    }
  ],
  "timestamp": "2026-10-25T15:30:00"
}
```

- `methodCode`: `CASH`, `BANK_TRANSFER`, `E_WALLET`, `VNPAY_QR`, `MOMO`, `STRIPE`. Phương thức xuất hiện trong danh sách chưa chắc đã có cổng thanh toán tương ứng.

---

## 3. Thực hiện thanh toán & Xuất hóa đơn (FR-43)

- **Endpoint:** `POST /api/v1/payments/process`
- **Quyền hạn:** `CUSTOMER` hoặc authority `PERM_POS_USE` hoặc `PERM_ORDER_COLLECT_CASH`; khách chỉ thanh toán đơn của mình, nhân viên cần `POS_USE` cho đơn POS và `ORDER_COLLECT_CASH` cho đơn khác
- **Mô tả:** Thu tiền mặt và lập hóa đơn `hoa_don`; đơn POS DRAFT được trừ tồn kho và chuyển `COMPLETED`, đơn `PENDING` chuyển `CONFIRMED`. Chỉ nhận `CASH`; phương thức khác phải đi qua cổng thanh toán (mục 4 - 10). Gửi lại request POS y hệt trả lại hóa đơn cũ với HTTP 200.

### Request Body
```json
{
  "orderId": 1001,
  "paymentMethodCode": "CASH",
  "amountPaid": 600000.00,
  "note": "Khách đưa 600.000đ",
  "voucherCode": "SAVE10",
  "redeemedPoints": 2,
  "quoteFingerprint": "opaque-server-token"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `paymentMethodCode` | String | Có | Mã phương thức (`CASH`) |
| `amountPaid` | BigDecimal (Number) | Có | Số tiền khách đưa (`>= 0`) |
| `note` | String | Không | Ghi chú |
| `voucherCode` | String | Không | Chỉ đơn POS (`POS-...`), tối đa 50 ký tự |
| `redeemedPoints` | BigDecimal (Number) | Không | Chỉ đơn POS, số nguyên `>= 0` |
| `quoteFingerprint` | String | Không | Chỉ đơn POS, tối đa 64 ký tự, lấy từ `POST /api/v1/orders/pos/{orderId}/quote` |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thanh toán và xuất hóa đơn thành công",
  "result": {
    "invoiceId": 801,
    "invoiceCode": "HD-20261031-001",
    "orderId": 1001,
    "orderCode": "DH-20261031-001",
    "totalActualPaid": 595000.00,
    "vatAmount": 47600.00,
    "cashReceived": 600000.00,
    "cashChange": 5000.00,
    "paymentStatus": "PAID",
    "paymentMethod": "CASH",
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.00,
    "earnedPoints": 5,
    "note": "Khách đưa 600.000đ",
    "issuedAt": "2026-10-31T12:05:00"
  },
  "timestamp": "2026-10-31T12:05:00"
}
```

- Các trường điểm (`redeemedPoints` ... `earnedPoints`) là `null` với đơn không có snapshot loyalty. `totalActualPaid` là cơ sở tích điểm / xét hạng, không phải `cashReceived`.

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`400 ORDER_ALREADY_PAID`:** Đơn hàng đã thanh toán.
- **`400 PAYMENT_AMOUNT_INSUFFICIENT`:** Số tiền thanh toán không đủ để trả tổng hóa đơn.
- **`400 INSUFFICIENT_STOCK`:** Không đủ tồn kho cho SKU đã chọn.
- **`400 CART_EMPTY`:** Giỏ hàng đang trống.
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`403 ACCESS_DENIED`:** Bạn không có quyền truy cập tài nguyên này.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`404 PAYMENT_METHOD_NOT_FOUND`:** Không tìm thấy phương thức thanh toán.
- **`404 INVENTORY_NOT_FOUND`:** Không tìm thấy bản ghi kho.
- **`4107 QUOTE_CHANGED`:** Báo giá giỏ hàng đã thay đổi. Tải lại và xác nhận.
- **`4108 IDEMPOTENCY_CONFLICT`:** Khóa đặt hàng đã được dùng với dữ liệu khác.
- **`4105 VOUCHER_EXHAUSTED`:** Voucher đã hết lượt sử dụng.
- **`4202 LOYALTY_POLICY_UNAVAILABLE`:** Chưa cấu hình chính sách điểm.
- **`4203 LOYALTY_POLICY_DISABLED`:** Chính sách đổi điểm đang tắt.
- **`4204 INSUFFICIENT_POINTS`:** Số điểm yêu cầu vượt quá mức cho phép hiện tại.
- **`4208 LOYALTY_STATE_CONFLICT`:** Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **`500 INTERNAL_SERVER_ERROR`:** Đã xảy ra lỗi. Vui lòng thử lại sau.

---

## 4. Tạo Payment Attempt

- **Endpoint:** `POST /api/v1/payments/attempts`
- **Quyền hạn:** `CUSTOMER` (chỉ đơn của mình)
- **Mô tả:** Tạo lượt thanh toán trực tuyến cho đơn; số tiền lấy từ đơn hàng, không nhận từ client. Cùng `idempotencyKey` trả lại lượt cũ (xem mục 11).

### Request Body
```json
{
  "orderId": 1001,
  "provider": "STRIPE",
  "idempotencyKey": "pay-order-1001-STRIPE"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `provider` | String | Có | `STRIPE`, `VNPAY` |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn/cổng, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo payment attempt thành công",
  "result": {
    "id": 21,
    "orderId": 1001,
    "provider": "STRIPE",
    "status": "CREATED",
    "amount": 595000.00,
    "currency": "VND",
    "providerReference": "SKELETON-3f0c...",
    "checkoutUrl": null,
    "createdAt": "2026-11-05T09:00:00",
    "expiresAt": null
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- `status`: `CREATED`, `PENDING`, `SETTLEMENT_PENDING`, `SETTLED`, `FAILED`, `CANCELLED`, `EXPIRED`, `REVIEW_REQUIRED`.

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`400 ORDER_ALREADY_PAID`:** Đơn hàng đã thanh toán.
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`409 DATA_CONFLICT`:** Dữ liệu bị xung đột.

---

## 5. Xem Payment Attempt

- **Endpoint:** `GET /api/v1/payments/attempts/{id}`
- **Quyền hạn:** `CUSTOMER` (chỉ lượt thanh toán của mình)
- **Mô tả:** Xem trạng thái một lượt thanh toán, cùng dạng `result` như mục 4.

### Request Parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | ID payment attempt trong đường dẫn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy payment attempt thành công",
  "result": {
    "id": 21,
    "orderId": 1001,
    "provider": "STRIPE",
    "status": "PENDING",
    "amount": 595000.00,
    "currency": "VND",
    "providerReference": "cs_test_a1B2c3...",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3...",
    "createdAt": "2026-11-05T09:00:00",
    "expiresAt": null
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`404 RESOURCE_NOT_FOUND`:** Không tìm thấy tài nguyên.

Khi không tìm thấy attempt, service ghi đè thông báo thành `Không tìm thấy lần thanh toán.`

---

## 6. Tạo phiên Stripe Checkout (test mode)

- **Endpoint:** `POST /api/v1/payments/stripe/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Tạo (hoặc lấy lại) lượt thanh toán Stripe và phiên Hosted Checkout. Chỉ nhận khóa `sk_test_`; số tiền lấy từ đơn hàng.

### Request Body
```json
{
  "orderId": 1001,
  "idempotencyKey": "pay-order-1001-STRIPE"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo Stripe Checkout thành công",
  "result": {
    "attemptId": 21,
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3..."
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- Lượt đang mở trả lại `checkoutUrl` đã lưu với message `Stripe Checkout đã tồn tại`.

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`400 ORDER_ALREADY_PAID`:** Đơn hàng đã thanh toán.
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`409 DATA_CONFLICT`:** Dữ liệu bị xung đột.
- **`404 RESOURCE_NOT_FOUND`:** Không tìm thấy tài nguyên.
- **`400 PAYMENT_PROVIDER_REJECTED`:** Nhà cung cấp thanh toán đã từ chối yêu cầu.
- **`503 PAYMENT_PROVIDER_NOT_CONFIGURED`:** Nhà cung cấp thanh toán chưa được cấu hình.
- **`503 PAYMENT_PROVIDER_UNAVAILABLE`:** Nhà cung cấp thanh toán hiện không khả dụng.

---

## 7. Stripe Webhook

- **Endpoint:** `POST /api/v1/payments/stripe/webhook`
- **Quyền hạn:** `PUBLIC` (Server-to-Server từ Stripe, xác thực bằng header `Stripe-Signature`)
- **Mô tả:** Nhận sự kiện Stripe đã ký (HMAC-SHA256, lệch giờ tối đa 300 giây). Chỉ xử lý `checkout.session.completed` (khi `payment_status = paid`), `async_payment_succeeded`, `async_payment_failed`, `expired`; kiểm tra khớp số tiền / tiền tệ. `PAID` chỉ được ghi nhận từ sự kiện đã xác thực này, không từ trang redirect.

### Request Body
Payload sự kiện Stripe nguyên bản (raw JSON), bắt buộc. Header `Stripe-Signature` kiểu String không bắt buộc ở binding nhưng cần hợp lệ để xác thực.

### Response Thành công (HTTP 200 OK)
```json
{
  "received": true
}
```

- Loại sự kiện không xử lý trả `{ "received": true, "ignored": true }`. Response không bọc `ApiResponse`.

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`404 RESOURCE_NOT_FOUND`:** Không tìm thấy tài nguyên.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`409 DATA_CONFLICT`:** Dữ liệu bị xung đột.
- **`503 PAYMENT_PROVIDER_NOT_CONFIGURED`:** Nhà cung cấp thanh toán chưa được cấu hình.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`500 INTERNAL_SERVER_ERROR`:** Đã xảy ra lỗi. Vui lòng thử lại sau.
- **`4208 LOYALTY_STATE_CONFLICT`:** Trạng thái điểm đã thay đổi. Tải lại và thử lại.

Ví dụ thông báo ghi đè: `Chữ ký Stripe không hợp lệ.`, `Sự kiện Stripe chưa đầy đủ.`, `Sự kiện Stripe không đúng định dạng.`, `Số tiền hoặc tiền tệ từ nhà cung cấp không khớp.`, `Dữ liệu sự kiện từ nhà cung cấp đã thay đổi.`

---

## 8. Tạo URL thanh toán VNPAY (sandbox)

- **Endpoint:** `POST /api/v1/payments/vnpay/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Tạo (hoặc lấy lại) lượt thanh toán VNPAY và URL thanh toán đã ký HMAC-SHA512. Số tiền × 100 (VND nguyên); `vnp_TxnRef` = `VNPAY{attemptId}{yyyyMMddHHmmss}`, mỗi lượt mới có TxnRef mới.

### Request Body
```json
{
  "orderId": 1001,
  "idempotencyKey": "pay-order-1001-VNPAY"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |
| `idempotencyKey` | String | Có | Khóa cố định cho mỗi đơn, tối đa 100 ký tự |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo VNPAY checkout thành công",
  "result": {
    "attemptId": 22,
    "checkoutUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=59500000&vnp_TxnRef=VNPAY2220261105090000&..."
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- Lượt đang mở trả lại `checkoutUrl` đã lưu với message `VNPAY checkout đã tồn tại`.

### Response Lỗi thường gặp
- **`400 INVALID_REQUEST`:** Dữ liệu yêu cầu không hợp lệ.
- **`400 ORDER_ALREADY_PAID`:** Đơn hàng đã thanh toán.
- **`401 UNAUTHENTICATED`:** Bạn cần đăng nhập để truy cập tài nguyên này.
- **`403 FORBIDDEN`:** Bạn không có quyền truy cập.
- **`404 ORDER_NOT_FOUND`:** Không tìm thấy đơn hàng.
- **`404 CUSTOMER_NOT_FOUND`:** Không tìm thấy khách hàng.
- **`409 DATA_CONFLICT`:** Dữ liệu bị xung đột.
- **`404 RESOURCE_NOT_FOUND`:** Không tìm thấy tài nguyên.
- **`503 PAYMENT_PROVIDER_NOT_CONFIGURED`:** Nhà cung cấp thanh toán chưa được cấu hình.

---

## 9. Kết quả trả về từ VNPAY (Return URL)

- **Endpoint:** `GET /api/v1/payments/vnpay/return`
- **Quyền hạn:** `PUBLIC` (trình duyệt khách quay về từ VNPAY, kèm các tham số `vnp_*`)
- **Mô tả:** Chỉ kiểm tra chữ ký để hiển thị kết quả cho khách, **không** ghi nhận thanh toán.

### Request Parameters

Toàn bộ query, kể cả các tham số `vnp_*` khác, được nhận dưới dạng `Map<String, String>`; không có tham số riêng nào được khai báo bắt buộc ở controller.

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `vnp_SecureHash` | String | Không | Chữ ký để kiểm tra tính hợp lệ |
| `vnp_ResponseCode` | String | Không | Mã kết quả |
| `vnp_TransactionStatus` | String | Không | Trạng thái giao dịch |
| `vnp_TxnRef` | String | Không | Mã tham chiếu giao dịch |

### Response Thành công (HTTP 200 OK)
```json
{
  "valid": true,
  "displayOnly": true,
  "responseCode": "00",
  "transactionStatus": "00",
  "txnRef": "VNPAY2220261105090000"
}
```

- Response không bọc `ApiResponse`; `valid = false` khi sai chữ ký.

---

## 10. Xử lý IPN từ VNPAY

- **Endpoint:** `GET /api/v1/payments/vnpay/ipn`
- **Quyền hạn:** `PUBLIC` (Server-to-Server từ VNPAY, xác thực `vnp_SecureHash` HMAC-SHA512 và `vnp_TmnCode`)
- **Mô tả:** Nhận kết quả giao dịch, kiểm tra chữ ký / merchant / số tiền, rồi ghi nhận thanh toán. Thành công khi `vnp_ResponseCode` và `vnp_TransactionStatus` đều `00`; sự kiện chống trùng theo `{txnRef}:{vnp_TransactionNo}` (nếu thiếu transaction number thì dùng `vnp_ResponseCode`).

### Request Parameters

Toàn bộ query, kể cả các tham số `vnp_*` khác, được nhận dưới dạng `Map<String, String>`; không có tham số riêng nào được khai báo bắt buộc ở controller.

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `vnp_SecureHash` | String | Không | Chữ ký để kiểm tra tính hợp lệ |
| `vnp_ResponseCode` | String | Không | Mã kết quả |
| `vnp_TransactionStatus` | String | Không | Trạng thái giao dịch |
| `vnp_TxnRef` | String | Không | Mã tham chiếu giao dịch |
| `vnp_TmnCode` | String | Không | Mã merchant; phải khớp cấu hình |
| `vnp_Amount` | String | Không | Số tiền nguyên nhân 100 |
| `vnp_CurrCode` | String | Không | Tiền tệ; phải là `VND` |
| `vnp_TransactionNo` | String | Không | Mã giao dịch, dùng tạo event ID; nếu thiếu dùng `vnp_ResponseCode` |

### Response Thành công (HTTP 200 OK)
```json
{
  "RspCode": "00",
  "Message": "Confirm Success"
}
```

### Response Lỗi thường gặp
Các nhánh kiểm tra sau trả HTTP 200, `RspCode` cho biết kết quả:
- **`97`:** Sai chữ ký.
- **`99`:** Sai merchant (`vnp_TmnCode`).
- **`01`:** Không tìm thấy giao dịch theo `vnp_TxnRef`.
- **`04`:** Sai số tiền hoặc tiền tệ.

Sau khi vượt các kiểm tra trên, xử lý sự kiện vẫn có thể ném lỗi `400 INVALID_REQUEST` — Dữ liệu yêu cầu không hợp lệ.; `404 RESOURCE_NOT_FOUND` — Không tìm thấy tài nguyên.; `404 ORDER_NOT_FOUND` — Không tìm thấy đơn hàng.; `404 CUSTOMER_NOT_FOUND` — Không tìm thấy khách hàng.; `409 DATA_CONFLICT` — Dữ liệu bị xung đột.; `4208 LOYALTY_STATE_CONFLICT` — Trạng thái điểm đã thay đổi. Tải lại và thử lại.; `503 PAYMENT_PROVIDER_NOT_CONFIGURED` — Nhà cung cấp thanh toán chưa được cấu hình.; hoặc `500 INTERNAL_SERVER_ERROR` — Đã xảy ra lỗi. Vui lòng thử lại sau.

---

## 11. Quy tắc thanh toán lại (Re-pay)

FE gửi một `idempotencyKey` cố định cho mỗi đơn / cổng; server xét lượt mới nhất của khóa đó (áp dụng cho mục 4, 6 và 8).

| Lượt mới nhất | Kết quả khi gửi lại cùng khóa |
| :--- | :--- |
| Chưa có | Tạo lượt `CREATED` mới |
| `CREATED`, `PENDING`, `SETTLEMENT_PENDING` | Trả lại đúng lượt đó (cùng `checkoutUrl`) |
| `SETTLED`, `REVIEW_REQUIRED` | Trả lại lượt đó; endpoint checkout tạo phiên nếu lượt chưa có `checkoutUrl` |
| `FAILED`, `CANCELLED`, `EXPIRED` | Nếu chưa có hóa đơn, tạo lượt mới với khóa nội bộ `<khóa rút ngắn>~r<n>` và phiên Stripe / `TxnRef` VNPAY mới |

- Khi thử lại lượt đã kết thúc, đơn đã có hóa đơn → `400 ORDER_ALREADY_PAID`; khóa cùng provider thuộc đơn khác → `409 DATA_CONFLICT`. Kiểm tra khả năng thanh toán của đơn chạy trước khi tìm lượt cũ. Response không đổi, khóa nội bộ không lộ ra ngoài.
- Thanh toán muộn sau khi lượt `CANCELLED` / `EXPIRED` chuyển sang `REVIEW_REQUIRED`, không tự hoàn tiền hay xử lý đơn.
