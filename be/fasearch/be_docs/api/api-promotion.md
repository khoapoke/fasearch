# TÀI LIỆU API: MODULE PROMOTION (KHUYẾN MÃI & MÃ GIẢM GIÁ)

Module `promotion` phụ trách cấu hình các chiến dịch ưu đãi (giảm phần trăm, giảm số tiền cố định hoặc miễn phí vận chuyển `FREE_SHIP`), phát hành mã voucher và công bố ưu đãi cho khách hàng. Việc kiểm tra mã giảm giá (FR-47) được thực hiện khi báo giá giỏ hàng `POST /api/v1/cart/quote` và khi đặt hàng, xem [api-order.md](./api-order.md).

---

## 1. Xem danh sách ưu đãi công khai (FR-44)

- **Endpoint:** `GET /api/v1/promotions`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Trả các ưu đãi đang hiệu lực, còn lượt mã (tối đa một mã khả dụng cho mỗi chương trình), gồm cả mã `FREE_SHIP`. Không trả chương trình tạm dừng, hết hạn, hết lượt hay số liệu quản trị.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách ưu đãi công khai thành công",
  "result": [
    {
      "campaignId": 1,
      "title": "Ưu đãi chào mừng",
      "discountType": "PHAN_TRAM",
      "discountValue": 10.00,
      "conditionText": "Áp dụng cho mọi đơn hàng",
      "startAt": "2026-11-01T04:26:53",
      "endAt": "2026-12-02T04:26:53",
      "code": "WELCOME2026"
    }
  ],
  "errors": null,
  "timestamp": "2026-11-02T11:30:00"
}
```

---

## 2. Xem danh sách chương trình khuyến mãi (FR-44)

- **Endpoint:** `GET /api/v1/khuyen-mai`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Danh sách chương trình khuyến mãi có phân trang và bộ lọc.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, `1` - `100` (mặc định: `20`) |
| `trangThai` | String | Không | `HOAT_DONG`, `TAM_DUNG` |
| `loai` | String | Không | Loại giảm: `PHAN_TRAM`, `SO_TIEN`, `FREE_SHIP` |
| `q` | String | Không | Tìm theo tên chương trình (tối đa 100 ký tự) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách thành công",
  "result": {
    "content": [
      {
        "maKm": 2,
        "tenCtkm": "Siêu Sale Black Friday 2026",
        "loaiGiam": "SO_TIEN",
        "giaTriGiam": 100000.00,
        "ngayBatDau": "2026-11-20T00:00:00",
        "ngayKetThuc": "2026-11-30T23:59:59",
        "dieuKienApDung": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
        "trangThai": "HOAT_DONG",
        "phienBan": 1,
        "maSpApDung": [101, 102],
        "codes": []
      }
    ],
    "pageNumber": 0,
    "pageSize": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `page` / `size` / `q` ngoài miền cho phép hoặc `trangThai` không hỗ trợ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 3. Xem chi tiết chương trình khuyến mãi (FR-44)

- **Endpoint:** `GET /api/v1/khuyen-mai/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Chi tiết chương trình kèm danh sách mã voucher đã phát hành.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy chi tiết thành công",
  "result": {
    "maKm": 2,
    "tenCtkm": "Siêu Sale Black Friday 2026",
    "loaiGiam": "SO_TIEN",
    "giaTriGiam": 100000.00,
    "ngayBatDau": "2026-11-20T00:00:00",
    "ngayKetThuc": "2026-11-30T23:59:59",
    "dieuKienApDung": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
    "trangThai": "HOAT_DONG",
    "phienBan": 1,
    "maSpApDung": [101, 102],
    "codes": [
      {
        "maVoucher": 5,
        "maKm": 2,
        "maCode": "BF2026",
        "soLuongPhatHanh": 500,
        "daSuDung": 18,
        "soLuongGiuCho": 0,
        "trangThai": "ACTIVE"
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy chương trình (`RESOURCE_NOT_FOUND`).

---

## 4. Thêm mới chương trình khuyến mãi (FR-45)

- **Endpoint:** `POST /api/v1/khuyen-mai`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Khởi tạo chương trình ưu đãi ở trạng thái `TAM_DUNG`; bật bằng cách cập nhật sang `HOAT_DONG` (mục 5). Loại `FREE_SHIP` miễn toàn bộ phí vận chuyển, không giảm tiền hàng và không dùng chung với voucher giảm giá khác; `giaTriGiam` chỉ cần là số dương (quy ước `1`).

### Request Body
```json
{
  "tenCtkm": "Siêu Sale Black Friday 2026",
  "loaiGiam": "SO_TIEN",
  "giaTriGiam": 100000.00,
  "ngayBatDau": "2026-11-20T00:00:00",
  "ngayKetThuc": "2026-11-30T23:59:59",
  "dieuKienApDung": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
  "maSpApDung": [101, 102]
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `tenCtkm` | String | Có | Tên chương trình, tối đa 255 ký tự |
| `loaiGiam` | String | Có | `PHAN_TRAM` (`<= 100`), `SO_TIEN`, `FREE_SHIP` |
| `giaTriGiam` | Number | Có | Mức giảm, `>= 0.01` |
| `ngayBatDau` | String | Có | Thời điểm bắt đầu `yyyy-MM-ddTHH:mm:ss` |
| `ngayKetThuc` | String | Có | Thời điểm kết thúc, không trước `ngayBatDau` |
| `dieuKienApDung` | String | Không | Mô tả điều kiện, tối đa 1000 ký tự |
| `maSpApDung` | Array | Không | ID sản phẩm áp dụng; bỏ trống là áp dụng toàn bộ |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Tạo chương trình thành công",
  "result": {
    "maKm": 2,
    "tenCtkm": "Siêu Sale Black Friday 2026",
    "loaiGiam": "SO_TIEN",
    "giaTriGiam": 100000.00,
    "ngayBatDau": "2026-11-20T00:00:00",
    "ngayKetThuc": "2026-11-30T23:59:59",
    "dieuKienApDung": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
    "trangThai": "TAM_DUNG",
    "phienBan": 0,
    "maSpApDung": [101, 102],
    "codes": []
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ, loại giảm không hỗ trợ, mức giảm sai, khoảng thời gian sai hoặc có sản phẩm không tồn tại.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 5. Sửa & Tạm dừng chương trình khuyến mãi (FR-46)

- **Endpoint:** `PUT /api/v1/khuyen-mai/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Cập nhật điều kiện, thời gian, mức giảm hoặc chuyển trạng thái `HOAT_DONG` / `TAM_DUNG`. Phải gửi đúng `phienBan` hiện hành (khóa lạc quan); chỉ các trường được gửi lên mới đổi.

### Request Body
```json
{
  "phienBan": 0,
  "trangThai": "HOAT_DONG",
  "ngayKetThuc": "2026-12-05T23:59:59"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `phienBan` | Long | Có | Phiên bản hiện hành của chương trình |
| `tenCtkm` | String | Không | Tên chương trình, tối đa 255 ký tự |
| `loaiGiam` | String | Không | `PHAN_TRAM`, `SO_TIEN`, `FREE_SHIP` |
| `giaTriGiam` | Number | Không | Mức giảm, `>= 0.01` |
| `ngayBatDau` | String | Không | Thời điểm bắt đầu |
| `ngayKetThuc` | String | Không | Thời điểm kết thúc |
| `dieuKienApDung` | String | Không | Mô tả điều kiện, tối đa 1000 ký tự |
| `maSpApDung` | Array | Không | ID sản phẩm áp dụng |
| `trangThai` | String | Không | `HOAT_DONG`, `TAM_DUNG` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Cập nhật thành công",
  "result": {
    "maKm": 2,
    "tenCtkm": "Siêu Sale Black Friday 2026",
    "loaiGiam": "SO_TIEN",
    "giaTriGiam": 100000.00,
    "ngayBatDau": "2026-11-20T00:00:00",
    "ngayKetThuc": "2026-12-05T23:59:59",
    "dieuKienApDung": "Áp dụng cho toàn bộ sản phẩm áo sơ mi",
    "trangThai": "HOAT_DONG",
    "phienBan": 1,
    "maSpApDung": [101, 102],
    "codes": []
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Dữ liệu không hợp lệ hoặc trạng thái không hỗ trợ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy chương trình (`RESOURCE_NOT_FOUND`).
- **HTTP 409 Conflict:** Phiên bản đã đổi, tải lại trước khi lưu (`4109 CAMPAIGN_VERSION_CHANGED`).

---

## 6. Phát hành mã voucher (FR-45)

- **Endpoint:** `POST /api/v1/khuyen-mai/{id}/codes`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Phát hành một mã voucher cho chương trình; mã được chuẩn hóa chữ hoa và phải duy nhất toàn hệ thống.

### Request Body
```json
{
  "maCode": "BF2026",
  "soLuongPhatHanh": 500
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `maCode` | String | Có | Mã voucher, tối đa 50 ký tự |
| `soLuongPhatHanh` | Integer | Không | Số lượt sử dụng tối đa (`>= 1`) |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Phát hành mã thành công",
  "result": {
    "maVoucher": 5,
    "maKm": 2,
    "maCode": "BF2026",
    "soLuongPhatHanh": 500,
    "daSuDung": 0,
    "soLuongGiuCho": 0,
    "trangThai": "ACTIVE"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Mã trống hoặc quá 50 ký tự, số lượng phát hành không hợp lệ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
- **HTTP 404 Not Found:** Không tìm thấy chương trình (`RESOURCE_NOT_FOUND`).
- **HTTP 409 Conflict:** Mã voucher đã tồn tại (`DATA_CONFLICT`).
