# TÀI LIỆU API: MODULE SEARCH (TÌM KIẾM THÔNG MINH ĐA PHƯƠNG THỨC - AI)

Module `search` cung cấp các tính năng tìm kiếm thông minh ứng dụng Trí tuệ Nhân tạo (FastAPI + CLIP + Qdrant Vector Engine): tìm kiếm theo văn bản mô tả (Text-to-Image), tìm kiếm theo hình ảnh tải lên (Image-to-Image) và tìm kiếm kết hợp đa phương thức (Multimodal Search).

Toàn bộ API được phục vụ thông qua Spring Boot Backend đóng vai trò API Gateway kết nối tới Python AI Service (`http://localhost:8000`).

---

## 1. Tìm kiếm bằng văn bản / mô tả tự nhiên (FR-NC1)

- **Endpoint:** `POST /api/v1/search/text`
- **Quyền hạn:** `PUBLIC` (permitAll; không có `@PreAuthorize`)
- **Mô tả:** Người dùng nhập câu lệnh mô tả (ví dụ: *"áo sơ mi trắng cổ bẻ công sở"*), hệ thống trích xuất vector đặc trưng CLIP và truy vấn các sản phẩm có độ tương đồng cosine cao nhất từ vector database Qdrant.

### Request Body (JSON)
```json
{
  "query": "áo sơ mi trắng cổ bẻ công sở",
  "limit": 12
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `query` | `String` | **Có** | - | Từ khóa hoặc câu mô tả trang phục cần tìm |
| `limit` | `Integer` | Không | `12` | Số lượng kết quả tối đa (1–24); null dùng 12 |

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
        "productId": 2313,
        "productName": "Áo thun Davies cổ tròn",
        "brandName": "Davies",
        "price": 199000.00,
        "imageUrl": "/api/v1/products/images/davies-2313.jpg",
        "colors": ["Trắng", "Đen"],
        "status": "ACTIVE"
      }
    ]
  },
  "timestamp": "2026-10-30T00:30:00"
}
```

> `ApiResponse` bỏ các trường null: `errors` không xuất hiện khi thành công; `result` cũng không xuất hiện khi giá trị null. Các trường null trong `items[]` được bỏ.

### Quy tắc kết quả (sản phẩm đang bán thật)

Sau khi AI trả về các điểm vector gần nhất, Backend đối chiếu **một truy vấn gộp** với danh mục sản phẩm (không N+1) và chỉ giữ sản phẩm thỏa **đồng thời**:

- chưa xóa mềm (`da_xoa = false`), `publication_status = PUBLISHED`, `trang_thai = ACTIVE`;
- có ít nhất một biến thể (chưa xóa mềm) với tồn kho khả dụng `so_luong_kha_dung > 0`.

Các bước xử lý: lấy dư từ AI `min(24, 3 × limit)` (trần của AI service là 24) điểm → bỏ điểm không có `product_id` hợp lệ → gộp trùng theo `productId` (giữ điểm cao nhất) → lọc theo điều kiện trên → sắp theo điểm giảm dần → cắt về `limit`. Vì vậy `total` là số kết quả thực sự trả về (có thể ít hơn `limit` nếu không đủ sản phẩm đang bán khớp).

| Trường `items[]` | Kiểu | Mô tả |
| :--- | :--- | :--- |
| `id` | `String` | Mã điểm vector trong index AI (khóa ổn định cho UI, không hiển thị) |
| `score` | `double` | Độ tương đồng thô (không phải xác suất) |
| `productId` | `Long` | Mã sản phẩm đang bán (`/san-pham/{productId}`) |
| `productName` | `String` | Tên sản phẩm |
| `brandName` | `String` | Thương hiệu (bỏ qua khi sản phẩm chưa gắn hãng) |
| `price` | `BigDecimal` | Giá bán hiện hành |
| `imageUrl` | `String` | Ảnh chính theo catalog `/api/v1/products/images/{file}` |
| `colors` | `String[]` | Màu còn hàng (đã loại giá trị placeholder `Default Title`) |
| `status` | `String` | `ACTIVE` |

> Các trường kỹ thuật của index AI (`imagePath`, `fullImageUrl`, `fileName`, `catalog`) **không còn** nằm trong phản hồi.

### Response Lỗi thường gặp
- **HTTP 400:** Kiểm tra DTO thất bại: `code: 400`, `message: "Dữ liệu không hợp lệ."`, chi tiết nằm trong `errors` (query trống hoặc limit ngoài 1–24). Service cũng có thể ném `INVALID_REQUEST` (400, thông điệp chuẩn: "Dữ liệu yêu cầu không hợp lệ."); thông điệp thực tế cho query trống: "Nội dung tìm kiếm không được để trống".
- **HTTP 503:** `AI_SERVICE_UNAVAILABLE` (503, thông điệp chuẩn: "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau"); client thay thông điệp bằng chi tiết lỗi hoặc lỗi kết nối.

---

## 2. Tìm kiếm sản phẩm bằng hình ảnh (FR-NC2)

- **Endpoint:** `POST /api/v1/search/image`
- **Quyền hạn:** `PUBLIC` (permitAll; không có `@PreAuthorize`)
- **Mô tả:** Khách hàng hoặc nhân viên tải ảnh một trang phục mẫu (chụp trực tiếp hoặc tải từ internet), hệ thống AI phân tích đặc trưng thị giác (CLIP Image Embeddings) để gợi ý các sản phẩm có kiểu dáng, màu sắc tương tự.
- **Content-Type:** `multipart/form-data`

### Request Parameters (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` | `MultipartFile` | Không | - | Ưu tiên khi cả hai được gửi; phải có `file` hoặc `image`. File ảnh binary định dạng `.png`, `.jpg`, `.jpeg`, `.webp` (tối đa 10MB theo service; multipart mặc định 5MB/file) |
| `image` | `MultipartFile` | Không | - | Ảnh thay thế khi không có `file` |
| `limit` | `Integer` | Không | `12` | Số lượng kết quả tối đa; ngoài khoảng 1–24 dùng 12 |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm theo hình ảnh thành công",
  "result": {
    "total": 2,
    "items": [
      {
        "id": "3dc85696-a348-427b-b6ba-191dc2fa3736",
        "score": 0.5345,
        "productId": 2313,
        "productName": "Áo thun Davies cổ tròn",
        "brandName": "Davies",
        "price": 199000.00,
        "imageUrl": "/api/v1/products/images/davies-2313.jpg",
        "colors": ["Trắng", "Đen"],
        "status": "ACTIVE"
      },
      {
        "id": "aa360090-9cd3-40f4-a740-8a7cab80d045",
        "score": 0.5059,
        "productId": 1204,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "brandName": "Routine",
        "price": 350000.00,
        "imageUrl": "/api/v1/products/images/routine-1204.jpg",
        "colors": ["Xanh"],
        "status": "ACTIVE"
      }
    ]
  },
  "timestamp": "2026-10-30T00:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400, thông điệp chuẩn: "Dữ liệu yêu cầu không hợp lệ.") khi thiếu, rỗng, thiếu tên, quá 10MB hoặc không đọc được file; thông điệp thực tế mô tả nguyên nhân. `INVALID_IMAGE_FILE` (400): "Định dạng file ảnh không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp".
- **HTTP 413:** Vượt giới hạn multipart cấu hình (mặc định 5MB/file, 6MB/request): "Tệp vượt quá 5MB. Chọn tệp nhỏ hơn rồi thử lại."
- **HTTP 503:** `AI_SERVICE_UNAVAILABLE` (503, thông điệp chuẩn: "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau"); client thay bằng chi tiết lỗi hoặc lỗi kết nối.

---

## 3. Tìm kiếm đa phương thức kết hợp (FR-NC3)

- **Endpoint:** `POST /api/v1/search/multimodal`
- **Quyền hạn:** `PUBLIC` (permitAll; không có `@PreAuthorize`)
- **Mô tả:** Kết hợp đồng thời cả **Hình ảnh mẫu gốc** và **Mô tả văn bản bổ sung** để điều hướng tìm kiếm (ví dụ: tải ảnh chiếc áo nhưng nhập thêm *"màu đỏ, phong cách vintage"*). Vector truy vấn được tổng hợp theo trọng số:
$$\mathbf{v}_{\text{query}} = \alpha \cdot \mathbf{v}_{\text{text}} + (1 - \alpha) \cdot \mathbf{v}_{\text{image}}$$
- **Content-Type:** `multipart/form-data`

### Request Parameters (Form-Data)
| Tham số | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` | `MultipartFile` | Không | - | Ưu tiên khi cả hai được gửi; phải có `file` hoặc `image`. File ảnh gốc binary (`.png`, `.jpg`, `.jpeg`, `.webp`, tối đa 10MB theo service; multipart mặc định 5MB/file) |
| `image` | `MultipartFile` | Không | - | Ảnh thay thế khi không có `file` |
| `query` | `String` | Không | - | Ưu tiên khi được gửi; phải có `query` hoặc `textQuery` không trống |
| `textQuery` | `String` | Không | - | Văn bản thay thế khi không có `query` |
| `limit` | `Integer` | Không | `12` | Số lượng kết quả tối đa; ngoài khoảng 1–24 dùng 12 |
| `text_weight` | `Float` | Không | `0.5` | Trọng số chữ ($0.0 \le text\_weight \le 1.0$), ngoài khoảng dùng `0.5` (cân bằng 50% ảnh + 50% chữ) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tìm kiếm đa phương thức kết hợp thành công",
  "result": {
    "total": 2,
    "items": [
      {
        "id": "3dc85696-a348-427b-b6ba-191dc2fa3736",
        "score": 0.5345,
        "productId": 2313,
        "productName": "Áo thun Davies cổ tròn",
        "brandName": "Davies",
        "price": 199000.00,
        "imageUrl": "/api/v1/products/images/davies-2313.jpg",
        "colors": ["Trắng", "Đen"],
        "status": "ACTIVE"
      },
      {
        "id": "aa360090-9cd3-40f4-a740-8a7cab80d045",
        "score": 0.5059,
        "productId": 1204,
        "productName": "Áo sơ mi Oxford kẻ sọc",
        "brandName": "Routine",
        "price": 350000.00,
        "imageUrl": "/api/v1/products/images/routine-1204.jpg",
        "colors": ["Xanh"],
        "status": "ACTIVE"
      }
    ]
  },
  "timestamp": "2026-10-30T00:30:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400, thông điệp chuẩn: "Dữ liệu yêu cầu không hợp lệ.") khi thiếu ảnh hoặc mô tả, ảnh rỗng, thiếu tên, quá 10MB hoặc không đọc được; thông điệp thực tế mô tả nguyên nhân. `INVALID_IMAGE_FILE` (400): "Định dạng file ảnh không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp".
- **HTTP 413:** Vượt giới hạn multipart cấu hình (mặc định 5MB/file, 6MB/request): "Tệp vượt quá 5MB. Chọn tệp nhỏ hơn rồi thử lại."
- **HTTP 503:** `AI_SERVICE_UNAVAILABLE` (503, thông điệp chuẩn: "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau"); client thay bằng chi tiết lỗi hoặc lỗi kết nối.

---

## 4. Xem ảnh dataset (chỉ dùng gỡ lỗi)

- **Endpoint:** `GET /api/v1/search/images/{fileName}`
- **Quyền hạn:** `PUBLIC` (permitAll; không có `@PreAuthorize`)
- **Mô tả:** Chỉ phục vụ gỡ lỗi index AI; giao diện khách **không** dùng (kết quả tìm kiếm trả ảnh catalog ở `imageUrl`). Backend tải ảnh dataset từ AI Service và trả lại cho trình duyệt (`Cache-Control: private, max-age=3600`), không bọc `ApiResponse`.

### Request Parameters
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `fileName` | String | Có | Tên đường dẫn gồm 1–64 chữ ASCII, số, `_` hoặc `-`, theo sau bởi `.jpg`, `.jpeg`, `.png` hoặc `.webp` |

### Response Thành công (HTTP 200 OK)
Nội dung nhị phân ảnh.

### Response Lỗi thường gặp
- **HTTP 400:** `INVALID_REQUEST` (400, thông điệp chuẩn: "Dữ liệu yêu cầu không hợp lệ."); thực tế: "Tên file ảnh không hợp lệ".
- **HTTP 404:** `RESOURCE_NOT_FOUND` (404, thông điệp chuẩn: "Không tìm thấy tài nguyên."); thực tế: "Không tìm thấy ảnh".
- **HTTP 503:** `AI_SERVICE_UNAVAILABLE` (503, thông điệp chuẩn: "Dịch vụ tìm kiếm AI hiện không khả dụng. Vui lòng thử lại sau"); client thay bằng chi tiết lỗi hoặc lỗi kết nối.

---

## 5. Ghi nhận lịch sử tìm kiếm

- **Endpoint:** `POST /api/v1/account/search-history`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize` hoặc mã quyền riêng)
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
| `resultCount` | Integer | Không | Bắt buộc và không âm khi `status = SUCCESS`; nếu không có ở trạng thái khác thì mặc định 0 |
| `resultRefs` | String | Không | Mảng JSON tham chiếu an toàn (tối đa 24 chuỗi không rỗng, mỗi chuỗi tối đa 256 ký tự, toàn bộ tối đa 4096 ký tự; không chứa data URL, đường dẫn nội bộ hay bí mật) |
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
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** Kiểm tra DTO thất bại: "Dữ liệu không hợp lệ." và chi tiết `errors`. `INVALID_REQUEST` (400, thông điệp chuẩn: "Dữ liệu yêu cầu không hợp lệ.") khi kết quả SUCCESS không hợp lệ hoặc `resultRefs` không hợp lệ/không an toàn; service thay thông điệp bằng lý do cụ thể.
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."

---

## 6. Xem lịch sử tìm kiếm

- **Endpoint:** `GET /api/v1/account/search-history`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize`; chỉ lịch sử của chính mình)
- **Mô tả:** Lịch sử tìm kiếm của tài khoản hiện tại, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`; số âm được đưa về 0) |
| `size` | Integer | Không | Số bản ghi/trang, được giới hạn trong `1`–`100` (mặc định: `20`) |

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
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."

---

## 7. Xóa một mục lịch sử tìm kiếm

- **Endpoint:** `DELETE /api/v1/account/search-history/{id}`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize`; chỉ mục của chính mình)
- **Mô tả:** Xóa mềm một mục lịch sử.

### Request Parameters
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `id` | Long | Có | Mã trong đường dẫn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa lịch sử tìm kiếm thành công",
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."; `RESOURCE_NOT_FOUND` (404, thông điệp chuẩn: "Không tìm thấy tài nguyên."); thực tế: "Lịch sử tìm kiếm không tồn tại".

---

## 8. Thêm sản phẩm yêu thích

- **Endpoint:** `POST /api/v1/account/favorites`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize` hoặc mã quyền riêng)
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
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400:** Thiếu tham số: "Thiếu tham số 'productId'."
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."; `PRODUCT_NOT_FOUND` (404, thông điệp chuẩn: "Không tìm thấy sản phẩm."); thực tế: "Sản phẩm không tồn tại" hoặc "Sản phẩm không khả dụng". `RESOURCE_NOT_FOUND` (404, thông điệp chuẩn: "Không tìm thấy tài nguyên."); thực tế: "Yêu thích không tồn tại".

---

## 9. Xóa sản phẩm yêu thích

- **Endpoint:** `DELETE /api/v1/account/favorites/{productId}`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize`; chỉ mục của chính mình)
- **Mô tả:** Xóa mềm sản phẩm khỏi danh sách yêu thích.

### Request Parameters
| Tham số | Kiểu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `productId` | Long | Có | Mã trong đường dẫn |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Xóa yêu thích thành công",
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."; `RESOURCE_NOT_FOUND` (404, thông điệp chuẩn: "Không tìm thấy tài nguyên."); thực tế: "Yêu thích không tồn tại".

---

## 10. Xem danh sách sản phẩm yêu thích

- **Endpoint:** `GET /api/v1/account/favorites`
- **Quyền hạn:** `AUTHENTICATED` (mọi tài khoản đã xác thực; không có `@PreAuthorize`; chỉ danh sách của chính mình)
- **Mô tả:** Danh sách yêu thích của tài khoản hiện tại, mới nhất trước.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `page` | Integer | Không | Số trang (mặc định: `0`; số âm được đưa về 0) |
| `size` | Integer | Không | Số bản ghi/trang, được giới hạn trong `1`–`100` (mặc định: `20`) |

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
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 401:** `UNAUTHENTICATED` (401): "Bạn cần đăng nhập để truy cập tài nguyên này."
- **HTTP 404:** `USER_NOT_FOUND` (404): "Không tìm thấy người dùng."

---

## 11. Quy chuẩn ảnh kết quả tìm kiếm

Ảnh trong kết quả là **ảnh chính của sản phẩm trong catalog** (`imageUrl = /api/v1/products/images/{file}`), cùng nguồn với danh sách sản phẩm. Frontend phục vụ qua BFF cùng origin `/api/catalog/product-images/{file}` và hiển thị bằng đúng thẻ sản phẩm của catalog (giá, màu, yêu thích, liên kết `/san-pham/{productId}`).
