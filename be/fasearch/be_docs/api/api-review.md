# TÀI LIỆU API: MODULE REVIEW (ĐÁNH GIÁ SẢN PHẨM)

Module `review` chịu trách nhiệm quản lý đánh giá sản phẩm của khách hàng: xem danh sách & tổng quan đánh giá (công khai), khách đã nhận hàng viết / sửa / xóa đánh giá của mình, và quản trị viên / quản lý ẩn hoặc hiện lại đánh giá vi phạm. Bảng dữ liệu: `product_review` (Flyway `V23`, chỉ thêm mới — không sửa bảng cũ).

Quy tắc nghiệp vụ chung:
- Chỉ khách (`CUSTOMER`) có **đơn hàng `COMPLETED` chứa sản phẩm** mới được viết đánh giá (đánh dấu `verifiedPurchase = true`).
- Mỗi tài khoản chỉ có **một** đánh giá đang hoạt động cho mỗi sản phẩm (xóa mềm xong có thể viết lại).
- Đánh giá bị ẩn (`hidden = true`) không xuất hiện ở danh sách công khai và không tính vào tổng quan.
- Tên tác giả được rút gọn (ví dụ `Nguyễn A.`), không trả tên đăng nhập hay thông tin liên hệ.

---

## 1. Danh sách đánh giá của sản phẩm (FR-NC4)

- **Endpoint:** `GET /api/v1/reviews/products/{productId}`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Trả danh sách đánh giá đang hiển thị của một sản phẩm, có phân trang, sắp xếp và lọc theo số sao.

### Query Parameters

| Tham số | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `rating` | Integer | Không | | Lọc theo số sao (1 - 5) |
| `sort` | String | Không | `newest` | `newest` (mới nhất), `rating_desc` / `highest` (sao cao nhất), `rating_asc` / `lowest` (sao thấp nhất); không phân biệt hoa thường |
| `page` | Integer | Không | `0` | Trang (bắt đầu từ 0) |
| `size` | Integer | Không | `10` | Số bản ghi mỗi trang (1 - 50) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách đánh giá thành công",
  "result": {
    "content": [
      {
        "id": 128,
        "productId": 2301,
        "rating": 5,
        "title": "Đáng tiền",
        "body": "Vải mát, form đẹp, giặt xong không bị co.",
        "sizeFit": "VUA",
        "verifiedPurchase": true,
        "authorName": "Nguyễn A.",
        "createdAt": "2026-11-04T09:15:00",
        "updatedAt": "2026-11-04T09:15:00"
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-05T10:00:00"
}
```

- `ReviewRes` bỏ các trường có giá trị null khỏi JSON. `sizeFit` khi có là `NHO` (hơi nhỏ), `VUA` (vừa vặn), `RONG` (hơi rộng); `hidden` và `hiddenReason` chỉ dành cho tác giả hoặc quản trị, `productName` chỉ dành cho quản trị.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `rating` ngoài khoảng 1 - 5 hoặc `sort` không hợp lệ (`INVALID_REQUEST`).
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 2. Tổng quan đánh giá của sản phẩm (FR-NC4)

- **Endpoint:** `GET /api/v1/reviews/products/{productId}/summary`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Trả điểm trung bình, số lượng đánh giá, phân bố số sao và tóm tắt cảm nhận kích cỡ của sản phẩm.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy tổng quan đánh giá thành công",
  "result": {
    "productId": 2301,
    "average": 4.3,
    "count": 12,
    "distribution": { "5": 6, "4": 4, "3": 1, "2": 1, "1": 0 },
    "fit": { "NHO": 1, "VUA": 8, "RONG": 1 },
    "fitCount": 10,
    "fitVerdict": "VUA"
  },
  "timestamp": "2026-11-05T10:00:00"
}
```

- `productId` là Long; `average` là double làm tròn 1 chữ số thập phân, bằng `0` khi chưa có đánh giá; `count` là long. `distribution` ánh xạ các khóa `"1"`–`"5"` đến số lượng long.
- `fit` ánh xạ `NHO`, `VUA`, `RONG` đến số lượng long; `fitCount` là tổng số đánh giá có chọn cảm nhận. Giao diện tính tỷ lệ mỗi nhóm bằng số lượng chia `fitCount`, và dùng `fitVerdict` để gợi ý lên size, giữ size hoặc xuống size.
- `fitVerdict`: nhóm cảm nhận kích cỡ nhiều nhất; `null` khi có ít hơn 5 đánh giá chọn cảm nhận kích cỡ (3 hoặc 4 phiếu vẫn là `null`; từ 5 phiếu mới có lời khuyên).

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 3. Kiểm tra quyền đánh giá & đánh giá của tôi (FR-NC5)

- **Endpoint:** `GET /api/v1/reviews/products/{productId}/me`
- **Quyền hạn:** `CUSTOMER` (Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Cho biết khách hiện tại đã nhận hàng sản phẩm này chưa, đã đánh giá chưa, và trả lại đánh giá của chính khách (nếu có).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Kiểm tra quyền đánh giá thành công",
  "result": {
    "canReview": false,
    "purchased": true,
    "alreadyReviewed": true,
    "reason": "ALREADY_REVIEWED",
    "myReview": {
      "id": 128,
      "productId": 2301,
      "rating": 5,
      "title": "Đáng tiền",
      "body": "Vải mát, form đẹp.",
      "sizeFit": "VUA",
      "verifiedPurchase": true,
      "authorName": "Nguyễn A.",
      "createdAt": "2026-11-04T09:15:00",
      "updatedAt": "2026-11-04T09:15:00",
      "hidden": false
    }
  },
  "timestamp": "2026-11-05T10:00:00"
}
```

- `reason`: `NOT_PURCHASED` (chưa có đơn `COMPLETED` chứa sản phẩm), `ALREADY_REVIEWED` hoặc `null` (được phép viết).

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Không phải vai trò `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).

---

## 4. Viết đánh giá (FR-NC5)

- **Endpoint:** `POST /api/v1/reviews/products/{productId}`
- **Quyền hạn:** `CUSTOMER` (chỉ khách có đơn `COMPLETED` chứa sản phẩm; Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Khách đã nhận hàng gửi đánh giá cho sản phẩm; hệ thống tự gán `verifiedPurchase = true`.

### Request Body
```json
{
  "rating": 5,
  "title": "Đáng tiền",
  "body": "Vải mát, form đẹp, giặt xong không bị co.",
  "sizeFit": "VUA"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Validation | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `rating` | Integer | Có | 1 - 5 | Số sao |
| `title` | String | Không | Tối đa 120 ký tự | Tiêu đề ngắn |
| `body` | String | Không | Tối đa 2000 ký tự | Nội dung nhận xét |
| `sizeFit` | String | Không | `NHO`, `VUA`, `RONG` | Cảm nhận về kích cỡ |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Gửi đánh giá thành công",
  "result": {
    "id": 128,
    "productId": 2301,
    "rating": 5,
    "title": "Đáng tiền",
    "body": "Vải mát, form đẹp, giặt xong không bị co.",
    "sizeFit": "VUA",
    "verifiedPurchase": true,
    "authorName": "Nguyễn A.",
    "createdAt": "2026-11-05T10:00:00",
    "updatedAt": "2026-11-05T10:00:00",
    "hidden": false
  },
  "timestamp": "2026-11-05T10:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ (thiếu `rating`, ngoài 1 - 5, quá độ dài).
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Chưa nhận hàng sản phẩm này (`4301 REVIEW_NOT_ELIGIBLE`: "Chỉ khách đã nhận hàng sản phẩm này mới được đánh giá") hoặc không phải vai trò `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy sản phẩm (`PRODUCT_NOT_FOUND`).
- **HTTP 409 Conflict:** Đã đánh giá sản phẩm này, hãy chỉnh sửa (`4302 REVIEW_ALREADY_EXISTS`: "Bạn đã đánh giá sản phẩm này, hãy chỉnh sửa đánh giá hiện có").

---

## 5. Sửa đánh giá của tôi (FR-NC5)

- **Endpoint:** `PUT /api/v1/reviews/products/{productId}`
- **Quyền hạn:** `CUSTOMER` (chỉ sửa đánh giá của chính mình; Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Thay thế nội dung đánh giá hiện có (số sao, tiêu đề, nội dung, cảm nhận kích cỡ).

### Request Body
```json
{
  "rating": 4,
  "title": "Ổn nhưng hơi chật vai",
  "body": "Mặc vài lần thấy hơi chật vai, chất vải vẫn tốt.",
  "sizeFit": "NHO"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Validation | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `rating` | Integer | Có | 1 - 5 | Số sao |
| `title` | String | Không | Tối đa 120 ký tự | Tiêu đề ngắn |
| `body` | String | Không | Tối đa 2000 ký tự | Nội dung nhận xét |
| `sizeFit` | String | Không | `NHO`, `VUA`, `RONG` | Cảm nhận về kích cỡ |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật đánh giá thành công",
  "result": {
    "id": 128,
    "productId": 2301,
    "rating": 4,
    "title": "Ổn nhưng hơi chật vai",
    "body": "Mặc vài lần thấy hơi chật vai, chất vải vẫn tốt.",
    "sizeFit": "NHO",
    "verifiedPurchase": true,
    "authorName": "Nguyễn A.",
    "createdAt": "2026-11-05T10:00:00",
    "updatedAt": "2026-11-06T08:30:00",
    "hidden": false
  },
  "timestamp": "2026-11-06T08:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ.
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Không phải vai trò `CUSTOMER`.
- **HTTP 404 Not Found:** Chưa có đánh giá để sửa (`4303 REVIEW_NOT_FOUND`: "Không tìm thấy đánh giá") hoặc không tìm thấy sản phẩm.

---

## 6. Xóa đánh giá của tôi (FR-NC5)

- **Endpoint:** `DELETE /api/v1/reviews/products/{productId}`
- **Quyền hạn:** `CUSTOMER` (chỉ xóa đánh giá của chính mình; Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Xóa mềm (`da_xoa = true`) đánh giá của khách; sau đó khách có thể viết lại đánh giá mới.

### Response Thành công (HTTP 200 OK)

`result` không xuất hiện vì giá trị null.
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa đánh giá thành công",
  "timestamp": "2026-11-06T08:35:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Không phải vai trò `CUSTOMER`.
- **HTTP 404 Not Found:** Chưa có đánh giá để xóa (`4303 REVIEW_NOT_FOUND`: "Không tìm thấy đánh giá").

---

## 7. Danh sách đánh giá cho quản trị (FR-NC6)

- **Endpoint:** `GET /api/v1/admin/reviews`
- **Quyền hạn:** `PERM_REVIEW_MODERATE` (Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Liệt kê mọi đánh giá (kể cả đã ẩn), mới nhất trước, kèm tên sản phẩm và lý do ẩn để kiểm duyệt.

### Query Parameters

| Tham số | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `productId` | Long | Không | | Chỉ đánh giá của một sản phẩm |
| `hidden` | Boolean | Không | | `true` chỉ đánh giá đã ẩn, `false` chỉ đánh giá đang hiển thị |
| `page` | Integer | Không | `0` | Trang (bắt đầu từ 0) |
| `size` | Integer | Không | `20` | Số bản ghi mỗi trang (1 - 100) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách đánh giá quản trị thành công",
  "result": {
    "content": [
      {
        "id": 131,
        "productId": 2301,
        "rating": 1,
        "title": "Quảng cáo",
        "body": "Mua hàng giá rẻ tại website khác...",
        "verifiedPurchase": true,
        "authorName": "Lê M.",
        "createdAt": "2026-11-05T09:00:00",
        "updatedAt": "2026-11-05T09:00:00",
        "hidden": true,
        "hiddenReason": "Spam",
        "productName": "Áo thun cotton basic"
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-05T10:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Thiếu quyền `PERM_REVIEW_MODERATE`.

---

## 8. Ẩn / hiện đánh giá (FR-NC6)

- **Endpoint:** `PATCH /api/v1/admin/reviews/{reviewId}/visibility`
- **Quyền hạn:** `PERM_REVIEW_MODERATE` (Cần Header `Authorization: Bearer <token>`)
- **Mô tả:** Ẩn đánh giá vi phạm khỏi trang sản phẩm (kèm lý do) hoặc hiện lại. Đánh giá ẩn không tính vào điểm trung bình.

### Request Body
```json
{
  "hidden": true,
  "reason": "Spam"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Validation | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `hidden` | Boolean | Có | | `true` ẩn, `false` hiện lại |
| `reason` | String | Không | Tối đa 255 ký tự | Lý do ẩn (bỏ qua khi hiện lại) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật trạng thái hiển thị đánh giá thành công",
  "result": {
    "id": 131,
    "productId": 2301,
    "rating": 1,
    "title": "Quảng cáo",
    "body": "Mua hàng giá rẻ tại website khác...",
    "verifiedPurchase": true,
    "authorName": "Lê M.",
    "createdAt": "2026-11-05T09:00:00",
    "updatedAt": "2026-11-05T10:05:00",
    "hidden": true,
    "hiddenReason": "Spam",
    "productName": "Áo thun cotton basic"
  },
  "timestamp": "2026-11-05T10:05:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `hidden` hoặc `reason` quá dài.
- **HTTP 401 Unauthorized:** Thiếu token hoặc token không hợp lệ / hết hạn.
- **HTTP 403 Forbidden:** Thiếu quyền `PERM_REVIEW_MODERATE`.
- **HTTP 404 Not Found:** Không tìm thấy đánh giá (`4303 REVIEW_NOT_FOUND`: "Không tìm thấy đánh giá").
