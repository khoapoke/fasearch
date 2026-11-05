# TÀI LIỆU API: MODULE ORDER & CART (ĐƠN HÀNG & GIỎ HÀNG)

Module `order` và `cart` xử lý toàn bộ quy trình mua hàng đa kênh (Omnichannel): thêm hàng vào giỏ, báo giá ưu đãi, đặt hàng trực tuyến, đơn tạm lưu tại quầy POS và theo dõi luồng trạng thái đơn hàng. Phí vận chuyển xem [api-shipping.md](./api-shipping.md).

---

## 1. Xem giỏ hàng hiện tại (FR-35A)

- **Endpoint:** `GET /api/v1/cart`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Lấy giỏ hàng của khách hàng đang đăng nhập (tự tạo giỏ rỗng nếu chưa có).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy thông tin giỏ hàng thành công",
  "result": {
    "cartId": 1,
    "totalItems": 2,
    "subTotal": 630000.00,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": "/api/v1/products/images/a1b2c3.jpg",
        "unitPrice": 350000.00,
        "quantity": 1,
        "totalPrice": 350000.00
      },
      {
        "skuId": 105,
        "productName": "Áo Polo Pique Cổ Bẻ",
        "color": "Đen",
        "size": "L",
        "barcode": "893850123405",
        "imageUrl": null,
        "unitPrice": 280000.00,
        "quantity": 1,
        "totalPrice": 280000.00
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Tài khoản chưa có hồ sơ khách hàng (`CUSTOMER_NOT_FOUND`).

---

## 2. Thêm sản phẩm vào giỏ (FR-35A)

- **Endpoint:** `POST /api/v1/cart/items`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Thêm biến thể (SKU) vào giỏ; nếu SKU đã có trong giỏ thì cộng dồn số lượng. Kiểm tra tồn kho khả dụng.

### Request Body
```json
{
  "skuId": 101,
  "quantity": 1
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `skuId` | Long | Có | ID biến thể sản phẩm |
| `quantity` | Integer | Có | Số lượng thêm (`>= 1`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thêm sản phẩm vào giỏ hàng thành công",
  "result": {
    "cartId": 1,
    "totalItems": 1,
    "subTotal": 350000.00,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": null,
        "unitPrice": 350000.00,
        "quantity": 1,
        "totalPrice": 350000.00
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Số lượng không hợp lệ, sản phẩm ngừng bán (`PRODUCT_NOT_AVAILABLE`) hoặc không đủ tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`).

---

## 3. Cập nhật số lượng sản phẩm trong giỏ (FR-35A)

- **Endpoint:** `PUT /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Đặt lại số lượng của một mặt hàng trong giỏ.

### Request Body
```json
{
  "quantity": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `quantity` | Integer | Có | Số lượng mới (`>= 1`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật số lượng sản phẩm trong giỏ thành công",
  "result": {
    "cartId": 1,
    "totalItems": 1,
    "subTotal": 700000.00,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": null,
        "unitPrice": 350000.00,
        "quantity": 2,
        "totalPrice": 700000.00
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Số lượng không hợp lệ hoặc không đủ tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 404 Not Found:** Sản phẩm không có trong giỏ (`CART_ITEM_NOT_FOUND`).

---

## 4. Xóa sản phẩm khỏi giỏ hàng (FR-35A)

- **Endpoint:** `DELETE /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Xóa một mặt hàng khỏi giỏ và trả về giỏ hàng sau khi xóa.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa sản phẩm khỏi giỏ hàng thành công",
  "result": {
    "cartId": 1,
    "totalItems": 0,
    "subTotal": 0,
    "items": []
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Sản phẩm không có trong giỏ (`CART_ITEM_NOT_FOUND`).

---

## 5. Xóa sạch giỏ hàng (FR-35A)

- **Endpoint:** `DELETE /api/v1/cart`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Xóa toàn bộ mặt hàng trong giỏ.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa sạch giỏ hàng thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.

---

## 6. Báo giá giỏ hàng với voucher và điểm (FR-47)

- **Endpoint:** `POST /api/v1/cart/quote`
- **Quyền hạn:** `CUSTOMER` (khách hàng lấy từ JWT)
- **Mô tả:** Tính trước giá giỏ hàng sau voucher rồi đến điểm tích lũy (điểm giảm trên phần hàng hóa còn lại, không giảm phí ship). Chỉ đọc: không giữ voucher, điểm hay tồn kho. Response `Cache-Control: no-store`.

### Request Body
```json
{
  "voucherCode": "SAVE10",
  "redeemedPoints": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `voucherCode` | String | Không | Mã giảm giá, tối đa 50 ký tự |
| `redeemedPoints` | Number | Không | Số điểm muốn dùng, số nguyên `>= 0` (mặc định 0) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tính ưu đãi giỏ hàng thành công",
  "result": {
    "items": [
      {
        "skuId": 11,
        "productName": "Áo sơ mi",
        "quantity": 1,
        "unitPrice": 10000.00,
        "totalPrice": 10000.00,
        "discountAmount": 1000.00,
        "pointsDiscountAmount": 2000.00
      }
    ],
    "subTotal": 10000.00,
    "voucherCode": "SAVE10",
    "freeShipping": false,
    "voucherDiscount": 1000.00,
    "remainingMerchandiseAmount": 9000.00,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "allowedRedeemedPoints": 9,
    "availablePoints": 20,
    "policyStatus": "ENABLED",
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPoint": 1000.00,
    "merchandiseAmountDue": 7000.00,
    "quoteFingerprint": "opaque-server-token"
  },
  "errors": null,
  "timestamp": "2026-10-31T12:00:00"
}
```

- `freeShipping = true` khi voucher loại `FREE_SHIP` (xem [api-promotion.md](./api-promotion.md)). `quoteFingerprint` là token do server phát sinh, gửi lại khi checkout.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Điểm âm / phân số / tràn số; voucher đã tạm dừng, chưa bắt đầu, hết hạn hoặc không áp dụng cho giỏ (`VOUCHER_PAUSED`, `VOUCHER_NOT_STARTED`, `VOUCHER_EXPIRED`, `VOUCHER_NOT_APPLICABLE`); giỏ rỗng (`CART_EMPTY`).
- **HTTP 404 Not Found:** Mã voucher không tồn tại (`VOUCHER_UNKNOWN`).
- **HTTP 409 Conflict:** Hết lượt voucher (`4105 VOUCHER_EXHAUSTED`); chưa mở đầu điểm / chính sách chưa có hoặc đang tắt / vượt số điểm cho phép (`4201`, `4202`, `4203`, `4204 INSUFFICIENT_POINTS`, kèm mức tối đa trong `errors`).

---

## 7. Đặt hàng trực tuyến (FR-35B)

- **Endpoint:** `POST /api/v1/orders/checkout`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Chốt giỏ hàng tạo đơn mới, tạm giữ tồn kho, áp dụng voucher / điểm theo quote và tính lại phí ship nếu có tọa độ. Gửi lại đúng request cũ trả đơn đã tạo với HTTP 200.

### Request Body
```json
{
  "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
  "receiverName": "Nguyễn Văn A",
  "receiverPhone": "0987654321",
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 2,
  "quoteFingerprint": "opaque-server-token",
  "expectedMerchandiseAmountDue": 565000.00,
  "checkoutKey": "client-generated-idempotency-key",
  "paymentMethod": "VNPAY_QR",
  "shippingFee": 30000.00,
  "note": "Giao vào giờ hành chính",
  "deliveryLatitude": 10.8070354,
  "deliveryLongitude": 106.6287031
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `deliveryAddress` | String | Có | Địa chỉ nhận hàng |
| `receiverName` | String | Không | Tên người nhận |
| `receiverPhone` | String | Không | SĐT người nhận |
| `voucherCode` | String | Không | Mã giảm giá, tối đa 50 ký tự |
| `redeemedPoints` | Number | Không | Số điểm dùng, số nguyên `>= 0` |
| `quoteFingerprint` | String | Không | Token từ `POST /api/v1/cart/quote`, tối đa 64 ký tự |
| `expectedMerchandiseAmountDue` | Number | Không | Tiền hàng phải trả theo quote (`>= 0`) |
| `checkoutKey` | String | Không | Khóa chống trùng, 1 - 100 ký tự; bắt buộc nếu có voucher / điểm |
| `paymentMethod` | String | Không | Phương thức thanh toán dự kiến |
| `shippingFee` | Number | Không | Phí ship FE đã hiển thị (`>= 0`); khi có tọa độ phải khớp phí server tính |
| `note` | String | Không | Ghi chú đơn hàng |
| `deliveryLatitude` | Number | Không | Vĩ độ giao hàng `[-90, 90]`, gửi cùng `deliveryLongitude` |
| `deliveryLongitude` | Number | Không | Kinh độ giao hàng `[-180, 180]`, gửi cùng `deliveryLatitude` |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261025-001",
    "status": "PENDING",
    "customerName": "Nguyễn Văn A",
    "customerPhone": "0987654321",
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "subTotal": 630000.00,
    "discountAmount": 63000.00,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.00,
    "earnedPoints": null,
    "voucherId": 5,
    "voucherCode": "FASEARCH10",
    "voucherCampaignName": "Ưu đãi chào mừng",
    "voucherCampaignVersion": 1,
    "replayed": false,
    "shippingFee": 30000.00,
    "totalAmount": 595000.00,
    "createdAt": "2026-10-25T15:30:00",
    "deliveryLatitude": 10.8070354,
    "deliveryLongitude": 106.6287031,
    "distanceKm": 4.2,
    "shippingMethod": "estimate"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Giỏ rỗng (`CART_EMPTY`), thiếu địa chỉ / `checkoutKey`, tọa độ sai, voucher không hợp lệ, không đủ tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.
- **HTTP 409 Conflict:** Giá / giỏ / voucher / chính sách / phí ship đã đổi sau quote (`4107 QUOTE_CHANGED`); cùng `checkoutKey` nhưng dữ liệu khác (`4108 IDEMPOTENCY_CONFLICT`); lỗi điểm `4201` - `4208`.

---

## 8. Xem danh sách đơn hàng (FR-36)

- **Endpoint:** `GET /api/v1/orders`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ thấy đơn của mình)
- **Mô tả:** Lấy danh sách đơn hàng có phân trang và bộ lọc.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `orderDate,desc`) |
| `status` | String | Không | `DRAFT`, `PENDING`, `CONFIRMED`, `PACKING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `RETURNED` |
| `orderCode` | String | Không | Tìm theo mã đơn hàng |
| `customerPhone` | String | Không | Tìm theo SĐT khách hàng |
| `startDate` | String | Không | Từ ngày đặt `yyyy-MM-dd` |
| `endDate` | String | Không | Đến ngày đặt `yyyy-MM-dd` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách đơn hàng thành công",
  "result": {
    "content": [
      {
        "orderId": 1001,
        "orderCode": "DH-20261025-001",
        "status": "PENDING",
        "customerName": "Nguyễn Văn A",
        "customerPhone": "0987654321",
        "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
        "subTotal": 630000.00,
        "discountAmount": 63000.00,
        "redeemedPoints": 2,
        "pointsDiscount": 2000.00,
        "earnedPoints": null,
        "shippingFee": 30000.00,
        "totalAmount": 595000.00,
        "createdAt": "2026-10-25T15:30:00"
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

---

## 9. Xem chi tiết đơn hàng (FR-36)

- **Endpoint:** `GET /api/v1/orders/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ xem đơn của mình)
- **Mô tả:** Lấy chi tiết đơn hàng gồm danh sách dòng hàng, voucher và điểm đã áp dụng.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261025-001",
    "status": "CONFIRMED",
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "Giao vào giờ hành chính",
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "imageUrl": null,
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00,
        "discountAmount": 0.00,
        "pointsDiscountAmount": 0.00
      }
    ],
    "subTotal": 350000.00,
    "discountAmount": 0.00,
    "redeemedPoints": 0,
    "pointsDiscount": 0.00,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
    "voucherId": null,
    "voucherCode": null,
    "shippingFee": 30000.00,
    "totalAmount": 380000.00,
    "createdAt": "2026-10-25T15:30:00",
    "deliveryLatitude": null,
    "deliveryLongitude": null,
    "distanceKm": null,
    "shippingMethod": null
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** `CUSTOMER` xem đơn của người khác.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).

---

## 10. Cập nhật trạng thái đơn hàng (FR-37)

- **Endpoint:** `PATCH /api/v1/orders/{id}/status`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Chuyển trạng thái tuần tự `PENDING` → `CONFIRMED` → `PACKING` → `SHIPPING` → `COMPLETED`; đơn đã hủy / hoàn tất / trả lại không đổi được. Đơn có voucher / điểm phải đã lập hóa đơn trước khi `COMPLETED`.

### Request Body
```json
{
  "status": "PACKING",
  "note": "Đã chuẩn bị xong hàng, sẵn sàng giao cho đơn vị vận chuyển"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `status` | String | Có | Trạng thái kế tiếp |
| `note` | String | Không | Ghi chú tiến trình |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật trạng thái đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261025-001",
    "status": "PACKING",
    "customer": { "customerId": 1, "fullName": "Nguyễn Văn A", "phoneNumber": "0987654321" },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "[PACKING]: Đã chuẩn bị xong hàng, sẵn sàng giao cho đơn vị vận chuyển",
    "items": [],
    "subTotal": 350000.00,
    "shippingFee": 30000.00,
    "totalAmount": 380000.00,
    "createdAt": "2026-10-25T15:30:00"
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Chuyển trạng thái sai thứ tự hoặc đơn đã kết thúc.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).

---

## 11. Hủy đơn hàng (FR-38)

- **Endpoint:** `POST /api/v1/orders/{id}/cancel`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (khách hàng chỉ hủy đơn của mình khi `PENDING` / `CONFIRMED`)
- **Mô tả:** Hủy đơn chưa thanh toán, hoàn trả tồn kho, voucher và điểm giữ chỗ trong cùng transaction (FR-40). Đơn đã `PAID`, đã hoàn tất, hoặc đã bàn giao với voucher / điểm thì không hủy được.

### Request Body
```json
{
  "reason": "Khách hàng đổi ý muốn chọn size khác"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Có | Lý do hủy đơn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Hủy đơn hàng thành công",
  "result": {
    "orderId": 1001,
    "orderCode": "DH-20261028-001",
    "status": "CANCELLED",
    "customer": { "customerId": 1, "fullName": "Nguyễn Văn A", "phoneNumber": "0987654321" },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "[CUSTOMER] Hủy đơn: Khách hàng đổi ý muốn chọn size khác (2026-10-28 15:30:00)",
    "items": [],
    "subTotal": 630000.00,
    "shippingFee": 30000.00,
    "totalAmount": 660000.00,
    "createdAt": "2026-10-28T15:20:00"
  },
  "errors": null,
  "timestamp": "2026-10-28T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu lý do, đơn đã hủy / hoàn tất / hoàn trả / đã thanh toán hoặc không còn hủy được theo trạng thái.
- **HTTP 403 Forbidden:** `CUSTOMER` hủy đơn của người khác.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).

---

## 12. Lưu tạm đơn hàng POS (FR-39)

- **Endpoint:** `POST /api/v1/orders/pos/draft`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Thu ngân tạm lưu đơn đang tính dở để phục vụ khách khác. Đơn có trạng thái `DRAFT`, không tạm giữ tồn kho (chỉ kiểm tra tồn khả dụng lúc lưu).

### Request Body
```json
{
  "customerPhone": "0987654321",
  "note": "Khách đang chọn thêm màu khác",
  "items": [
    {
      "skuId": 101,
      "quantity": 1
    }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `customerPhone` | String | Không | SĐT khách hàng để gắn đơn (cần để dùng điểm / tích điểm); SĐT chưa có hồ sơ chỉ được ghi vào ghi chú |
| `note` | String | Không | Ghi chú |
| `items` | Array | Có | Danh sách dòng hàng, không rỗng |
| `items[].skuId` | Long | Có | ID biến thể sản phẩm |
| `items[].quantity` | Integer | Có | Số lượng (`>= 1`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạm lưu đơn hàng tại quầy POS thành công",
  "result": {
    "orderId": 1002,
    "orderCode": "POS-20261028-001",
    "status": "DRAFT",
    "customer": { "customerId": 1, "fullName": "Nguyễn Văn A", "phoneNumber": "0987654321" },
    "deliveryAddress": "Bán tại quầy (POS)",
    "note": "Khách đang chọn thêm màu khác",
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "imageUrl": null,
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00
      }
    ],
    "subTotal": 350000.00,
    "discountAmount": 0.00,
    "shippingFee": 0.00,
    "totalAmount": 350000.00,
    "createdAt": "2026-10-28T15:25:00"
  },
  "errors": null,
  "timestamp": "2026-10-28T15:25:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Danh sách sản phẩm rỗng hoặc không đủ tồn kho (`INSUFFICIENT_STOCK`).
- **HTTP 404 Not Found:** Không tìm thấy biến thể (`VARIANT_NOT_FOUND`) hoặc tồn kho (`INVENTORY_NOT_FOUND`).

---

## 13. Lấy danh sách đơn tạm tại quầy POS (FR-39)

- **Endpoint:** `GET /api/v1/orders/pos/drafts`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Lấy các đơn `DRAFT` đang tạm lưu để mở lại.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách đơn tạm tại quầy POS thành công",
  "result": [
    {
      "orderId": 1002,
      "orderCode": "POS-20261028-001",
      "status": "DRAFT",
      "customer": { "customerId": 1, "fullName": "Nguyễn Văn A", "phoneNumber": "0987654321" },
      "deliveryAddress": "Bán tại quầy (POS)",
      "note": "Khách đang chọn thêm màu khác",
      "items": [],
      "subTotal": 350000.00,
      "discountAmount": 0.00,
      "shippingFee": 0.00,
      "totalAmount": 350000.00,
      "createdAt": "2026-10-28T15:25:00"
    }
  ],
  "errors": null,
  "timestamp": "2026-10-28T15:26:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 14. Báo giá đơn tạm POS (FR-47)

- **Endpoint:** `POST /api/v1/orders/pos/{orderId}/quote`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Báo giá voucher / điểm cho đơn `DRAFT` theo các dòng hàng và khách hàng đã gắn. Cùng dạng `result` như mục 6, thêm `orderId`; chỉ đọc, không giữ voucher / điểm / tồn kho. Đơn không gắn khách hàng không dùng được điểm.

### Request Body
```json
{
  "voucherCode": "SAVE10",
  "redeemedPoints": 2
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `voucherCode` | String | Không | Mã giảm giá, tối đa 50 ký tự |
| `redeemedPoints` | Number | Không | Số điểm muốn dùng, số nguyên `>= 0` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "POS quote calculated",
  "result": {
    "orderId": 1002,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "quantity": 1,
        "unitPrice": 350000.00,
        "totalPrice": 350000.00,
        "discountAmount": 35000.00,
        "pointsDiscountAmount": 2000.00
      }
    ],
    "subTotal": 350000.00,
    "voucherCode": "SAVE10",
    "freeShipping": false,
    "voucherDiscount": 35000.00,
    "remainingMerchandiseAmount": 315000.00,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "allowedRedeemedPoints": 20,
    "availablePoints": 150,
    "policyStatus": "ENABLED",
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPoint": 1000.00,
    "merchandiseAmountDue": 313000.00,
    "quoteFingerprint": "opaque-server-token"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- Thanh toán đơn POS gửi `voucherCode`, `redeemedPoints`, `quoteFingerprint` qua `POST /api/v1/payments/process` ([api-payment.md](./api-payment.md)).

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Voucher không hợp lệ hoặc điểm sai định dạng.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy đơn hàng (`ORDER_NOT_FOUND`).
- **HTTP 409 Conflict:** Đơn không còn ở trạng thái `DRAFT` (`4107 QUOTE_CHANGED`); lỗi điểm `4201` - `4204`.
