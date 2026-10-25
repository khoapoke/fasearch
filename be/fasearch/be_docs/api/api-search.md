# TÀI LIỆU API: MODULE SEARCH (TÌM KIẾM THÔNG MINH ĐA PHƯƠNG THỨC - AI)

Module `search` cung cấp các tính năng tìm kiếm thông minh ứng dụng Trí tuệ Nhân tạo (AI): tìm kiếm theo ngôn ngữ tự nhiên, tìm kiếm theo hình ảnh sản phẩm và tìm kiếm kết hợp đa phương thức (Multimodal Search).

---

## 1. Tìm kiếm bằng mô tả ngôn ngữ tự nhiên (FR-NC1)

- **Endpoint:** `GET /api/v1/search/natural-language`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`
- **Mô tả:** Người dùng nhập câu lệnh tự nhiên (ví dụ: *"áo sơ mi trắng tay dài đi tiệc dưới 400k"*), hệ thống phân tích ngữ nghĩa và trích xuất thuộc tính để tìm sản phẩm phù hợp nhất.
- **Query Parameters:**
  - `query`: Câu lệnh mô tả tự nhiên (bắt buộc).
  - `page`: Số trang (mặc định: `0`).
  - `size`: Số bản ghi/trang (mặc định: `10`).

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm thành công",
  "result": {
    "extractedCriteria": {
      "category": "Áo sơ mi nam",
      "color": "Trắng",
      "maxPrice": 400000.00,
      "style": "Đi tiệc"
    },
    "products": [
      {
        "id": 1,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "price": 350000.00,
        "imageUrl": "https://cdn.fasearch.com/products/sp01.jpg",
        "matchScore": 0.94
      }
    ],
    "totalMatches": 1
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 2. Tìm kiếm sản phẩm bằng hình ảnh (FR-NC2)

- **Endpoint:** `POST /api/v1/search/image`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`
- **Mô tả:** Khách hàng hoặc nhân viên tải ảnh một trang phục (chụp trực tiếp hoặc tải từ internet), hệ thống AI phân tích đặc trưng thị giác (Vector Embeddings) để gợi ý các sản phẩm có kiểu dáng tương tự trong cửa hàng.
- **Content-Type:** `multipart/form-data`

### Request Body (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `image` | File (Binary) | Có | File ảnh định dạng `.jpg`, `.jpeg`, `.png`, tối đa 5MB |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Phân tích ảnh và tìm kiếm thành công",
  "result": {
    "detectedAttributes": {
      "itemType": "Áo thun Polo",
      "dominantColor": "Xanh Navy",
      "pattern": "Trơn"
    },
    "similarProducts": [
      {
        "id": 5,
        "productName": "Áo Polo Pique Navy Cổ Bẻ",
        "price": 280000.00,
        "imageUrl": "https://cdn.fasearch.com/products/polo02.jpg",
        "similarityScore": 0.89
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```

---

## 3. Tìm kiếm đa phương thức kết hợp (FR-NC3)

- **Endpoint:** `POST /api/v1/search/multimodal`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`
- **Mô tả:** Kết hợp cả hình ảnh và mô tả văn bản bổ sung để tinh chỉnh kết quả (ví dụ: tải ảnh chiếc áo nhưng nhập thêm *"nhưng màu đen và giá dưới 300k"*).
- **Content-Type:** `multipart/form-data`

### Request Body (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `image` | File (Binary) | Có | File ảnh trang phục tham chiếu |
| `textQuery` | String | Có | Mô tả bổ sung bằng văn bản để tinh chỉnh |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm đa phương thức thành công",
  "result": {
    "combinedQuerySummary": "Áo kiểu dáng như ảnh nhưng màu đen, giá < 300,000 VND",
    "matchedProducts": [
      {
        "id": 6,
        "productName": "Áo Polo Pique Đen Cổ Bẻ",
        "price": 280000.00,
        "imageUrl": "https://cdn.fasearch.com/products/polo01.jpg",
        "matchScore": 0.96
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-25T15:30:00"
}
```
