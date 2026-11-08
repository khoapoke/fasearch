# TÀI LIỆU API: MODULE ANALYTICS (BÁO CÁO & THỐNG KÊ)

Module `analytics` phục vụ quản trị viên và quản lý theo dõi sức khỏe kinh doanh: tổng hợp doanh thu theo chu kỳ, xếp hạng sản phẩm bán chạy/tồn chậm và báo cáo biến động xuất - nhập - tồn kho. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và chỉ dành cho `ADMIN`, `STAFF (Quản lý)`.

---

## 1. Báo cáo Doanh thu (FR-52)

- **Endpoint:** `GET /api/v1/analytics/revenue`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `REPORT_VIEW`
- **Mô tả:** Thống kê tổng doanh thu thực thu (từ hóa đơn đã thanh toán), số đơn và giá trị đơn trung bình theo chu kỳ. Chi phí nhập (`totalCogs`) và lợi nhuận gộp (`grossProfit`) luôn là `null` vì chưa có lịch sử giá vốn; chưa tách được kênh POS / Online.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `period` | String | Không | Chu kỳ: `DAY`, `WEEK`, `MONTH`, `YEAR` (mặc định `DAY`) |
| `startDate` | String | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | String | Có | Ngày kết thúc `YYYY-MM-DD` |
| `channel` | String | Không | Chỉ nhận `ALL` (mặc định); giá trị khác trả HTTP 400 |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy báo cáo doanh thu thành công",
  "result": {
    "summary": {
      "totalRevenue": 150000000.00,
      "totalOrders": 420,
      "averageOrderValue": 357142.85,
      "totalCogs": null,
      "grossProfit": null
    },
    "timeline": [
      {
        "date": "2026-10-01",
        "revenue": 5200000.00,
        "orders": 15
      },
      {
        "date": "2026-10-02",
        "revenue": 4800000.00,
        "orders": 14
      }
    ],
    "coverage": {
      "paidInvoices": 420,
      "excludedPending": 6,
      "excludedCancelledUnpaid": 3,
      "softDeletedProductsAttributed": 0,
      "channelNote": "Order rows carry no sales-channel column: channel is ALL only; POS/ONLINE split is not reported.",
      "cogsNote": "No cost history in schema: totalCogs/grossProfit are null, never estimated.",
      "openingStockNote": "totalImport = units on COMPLETED import receipts created in the month; totalDamaged = units on COMPLETED export receipts of type DAMAGED created in the month (totalSold counts paid invoice lines only, so damaged units are never counted twice). No month-end stock history exists in the schema: openingStock is null (Chưa đủ dữ liệu) and closingStock is the current available snapshot, not a recomputed close."
    }
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu / sai `startDate`, `endDate`, khoảng ngày không hợp lệ, `period` không hỗ trợ hoặc `channel` khác `ALL`.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 2. Báo cáo Hiệu quả Sản phẩm & Hàng tồn (FR-53)

- **Endpoint:** `GET /api/v1/analytics/top-products`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `REPORT_VIEW`
- **Mô tả:** Xếp hạng Top N sản phẩm bán chạy nhất hoặc danh sách sản phẩm bán chậm / tồn chậm luân chuyển trong khoảng thời gian phân tích.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `type` | String | Không | `BEST_SELLER`, `SLOW_MOVING` (mặc định `BEST_SELLER`) |
| `limit` | Integer | Không | Số sản phẩm hiển thị (mặc định: `10`) |
| `startDate` | String | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | String | Có | Ngày kết thúc `YYYY-MM-DD` |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy báo cáo sản phẩm thành công",
  "result": [
    {
      "rank": 1,
      "productId": 1,
      "productName": "Áo sơ mi Oxford kẻ sọc",
      "categoryName": "Áo sơ mi nam",
      "totalQuantitySold": 150,
      "totalRevenue": 52500000.00,
      "currentInventory": 43,
      "softDeleted": false
    },
    {
      "rank": 2,
      "productId": 6,
      "productName": "Áo Polo Pique Đen Cổ Bẻ",
      "categoryName": "Áo Polo Unisex",
      "totalQuantitySold": 98,
      "totalRevenue": 27440000.00,
      "currentInventory": 25,
      "softDeleted": false
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu / sai khoảng ngày, `limit` không hợp lệ hoặc `type` không hỗ trợ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 3. Báo cáo Xuất - Nhập - Tồn kho (FR-54)

- **Endpoint:** `GET /api/v1/analytics/inventory-movement`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `REPORT_VIEW`
- **Mô tả:** Báo cáo biến động tồn theo từng biến thể SKU trong một tháng. Các cột trong response:
  - `totalImport`: tổng số lượng trên các dòng phiếu nhập kho có trạng thái `COMPLETED`, ngày tạo phiếu trong tháng (0 nếu không có).
  - `totalSold`: số lượng bán từ hóa đơn `PAID` trong tháng. Chỉ lấy từ hóa đơn, không lấy từ phiếu xuất, nên hàng hỏng không bị tính trùng với `totalDamaged`.
  - `totalDamaged`: tổng số lượng trên các dòng phiếu xuất kho `COMPLETED` loại `DAMAGED` trong tháng (0 nếu không có). Phiếu xuất loại khác (`TRANSFER`, `OTHER`) không được tính vào báo cáo này.
  - `closingStock`: tồn khả dụng hiện tại (`so_luong_kha_dung`), không phải tồn cuối của tháng được chọn.
  - `openingStock`: luôn `null`. Hệ thống không lưu lịch sử tồn cuối tháng nên không suy ra được tồn đầu đúng; giao diện không hiển thị cột này.
  - `totalImport` và `totalDamaged` được tính cho đúng các SKU của trang hiện tại (bộ lọc `sku` và phân trang được tôn trọng), mỗi chỉ số một truy vấn gộp cho cả trang.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `year` | Integer | Có | Năm báo cáo, `2000` - `2100` |
| `month` | Integer | Có | Tháng báo cáo, `1` - `12` |
| `sku` | Long | Không | Lọc theo ID SKU cụ thể |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang (mặc định: `10`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy báo cáo xuất - nhập - tồn thành công",
  "result": {
    "content": [
      {
        "skuId": 101,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "color": "Xanh dương",
        "size": "L",
        "barcode": "893850123401",
        "openingStock": null,
        "totalImport": 5,
        "totalSold": 38,
        "totalDamaged": 3,
        "closingStock": 30
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
- **HTTP 400 Bad Request:** `year`, `month`, `page` hoặc `size` ngoài miền hợp lệ.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.

---

## 4. Báo cáo Tổng hợp (tab "Tổng hợp" của trang Báo cáo)

- **Endpoint:** `GET /api/v1/analytics/overview`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — Quản lý cần quyền `REPORT_VIEW`
- **Mô tả:** Một lần gọi trả về KPI, doanh thu theo danh mục, đơn theo trạng thái, hóa đơn theo phương thức thanh toán và Top 10 khách hàng trong khoảng ngày. Tất cả tổng hợp bằng SQL; khoảng thời gian nửa mở `[startDate 00:00, endDate + 1 ngày 00:00)` theo giờ Việt Nam (cùng cách các báo cáo khác đang dùng).

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `startDate` | String | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | String | Có | Ngày kết thúc `YYYY-MM-DD` (không quá 366 ngày so với `startDate`) |

### Định nghĩa
- **Doanh thu, số đơn, AOV (`kpi`):** hóa đơn `PAID`, chưa xóa, đơn chưa xóa và không phải `DRAFT`/`CANCELLED`, theo `ngay_lap` của hóa đơn; đúng như báo cáo doanh thu. AOV = doanh thu / số đơn, bằng 0 khi chưa có đơn.
- **Khách mới (`newCustomers`):** số khách chưa xóa có đơn đầu tiên (không phải `DRAFT`/`CANCELLED`) được đặt trong khoảng ngày.
- **`byCategory`:** giá trị dòng hàng của các hóa đơn đã thanh toán ở trên = `số lượng x đơn giá - giảm giá dòng - giảm bằng điểm`, nhóm theo danh mục sản phẩm (sản phẩm đã xóa vẫn tính; không có danh mục gom vào "Chưa phân loại"). Chưa gồm phí vận chuyển nên tổng nhỏ hơn hoặc bằng `kpi.revenue`. Sắp xếp giảm dần theo doanh thu.
- **`byStatus`:** số đơn tạo trong khoảng ngày (theo `ngay_dat`), chưa xóa, không tính `DRAFT`, nhóm theo trạng thái đơn; `total` là tổng `tong_tien` của đơn.
- **`byPayment`:** hóa đơn đã thanh toán (cùng điều kiện doanh thu) nhóm theo `payment_method_code`; mã trống là `OTHER`. Sắp xếp giảm dần theo doanh thu.
- **`topCustomers`:** tối đa 10 khách theo tổng doanh thu hóa đơn đã thanh toán; chỉ gồm đơn có khách hàng (đơn bán tại quầy không có khách bị bỏ qua); `lastOrderAt` là thời điểm lập hóa đơn mới nhất trong khoảng; `deleted = true` khi khách đã xóa.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy báo cáo tổng hợp thành công",
  "result": {
    "kpi": { "revenue": 640000.00, "orders": 4, "averageOrderValue": 160000.00, "newCustomers": 2 },
    "byCategory": [ { "categoryId": 3, "categoryName": "Áo", "revenue": 350000.00, "quantity": 4 } ],
    "byStatus": [ { "status": "COMPLETED", "orders": 3, "total": 540000.00 } ],
    "byPayment": [ { "method": "CASH", "invoices": 1, "revenue": 300000.00 } ],
    "topCustomers": [
      { "customerId": 12, "name": "Nguyễn An", "deleted": false, "orders": 2, "revenue": 400000.00, "lastOrderAt": "2026-11-03T23:35:00" }
    ]
  },
  "errors": null,
  "timestamp": "2026-11-08T10:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu / sai `startDate`, `endDate`, `startDate` sau `endDate` hoặc khoảng dài hơn 366 ngày.
- **HTTP 403 Forbidden:** Vai trò `CUSTOMER` không có quyền.
