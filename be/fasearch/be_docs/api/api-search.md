# TÀI LIỆU API: MODULE SEARCH (TÌM KIẾM THÔNG MINH ĐA PHƯƠNG THỨC - AI)

Module `search` cung cấp các tính năng tìm kiếm thông minh ứng dụng Trí tuệ Nhân tạo (FastAPI + CLIP + Qdrant Vector Engine): tìm kiếm theo văn bản mô tả (Text-to-Image), tìm kiếm theo hình ảnh tải lên (Image-to-Image) và tìm kiếm kết hợp đa phương thức (Multimodal Search).

Toàn bộ API được phục vụ thông qua Spring Boot Backend đóng vai trò API Gateway kết nối tới Python AI Service (`http://localhost:8000`).

---

## 1. Tìm kiếm bằng văn bản / mô tả tự nhiên (FR-NC1)

- **Endpoint:** `POST /api/v1/search/text`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Người dùng nhập câu lệnh mô tả (ví dụ: *"áo sơ mi trắng cổ bẻ công sở"*), hệ thống trích xuất vector đặc trưng CLIP và truy vấn các sản phẩm có độ tương đồng cosine cao nhất từ vector database Qdrant.

### Request Body (JSON)
```json
{
  "query": "áo sơ mi trắng cổ bẻ công sở",
  "limit": 5
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `query` | `String` | **Có** | - | Từ khóa hoặc câu mô tả trang phục cần tìm |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa ($1 \le limit \le 24$) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm theo văn bản thành công",
  "result": {
    "total": 1,
    "items": [
      {
        "id": "c71e280d-8df5-46aa-b2b9-1f486a43875f",
        "score": 0.8254,
        "imagePath": "/dataset/test/shirt1.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/shirt1.jpg",
        "fileName": "shirt1.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-30T00:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Câu tìm kiếm trống (`INVALID_REQUEST`), `limit` ngoài khoảng `1` - `24`.
- **HTTP 503 Service Unavailable:** Dịch vụ AI chưa bật hoặc mất kết nối (`AI_SERVICE_UNAVAILABLE`).

---

## 2. Tìm kiếm sản phẩm bằng hình ảnh (FR-NC2)

- **Endpoint:** `POST /api/v1/search/image`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Khách hàng hoặc nhân viên tải ảnh một trang phục mẫu (chụp trực tiếp hoặc tải từ internet), hệ thống AI phân tích đặc trưng thị giác (CLIP Image Embeddings) để gợi ý các sản phẩm có kiểu dáng, màu sắc tương tự.
- **Content-Type:** `multipart/form-data`

### Request Parameters (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` *(hoặc `image`)* | `MultipartFile` | **Có** | - | File ảnh binary định dạng `.png`, `.jpg`, `.jpeg`, `.webp` (tối đa 10MB) |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa ($1 \le limit \le 24$) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm theo hình ảnh thành công",
  "result": {
    "total": 5,
    "items": [
      {
        "id": "3dc85696-a348-427b-b6ba-191dc2fa3736",
        "score": 0.5345,
        "imagePath": "/dataset/test/shirt1.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/shirt1.jpg",
        "fileName": "shirt1.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      },
      {
        "id": "aa360090-9cd3-40f4-a740-8a7cab80d045",
        "score": 0.5059,
        "imagePath": "/dataset/test/shirt2.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/shirt2.jpg",
        "fileName": "shirt2.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-30T00:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Chưa chọn file, file rỗng hoặc sai định dạng `.png, .jpg, .jpeg, .webp` (`INVALID_IMAGE_FILE`), dung lượng vượt 10MB.
- **HTTP 503 Service Unavailable:** Dịch vụ AI chưa bật hoặc mất kết nối (`AI_SERVICE_UNAVAILABLE`).

---

## 3. Tìm kiếm đa phương thức kết hợp (FR-NC3)

- **Endpoint:** `POST /api/v1/search/multimodal`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Kết hợp đồng thời cả **Hình ảnh mẫu gốc** và **Mô tả văn bản bổ sung** để điều hướng tìm kiếm (ví dụ: tải ảnh chiếc áo nhưng nhập thêm *"màu đỏ, phong cách vintage"*). Vector truy vấn được tổng hợp theo trọng số:
$$\mathbf{v}_{\text{query}} = \alpha \cdot \mathbf{v}_{\text{text}} + (1 - \alpha) \cdot \mathbf{v}_{\text{image}}$$
- **Content-Type:** `multipart/form-data`

### Request Parameters (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` *(hoặc `image`)* | `MultipartFile` | **Có** | - | File ảnh gốc binary (`.png`, `.jpg`, `.jpeg`, `.webp`, tối đa 10MB) |
| `query` *(hoặc `textQuery`)* | `String` | **Có** | - | Văn bản bổ sung hoặc yêu cầu thay đổi thuộc tính |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa ($1 \le limit \le 24$) |
| `text_weight` *(hoặc `textWeight`)* | `Float` | Không | `0.5` | Trọng số chữ ($0.0 \le text\_weight \le 1.0$), `0.5` là cân bằng 50% ảnh + 50% chữ |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm đa phương thức kết hợp thành công",
  "result": {
    "total": 5,
    "items": [
      {
        "id": "3dc85696-a348-427b-b6ba-191dc2fa3736",
        "score": 0.5345,
        "imagePath": "/dataset/test/shirt1.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/shirt1.jpg",
        "fileName": "shirt1.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      },
      {
        "id": "aa360090-9cd3-40f4-a740-8a7cab80d045",
        "score": 0.5059,
        "imagePath": "/dataset/test/shirt2.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/shirt2.jpg",
        "fileName": "shirt2.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      },
      {
        "id": "f3cacb10-c392-47d1-82df-59733ce9f0b8",
        "score": 0.4974,
        "imagePath": "/dataset/test/dress1.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/dress1.jpg",
        "fileName": "dress1.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      },
      {
        "id": "bb67d142-5952-4b31-aab9-04506838b6a2",
        "score": 0.4878,
        "imagePath": "/dataset/test/bag1.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/bag1.jpg",
        "fileName": "bag1.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      },
      {
        "id": "283ba4f2-9da3-45ad-b200-289c20940b71",
        "score": 0.4807,
        "imagePath": "/dataset/test/dress2.jpg",
        "fullImageUrl": "http://localhost:8000/dataset/test/dress2.jpg",
        "fileName": "dress2.jpg",
        "catalog": "FASHION_PRODUCT",
        "productId": null,
        "productName": null,
        "price": null,
        "status": null
      }
    ]
  },
  "errors": null,
  "timestamp": "2026-10-30T00:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Chưa chọn file, file rỗng hoặc sai định dạng `.png, .jpg, .jpeg, .webp` (`INVALID_IMAGE_FILE`), dung lượng vượt 10MB.
- **HTTP 503 Service Unavailable:** Dịch vụ AI chưa bật hoặc mất kết nối (`AI_SERVICE_UNAVAILABLE`).

---

## 4. Xem ảnh dataset kết quả tìm kiếm

- **Endpoint:** `GET /api/v1/search/images/{fileName}`
- **Quyền hạn:** `PUBLIC` (Không yêu cầu đăng nhập)
- **Mô tả:** Backend tải ảnh sản phẩm từ AI Service và trả lại cho trình duyệt (`Cache-Control: private, max-age=3600`), không bọc `ApiResponse`.

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Tên file hoặc phần mở rộng không hợp lệ.
- **HTTP 503 Service Unavailable:** Dịch vụ AI chưa bật hoặc mất kết nối (`AI_SERVICE_UNAVAILABLE`).

---

## 5. Ghi nhận lịch sử tìm kiếm

- **Endpoint:** `POST /api/v1/account/search-history`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (tài khoản đang đăng nhập)
- **Mô tả:** Ghi nhận một lượt tìm kiếm sau khi có kết quả thực tế.

### Request Body
```json
{
  "mode": "TEXT",
  "query": "áo sơ mi trắng",
  "resultCount": 5,
  "resultRefs": "[\"id1\",\"id2\"]",
  "status": "SUCCESS"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `mode` | String | Có | `TEXT`, `IMAGE`, `MULTIMODAL` |
| `query` | String | Không | Từ khóa tìm kiếm, tối đa 500 ký tự |
| `resultCount` | Integer | Không | Số kết quả (mặc định 0) |
| `resultRefs` | String | Không | Mảng JSON tham chiếu an toàn (tối đa 24 phần tử, 4096 ký tự; không chứa data URL, đường dẫn nội bộ hay bí mật) |
| `status` | String | Có | `SUCCESS`, `FAILED`, `CANCELLED` |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Ghi nhận lịch sử tìm kiếm thành công",
  "result": {
    "id": 31,
    "mode": "TEXT",
    "query": "áo sơ mi trắng",
    "resultCount": 5,
    "resultRefs": "[\"id1\",\"id2\"]",
    "status": "SUCCESS",
    "occurredAt": "2026-11-05T09:00:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `mode` / `status`, `resultRefs` không phải mảng JSON hợp lệ hoặc chứa nội dung không an toàn.
- **HTTP 401 Unauthorized:** Chưa đăng nhập.

---

## 6. Xem lịch sử tìm kiếm

- **Endpoint:** `GET /api/v1/account/search-history`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (chỉ lịch sử của chính mình)
- **Mô tả:** Lịch sử tìm kiếm của tài khoản hiện tại, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, tối đa `100` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy lịch sử tìm kiếm thành công",
  "result": {
    "content": [
      {
        "id": 31,
        "mode": "TEXT",
        "query": "áo sơ mi trắng",
        "resultCount": 5,
        "resultRefs": "[\"id1\",\"id2\"]",
        "status": "SUCCESS",
        "occurredAt": "2026-11-05T09:00:00"
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
- **HTTP 401 Unauthorized:** Chưa đăng nhập.

---

## 7. Xóa một mục lịch sử tìm kiếm

- **Endpoint:** `DELETE /api/v1/account/search-history/{id}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (chỉ mục của chính mình)
- **Mô tả:** Xóa mềm một mục lịch sử.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa lịch sử tìm kiếm thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Mục không tồn tại hoặc không thuộc tài khoản hiện tại.

---

## 8. Thêm sản phẩm yêu thích

- **Endpoint:** `POST /api/v1/account/favorites`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (tài khoản đang đăng nhập)
- **Mô tả:** Thêm sản phẩm vào danh sách yêu thích; đã yêu thích thì trả lại mục cũ.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Có | ID sản phẩm |

### Response Thành công (HTTP 201 Created)
```json
{
  "success": true,
  "code": 201,
  "message": "Thêm yêu thích thành công",
  "result": {
    "id": 7,
    "productId": 1,
    "productName": "Áo sơ mi Oxford kẻ sọc",
    "price": 350000.00,
    "createdAt": "2026-11-05T09:00:00"
  },
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu `productId`.
- **HTTP 404 Not Found:** Sản phẩm không tồn tại hoặc không khả dụng (`PRODUCT_NOT_FOUND`).

---

## 9. Xóa sản phẩm yêu thích

- **Endpoint:** `DELETE /api/v1/account/favorites/{productId}`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (chỉ mục của chính mình)
- **Mô tả:** Xóa mềm sản phẩm khỏi danh sách yêu thích.

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa yêu thích thành công",
  "result": null,
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 404 Not Found:** Sản phẩm chưa có trong danh sách yêu thích.

---

## 10. Xem danh sách sản phẩm yêu thích

- **Endpoint:** `GET /api/v1/account/favorites`
- **Quyền hạn:** `ADMIN`, `STAFF (Quản lý)`, `CUSTOMER` (chỉ danh sách của chính mình)
- **Mô tả:** Danh sách yêu thích của tài khoản hiện tại, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`) |
| `size` | Integer | Không | Số bản ghi/trang, tối đa `100` (mặc định: `20`) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Lấy danh sách yêu thích thành công",
  "result": {
    "content": [
      {
        "id": 7,
        "productId": 1,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "price": 350000.00,
        "createdAt": "2026-11-05T09:00:00"
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
- **HTTP 401 Unauthorized:** Chưa đăng nhập.

---

## 11. Quy chuẩn URL hiển thị ảnh tĩnh (Static Full Image URL)

URL hiển thị ảnh sản phẩm được Spring Boot tự động chuẩn hóa dựa trên `base-url` của AI Service:
$$\text{FullImageUrl} = \text{base-url} + \text{image\_path}$$

- Khi `imagePath = "/dataset/test/shirt1.jpg"`:
  👉 `fullImageUrl = "http://localhost:8000/dataset/test/shirt1.jpg"`
- Frontend có thể bind trực tiếp thuộc tính `fullImageUrl` vào thẻ `<img>` mà không cần xử lý thêm chuỗi URL.
