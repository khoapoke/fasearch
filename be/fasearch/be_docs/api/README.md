# TÀI LIỆU ĐẶC TẢ API HỆ THỐNG (FA SEARCH BACKEND)

Tài liệu này tổng hợp toàn bộ thông số kỹ thuật, cấu trúc Request, Response và quy chuẩn giao tiếp API của hệ thống **FaSearch Backend**.

> 📌 **Tài liệu liên quan:**
> - Danh mục chức năng, ma trận Role (RBAC) & Tiến độ: **[module.md](../module.md)**
> - Hướng dẫn quy tắc phát triển dành cho Agent: **[AGENTS.md](../../AGENTS.md)**

---

## I. MỤC LỤC CÁC PHÂN HỆ API

| STT | Phân hệ (Module) | File tài liệu | Mô tả |
| :---: | :--- | :--- | :--- |
| 1 | **Xác thực & Tài khoản** | [api-auth.md](./api-auth.md) | Đăng nhập, đăng ký, quên / đặt lại mật khẩu, xác thực email, quản lý tài khoản & RBAC |
| 2 | **Người dùng & Khách hàng** | [api-user.md](./api-user.md) | Hồ sơ khách hàng, nhân viên, tích điểm & hạng thành viên |
| 3 | **Sản phẩm & Danh mục** | [api-product.md](./api-product.md) | Danh mục, sản phẩm, biến thể SKU, mã vạch Barcode, ảnh sản phẩm, tra cứu POS |
| 4 | **Bản nháp & Xuất bản** | [api-publish.md](./api-publish.md) | Bản nháp sản phẩm, nhập từ URL, xuất bản / gỡ xuất bản & đồng bộ AI |
| 5 | **Thương hiệu** | [api-brand.md](./api-brand.md) | Danh sách thương hiệu công khai & logo |
| 6 | **Tìm kiếm thông minh (AI)** | [api-search.md](./api-search.md) | Tìm kiếm tự nhiên NLP, tìm kiếm bằng ảnh, đa phương thức, lịch sử tìm kiếm & yêu thích |
| 7 | **Kho hàng & Tồn kho** | [api-inventory.md](./api-inventory.md) | Tra cứu tồn, nhập kho, xuất hủy/chuyển kho, kiểm kê |
| 8 | **Đơn hàng & Giỏ hàng** | [api-order.md](./api-order.md) | Giỏ hàng, báo giá ưu đãi, đặt hàng Online, POS đơn tạm, cập nhật trạng thái đơn |
| 9 | **Vận chuyển & Bản đồ** | [api-shipping.md](./api-shipping.md) | Tính phí vận chuyển, gợi ý địa chỉ, tọa độ giao hàng, miễn phí ship |
| 10 | **Thanh toán & Hóa đơn** | [api-payment.md](./api-payment.md) | Tính tiền, xuất hóa đơn, thanh toán Stripe / VNPAY |
| 11 | **Khuyến mãi & Giảm giá** | [api-promotion.md](./api-promotion.md) | Chương trình khuyến mãi, phát hành mã voucher, ưu đãi công khai |
| 12 | **Đổi / Trả hàng** | [api-returnorder.md](./api-returnorder.md) | Chưa triển khai |
| 13 | **Báo cáo & Thống kê** | [api-analytics.md](./api-analytics.md) | Doanh thu, top sản phẩm bán chạy, báo cáo xuất - nhập - tồn |

---

## II. QUY CHUẨN KỸ THUẬT CHUNG

### 1. Base URL
- **Môi trường cục bộ (Local Development):** `http://localhost:8080`
- **Tiền tố phiên bản API:** `/api/v1`

### 2. Tiêu đề yêu cầu (HTTP Headers)
- Định dạng dữ liệu mặc định:
  ```http
  Content-Type: application/json
  Accept: application/json
  ```
- Với các endpoint cần xác thực (Role `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER`):
  ```http
  Authorization: Bearer <access_token>
  ```

### 3. Cấu trúc phản hồi chuẩn (`ApiResponse<T>`)

Mọi phản hồi từ máy chủ đều được chuẩn hóa theo định dạng JSON sau:

#### Phản hồi thành công (Đơn bản ghi / Thao tác thành công)
```json
{
  "success": true,
  "code": 200,
  "message": "Thao tác thành công",
  "result": { ... },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

#### Phản hồi danh sách có phân trang (Pagination Table)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách thành công",
  "result": {
    "content": [ ... ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 45,
    "totalPages": 5,
    "last": false
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

#### Phản hồi lỗi kiểm tra dữ liệu (Error Validate Response)
```json
{
  "success": false,
  "code": 400,
  "message": "Dữ liệu yêu cầu không hợp lệ",
  "result": null,
  "errors": [
    {
      "field": "email",
      "message": "Email không đúng định dạng"
    }
  ],
  "timestamp": "2026-10-25T15:30:00"
}
```

### 4. Bảng mã lỗi hệ thống (`ErrorCode`)

| Mã HTTP | Error Code | Ý nghĩa |
| :---: | :--- | :--- |
| `200` | `OK` | Yêu cầu xử lý thành công |
| `201` | `CREATED` | Bản ghi mới đã được tạo thành công |
| `400` | `INVALID_REQUEST` / `*_ALREADY_EXISTS` | Dữ liệu đầu vào sai validation hoặc đã tồn tại |
| `401` | `UNAUTHORIZED` / `INVALID_TOKEN` | Token không hợp lệ, hết hạn hoặc chưa đăng nhập |
| `403` | `FORBIDDEN` / `ACCESS_DENIED` | Tài khoản không có đủ quyền thực hiện hành động |
| `404` | `RESOURCE_NOT_FOUND` / `*_NOT_FOUND` | Không tìm thấy tài nguyên theo ID hoặc điều kiện lọc |
| `405` | `METHOD_NOT_ALLOWED` | Phương thức HTTP không được hỗ trợ trên endpoint này |
| `409` | `DATA_CONFLICT` | Dữ liệu xung đột (trùng khóa, sai phiên bản) |
| `429` | `TOO_MANY_REQUESTS` | Gọi quá nhiều lần trong thời gian ngắn |
| `500` | `INTERNAL_SERVER_ERROR` | Lỗi nội bộ không xác định từ phía hệ thống |
| `503` | `*_UNAVAILABLE` / `*_NOT_CONFIGURED` | Dịch vụ phụ thuộc (AI, thanh toán, bản đồ, email) không khả dụng |

#### Mã lỗi nghiệp vụ (`ApiResponse.code`)

Các mã dưới đây độc lập với HTTP status (cột HTTP là status trả về):

| Mã | Error Code | HTTP | Ý nghĩa |
| :---: | :--- | :---: | :--- |
| `4101` - `4106` | `VOUCHER_*` | 400 / 404 / 409 | Voucher không tồn tại, tạm dừng, chưa bắt đầu, hết hạn, hết lượt hoặc không áp dụng |
| `4107` | `QUOTE_CHANGED` | 409 | Giá, giỏ hàng, voucher, điểm hoặc phí ship đã đổi sau khi báo giá |
| `4108` | `IDEMPOTENCY_CONFLICT` | 409 | Cùng khóa idempotency nhưng dữ liệu khác |
| `4109` | `CAMPAIGN_VERSION_CHANGED` | 409 | Chương trình khuyến mãi đã đổi phiên bản |
| `4201` - `4208` | `LOYALTY_*` / `INSUFFICIENT_POINTS` / `OPENING_ALREADY_RECORDED` | 409 | Lỗi chính sách, số dư và phiên bản tích điểm |
| `4301` - `4303` | `MAPS_*` | 503 / 429 | Bản đồ chưa bật, đang bận hoặc vượt giới hạn tốc độ |

### 5. Phân quyền theo vai trò

| Vai trò | Tên hiển thị | Phạm vi |
| :--- | :--- | :--- |
| `ADMIN` | Quản trị viên hệ thống | Toàn quyền, gồm quản lý tài khoản đăng nhập / phân quyền (`/api/v1/auth/accounts/**`) và mở đầu điểm tích lũy (`POST /api/v1/quan-tri/thanh-vien/mo-dau`) |
| `STAFF` | Quản lý | Toàn bộ nghiệp vụ cửa hàng: sản phẩm, tồn kho, đơn hàng, khách hàng, hồ sơ nhân sự, khuyến mãi, tích điểm, báo cáo; không quản lý tài khoản đăng nhập |
| `CUSTOMER` | Khách hàng | Giỏ hàng, đặt hàng, thanh toán, hồ sơ và điểm của chính mình |
