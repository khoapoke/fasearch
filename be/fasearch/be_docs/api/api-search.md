# TÀI LIỆU API: MODULE SEARCH (TÌM KIẾM THÔNG MINH ĐA PHƯƠNG THỨC - AI)

Module `search` cung cấp các tính năng tìm kiếm thông minh ứng dụng Trí tuệ Nhân tạo (FastAPI + CLIP + Qdrant Vector Engine): tìm kiếm theo văn bản mô tả (Text-to-Image), tìm kiếm theo hình ảnh tải lên (Image-to-Image) và tìm kiếm kết hợp đa phương thức (Multimodal Search).

Toàn bộ API được phục vụ thông qua Spring Boot Backend đóng vai trò API Gateway kết nối tới Python AI Service (`http://localhost:8000`).

---

## 1. Tìm kiếm bằng văn bản / mô tả tự nhiên (FR-NC1)

- **Endpoint:** `POST /api/v1/search/text`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`, `ADMIN`
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

---

## 2. Tìm kiếm sản phẩm bằng hình ảnh (FR-NC2)

- **Endpoint:** `POST /api/v1/search/image`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`, `ADMIN`
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

---

## 3. Tìm kiếm đa phương thức kết hợp (FR-NC3)

- **Endpoint:** `POST /api/v1/search/multimodal`
- **Quyền hạn:** `PUBLIC`, `CUSTOMER`, `STAFF`, `ADMIN`
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

---

## 4. Quy chuẩn URL hiển thị ảnh tĩnh (Static Full Image URL)

URL hiển thị ảnh sản phẩm được Spring Boot tự động chuẩn hóa dựa trên `base-url` của AI Service:
$$\text{FullImageUrl} = \text{base-url} + \text{image\_path}$$

- Khi `imagePath = "/dataset/test/shirt1.jpg"`:
  👉 `fullImageUrl = "http://localhost:8000/dataset/test/shirt1.jpg"`
- Frontend có thể bind trực tiếp thuộc tính `fullImageUrl` vào thẻ `<img>` mà không cần xử lý thêm chuỗi URL.

---

## 5. Quy chuẩn Mã lỗi ngoại lệ (Error Handling)

| HTTP Status | Mã lỗi | Tình huống | Thông báo mẫu |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_REQUEST` | Query trống hoặc file tải lên rỗng | *"Vui lòng chọn file ảnh hợp lệ"* |
| `400 Bad Request` | `INVALID_IMAGE_FILE` | File không thuộc định dạng `.png, .jpg, .jpeg, .webp` | *"Định dạng file không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp"* |
| `503 Service Unavailable` | `AI_SERVICE_UNAVAILABLE` | Server AI FastAPI (Port 8000) chưa bật hoặc mất kết nối | *"Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng kiểm tra server AI hoặc thử lại sau"* |

---

## 4. Lịch sử tìm kiếm tài khoản (STT6 P1)

### POST /api/v1/account/search-history
Ghi nhận lịch sử tìm kiếm sau khi có kết quả thực tế.

**Quyền hạn:** `CUSTOMER`, `STAFF`, `ADMIN` (yêu cầu đăng nhập)

**Request Body (JSON):**
```json
{
  "mode": "TEXT",
  "query": "áo sơ mi trắng",
  "resultCount": 5,
  "resultRefs": "[\"id1\",\"id2\"]",
  "status": "SUCCESS"
}
```

| Trường | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `mode` | `TEXT`/`IMAGE`/`MULTIMODAL` | **Có** | Chế độ tìm kiếm |
| `query` | `String` (max 500) | Không | Từ khóa tìm kiếm |
| `resultCount` | `Integer` | Không | Số kết quả (mặc định 0) |
| `resultRefs` | `String` (JSON array, max 4096 ký tự) | Không | Tham chiếu an toàn (không data URL, raw file, internal path, secret) |
| `status` | `SUCCESS`/`FAILED`/`CANCELLED` | **Có** | Kết quả tìm kiếm |

**Response:** HTTP 201 với `SearchHistoryRes` (id, mode, query, resultCount, resultRefs, status, occurredAt).

### GET /api/v1/account/search-history?page=0&size=20
Lấy lịch sử tìm kiếm của tài khoản hiện tại (phân trang, mới nhất trước).

### DELETE /api/v1/account/search-history/{id}
Xóa mềm một mục lịch sử. Trả 404 nếu không tồn tại hoặc không thuộc tài khoản hiện tại.

---

## 5. Yêu thích tài khoản (STT6 P1)

### POST /api/v1/account/favorites?productId={id}
Thêm sản phẩm vào yêu thích. Idempotent: nếu đã yêu thích, trả cùng id.

**Quyền hạn:** `CUSTOMER`, `STAFF`, `ADMIN` (yêu cầu đăng nhập)

**Response:** HTTP 201 với `FavoriteRes` (id, productId, productName, price, createdAt).

**Lỗi:** 404 nếu sản phẩm không tồn tại hoặc không khả dụng (đã xóa/inactive).

### DELETE /api/v1/account/favorites/{productId}
Xóa mềm yêu thích. Trả 404 nếu không tồn tại.

### GET /api/v1/account/favorites?page=0&size=20
Lấy danh sách yêu thích của tài khoản hiện tại (phân trang, mới nhất trước).

---

## 6. Đổi mật khẩu (STT6 P1)

### POST /api/v1/auth/change-password
**Quyền hạn:** `CUSTOMER`, `STAFF`, `ADMIN` (yêu cầu đăng nhập)

**Request Body (JSON):**
```json
{
  "oldPassword": "mat_khau_cu",
  "newPassword": "mat_khau_moi_min_6"
}
```

**Response:** HTTP 200 với message "Đổi mật khẩu thành công".

**Lỗi:** 401 nếu mật khẩu cũ sai; 400 nếu mật khẩu mới trùng mật khẩu cũ hoặc validation thất bại.

**Hành vi sau đổi:** Token hiện tại vẫn hợp lệ (stateless JWT). Client nên đăng nhập lại với mật khẩu mới để lấy token mới.
