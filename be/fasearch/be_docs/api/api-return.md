# TÀI LIỆU API: MODULE RETURN (ĐỔI/TRẢ & HOÀN TIỀN)

Module `returns` xử lý trả hàng và hoàn tiền theo giá thực trả của đơn. V31 thêm CANCELLED, lý do hủy, bảng lần thử Stripe và chỉ mục `(order_id,status)`, `(created_at DESC,id DESC)`, history/line. V28 giữ nguyên checksum. V28 bổ sung các bảng `order_return`, `order_return_line`, `order_return_photo`, `order_return_history` và thời điểm hoàn tất đơn. Đây là luồng trả hàng/hoàn tiền; đổi sang sản phẩm khác thực hiện bằng đơn mua mới.

`ADMIN` có mọi quyền. `STAFF` mặc định có `RETURN_VIEW`, `RETURN_PROCESS`; `RETURN_REFUND` mặc định tắt. Khách hàng chỉ thao tác trên đơn của chính tài khoản mình. Mọi thao tác tiền, kho, điểm dùng transaction và khóa hàng đơn; nhận hàng khóa tồn, hoàn tiền khóa hóa đơn và khách hàng. Sổ điểm giữ nguyên trigger append-only.

Thời hạn cấu hình `returns.window-days` (mặc định 7), tính từ `don_hang.completed_at`, dùng đồng hồ DB. Trigger ghi thời điểm khi chuyển sang COMPLETED. Đơn hoàn tất trước V28 có thời điểm không xác định: không tự cấp thời hạn mới; khách liên hệ cửa hàng.

Các mã lý do: `WRONG_SIZE` (Sai size), `DEFECTIVE` (Lỗi sản phẩm), `NOT_AS_DESCRIBED` (Không giống mô tả), `CHANGE_MIND` (Đổi ý), `OTHER` (Khác, bắt buộc ghi chú). Trạng thái: `PENDING → APPROVED → RECEIVED → REFUNDED`, hoặc `PENDING → REJECTED`, `APPROVED → CANCELLED` (chưa nhận hàng, bắt buộc lý do, không đổi tiền/kho/điểm). Một yêu cầu đang mở trên mỗi đơn.

---

## 1. Xem điều kiện và lịch sử trả hàng (FR-49)

- **Endpoint:** `GET /api/v1/returns/orders/{orderId}`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Kiểm tra quyền sở hữu; trả điều kiện thời hạn, số lượng còn có thể trả và toàn bộ lịch sử yêu cầu. `completedAt` là chuỗi rỗng nếu chưa có thời điểm hoàn tất.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| orderId | Long | Có | Mã đơn hàng |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "eligible": false,
    "windowDays": 7,
    "completedAt": "2026-11-09T10:00:00",
    "partiallyReturned": true,
    "lines": [
      {
        "skuId": 10,
        "quantity": 3,
        "remaining": 2
      }
    ],
    "requests": [
      {
        "id": 21,
        "orderId": 1001,
        "orderCode": "DH-20261109-001",
        "customerName": "Nguyễn An",
        "customerPhone": "0900000001",
        "status": "REFUNDED",
        "reason": "DEFECTIVE",
        "note": "Đường may lỗi",
        "rejectionReason": null,
        "createdAt": "2026-11-09 12:00:00.0",
        "merchandiseAmount": 80000,
        "shippingAmount": 30000,
        "refundAmount": 110000,
        "refundMethod": "STRIPE",
        "refundId": "re_test_example",
        "earnedReverse": 11,
        "redeemedReturn": 10,
        "pointsShortfall": 0,
        "lines": [
          {
            "skuId": 10,
            "productName": "Áo thun",
            "variantName": "Đen / M",
            "quantity": 1,
            "grossAmount": 100000,
            "voucherDiscount": 10000,
            "pointsDiscount": 10000,
            "refundAmount": 80000,
            "restockQuantity": 0
          }
        ],
        "photos": [
          0
        ],
        "history": [
          {
            "status": "REFUNDED",
            "note": null,
            "occurredAt": "2026-11-09T12:30:00"
          }
        ],
        "cancelReason": null,
        "paidAmount": 270000,
        "orderRefundedAmount": 110000
      }
    ],
    "paidAmount": 270000,
    "refundedAmount": 110000
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 2. Gửi yêu cầu trả hàng (FR-50)

- **Endpoint:** `POST /api/v1/returns`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Chỉ đơn COMPLETED đã thanh toán, còn hạn và chưa có yêu cầu mở. Tổng số lượng không vượt lượng mua trừ các yêu cầu chưa bị từ chối/hủy. requestId chống gửi lại; cùng khóa nhưng khác nội dung bị từ chối.

### Request Body
```json
{
  "orderId": 1001,
  "requestId": "dbe7138e-60dc-4130-9e81-9ed33bf3caaa",
  "reason": "DEFECTIVE",
  "note": "Đường may lỗi",
  "lines": [
    {
      "skuId": 10,
      "quantity": 1
    }
  ],
  "photos": []
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| orderId | Long | Có | ID dương của đơn thuộc khách |
| requestId | UUID | Có | Khóa duy nhất cho một lần gửi; giữ nguyên khi thử lại |
| reason | Enum (String) | Có | Một trong 5 mã lý do |
| note | String | Không | Tối đa 1000 ký tự, bắt buộc với OTHER |
| lines | Array | Có | 1–100 dòng, SKU không trùng |
| lines[].skuId | Long | Có | ID SKU dương thuộc đơn |
| lines[].quantity | Integer | Có | Số nguyên dương, không vượt số lượng còn lại |
| photos | Array | Không | Tối đa 3 ảnh |
| photos[].contentType | String | Có nếu có ảnh | image/png hoặc image/jpeg |
| photos[].data | String | Có nếu có ảnh | Base64 thuần, không có data: prefix; ảnh giải mã tối đa 5MB, kiểm tra định dạng, kích thước tối đa 25 megapixel |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "PENDING",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": null,
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": null,
    "earnedReverse": 0,
    "redeemedReturn": 0,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "PENDING",
        "note": null,
        "occurredAt": "2026-11-09T12:00:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 110000
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 3. Xem chi tiết yêu cầu của khách (FR-50)

- **Endpoint:** `GET /api/v1/returns/{id}`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Trả chi tiết và lịch sử yêu cầu thuộc đơn của khách. Không trả actor trong lịch sử, refundActor, refundNote, refundAttempts; note lịch sử chỉ giữ lý do REJECTED/CANCELLED. Ghi chú khách ban đầu vẫn được giữ.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "REFUNDED",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": null,
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": "re_test_example",
    "earnedReverse": 11,
    "redeemedReturn": 10,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "REFUNDED",
        "note": null,
        "occurredAt": "2026-11-09T12:30:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 110000
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 4. Xem ảnh minh chứng của khách (FR-50)

- **Endpoint:** `GET /api/v1/returns/{id}/photos/{position}`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Ảnh chỉ đọc sau kiểm tra quyền sở hữu; position là số nguyên; ảnh được lưu ở vị trí 0 đến 2.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |
| position | Integer | Có | Vị trí ảnh |

### Response Thành công (HTTP 200 OK)
`Content-Type: image/png` hoặc `image/jpeg`, dữ liệu ảnh nhị phân, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Endpoint ảnh trả nhị phân nên không bọc ApiResponse.

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."

---

## 5. Danh sách đổi/trả quản trị (FR-48)

- **Endpoint:** `GET /api/v1/admin/returns`
- **Quyền hạn:** `PERM_RETURN_VIEW` (ADMIN hoặc STAFF được cấp quyền `RETURN_VIEW`)
- **Mô tả:** Lọc status; q tìm mã đơn/tên khách/SĐT; from/to ngày YYYY-MM-DD, ngày cuối bao gồm trọn ngày; page từ 0, size 1–100 (mặc định 20). counts theo tìm kiếm/ngày nhưng không bị lọc bởi status. Sắp theo thời gian và id giảm dần.

### Query parameters

Ví dụ: `?status=PENDING&q=DH-20261109&from=2026-11-01&to=2026-11-10&page=0&size=20`

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| status | String | Không | Trạng thái yêu cầu. |
| q | String | Không | Tìm mã đơn, tên hoặc số điện thoại. |
| from | String | Không | Ngày bắt đầu, định dạng YYYY-MM-DD. |
| to | String | Không | Ngày kết thúc, định dạng YYYY-MM-DD. |
| page | Integer | Không | Trang từ 0, mặc định 0. |
| size | Integer | Không | Số dòng mỗi trang, 1–100, mặc định 20. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "content": [
      {
        "id": 21,
        "orderId": 1001,
        "orderCode": "DH-20261109-001",
        "customerName": "Nguyễn An",
        "customerPhone": "0900000001",
        "status": "REFUNDED",
        "reason": "DEFECTIVE",
        "refundAmount": 110000,
        "createdAt": "2026-11-09 12:00:00.0",
        "paidAmount": 270000,
        "orderRefundedAmount": 110000
      }
    ],
    "counts": [
      {
        "status": "REFUNDED",
        "count": 1
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "isLast": true
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 6. Chi tiết đổi/trả quản trị (FR-48)

- **Endpoint:** `GET /api/v1/admin/returns/{id}`
- **Quyền hạn:** `PERM_RETURN_VIEW` (ADMIN hoặc STAFF được cấp quyền `RETURN_VIEW`)
- **Mô tả:** Trả dòng hàng, ảnh, lý do, tiền hàng, phí giao hàng, phương thức hoàn và lịch sử.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "REFUNDED",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": null,
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": "re_test_example",
    "refundActor": "chapter5_admin",
    "refundNote": "Đã đối soát",
    "earnedReverse": 11,
    "redeemedReturn": 10,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "REFUNDED",
        "actor": "chapter5_admin",
        "note": "Đã đối soát",
        "occurredAt": "2026-11-09T12:30:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 110000,
    "refundAttempts": [
      {
        "number": 1,
        "refundId": "re_test_example",
        "status": "succeeded",
        "idempotencyKey": "fasearch-return-{returnKey}-1",
        "updatedAt": "2026-11-09T12:30:00"
      }
    ]
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 7. Ảnh minh chứng quản trị (FR-48)

- **Endpoint:** `GET /api/v1/admin/returns/{id}/photos/{position}`
- **Quyền hạn:** `PERM_RETURN_VIEW` (ADMIN hoặc STAFF được cấp quyền `RETURN_VIEW`)
- **Mô tả:** Đọc ảnh của yêu cầu, position là số nguyên; ảnh được lưu ở vị trí 0 đến 2.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |
| position | Integer | Có | Vị trí ảnh |

### Response Thành công (HTTP 200 OK)
`Content-Type: image/png` hoặc `image/jpeg`, dữ liệu ảnh nhị phân, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Endpoint ảnh trả nhị phân nên không bọc ApiResponse.

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."

---

## 8. Duyệt, từ chối hoặc hủy yêu cầu đã duyệt (FR-50)

- **Endpoint:** `POST /api/v1/admin/returns/{id}/decision`
- **Quyền hạn:** `PERM_RETURN_PROCESS` (ADMIN hoặc STAFF được cấp quyền `RETURN_PROCESS`)
- **Mô tả:** APPROVE/REJECT chỉ PENDING; CANCEL chỉ APPROVED chưa nhận hàng, bắt buộc lý do. Hủy không đổi tiền/kho/điểm và trả lại hạn mức. Gửi lại đúng trạng thái đích không tạo thêm lịch sử.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |

### Request Body
```json
{
  "action": "REJECT",
  "note": "Sản phẩm không thuộc phạm vi đổi/trả"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| action | String | Có | APPROVE, REJECT hoặc CANCEL |
| note | String | Không | Tối đa 1000 ký tự; REJECT/CANCEL bắt buộc khác rỗng |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "REJECTED",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": "Sản phẩm không thuộc phạm vi đổi/trả",
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": null,
    "refundActor": null,
    "refundNote": null,
    "earnedReverse": 0,
    "redeemedReturn": 0,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "REJECTED",
        "actor": "chapter5_admin",
        "note": "Sản phẩm không thuộc phạm vi đổi/trả",
        "occurredAt": "2026-11-09T12:30:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 0,
    "refundAttempts": []
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 9. Nhận hàng và phân loại tồn (FR-51)

- **Endpoint:** `POST /api/v1/admin/returns/{id}/receive`
- **Quyền hạn:** `PERM_RETURN_PROCESS` (ADMIN hoặc STAFF được cấp quyền `RETURN_PROCESS`)
- **Mô tả:** Chỉ sau APPROVED. Cần đủ mọi SKU, mỗi SKU một lần. restockQuantity tăng tồn vật lý và khả dụng; phần còn lại là DAMAGED, tạo phiếu xuất hoàn tất TRA-{returnId}-{skuId}, không trừ thêm tồn bán. Gửi lại cùng số lượng không nhập kho hai lần; đổi số lượng sau nhận bị từ chối.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |

### Request Body
```json
{
  "lines": [
    {
      "skuId": 10,
      "restockQuantity": 0
    }
  ]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| lines | Array | Có | 1–100 dòng, đủ các dòng yêu cầu, không trùng SKU |
| lines[].skuId | Long | Có | ID SKU dương trong yêu cầu |
| lines[].restockQuantity | Integer | Không | 0 đến số lượng trả; nếu bỏ qua mặc định 0; phần còn lại là hàng hỏng |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "RECEIVED",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": null,
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": null,
    "refundActor": null,
    "refundNote": null,
    "earnedReverse": 0,
    "redeemedReturn": 0,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "RECEIVED",
        "actor": "chapter5_admin",
        "note": null,
        "occurredAt": "2026-11-09T12:30:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 0,
    "refundAttempts": []
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- **HTTP 404:** `INVENTORY_NOT_FOUND` (404) — "Không tìm thấy bản ghi kho."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.

---

## 10. Thực hiện hoàn tiền (FR-50)

- **Endpoint:** `POST /api/v1/admin/returns/{id}/refund`
- **Quyền hạn:** `PERM_RETURN_REFUND` (ADMIN hoặc STAFF được cấp quyền `RETURN_REFUND`)
- **Mô tả:** Chỉ sau RECEIVED. BE dùng số tiền đã chụp khi lập yêu cầu, không nhận amount từ người gọi. Stripe chỉ chế độ test; CASH/VNPAY/MoMo/chuyển khoản/ví điện tử ghi nhận hoàn thủ công người thực hiện, tiền và chứng từ bắt buộc. Khách thấy “Hoàn thủ công qua cửa hàng”. Retry trả cùng kết quả, không hoàn tiền/kho/điểm lần hai. `refundAttempts` trong response của lần hoàn thành công được chụp trước khi gọi Stripe; xem lại chi tiết để lấy các lần thử vừa lưu.

### Path parameters

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long | Có | Mã yêu cầu đổi/trả |

### Request Body
```json
{
  "note": "Phiếu chi PC-001"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| note | String | Không | Tối đa 1000 ký tự; hoàn thủ công bắt buộc ghi chứng từ |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác đổi/trả thành công.",
  "result": {
    "id": 21,
    "orderId": 1001,
    "orderCode": "DH-20261109-001",
    "customerName": "Nguyễn An",
    "customerPhone": "0900000001",
    "status": "REFUNDED",
    "reason": "DEFECTIVE",
    "note": "Đường may lỗi",
    "rejectionReason": null,
    "createdAt": "2026-11-09 12:00:00.0",
    "merchandiseAmount": 80000,
    "shippingAmount": 30000,
    "refundAmount": 110000,
    "refundMethod": "STRIPE",
    "refundId": "re_test_example",
    "refundActor": "chapter5_admin",
    "refundNote": "Đã đối soát",
    "earnedReverse": 11,
    "redeemedReturn": 10,
    "pointsShortfall": 0,
    "lines": [
      {
        "skuId": 10,
        "productName": "Áo thun",
        "variantName": "Đen / M",
        "quantity": 1,
        "grossAmount": 100000,
        "voucherDiscount": 10000,
        "pointsDiscount": 10000,
        "refundAmount": 80000,
        "restockQuantity": 0
      }
    ],
    "photos": [
      0
    ],
    "history": [
      {
        "status": "REFUNDED",
        "actor": "chapter5_admin",
        "note": "Đã đối soát",
        "occurredAt": "2026-11-09T12:30:00"
      }
    ],
    "cancelReason": null,
    "paidAmount": 270000,
    "orderRefundedAmount": 110000,
    "refundAttempts": [
      {
        "number": 1,
        "refundId": "re_test_example",
        "status": "succeeded",
        "idempotencyKey": "fasearch-return-{returnKey}-1",
        "updatedAt": "2026-11-09T12:30:00"
      }
    ]
  },
  "timestamp": "2026-11-09T12:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400) — "Dữ liệu yêu cầu không hợp lệ."
- **HTTP 401:** `UNAUTHENTICATED` (401) — "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 403:** `ACCESS_DENIED` (403) — "Bạn không có quyền truy cập tài nguyên này."
- **HTTP 404:** `ORDER_NOT_FOUND` (404) — "Không tìm thấy đơn hàng."
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404) — "Không tìm thấy tài nguyên."
- **HTTP 404:** `CUSTOMER_NOT_FOUND` (404) — "Không tìm thấy khách hàng."
- **HTTP 409:** `LOYALTY_STATE_CONFLICT` (4208) — "Trạng thái điểm đã thay đổi. Tải lại và thử lại."
- **HTTP 400:** `PAYMENT_PROVIDER_REJECTED` (400) — "Nhà cung cấp thanh toán đã từ chối yêu cầu."
- **HTTP 503:** `PAYMENT_PROVIDER_UNAVAILABLE` (503) — "Nhà cung cấp thanh toán hiện không khả dụng."
- **HTTP 503:** `PAYMENT_PROVIDER_NOT_CONFIGURED` (503) — "Nhà cung cấp thanh toán chưa được cấu hình."
- Thông báo `INVALID_REQUEST` thực tế có thể nêu chi tiết điều kiện không hợp lệ; lỗi kiểm tra DTO trả mã 400, thông báo "Dữ liệu không hợp lệ." và danh sách `errors`.
- Lỗi Stripe có thể thay thông báo mặc định bằng thông báo cụ thể; trạng thái chưa xác nhận cần thử lại cùng yêu cầu để đối soát.

---

## 11. Quy tắc tiền, điểm và doanh thu (FR-49, FR-50, FR-51)

- Tiền hàng hoàn = tổng snapshot `quantity × unitPrice − discountAmount − pointsDiscountAmount` của dòng được chọn. Chia lũy kế theo số lượng, làm tròn xuống VND (tiền mặt có phần lẻ giữ đến 2 chữ số) để các lần trả cộng đúng giá thực trả gốc; với Stripe VND, phần lẻ giữa dòng được phân bổ lũy kế theo thứ tự SKU; tiền trước giảm hiển thị bằng tiền hoàn + từng phần giảm được phân bổ. Không lấy giá sản phẩm hiện tại.
- Phí giao hàng hoàn đủ một lần khi lý do DEFECTIVE/NOT_AS_DESCRIBED; các lần khác không hoàn. Không vượt số tiền hóa đơn thực trả. Đơn 0đ xử lý tại chỗ, không gọi Stripe.
- Stripe: lấy payment_intent từ session SETTLED, kiểm tra test/paid/VND và amount_total khớp hóa đơn. Đối soát GET /v1/refunds theo payment_intent và metadata return_key trước khi POST /v1/refunds, header Idempotency-Key fasearch-return-{requestUUID}. Có phân trang khi đối soát; không dựa riêng vào thời gian lưu khóa của Stripe. Chỉ refund succeeded đúng số tiền/currency/intent mới ghi REFUNDED. Lưu refund id. VNPAY/MoMo/chuyển khoản/ví điện tử hoàn thủ công qua cửa hàng, bắt buộc chứng từ. Stripe luôn đi qua cổng, không chuyển sang thủ công.
- Earned points bị thu hồi theo tỷ lệ tiền hoàn/tổng thực trả, tính lũy kế để không mất phần dư. RETURN_REVERSE là bút toán mới; không làm âm số dư và không lấy điểm đang giữ cho đơn khác. Shortfall ghi trên yêu cầu. Điểm đã đổi hoàn theo tỷ lệ snapshot giảm điểm của dòng, RETURN_REDEEM. Sổ cũ không bị sửa/xóa.
- Hoàn hết tiền hóa đơn đặt paymentStatus REFUNDED; hoàn một phần giữ PAID và tổng tiền hoàn ở các yêu cầu REFUNDED. Hóa đơn gốc giữ số tiền lịch sử. Trả và hoàn đủ toàn bộ số lượng đặt orderStatus RETURNED; một phần giữ COMPLETED và nhãn “Đã trả một phần”.
- Analytics: doanh thu = hóa đơn PAID hoặc REFUNDED trừ tổng tiền hoàn thành công; theo **ngày hóa đơn gốc** (báo cáo hồi tố), không theo ngày hoàn. Áp dụng revenue timeline/KPI/payment methods/top customers/category/top-products; nhóm sản phẩm trừ tiền hàng hoàn, phí giao hàng không thuộc nhóm sản phẩm. Hóa đơn REFUNDED hoặc net bằng 0 sau hoàn không được tính vào số đơn paidTotals, paidByMethod, topCustomers, timeline và mẫu số AOV. Chi tiêu tích lũy/hạng khách và Export CSV khách cũng dùng tiền đã trả trừ hoàn thành công. Export CSV đơn ghi “Đã hoàn tiền” cho REFUNDED, giữ phương thức thanh toán và tổng tiền net sau hoàn; hoàn một phần ghi “Đã hoàn một phần”. Lịch sử đơn/hóa đơn vẫn giữ nguyên giao dịch gốc.
- Sự kiện ReturnService.ReturnChanged phát trong transaction, gồm returnId/orderId/status; lane notification dùng TransactionalEventListener AFTER_COMMIT để gửi thông báo.

Tham chiếu provider: [Stripe Refund object](https://docs.stripe.com/api/refunds/object), [Create a refund](https://docs.stripe.com/api/refunds/create). Refund object không có trường livemode; kiểm tra test mode trên session và khóa sk_test trước khi gọi.

- Điểm: cộng điểm đã đổi trả lại trước, rồi `deduction = min(reverse, max(0, balance + redeemed - held))`; `shortfall = reverse - deduction`. Ghi RETURN_REDEEM trước RETURN_REVERSE, giữ khóa khách/held và append-only. Số dư 0, reverse 10, redeemed 20 → số dư 10, thiếu 0.
- Hoàn hết hàng nhưng giữ phí giao hàng: order RETURNED, invoice PAID; admin/khách hiển thị “Đã hoàn một phần”, số đã hoàn / số đã trả. Chi tiết đơn trả `paidAmount`, `refundedAmount` ngay cả khi người xem không có RETURN_VIEW.
- Tồn kho và số lượng báo cáo: đã bán và units danh mục/SKU trừ quantity của yêu cầu REFUNDED. Cột Hỏng loại phiếu `TRA-%` vì đây là hàng trả chưa nhập kho bán; không trừ kho lần nữa. Không thêm cột mới. Số lượng vẫn hồi tố theo ngày hóa đơn gốc, giống doanh thu.
- Danh sách admin chỉ lấy projection tóm tắt bằng 3 truy vấn/page (counts, total, content); không gọi detail() từng dòng. Nhấn một yêu cầu mới tải dòng hàng/ảnh/lịch sử.
- Hoàn tiền khóa đơn → hóa đơn → khách; tính/kiểm tra số tiền, điểm, held, actor, trạng thái và chuẩn bị response trước gọi Stripe. Sau provider chỉ ghi kết quả đã chuẩn bị. Provider chưa thành công không ghi điểm/hóa đơn/REFUNDED; chỉ lưu bằng chứng lần thử.
- Stripe đối soát mọi trang metadata `return_key`; succeeded mới đánh dấu hoàn. failed/canceled cho lần thử mới với khóa `fasearch-return-{returnKey}-{attemptNumber}` và metadata attempt_number. Refund cũ thiếu attempt_number được coi là lần 1. Pending/requires_action/unknown giữ nguyên khóa/đối soát, không tạo lần mới. Bảng order_return_refund_attempt lưu số lần, refund id, status, idempotency key; admin hiển thị “Stripe từ chối hoàn tiền, thử lại”. Theo [Stripe Refund object](https://docs.stripe.com/api/refunds/object) và [idempotency](https://docs.stripe.com/api/idempotent_requests).
