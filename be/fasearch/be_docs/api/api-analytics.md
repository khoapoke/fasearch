# TÀI LIỆU API: MODULE ANALYTICS (BÁO CÁO & THỐNG KÊ)

Module `analytics` phục vụ quản trị viên và quản lý theo dõi sức khỏe kinh doanh: tổng hợp doanh thu theo chu kỳ, xếp hạng sản phẩm bán chạy/tồn chậm và báo cáo biến động xuất - nhập - tồn kho. Toàn bộ endpoint yêu cầu Header `Authorization: Bearer <token>` và chỉ dành cho `ADMIN`, `STAFF (Quản lý)`. Các endpoint nhận trực tiếp query params, không có request DTO. `ApiResponse` bỏ qua các trường null ở cấp envelope (ví dụ `errors` khi thành công).

---

## 1. Báo cáo Doanh thu (FR-52)

- **Endpoint:** `GET /api/v1/analytics/revenue`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — cần quyền `REPORT_VIEW` (authority `PERM_REPORT_VIEW`; ADMIN có mọi quyền, STAFF cần được cấp quyền)
- **Mô tả:** Thống kê tổng doanh thu thực thu (từ hóa đơn đã thanh toán), số đơn và giá trị đơn trung bình theo chu kỳ. Chi phí nhập (`totalCogs`) và lợi nhuận gộp (`grossProfit`) luôn là `null` vì chưa có lịch sử giá vốn; chưa tách được kênh POS / Online.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `period` | String | Không | Chu kỳ: `DAY`, `WEEK`, `MONTH`, `YEAR` (không phân biệt hoa thường; mặc định `DAY`) |
| `startDate` | LocalDate | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | LocalDate | Có | Ngày kết thúc `YYYY-MM-DD` |
| `channel` | String | Không | Chỉ nhận `ALL` (không phân biệt hoa thường; mặc định); giá trị khác trả HTTP 400 |

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (`400`, thông điệp mặc định `Dữ liệu yêu cầu không hợp lệ.`); thông điệp thực tế: `Khoảng ngày bắt đầu hoặc kết thúc không hợp lệ.`, `Kỳ báo cáo không được hỗ trợ.`, hoặc `Không có số liệu theo kênh bán: dữ liệu đơn hàng không có cột kênh bán.`
- **HTTP 400 Bad Request:** Thiếu tham số bắt buộc: mã `400`, thông điệp `Thiếu tham số '<tên>'.`; sai kiểu hoặc định dạng: mã `400`, thông điệp `Tham số '<tên>' sai định dạng.`
- **HTTP 401 Unauthorized:** `UNAUTHENTICATED` (`401`) — `Bạn cần đăng nhập để truy cập tài nguyên này.`
- **HTTP 403 Forbidden:** `ACCESS_DENIED` (`403`) — `Bạn không có quyền truy cập tài nguyên này.` (thiếu vai trò hoặc quyền).

---

## 2. Báo cáo Hiệu quả Sản phẩm & Hàng tồn (FR-53)

- **Endpoint:** `GET /api/v1/analytics/top-products`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — cần quyền `REPORT_VIEW` (authority `PERM_REPORT_VIEW`; ADMIN có mọi quyền, STAFF cần được cấp quyền)
- **Mô tả:** Mỗi dòng là một sản phẩm (`productId`), gộp tất cả SKU chưa xóa của sản phẩm trước khi xếp hạng và áp dụng `limit`. `BEST_SELLER` xếp theo tổng số lượng bán ròng giảm dần, đồng hạng theo `productId` tăng dần. `SLOW_MOVING` chỉ gồm sản phẩm mà mọi SKU chưa xóa đều có số lượng bán ròng bằng 0 trong khoảng ngày; một SKU không bán không làm cả sản phẩm thành bán chậm. Không gộp theo tên sản phẩm.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `type` | String | Không | `BEST_SELLER`, `SLOW_MOVING` (không phân biệt hoa thường; mặc định `BEST_SELLER`) |
| `limit` | Integer | Không | Số sản phẩm hiển thị, `1` - `100` (mặc định: `10`) |
| `startDate` | LocalDate | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | LocalDate | Có | Ngày kết thúc `YYYY-MM-DD` |

### Request Body
Không có body; truyền bộ lọc bằng Query Params ở trên.

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| — | — | Không | Endpoint GET không nhận request body |

### Trường dữ liệu trả về
| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `rank` | Integer | Có | Hạng liên tục từ 1 sau lọc |
| `productId` | Long | Có | ID sản phẩm, mỗi sản phẩm tối đa một dòng |
| `productName` | String | Có | Tên sản phẩm; hai sản phẩm cùng tên vẫn là hai dòng |
| `categoryName` | String | Có | Tên danh mục, chuỗi rỗng nếu không có |
| `totalQuantitySold` | Long | Có | Tổng số lượng các SKU chưa xóa, trừ số lượng trả có trạng thái REFUNDED |
| `totalRevenue` | BigDecimal | Có | Tổng tiền hàng trừ giảm giá dòng, điểm và tiền hàng hoàn REFUNDED; không gồm phí giao hàng |
| `currentInventory` | Long | Có | Tổng tồn khả dụng hiện tại của các SKU chưa xóa; mỗi SKU tính đúng một lần, không nhân theo số dòng bán |
| `softDeleted` | Boolean | Có | Cờ sản phẩm đã xóa; vẫn giữ quy tắc quy thuộc như trước |

Giữ nguyên cấu trúc DTO, không thêm/xóa/đổi tên trường. Khoảng ngày theo ngày lập hóa đơn gốc, từ đầu `startDate` tới trước đầu ngày sau `endDate`; hóa đơn PAID/REFUNDED chưa xóa, đơn chưa xóa và không DRAFT/CANCELLED. Khoản hoàn được trừ hồi tố như hiện tại. Báo cáo Xuất–nhập–tồn ở mục 3 vẫn theo SKU.

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (`400`, thông điệp mặc định `Dữ liệu yêu cầu không hợp lệ.`); thông điệp thực tế: `Khoảng ngày bắt đầu hoặc kết thúc không hợp lệ.`, `Giới hạn không hợp lệ.`, hoặc `Loại không được hỗ trợ.`
- **HTTP 400 Bad Request:** Thiếu tham số bắt buộc: mã `400`, thông điệp `Thiếu tham số '<tên>'.`; sai kiểu hoặc định dạng: mã `400`, thông điệp `Tham số '<tên>' sai định dạng.`
- **HTTP 401 Unauthorized:** `UNAUTHENTICATED` (`401`) — `Bạn cần đăng nhập để truy cập tài nguyên này.`
- **HTTP 403 Forbidden:** `ACCESS_DENIED` (`403`) — `Bạn không có quyền truy cập tài nguyên này.` (thiếu vai trò hoặc quyền).

---

## 3. Báo cáo Xuất - Nhập - Tồn kho (FR-54)

- **Endpoint:** `GET /api/v1/analytics/inventory-movement`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — cần quyền `REPORT_VIEW` (authority `PERM_REPORT_VIEW`; ADMIN có mọi quyền, STAFF cần được cấp quyền)
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
| `page` | Integer | Không | Số trang, từ `0` (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, `1` - `100` (mặc định: `10`) |

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
  "timestamp": "2026-10-25T15:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (`400`, thông điệp mặc định `Dữ liệu yêu cầu không hợp lệ.`); thông điệp thực tế: `Năm không hợp lệ.` hoặc `Tháng, trang hoặc kích thước không hợp lệ.`
- **HTTP 400 Bad Request:** Thiếu tham số bắt buộc: mã `400`, thông điệp `Thiếu tham số '<tên>'.`; sai kiểu hoặc định dạng: mã `400`, thông điệp `Tham số '<tên>' sai định dạng.`
- **HTTP 401 Unauthorized:** `UNAUTHENTICATED` (`401`) — `Bạn cần đăng nhập để truy cập tài nguyên này.`
- **HTTP 403 Forbidden:** `ACCESS_DENIED` (`403`) — `Bạn không có quyền truy cập tài nguyên này.` (thiếu vai trò hoặc quyền).

---

## 4. Báo cáo Tổng hợp (tab "Tổng hợp" của trang Báo cáo)

- **Endpoint:** `GET /api/v1/analytics/overview`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)` — cần quyền `REPORT_VIEW` (authority `PERM_REPORT_VIEW`; ADMIN có mọi quyền, STAFF cần được cấp quyền)
- **Mô tả:** Một lần gọi trả về KPI, doanh thu theo danh mục, đơn theo trạng thái, hóa đơn theo phương thức thanh toán và Top 10 khách hàng trong khoảng ngày. Tất cả tổng hợp bằng SQL; khoảng thời gian nửa mở `[startDate 00:00, endDate + 1 ngày 00:00)` theo giờ Việt Nam (cùng cách các báo cáo khác đang dùng).

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `startDate` | LocalDate | Có | Ngày bắt đầu `YYYY-MM-DD` |
| `endDate` | LocalDate | Có | Ngày kết thúc `YYYY-MM-DD` (không quá 366 ngày so với `startDate`) |

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
  "timestamp": "2026-11-08T10:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `INVALID_REQUEST` (`400`, thông điệp mặc định `Dữ liệu yêu cầu không hợp lệ.`); thông điệp thực tế: `Khoảng ngày bắt đầu hoặc kết thúc không hợp lệ.` (bao gồm khoảng dài hơn 366 ngày).
- **HTTP 400 Bad Request:** Thiếu tham số bắt buộc: mã `400`, thông điệp `Thiếu tham số '<tên>'.`; sai kiểu hoặc định dạng: mã `400`, thông điệp `Tham số '<tên>' sai định dạng.`
- **HTTP 401 Unauthorized:** `UNAUTHENTICATED` (`401`) — `Bạn cần đăng nhập để truy cập tài nguyên này.`
- **HTTP 403 Forbidden:** `ACCESS_DENIED` (`403`) — `Bạn không có quyền truy cập tài nguyên này.` (thiếu vai trò hoặc quyền).

### Doanh thu sau hoàn tiền (V28)

Hóa đơn PAID/REFUNDED được tính theo ngày lập gốc, trừ tổng tiền yêu cầu REFUNDED. Các báo cáo quá khứ cập nhật hồi tố khi hoàn tiền. KPI, timeline, theo phương thức, khách hàng và sản phẩm/danh mục cùng trừ hoàn; sản phẩm/danh mục chỉ trừ tiền hàng, không trừ phí giao hàng. Số hóa đơn vẫn gồm giao dịch gốc có doanh thu net 0. Chi tiết [module Return](./api-return.md#11-quy-tắc-tiền-điểm-và-doanh-thu-fr-49-fr-50-fr-51).

### Điều chỉnh trả hàng R1F (V31)
Doanh thu hồi tố theo ngày hóa đơn gốc, trừ hoàn thành công. Số đơn/mẫu số AOV bỏ hóa đơn REFUNDED hoặc net 0 (paidTotals, paidByMethod, topCustomers, timeline). Units danh mục, sản phẩm và đã bán SKU trừ quantity REFUNDED. Cột Hỏng loại phiếu TRA-%: hàng trả hỏng chưa nhập kho bán, không trừ lần nữa. Không thêm cột; [quy tắc hoàn tiền](./api-return.md#11-quy-tắc-tiền-điểm-và-doanh-thu-fr-49-fr-50).
