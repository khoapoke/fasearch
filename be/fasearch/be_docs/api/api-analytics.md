# TÀI LIỆU API: MODULE ANALYTICS (BÁO CÁO & THỐNG KÊ)

Module `analytics` phục vụ quản trị viên và quản lý theo dõi sức khỏe kinh doanh: tổng hợp doanh thu theo chu kỳ, xếp hạng sản phẩm bán chạy/tồn chậm và báo cáo biến động xuất - nhập - tồn kho. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và chỉ dành cho `ADMIN`, `STAFF (Quản lý)`.

---

## 1. Báo cáo Doanh thu (FR-52)

- **Endpoint:** `GET /api/v1/analytics/revenue`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
      "openingStockNote": "No warehouse/opening history in schema ..."
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
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
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`
- **Mô tả:** Báo cáo biến động tồn theo từng biến thể SKU trong một tháng. Hiện chỉ có `totalSold` và `closingStock` (tồn hiện tại); `openingStock`, `totalImport`, `totalDamaged` trả `null` vì chưa có lịch sử kho.

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
        "totalImport": null,
        "totalSold": 38,
        "totalDamaged": null,
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
