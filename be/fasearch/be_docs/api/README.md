# TÀI LIỆU ĐẶC TẢ API HỆ THỐNG (FA SEARCH BACKEND)

Tài liệu này tổng hợp toàn bộ thông số kỹ thuật, cấu trúc Request, Response và quy chuẩn giao tiếp API của hệ thống **FaSearch Backend**.

> 📌 **Tài liệu liên quan:**
> - Danh mục 54 chức năng, ma trận Role (RBAC) & Tiến độ: **[module.md](../module.md)**
> - Hướng dẫn quy tắc phát triển dành cho Agent: **[AGENTS.md](../../AGENTS.md)**

---

## I. MỤC LỤC CÁC PHÂN HỆ API

| STT | Phân hệ (Module) | File tài liệu | Mô tả |
| :---: | :--- | :--- | :--- |
| 1 | **Xác thực & Tài khoản** | [api-auth.md](./api-auth.md) | Đăng nhập, đăng ký, thông tin tài khoản, quản lý tài khoản & RBAC |
| 2 | **Người dùng & Khách hàng** | [api-user.md](./api-user.md) | Hồ sơ khách hàng, nhân viên, tích điểm & hạng thành viên |
| 3 | **Sản phẩm & Danh mục** | [api-product.md](./api-product.md) | Danh mục, sản phẩm, biến thể SKU, mã vạch Barcode, tra cứu POS |
| 4 | **Tìm kiếm thông minh (AI)** | [api-search.md](./api-search.md) | Tìm kiếm tự nhiên NLP, tìm kiếm bằng ảnh & tìm kiếm đa phương thức |
| 5 | **Kho hàng & Tồn kho** | [api-inventory.md](./api-inventory.md) | Tra cứu tồn, nhập kho, xuất hủy/chuyển kho, kiểm kê & cảnh báo |
| 6 | **Đơn hàng & Giỏ hàng** | [api-order.md](./api-order.md) | Giỏ hàng, đặt hàng Online, POS đơn tạm, cập nhật trạng thái đơn |
| 7 | **Thanh toán & Hóa đơn** | [api-payment.md](./api-payment.md) | Tính tiền, phương thức thanh toán, xuất hóa đơn & VNPAY QR |
| 8 | **Khuyến mãi & Giảm giá** | [api-promotion.md](./api-promotion.md) | Chương trình khuyến mãi, phát hành mã voucher & xác thực voucher |
| 9 | **Đổi / Trả hàng** | [api-returnorder.md](./api-returnorder.md) | Tra cứu hóa đơn đổi trả, lập phiếu đổi trả & nhập kho thu hồi |
| 10 | **Báo cáo & Thống kê** | [api-analytics.md](./api-analytics.md) | Doanh thu, top sản phẩm bán chạy, báo cáo xuất - nhập - tồn |

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
- Với các endpoint cần xác thực (Role `ADMIN`, `STAFF`, `CUSTOMER`):
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
    "isLast": false
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
| `500` | `INTERNAL_SERVER_ERROR` | Lỗi nội bộ không xác định từ phía hệ thống |
