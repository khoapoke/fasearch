# TÀI LIỆU API: MODULE ORDER & CART (ĐƠN HÀNG & GIỎ HÀNG)

Module `order` và `cart` xử lý toàn bộ quy trình mua hàng đa kênh (Omnichannel): thêm hàng vào giỏ, báo giá ưu đãi, đặt hàng trực tuyến, đơn tạm lưu tại quầy POS và theo dõi luồng trạng thái đơn hàng. Phí vận chuyển xem [api-shipping.md](./api-shipping.md).

---

## 1. Xem giỏ hàng hiện tại (FR-35A)

- **Endpoint:** `GET /api/v1/cart`
- **Quyền hạn:** `hasRole('CUSTOMER')`
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
    "subTotal": 630000.0,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": "/api/v1/products/images/a1b2c3.jpg",
        "unitPrice": 350000.0,
        "quantity": 1,
        "totalPrice": 350000.0
      },
      {
        "skuId": 105,
        "productName": "Áo Polo Pique Cổ Bẻ",
        "color": "Đen",
        "size": "L",
        "barcode": "893850123405",
        "imageUrl": null,
        "unitPrice": 280000.0,
        "quantity": 1,
        "totalPrice": 280000.0
      }
    ]
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 2. Thêm sản phẩm vào giỏ (FR-35A)

- **Endpoint:** `POST /api/v1/cart/items`
- **Quyền hạn:** `hasRole('CUSTOMER')`
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
    "subTotal": 350000.0,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": null,
        "unitPrice": 350000.0,
        "quantity": 1,
        "totalPrice": 350000.0
      }
    ]
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 400 Bad Request** (`400 PRODUCT_NOT_AVAILABLE`): Sản phẩm hiện không được bán.
- **HTTP 404 Not Found** (`404 VARIANT_NOT_FOUND`): Không tìm thấy SKU.
- **HTTP 400 Bad Request** (`400 INSUFFICIENT_STOCK`): Không đủ tồn kho cho SKU đã chọn.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 3. Cập nhật số lượng sản phẩm trong giỏ (FR-35A)

- **Endpoint:** `PUT /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `hasRole('CUSTOMER')`
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

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `skuId` | Long | Có | ID SKU |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật số lượng sản phẩm trong giỏ thành công",
  "result": {
    "cartId": 1,
    "totalItems": 1,
    "subTotal": 700000.0,
    "items": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "imageUrl": null,
        "unitPrice": 350000.0,
        "quantity": 2,
        "totalPrice": 700000.0
      }
    ]
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404 Not Found** (`404 CART_ITEM_NOT_FOUND`): Không tìm thấy sản phẩm trong giỏ hàng.
- **HTTP 400 Bad Request** (`400 INSUFFICIENT_STOCK`): Không đủ tồn kho cho SKU đã chọn.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 4. Xóa sản phẩm khỏi giỏ hàng (FR-35A)

- **Endpoint:** `DELETE /api/v1/cart/items/{skuId}`
- **Quyền hạn:** `hasRole('CUSTOMER')`
- **Mô tả:** Xóa một mặt hàng khỏi giỏ và trả về giỏ hàng sau khi xóa.

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `skuId` | Long | Có | ID SKU |

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 404 Not Found** (`404 CART_ITEM_NOT_FOUND`): Không tìm thấy sản phẩm trong giỏ hàng.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 5. Xóa sạch giỏ hàng (FR-35A)

- **Endpoint:** `DELETE /api/v1/cart`
- **Quyền hạn:** `hasRole('CUSTOMER')`
- **Mô tả:** Xóa toàn bộ mặt hàng trong giỏ.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa sạch giỏ hàng thành công",
  "timestamp": "2026-10-25T15:30:00"
}
```

- `result` và `errors` là null nên không được tuần tự hóa.

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 6. Báo giá giỏ hàng với voucher và điểm (FR-47)

- **Endpoint:** `POST /api/v1/cart/quote`
- **Quyền hạn:** `hasRole('CUSTOMER')`
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
| `redeemedPoints` | BigDecimal | Không | Số điểm muốn dùng, số nguyên `>= 0` (mặc định 0) |

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
        "unitPrice": 10000.0,
        "totalPrice": 10000.0,
        "discountAmount": 1000.0,
        "pointsDiscountAmount": 2000.0
      }
    ],
    "subTotal": 10000.0,
    "voucherCode": "SAVE10",
    "freeShipping": false,
    "voucherDiscount": 1000.0,
    "remainingMerchandiseAmount": 9000.0,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.0,
    "allowedRedeemedPoints": 9,
    "availablePoints": 20,
    "policyStatus": "ENABLED",
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPoint": 1000.0,
    "merchandiseAmountDue": 7000.0,
    "quoteFingerprint": "opaque-server-token"
  },
  "timestamp": "2026-10-31T12:00:00"
}
```

- `freeShipping = true` khi voucher loại `FREE_SHIP` (xem [api-promotion.md](./api-promotion.md)). `quoteFingerprint` là token do server phát sinh, gửi lại khi checkout.

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 400 Bad Request** (`400 CART_EMPTY`): Giỏ hàng đang trống.
- **HTTP 404 Not Found** (`4101 VOUCHER_UNKNOWN`): Không tìm thấy mã Voucher.
- **HTTP 400 Bad Request** (`4102 VOUCHER_PAUSED`): Voucher đang tạm dừng.
- **HTTP 400 Bad Request** (`4103 VOUCHER_NOT_STARTED`): Voucher chưa đến thời gian sử dụng.
- **HTTP 400 Bad Request** (`4104 VOUCHER_EXPIRED`): Voucher đã hết hạn.
- **HTTP 409 Conflict** (`4105 VOUCHER_EXHAUSTED`): Voucher đã hết lượt sử dụng.
- **HTTP 400 Bad Request** (`4106 VOUCHER_NOT_APPLICABLE`): Voucher không áp dụng cho giỏ hàng này.
- **HTTP 409 Conflict** (`4202 LOYALTY_POLICY_UNAVAILABLE`): Chưa cấu hình chính sách điểm.
- **HTTP 409 Conflict** (`4203 LOYALTY_POLICY_DISABLED`): Chính sách đổi điểm đang tắt.
- **HTTP 409 Conflict** (`4204 INSUFFICIENT_POINTS`): Số điểm yêu cầu vượt quá mức cho phép hiện tại.
- **HTTP 409 Conflict** (`4208 LOYALTY_STATE_CONFLICT`): Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 7. Đặt hàng trực tuyến (FR-35B)

- **Endpoint:** `POST /api/v1/orders/checkout`
- **Quyền hạn:** `hasRole('CUSTOMER')`
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
| `deliveryAddress` | String | Có | Địa chỉ nhận hàng (service yêu cầu không rỗng; DTO không có ràng buộc) |
| `receiverName` | String | Không | Tên người nhận |
| `receiverPhone` | String | Không | SĐT người nhận |
| `voucherCode` | String | Không | Mã giảm giá, tối đa 50 ký tự |
| `redeemedPoints` | BigDecimal | Không | Số điểm dùng, số nguyên `>= 0` |
| `quoteFingerprint` | String | Không | Token từ `POST /api/v1/cart/quote`, tối đa 64 ký tự |
| `expectedMerchandiseAmountDue` | BigDecimal | Không | Tiền hàng phải trả theo quote (`>= 0`) |
| `checkoutKey` | String | Không | Khóa chống trùng, 1 - 100 ký tự; bắt buộc nếu có voucher / điểm |
| `paymentMethod` | String | Không | Phương thức thanh toán dự kiến |
| `shippingFee` | BigDecimal | Không | Phí ship FE đã hiển thị (`>= 0`); khi có tọa độ phải khớp phí server tính |
| `note` | String | Không | Ghi chú đơn hàng |
| `deliveryLatitude` | Double | Không | Vĩ độ giao hàng `[-90, 90]`, gửi cùng `deliveryLongitude` |
| `deliveryLongitude` | Double | Không | Kinh độ giao hàng `[-180, 180]`, gửi cùng `deliveryLatitude` |

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
    "subTotal": 630000.0,
    "discountAmount": 63000.0,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.0,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.0,
    "earnedPoints": null,
    "voucherId": 5,
    "voucherCode": "FASEARCH10",
    "voucherCampaignName": "Ưu đãi chào mừng",
    "voucherCampaignVersion": 1,
    "replayed": false,
    "shippingFee": 30000.0,
    "totalAmount": 595000.0,
    "createdAt": "2026-10-25T15:30:00",
    "deliveryLatitude": 10.8070354,
    "deliveryLongitude": 106.6287031,
    "distanceKm": 4.2,
    "shippingMethod": "estimate",
    "paymentStatus": null,
    "paymentMethod": null
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 400 Bad Request** (`400 CART_EMPTY`): Giỏ hàng đang trống.
- **HTTP 404 Not Found** (`4101 VOUCHER_UNKNOWN`): Không tìm thấy mã Voucher.
- **HTTP 400 Bad Request** (`4102 VOUCHER_PAUSED`): Voucher đang tạm dừng.
- **HTTP 400 Bad Request** (`4103 VOUCHER_NOT_STARTED`): Voucher chưa đến thời gian sử dụng.
- **HTTP 400 Bad Request** (`4104 VOUCHER_EXPIRED`): Voucher đã hết hạn.
- **HTTP 409 Conflict** (`4105 VOUCHER_EXHAUSTED`): Voucher đã hết lượt sử dụng.
- **HTTP 400 Bad Request** (`4106 VOUCHER_NOT_APPLICABLE`): Voucher không áp dụng cho giỏ hàng này.
- **HTTP 409 Conflict** (`4202 LOYALTY_POLICY_UNAVAILABLE`): Chưa cấu hình chính sách điểm.
- **HTTP 409 Conflict** (`4203 LOYALTY_POLICY_DISABLED`): Chính sách đổi điểm đang tắt.
- **HTTP 409 Conflict** (`4204 INSUFFICIENT_POINTS`): Số điểm yêu cầu vượt quá mức cho phép hiện tại.
- **HTTP 409 Conflict** (`4208 LOYALTY_STATE_CONFLICT`): Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **HTTP 409 Conflict** (`4108 IDEMPOTENCY_CONFLICT`): Khóa đặt hàng đã được dùng với dữ liệu khác.
- **HTTP 409 Conflict** (`4107 QUOTE_CHANGED`): Báo giá giỏ hàng đã thay đổi. Tải lại và xác nhận.
- **HTTP 400 Bad Request** (`400 INSUFFICIENT_STOCK`): Không đủ tồn kho cho SKU đã chọn.
- **HTTP 500 Internal Server Error** (`500 INTERNAL_SERVER_ERROR`): Đã xảy ra lỗi. Vui lòng thử lại sau.
- **HTTP 403 Forbidden:** Không có vai trò `CUSTOMER`.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 8. Xem danh sách đơn hàng (FR-36)

- **Endpoint:** `GET /api/v1/orders`
- **Quyền hạn:** `hasRole('CUSTOMER') or hasAuthority('PERM_ORDER_VIEW')`
- **Mô tả:** Lấy danh sách đơn hàng có phân trang và bộ lọc. `keyword` tìm đồng thời theo mã đơn, tên khách và số điện thoại, không phân biệt hoa/thường và dấu tiếng Việt (kể cả `đ`), tối đa 100 ký tự; `%` và `_` do người dùng nhập được hiểu là ký tự thường. Khách hàng vẫn chỉ thấy đơn của chính mình khi dùng bất kỳ bộ lọc nào.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |
| `sort` | String | Không | Tiêu chí sắp xếp (mặc định `orderDate,desc`) |
| `status` | OrderStatus | Không | `DRAFT`, `PENDING`, `CONFIRMED`, `PACKING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `RETURNED` |
| `orderCode` | String | Không | Tìm theo mã đơn hàng (không phân biệt hoa/thường) |
| `customerPhone` | String | Không | Tìm theo SĐT khách hàng (chỉ ADMIN/STAFF) |
| `keyword` | String | Không | Tìm theo mã đơn, tên khách hoặc SĐT; tối đa 100 ký tự |
| `startDate` | LocalDate | Không | Từ ngày đặt `yyyy-MM-dd`, tính từ 00:00 ngày đó (giờ Việt Nam) |
| `endDate` | LocalDate | Không | Đến ngày đặt `yyyy-MM-dd`, gồm cả ngày đó; điều kiện nửa mở `< endDate + 1 ngày 00:00` |

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
        "subTotal": 630000.0,
        "discountAmount": 63000.0,
        "redeemedPoints": 2,
        "pointsDiscount": 2000.0,
        "earnedPoints": null,
        "shippingFee": 30000.0,
        "totalAmount": 595000.0,
        "paymentStatus": null,
        "paymentMethod": null,
        "createdAt": "2026-10-25T15:30:00",
        "loyaltyPolicyId": null,
        "loyaltyPolicyVersion": null,
        "redeemCurrencyPerPointSnapshot": null,
        "voucherId": null,
        "voucherCode": null,
        "voucherCampaignName": null,
        "voucherCampaignVersion": null,
        "replayed": null,
        "deliveryLatitude": null,
        "deliveryLongitude": null,
        "distanceKm": null,
        "shippingMethod": null
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

- `paymentStatus` / `paymentMethod`: trạng thái và phương thức thanh toán từ hóa đơn `PAID` hoặc `REFUNDED` (`null` khi không có hóa đơn tương ứng); danh sách điền bằng MỘT truy vấn hóa đơn cho cả trang (không N+1). Chỉ cộng thêm, không đổi hành vi lọc/phân trang.

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 9. Xem chi tiết đơn hàng (FR-36)

- **Endpoint:** `GET /api/v1/orders/{id}`
- **Quyền hạn:** `hasRole('CUSTOMER') or hasAuthority('PERM_ORDER_VIEW')`
- **Mô tả:** Lấy chi tiết đơn hàng gồm danh sách dòng hàng, voucher, điểm và trạng thái thanh toán (từ hóa đơn PAID hoặc REFUNDED, null khi không có hóa đơn tương ứng).

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | ID đơn hàng |

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
        "unitPrice": 350000.0,
        "totalPrice": 350000.0,
        "discountAmount": 0.0,
        "pointsDiscountAmount": 0.0
      }
    ],
    "subTotal": 350000.0,
    "discountAmount": 0.0,
    "redeemedPoints": 0,
    "pointsDiscount": 0.0,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
    "voucherId": null,
    "voucherCode": null,
    "shippingFee": 30000.0,
    "totalAmount": 380000.0,
    "createdAt": "2026-10-25T15:30:00",
    "deliveryLatitude": null,
    "deliveryLongitude": null,
    "distanceKm": null,
    "shippingMethod": null,
    "paymentStatus": null,
    "paymentMethod": null,
    "voucherCampaignName": null,
    "voucherCampaignVersion": null,
    "paidAmount": 0,
    "refundedAmount": 0
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 403 Forbidden** (`403 FORBIDDEN`): Bạn không có quyền truy cập.
- **HTTP 404 Not Found** (`404 ORDER_NOT_FOUND`): Không tìm thấy đơn hàng.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 10. Cập nhật trạng thái đơn hàng (FR-37)

- **Endpoint:** `PATCH /api/v1/orders/{id}/status`
- **Quyền hạn:** `hasAuthority('PERM_ORDER_UPDATE_STATUS')`
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
| `status` | OrderStatus | Có | Trạng thái kế tiếp |
| `note` | String | Không | Ghi chú tiến trình |

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | ID đơn hàng |

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
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "[PACKING]: Đã chuẩn bị xong hàng, sẵn sàng giao cho đơn vị vận chuyển",
    "items": [],
    "subTotal": 350000.0,
    "shippingFee": 30000.0,
    "totalAmount": 380000.0,
    "createdAt": "2026-10-25T15:30:00",
    "discountAmount": 0,
    "redeemedPoints": 0,
    "pointsDiscount": 0,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
    "voucherId": null,
    "voucherCode": null,
    "voucherCampaignName": null,
    "voucherCampaignVersion": null,
    "paidAmount": 0,
    "refundedAmount": 0,
    "paymentStatus": null,
    "paymentMethod": null,
    "deliveryLatitude": null,
    "deliveryLongitude": null,
    "distanceKm": null,
    "shippingMethod": null
  },
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404 Not Found** (`404 ORDER_NOT_FOUND`): Không tìm thấy đơn hàng.
- **HTTP 404 Not Found** (`404 INVENTORY_NOT_FOUND`): Không tìm thấy bản ghi kho.
- **HTTP 409 Conflict** (`4208 LOYALTY_STATE_CONFLICT`): Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **HTTP 500 Internal Server Error** (`500 INTERNAL_SERVER_ERROR`): Đã xảy ra lỗi. Vui lòng thử lại sau.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 11. Hủy đơn hàng (FR-38)

- **Endpoint:** `POST /api/v1/orders/{id}/cancel`
- **Quyền hạn:** `hasRole('CUSTOMER') or hasAuthority('PERM_ORDER_CANCEL')`
- **Mô tả:** Hủy đơn chưa thanh toán, hoàn trả tồn kho, voucher và điểm giữ chỗ trong cùng transaction (FR-40). Đơn đã `PAID`, đã hoàn tất, hoặc đã bàn giao với voucher / điểm thì không hủy được. Sau khi commit, mọi Stripe Checkout Session còn mở của đơn được hết hạn (`EXPIRED`); session đã thanh toán trước đó giữ nguyên để webhook chuyển sang `REVIEW_REQUIRED`, không bao giờ ghi đè `SETTLED`.

### Request Body
```json
{
  "reason": "Khách hàng đổi ý muốn chọn size khác"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `reason` | String | Có | Lý do hủy đơn |

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | ID đơn hàng |

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
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
    "deliveryAddress": "Số 123 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM",
    "note": "[HỦY ĐƠN - KHÁCH HÀNG]: Khách hàng đổi ý muốn chọn size khác",
    "items": [],
    "subTotal": 630000.0,
    "shippingFee": 30000.0,
    "totalAmount": 660000.0,
    "paymentStatus": null,
    "paymentMethod": null,
    "createdAt": "2026-10-28T15:20:00",
    "discountAmount": 0,
    "redeemedPoints": 0,
    "pointsDiscount": 0,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
    "voucherId": null,
    "voucherCode": null,
    "voucherCampaignName": null,
    "voucherCampaignVersion": null,
    "paidAmount": 0,
    "refundedAmount": 0,
    "deliveryLatitude": null,
    "deliveryLongitude": null,
    "distanceKm": null,
    "shippingMethod": null
  },
  "timestamp": "2026-10-28T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 403 Forbidden** (`403 FORBIDDEN`): Bạn không có quyền truy cập.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404 Not Found** (`404 ORDER_NOT_FOUND`): Không tìm thấy đơn hàng.
- **HTTP 404 Not Found** (`404 INVENTORY_NOT_FOUND`): Không tìm thấy bản ghi kho.
- **HTTP 409 Conflict** (`4208 LOYALTY_STATE_CONFLICT`): Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **HTTP 500 Internal Server Error** (`500 INTERNAL_SERVER_ERROR`): Đã xảy ra lỗi. Vui lòng thử lại sau.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.
- **Ghi chú:** `note` ghi `[HỦY ĐƠN - KHÁCH HÀNG]: <lý do>` cho khách và `[HỦY ĐƠN - NHÂN VIÊN <username>]: <lý do>` cho ADMIN/STAFF. Đơn hủy nhưng tiền đã về trước đó chuyển sang `REVIEW_REQUIRED` để đối soát, không tự hoàn tiền.

---

## 12. Lưu tạm đơn hàng POS (FR-39)

- **Endpoint:** `POST /api/v1/orders/pos/draft`
- **Quyền hạn:** `hasAuthority('PERM_POS_USE')`
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
| `items` | List<PosDraftItemReq> | Có | Danh sách dòng hàng, không rỗng |
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
    "customer": {
      "customerId": 1,
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "0987654321"
    },
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
        "unitPrice": 350000.0,
        "totalPrice": 350000.0,
        "discountAmount": 0,
        "pointsDiscountAmount": 0
      }
    ],
    "subTotal": 350000.0,
    "discountAmount": 0.0,
    "shippingFee": 0.0,
    "totalAmount": 350000.0,
    "createdAt": "2026-10-28T15:25:00",
    "redeemedPoints": 0,
    "pointsDiscount": 0,
    "loyaltyPolicyId": null,
    "loyaltyPolicyVersion": null,
    "redeemCurrencyPerPointSnapshot": null,
    "earnedPoints": null,
    "voucherId": null,
    "voucherCode": null,
    "voucherCampaignName": null,
    "voucherCampaignVersion": null,
    "paidAmount": 0,
    "refundedAmount": 0,
    "paymentStatus": null,
    "paymentMethod": null,
    "deliveryLatitude": null,
    "deliveryLongitude": null,
    "distanceKm": null,
    "shippingMethod": null
  },
  "timestamp": "2026-10-28T15:25:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 404 Not Found** (`404 VARIANT_NOT_FOUND`): Không tìm thấy SKU.
- **HTTP 404 Not Found** (`404 INVENTORY_NOT_FOUND`): Không tìm thấy bản ghi kho.
- **HTTP 400 Bad Request** (`400 INSUFFICIENT_STOCK`): Không đủ tồn kho cho SKU đã chọn.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 13. Lấy danh sách đơn tạm tại quầy POS (FR-39)

- **Endpoint:** `GET /api/v1/orders/pos/drafts`
- **Quyền hạn:** `hasAuthority('PERM_POS_USE')`
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
      "customer": {
        "customerId": 1,
        "fullName": "Nguyễn Văn A",
        "phoneNumber": "0987654321"
      },
      "deliveryAddress": "Bán tại quầy (POS)",
      "note": "Khách đang chọn thêm màu khác",
      "items": [],
      "subTotal": 350000.0,
      "discountAmount": 0.0,
      "shippingFee": 0.0,
      "totalAmount": 350000.0,
      "createdAt": "2026-10-28T15:25:00",
      "redeemedPoints": 0,
      "pointsDiscount": 0,
      "loyaltyPolicyId": null,
      "loyaltyPolicyVersion": null,
      "redeemCurrencyPerPointSnapshot": null,
      "earnedPoints": null,
      "voucherId": null,
      "voucherCode": null,
      "voucherCampaignName": null,
      "voucherCampaignVersion": null,
      "paidAmount": 0,
      "refundedAmount": 0,
      "paymentStatus": null,
      "paymentMethod": null,
      "deliveryLatitude": null,
      "deliveryLongitude": null,
      "distanceKm": null,
      "shippingMethod": null
    }
  ],
  "timestamp": "2026-10-28T15:26:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 14. Báo giá đơn tạm POS (FR-47)

- **Endpoint:** `POST /api/v1/orders/pos/{orderId}/quote`
- **Quyền hạn:** `hasAuthority('PERM_POS_USE')`
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
| `redeemedPoints` | BigDecimal | Không | Số điểm muốn dùng, số nguyên `>= 0` |

### Path Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `orderId` | Long | Có | ID đơn hàng |

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
        "unitPrice": 350000.0,
        "totalPrice": 350000.0,
        "discountAmount": 35000.0,
        "pointsDiscountAmount": 2000.0
      }
    ],
    "subTotal": 350000.0,
    "voucherCode": "SAVE10",
    "freeShipping": false,
    "voucherDiscount": 35000.0,
    "remainingMerchandiseAmount": 315000.0,
    "redeemedPoints": 2,
    "pointsDiscount": 2000.0,
    "allowedRedeemedPoints": 20,
    "availablePoints": 150,
    "policyStatus": "ENABLED",
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPoint": 1000.0,
    "merchandiseAmountDue": 313000.0,
    "quoteFingerprint": "opaque-server-token"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- Thanh toán đơn POS gửi `voucherCode`, `redeemedPoints`, `quoteFingerprint` qua `POST /api/v1/payments/process` ([api-payment.md](./api-payment.md)).

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized** (`401 UNAUTHENTICATED`): Bạn cần đăng nhập để truy cập tài nguyên này.
- **HTTP 403 Forbidden** (`403 FORBIDDEN`): Bạn không có quyền truy cập.
- **HTTP 404 Not Found** (`404 ORDER_NOT_FOUND`): Không tìm thấy đơn hàng.
- **HTTP 404 Not Found** (`404 CUSTOMER_NOT_FOUND`): Không tìm thấy khách hàng.
- **HTTP 409 Conflict** (`4107 QUOTE_CHANGED`): Báo giá giỏ hàng đã thay đổi. Tải lại và xác nhận.
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 400 Bad Request** (`400 CART_EMPTY`): Giỏ hàng đang trống.
- **HTTP 404 Not Found** (`4101 VOUCHER_UNKNOWN`): Không tìm thấy mã Voucher.
- **HTTP 400 Bad Request** (`4102 VOUCHER_PAUSED`): Voucher đang tạm dừng.
- **HTTP 400 Bad Request** (`4103 VOUCHER_NOT_STARTED`): Voucher chưa đến thời gian sử dụng.
- **HTTP 400 Bad Request** (`4104 VOUCHER_EXPIRED`): Voucher đã hết hạn.
- **HTTP 409 Conflict** (`4105 VOUCHER_EXHAUSTED`): Voucher đã hết lượt sử dụng.
- **HTTP 400 Bad Request** (`4106 VOUCHER_NOT_APPLICABLE`): Voucher không áp dụng cho giỏ hàng này.
- **HTTP 409 Conflict** (`4202 LOYALTY_POLICY_UNAVAILABLE`): Chưa cấu hình chính sách điểm.
- **HTTP 409 Conflict** (`4203 LOYALTY_POLICY_DISABLED`): Chính sách đổi điểm đang tắt.
- **HTTP 409 Conflict** (`4204 INSUFFICIENT_POINTS`): Số điểm yêu cầu vượt quá mức cho phép hiện tại.
- **HTTP 409 Conflict** (`4208 LOYALTY_STATE_CONFLICT`): Trạng thái điểm đã thay đổi. Tải lại và thử lại.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.

---

## 15. Xuất CSV đơn hàng (FR-36)

- **Endpoint:** `GET /api/v1/admin/csv/orders`
- **Quyền hạn:** `hasAuthority('PERM_DATA_EXPORT') and hasAuthority('PERM_ORDER_VIEW')`
- **Mô tả:** Xuất CSV toàn bộ đơn hàng khớp bộ lọc của `GET /api/v1/orders` (mục 8), **mỗi dòng một đơn**, không chỉ trang hiện tại. Chỉ ADMIN/STAFF; đơn đã xóa mềm không được xuất. Tệp UTF-8 **có BOM**, phân tách bằng **dấu phẩy**, CRLF, quote RFC 4180; header tiếng Việt. Tối đa **50.000 dòng**.

> Tệp chứa **dữ liệu cá nhân** của khách hàng (tên, số điện thoại, địa chỉ giao hàng). Không lưu tệp trên máy chủ; FE hiển thị xác nhận trước khi tải và tên tệp không chứa dữ liệu cá nhân.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `status` | OrderStatus | Không | `DRAFT`, `PENDING`, `CONFIRMED`, `PACKING`, `SHIPPING`, `COMPLETED`, `CANCELLED`, `RETURNED` |
| `orderCode` | String | Không | Mã đơn, tối đa 50 ký tự |
| `customerPhone` | String | Không | Một phần số điện thoại, tối đa 20 ký tự |
| `keyword` | String | Không | Mã đơn, tên khách hoặc số điện thoại; tối đa 100 ký tự |
| `startDate` | LocalDate | Không | `YYYY-MM-DD`, tính từ 00:00 ngày đó |
| `endDate` | LocalDate | Không | `YYYY-MM-DD`, gồm cả ngày đó; điều kiện nửa mở `< endDate + 1 ngày 00:00` |

### Response Thành công (HTTP 200 OK)
- `Content-Type: text/csv; charset=UTF-8`
- `Content-Disposition: attachment; filename="don-hang-YYYY-MM-DD.csv"`
- `Cache-Control: no-store`
- `X-Export-Rows`: số dòng; `X-Content-Type-Options: nosniff`

| Cột |
| :--- |
| `Mã đơn`, `Ngày tạo`, `Trạng thái`, `Trạng thái thanh toán`, `Phương thức thanh toán` |
| `Tên khách hàng`, `Số điện thoại`, `Địa chỉ giao hàng` |
| `Tạm tính`, `Giảm giá`, `Giảm giá điểm`, `Phí vận chuyển`, `Tổng cộng` |
| `Mã voucher`, `Điểm nhận`, `Điểm dùng` |

- `Ngày tạo` theo `dd/MM/yyyy HH:mm` (giờ Việt Nam); tiền là số nguyên, **không** dấu phân cách nghìn; trạng thái và phương thức thanh toán bằng nhãn tiếng Việt.
- `Trạng thái thanh toán` = `Đã thanh toán` khi có hóa đơn `PAID`, ngược lại `Chưa thanh toán` (cùng quy tắc với danh sách đơn).
- Ô văn bản bắt đầu bằng `=`, `+`, `-`, `@`, tab hoặc CR được thêm tiền tố `'`; ô số giữ nguyên dạng số.
- Dòng được ghi theo lô 500, sắp xếp theo mã đơn tăng dần; mỗi lô đọc khách hàng và hóa đơn bằng một truy vấn, không N+1.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request** (`400 INVALID_REQUEST`): Dữ liệu yêu cầu không hợp lệ.
- **HTTP 403 Forbidden:** Không thỏa biểu thức quyền hạn.
- Thông điệp tùy ngữ cảnh hoặc lỗi kiểm tra trường có thể thay thế thông điệp mặc định ở trên.
