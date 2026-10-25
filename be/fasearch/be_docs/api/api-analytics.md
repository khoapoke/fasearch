# TÀI LIỆU API: MODULE ANALYTICS (BÁO CÁO & THỐNG KÊ)

Module `analytics` phục vụ quản trị viên theo dõi sức khỏe kinh doanh: tổng hợp doanh thu và lợi nhuận theo đa chiều, xếp hạng sản phẩm bán chạy/tồn chậm và báo cáo biến động xuất - nhập - tồn kho.

---

## 1. Báo cáo Doanh thu & Lợi nhuận (FR-52)

- **Endpoint:** `GET /api/v1/analytics/revenue`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Thống kê tổng doanh thu thực tế, chi phí nhập hàng, lợi nhuận gộp và số lượng đơn hàng theo chu kỳ thời gian (Ngày / Tuần / Tháng / Năm), phân tách giữa kênh bán lẻ tại quầy POS và kênh đặt hàng Online.
- **Query Parameters:**
  - `period`: Chu kỳ thống kê (`DAY`, `WEEK`, `MONTH`, `YEAR`).
  - `startDate`: Ngày bắt đầu (`YYYY-MM-DD`).
  - `endDate`: Ngày kết thúc (`YYYY-MM-DD`).
  - `channel`: Kênh bán hàng (`ALL`, `POS`, `ONLINE`).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy báo cáo doanh thu thành công",
  "result": {
    "summary": {
      "totalRevenue": 150000000.00,
      "totalCogs": 90000000.00,
      "grossProfit": 60000000.00,
      "totalOrders": 420,
      "averageOrderValue": 357142.85
    },
    "breakdownByChannel": [
      {
        "channel": "POS",
        "revenue": 95000000.00,
        "orders": 280
      },
      {
        "channel": "ONLINE",
        "revenue": 55000000.00,
        "orders": 140
      }
    ],
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
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Báo cáo Hiệu quả Sản phẩm & Hàng tồn (FR-53)

- **Endpoint:** `GET /api/v1/analytics/top-products`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Xếp hạng danh sách Top N sản phẩm mang lại doanh thu cao nhất hoặc danh sách các SKU tồn kho chậm luân chuyển (không có đơn bán trong 30/60 ngày).
- **Query Parameters:**
  - `type`: Tiêu chí (`BEST_SELLER`, `SLOW_MOVING`).
  - `limit`: Số lượng sản phẩm hiển thị (mặc định: `10`).
  - `startDate`, `endDate`: Khoảng thời gian phân tích.

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
      "currentInventory": 43
    },
    {
      "rank": 2,
      "productId": 6,
      "productName": "Áo Polo Pique Đen Cổ Bẻ",
      "categoryName": "Áo Polo Unisex",
      "totalQuantitySold": 98,
      "totalRevenue": 27440000.00,
      "currentInventory": 25
    }
  ],
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Báo cáo Xuất - Nhập - Tồn kho (FR-54)

- **Endpoint:** `GET /api/v1/analytics/inventory-movement`
- **Quyền hạn:** `ADMIN`
- **Mô tả:** Báo cáo chi tiết biến động số lượng tồn theo từng biến thể SKU trong một kỳ kế toán: Tồn đầu kỳ, Tổng nhập, Tổng xuất bán, Xuất hủy/hao hụt và Tồn cuối kỳ.
- **Query Parameters:**
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).
  - `month`: Tháng kế toán (`MM-YYYY`, ví dụ: `10-2026`).
  - `sku`: Lọc theo mã SKU cụ thể.

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
        "openingStock": 20,
        "totalImport": 50,
        "totalSold": 38,
        "totalDamaged": 2,
        "closingStock": 30
      }
    ],
    "pageNumber": 0,
    "pageSize": 10,
    "totalElements": 1,
    "totalPages": 1,
    "isLast": true
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```
