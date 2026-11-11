# TÀI LIỆU API: MODULE AUDIT (NHẬT KÝ HOẠT ĐỘNG)

## 1. Tra cứu nhật ký hoạt động (FR-A1-01)

- **Endpoint:** `GET /api/v1/admin/audit`
- **Quyền hạn:** `PERM_AUDIT_VIEW`.
- **Mô tả:** Nhật ký bất biến từ V33, mới nhất trước theo thời gian và ID. Bản ghi và thay đổi nghiệp vụ commit/rollback cùng transaction. Danh sách trường cho phép theo từng bảng; không lưu mật khẩu, token, email, điện thoại, địa chỉ, CCCD, ghi chú tự do hoặc phản hồi nhà cung cấp. Thao tác tự động không có phiên đăng nhập ghi SYSTEM; không suy đoán người thực hiện cho dữ liệu cũ. Phạm vi: sản phẩm/SKU/danh mục, đơn/trạng thái/hóa đơn/thu tiền, đổi trả/hoàn tiền, nhập/xuất/kiểm kê/tồn, khuyến mãi/Voucher, chính sách/phiên bản/giao dịch điểm, khách hàng/nhân sự/tài khoản/phân quyền và khôi phục.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. Các trường bên dưới là query parameters. |
| from | String (yyyy-MM-dd) | Không | Ngày bắt đầu, bao gồm ngày này, giờ Việt Nam. |
| to | String (yyyy-MM-dd) | Không | Ngày kết thúc, bao gồm ngày này, không trước from. |
| actor | String | Không | Tìm tên tài khoản không phân biệt hoa thường hoặc mã tài khoản chính xác, tối đa 200 ký tự. |
| objectType | String | Không | Loại đối tượng, so khớp chính xác, tối đa 200 ký tự; ví dụ PRODUCT, ORDER, RETURN, CUSTOMER, PERMISSION. |
| action | String | Không | So khớp chính xác, tối đa 200 ký tự; ví dụ CREATE, UPDATE, DELETE, RESTORE, STATUS_CHANGE, REFUND, POINT_ADJUST, PERMISSION_CHANGE. |
| q | String | Không | Tìm một phần tên hoặc mã đối tượng, tối đa 200 ký tự; tìm chuỗi con không phân biệt hoa thường, kể cả ký tự đặc biệt SQL. |
| page | Integer | Không | Từ 0, tối đa 1.000.000, mặc định 0. |
| size | Integer | Không | 1–100, mặc định 20. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Đã tải nhật ký hoạt động.",
  "result": {
    "content": [
      {
        "id": 123,
        "occurredAt": "2026-11-09T16:00:00Z",
        "actorId": 2,
        "actorUsername": "chapter5_admin",
        "actorRole": "ADMIN",
        "action": "UPDATE",
        "objectType": "PRODUCT",
        "objectId": "51",
        "objectLabel": "Áo sơ mi",
        "changes": { "gia_ban": { "before": 200000, "after": 190000 } }
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "timestamp": "2026-11-09T23:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Khoảng ngày hoặc phân trang không hợp lệ, bộ lọc quá dài (`INVALID_REQUEST`).
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Thiếu `PERM_AUDIT_VIEW`.

## 2. Xem thay đổi trước/sau (FR-A1-01)

- **Endpoint:** `GET /api/v1/admin/audit/{id}`
- **Quyền hạn:** `PERM_AUDIT_VIEW`.
- **Mô tả:** Đọc một hoạt động. `changes` chỉ gồm trường đã thay đổi; giá trị chưa tồn tại là null. Sửa riêng trường riêng tư chỉ ghi cờ `<tên_trường>_changed`, không ghi giá trị trước/sau. Thay mật khẩu chỉ ghi cờ `credential_changed`, không có giá trị mật khẩu. Không có API sửa hoặc xóa nhật ký.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. |
| id | Long (path) | Có | Mã bản ghi hoạt động. |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Đã tải chi tiết hoạt động.",
  "result": {
    "id": 123,
    "occurredAt": "2026-11-09T16:00:00Z",
    "actorId": 2,
    "actorUsername": "chapter5_admin",
    "actorRole": "ADMIN",
    "action": "UPDATE",
    "objectType": "PRODUCT",
    "objectId": "51",
    "objectLabel": "Áo sơ mi",
    "changes": { "gia_ban": { "before": 200000, "after": 190000 } }
  },
  "timestamp": "2026-11-09T23:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Thiếu `PERM_AUDIT_VIEW`.
- **HTTP 404 Not Found:** Không tìm thấy hoạt động (`404 RESOURCE_NOT_FOUND`: "Không tìm thấy hoạt động.").

## 3. Export CSV nhật ký (FR-A1-01)

- **Endpoint:** `GET /api/v1/admin/audit/export`
- **Quyền hạn:** Đồng thời `PERM_AUDIT_VIEW` và `PERM_DATA_EXPORT`.
- **Mô tả:** Xuất dữ liệu theo cùng bộ lọc mục 1, tối đa 10.000 hoạt động. Nếu vượt giới hạn, trả lỗi để người dùng thu hẹp bộ lọc; không âm thầm cắt dữ liệu. CSV UTF-8 BOM, CRLF, escape dấu ngoặc kép và chặn công thức bảng tính. Không nhận page/size.

### Request Body
```json
{}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Không có Request Body. |
| from, to | String (query) | Không | Khoảng ngày như mục 1. |
| actor, objectType, action, q | String (query) | Không | Bộ lọc như mục 1. |

### Response Thành công (HTTP 200 OK)

Phản hồi tải tệp, `Content-Type: text/csv;charset=UTF-8`, `Content-Disposition: attachment; filename=activity-log.csv`, `Cache-Control: no-store`; endpoint tải tệp không bọc ApiResponse.
```csv
Thời gian,Tài khoản,Vai trò,Hành động,Loại đối tượng,Mã đối tượng,Đối tượng,Thay đổi
"2026-11-09T16:00:00Z","chapter5_admin","ADMIN","UPDATE","PRODUCT","51","Áo sơ mi","{""gia_ban"":{""before"":200000,""after"":190000}}"
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Bộ lọc không hợp lệ hoặc có hơn 10.000 kết quả (`INVALID_REQUEST`).
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Thiếu một trong hai quyền.

Lỗi dùng ApiResponse JSON đầy đủ, ví dụ:
```json
{
  "success": false,
  "code": 400,
  "message": "Có hơn 10.000 hoạt động. Vui lòng thu hẹp bộ lọc trước khi Export CSV.",
  "timestamp": "2026-11-09T23:00:00"
}
```
