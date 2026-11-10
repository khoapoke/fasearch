# TÀI LIỆU API: MODULE NOTIFICATION (THÔNG BÁO ĐƠN HÀNG & SẢN PHẨM)

## 1. Đọc tùy chọn email đơn hàng (FR-N1-01)

- **Endpoint:** `GET /api/v1/notifications/preferences`
- **Quyền hạn:** CUSTOMER; chỉ tài khoản đang đăng nhập
- **Mô tả:** Đọc tùy chọn; mặc định bật khi chưa có bản ghi.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "orderUpdates": true
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không phải CUSTOMER.

## 2. Lưu tùy chọn email đơn hàng (FR-N1-01)

- **Endpoint:** `PUT /api/v1/notifications/preferences`
- **Quyền hạn:** CUSTOMER; chỉ tài khoản đang đăng nhập
- **Mô tả:** Lưu bật/tắt email trạng thái đơn và đổi/trả. Email hủy đơn chỉ hiển thị lý do hủy riêng; không dùng ghi chú tích lũy hoặc tên đăng nhập nhân viên. Kiểm tra lại tùy chọn ngay trước khi gửi, kể cả email đang chờ retry.

### Request Body
```json
{
  "orderUpdates": false
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| orderUpdates | Boolean | Có | Bật hoặc tắt email cập nhật đơn và đổi/trả. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "orderUpdates": false
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 400: Thiếu trường hoặc giá trị null/sai kiểu.
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không phải CUSTOMER.

## 3. Đọc cảnh báo sản phẩm yêu thích (FR-N1-02)

- **Endpoint:** `GET /api/v1/notifications/favorites`
- **Quyền hạn:** CUSTOMER; chỉ danh sách yêu thích của mình
- **Mô tả:** Trả tùy chọn và tổng tồn khả dụng các SKU chưa xóa. Mặc định cả hai cảnh báo tắt.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "items": [
      {
        "productId": 3129,
        "stockAlert": true,
        "priceAlert": false,
        "availableStock": 0
      }
    ]
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không phải CUSTOMER.

## 4. Lưu cảnh báo sản phẩm yêu thích (FR-N1-02)

- **Endpoint:** `PUT /api/v1/notifications/favorites/{productId}`
- **Quyền hạn:** CUSTOMER; sản phẩm phải thuộc danh sách yêu thích chưa xóa của mình
- **Mô tả:** Lưu hai tùy chọn. UI chỉ mời bật báo có hàng khi hết hàng; tùy chọn đã bật vẫn có thể tắt khi có hàng. Khóa dòng yêu thích để đồng bộ với thao tác xóa.

### Request Body
```json
{
  "stockAlert": true,
  "priceAlert": true
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| productId | Long (path) | Có | ID sản phẩm đã yêu thích. |
| stockAlert | Boolean | Có | Báo khi SKU có hàng trở lại. |
| priceAlert | Boolean | Có | Báo khi Publish làm giảm giá sản phẩm. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "stockAlert": true,
    "priceAlert": true
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 400: Thiếu tùy chọn hoặc sai kiểu.
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không phải CUSTOMER.
- HTTP 404 (`RESOURCE_NOT_FOUND`, code 404): "Sản phẩm không có trong danh sách yêu thích của bạn."

## 5. Đọc chuông quản trị (FR-N1-03 / FR-34)

- **Endpoint:** `GET /api/v1/admin/notifications`
- **Quyền hạn:** Có ít nhất một authority `PERM_ORDER_VIEW`, `PERM_RETURN_VIEW`, `PERM_INVENTORY_VIEW`
- **Mô tả:** Tối đa 30 thông báo mới nhất; unreadCount tính trên toàn bộ thông báo nhìn thấy. Lọc ngay trong SQL theo quyền VIEW hiện tại, cả danh sách và số chưa đọc. Trình duyệt thăm dò mỗi 30 giây.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "unreadCount": 1,
    "items": [
      {
        "id": 12,
        "title": "Đơn hàng mới DH-20261109-001",
        "href": "/quan-tri/don-hang/89",
        "permission": "ORDER_VIEW",
        "createdAt": "2026-11-09T15:00:00Z",
        "read": false
      }
    ]
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không có quyền VIEW phù hợp; CUSTOMER bị từ chối.

## 6. Đánh dấu đã đọc (FR-N1-03)

- **Endpoint:** `POST /api/v1/admin/notifications/{id}/read`
- **Quyền hạn:** Có ít nhất một authority `PERM_ORDER_VIEW`, `PERM_RETURN_VIEW`, `PERM_INVENTORY_VIEW`; chỉ ghi cho thông báo có quyền VIEW tương ứng
- **Mô tả:** Idempotent, trạng thái đọc riêng từng tài khoản. ID không nhìn thấy hoặc không tồn tại trả cập nhật=false mà không lộ nội dung. Không tự đánh dấu cho người khác.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| id | Long (path) | Có | ID thông báo. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thông báo thành công.",
  "result": {
    "id": 12,
    "read": true,
    "updated": true
  },
  "timestamp": "2026-11-09T22:00:00"
}
```

### Response Lỗi thường gặp
- HTTP 401: Chưa đăng nhập.
- HTTP 403: Không có quyền VIEW phù hợp; CUSTOMER bị từ chối.

## 7. Cơ chế sự kiện, chống trùng và an toàn email (FR-N1-01..03)

- V29 lưu signal cùng transaction bằng trigger cho đơn, đổi/trả, tồn kho và giá Publish. Rollback không để lại signal. Không backfill đơn cũ hay tồn kho hiện có khi migrate.
- `NotificationListener` nghe `OrderChanged`, `ReturnService.ReturnChanged`, `ProductPublishedEvent` với `AFTER_COMMIT`, đánh thức worker trên thread riêng. Poll 5 giây phục hồi khi mất tín hiệu đánh thức hoặc tiến trình khởi động lại. SQL row lock `FOR UPDATE SKIP LOCKED` bảo vệ nhiều worker.
- Email đơn: CONFIRMED, SHIPPING, COMPLETED, CANCELLED (kèm ghi chú/lý do). Email đổi/trả: APPROVED, REJECTED (kèm lý do), REFUNDED (kèm số tiền). HTML tiếng Việt, escape tên/ghi chú, dòng hàng, tổng tiền và liên kết chi tiết đơn. Unique `order:{orderId}:{status}`; return dùng `return:{returnId}:{status}` để hai yêu cầu riêng không che nhau.
- Mỗi mail có bản ghi trạng thái PENDING / SENT / DRY_RUN / SKIPPED / FAILED. Retry tối đa 3 lượt worker, chờ 30/60 giây khi lỗi; BrevoMailClient hiện có tự retry trong mỗi lượt. Lỗi không lan vào transaction đơn. Bản ghi đã hoàn tất không gửi lại khi replay sự kiện. Khóa UUID ổn định được truyền trong `headers.idempotencyKey` của Brevo cho mọi lượt retry; `duplicate_parameter` chỉ được xem thành công nếu lỗi nói rõ idempotency key đã xử lý. `first_attempt_at` được commit trước HTTP. Sau 10 phút kể từ lần thử đầu, không tự gửi lại mà đánh FAILED/DELIVERY_WINDOW_EXPIRED để tránh vượt cửa sổ chống trùng của nhà cung cấp sau crash/downtime. Xem [Brevo idempotency](https://developers.brevo.com/docs/heterogenous-versions-batch-emails). Cần đối soát thủ công những bản ghi này; không có cơ chế tự xóa bản ghi rồi gửi lại.
- Cảnh báo yêu thích: SKU từ khả dụng <=0 sang >0 sau nhập hàng, trả hàng hoặc thay đổi kho; giá giảm khi Publish tăng publication_version và trạng thái PUBLISHED. Bỏ qua sản phẩm chưa Publish, đã xóa hoặc ngừng bán. Chỉ các tùy chọn đã bật trước sự kiện mới nhận, không gửi hồi tố khi vừa bật. Kiểm tra yêu thích/tùy chọn/tài khoản còn hiệu lực trước gửi.
- `favorite_alert_rate` khóa allowance chung cho cả hai loại, tối đa một email được xếp hàng cho mỗi sản phẩm/khách trong 24 giờ (không phải một email cho mỗi loại). Dùng upsert điều kiện để nhiều worker không vượt hạn mức.
- Chuông: đơn PENDING mới -> ORDER_VIEW; yêu cầu trả PENDING -> RETURN_VIEW; SKU từ trên ngưỡng xuống <= ngưỡng -> INVENTORY_VIEW. Mỗi lần vượt ngưỡng tạo sự kiện riêng, không tạo lặp khi tiếp tục giảm dưới ngưỡng. Read marker riêng account, không thay tiền/kho nên dùng quyền VIEW hiện có, không thêm permission code.
- **Dev dùng dry-run mặc định** `${notifications.dry-run:true}`: chỉ lưu nội dung và ghi mail id/event key, hoàn toàn không gọi Brevo, dù đã cấu hình BREVO_API_KEY. Muốn gửi thật ở môi trường được phép phải chủ động đặt `notifications.dry-run=false`. Lane N1 không bật gửi thật, không sửa khóa Brevo, không gửi tới khách hàng thật.
- BFF: GET/PUT `/api/customer-account/notifications/{preferences|favorites[/productId]}`; GET `/api/admin/notifications`; POST `/api/admin/notifications/{id}/read`. JWT giữ trong cookie HttpOnly; ghi dữ liệu bắt buộc origin tin cậy, JSON và body <=1KB. ID/path được allowlist, không proxy tùy ý.

Ghi chú R3-F (V32): mỗi cảnh báo yêu thích có thời điểm kích hoạt riêng; đổi tùy chọn kia hoặc lưu lại không bỏ sự kiện đang chờ. Tắt rồi bật lại chỉ nhận sự kiện mới từ lần bật này. Chuông trả tối đa 30 mục, ưu tiên chưa đọc rồi mới đến đã đọc, mới nhất trong mỗi nhóm; tiếp tục đánh dấu để truy cập các mục cũ hơn. Bộ lọc quyền áp dụng cho số đếm, danh sách và đánh dấu.
