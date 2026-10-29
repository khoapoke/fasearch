# TÀI LIỆU TÍCH HỢP REST API CHO BACKEND (JAVA SPRING BOOT)
*Hệ thống: Fashion AI Search Engine (FastAPI + CLIP + Qdrant)*

> 📌 **Tài liệu tham chiếu nội bộ:**
> - [Tổng quan Kỹ thuật & Kiến trúc Hệ thống (README.md)](../README.md)
> - [Hướng dẫn Cài đặt & Vận hành (docs/SETUP.md)](SETUP.md)
> - [Giao diện Swagger UI Interactive:](http://localhost:8000/docs) `http://127.0.0.1:8000/docs`

---

## 1. MÔ HÌNH KIẾN TRÚC TÍCH HỢP & BẢO MẬT

Để đảm bảo vừa **dễ kết nối để test nhanh**, vừa **an toàn cho hệ thống**, kiến trúc đề xuất giữa Spring Boot và AI Service như sau:

```text
[ Web / Mobile App ]
         │ (HTTPS + JWT Bearer Token)
         ▼
┌────────────────────────────────────────────────────────┐
│  Java Spring Boot Backend (Cổng giao tiếp chính)       │
│  - Phân quyền người dùng (Spring Security)             │
│  - Rate Limiting / Validation nghiệp vụ                │
│  - Lưu log đơn hàng, lịch sử tìm kiếm vào MySQL/Postgres│
└──────────────────────────┬─────────────────────────────┘
                           │ (Mạng nội bộ / Docker Network / Localhost)
                           │ HTTP REST API (Không cần Auth phức tạp)
                           ▼
┌────────────────────────────────────────────────────────┐
│  Python AI Service (FastAPI - Port 8000)               │
│  - Trích xuất đặc trưng CLIP (Image / Text Embeddings) │
│  - Tìm kiếm Cosine Similarity trên Qdrant GPU (6334)   │
│  - Phục vụ Static Files ảnh sản phẩm (/dataset/...)    │
└────────────────────────────────────────────────────────┘
```

> [!TIP]
> **Khuyến nghị An toàn & Tối ưu hiệu năng:**
> - **Môi trường Test / Dev:** Spring Boot gọi trực tiếp sang `http://127.0.0.1:8000/api` rất nhanh gọn, không cần cấu hình API Key.
> - **Môi trường Production:** 
>   1. Không mở public port `8000` của AI Service ra Internet. Đặt AI Service và Spring Boot chung trong Docker Network hoặc Private Subnet.
>   2. Toàn bộ người dùng bên ngoài chỉ gọi qua Spring Boot. Spring Boot đóng vai trò Reverse Proxy / API Gateway gọi sang AI Service.

---

## 2. CẤU HÌNH TRONG SPRING BOOT

Thêm cấu hình vào file `application.yml` (hoặc `application.properties`):

```yaml
# application.yml
ai-service:
  base-url: ${AI_SERVICE_URL:http://localhost:8000}
  api-prefix: /api
  timeout-seconds: 15
```

---

## 3. CHI TIẾT CÁC ENDPOINTS

### 3.1. Tìm kiếm bằng Văn bản (Text-to-Image)

Tìm các sản phẩm thời trang tương đồng dựa trên chuỗi văn bản mô tả.

- **URL:** `POST ${ai-service.base-url}/api/search/text`
- **Content-Type:** `application/json`
- **Quyền:** `PUBLIC` (gọi nội bộ từ Spring Boot)

#### Request Body (JSON)
```json
{
  "query": "áo sơ mi trắng cổ bẻ công sở",
  "limit": 5
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `query` | `String` | **Có** | - | Từ khóa/câu mô tả sản phẩm (hỗ trợ cả tiếng Anh và tiếng Việt). |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa cần lấy ($1 \le limit \le 24$). |

#### Response (JSON)
```json
{
  "success": true,
  "status_code": 200,
  "message": "Tìm kiếm theo văn bản thành công",
  "data": {
    "total": 1,
    "results": [
      {
        "id": "c71e280d-8df5-46aa-b2b9-1f486a43875f",
        "score": 0.8254,
        "image_path": "dataset/train/sample_1001.jpg",
        "file_name": "sample_1001.jpg",
        "catalog": "TOPWEAR",
        "product_id": null,
        "metadata": null
      }
    ]
  },
  "errors": null
}
```

---

### 3.2. Tìm kiếm bằng Hình ảnh (Image-to-Image)

Tải lên 1 ảnh thời trang mẫu để tìm các sản phẩm tương đồng về kiểu dáng, màu sắc trong Database.

- **URL:** `POST ${ai-service.base-url}/api/search/image`
- **Content-Type:** `multipart/form-data`
- **Quyền:** `PUBLIC`

#### Request Parameters (Form Data)
| Tên Parameter | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` | `MultipartFile` | **Có** | - | File ảnh binary. Hỗ trợ: `.png`, `.jpg`, `.jpeg`, `.webp`. |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa ($1 \le limit \le 24$). |

#### Response (JSON)
```json
{
  "success": true,
  "status_code": 200,
  "message": "Tìm kiếm theo hình ảnh thành công",
  "data": {
    "total": 5,
    "results": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "score": 0.8912,
        "image_path": "dataset/train/dress_002.jpg",
        "file_name": "dress_002.jpg",
        "catalog": "FASHION_PRODUCT",
        "product_id": null,
        "metadata": null
      }
    ]
  },
  "errors": null
}
```

---

### 3.3. Tìm kiếm Đa phương thức kết hợp (Multimodal: Ảnh + Chữ)

Kết hợp cả **Ảnh gốc** và **Câu mô tả bổ sung** để điều hướng tìm kiếm (ví dụ: lấy ảnh áo sơ mi hiện tại + nhập chữ *"màu đỏ, phong cách vintage"*).

- **URL:** `POST ${ai-service.base-url}/api/search/multimodal`
- **Content-Type:** `multipart/form-data`
- **Quyền:** `PUBLIC`

#### Request Parameters (Form Data)
| Tên Parameter | Kiểu | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :---: | :---: | :--- |
| `file` | `MultipartFile` | **Có** | - | File ảnh mẫu gốc (`.png`, `.jpg`, `.jpeg`, `.webp`). |
| `query` | `String` | **Có** | - | Văn bản bổ sung hoặc yêu cầu thay đổi thuộc tính. |
| `limit` | `Integer` | Không | `5` | Số lượng kết quả tối đa ($1 \le limit \le 24$). |
| `text_weight` | `Float` | Không | `0.5` | Trọng số chữ ($0.0 \le text\_weight \le 1.0$). `0.5` là cân bằng 50% ảnh + 50% chữ. |

#### Response (JSON)
```json
{
  "success": true,
  "status_code": 200,
  "message": "Tìm kiếm đa phương thức kết hợp thành công",
  "data": {
    "total": 5,
    "results": [
      {
        "id": "e4f5a6b7-8901-2345-6789-abcdef012345",
        "score": 0.7850,
        "image_path": "dataset/train/red_vintage_shirt.jpg",
        "file_name": "red_vintage_shirt.jpg",
        "catalog": "TOPWEAR",
        "product_id": null,
        "metadata": null
      }
    ]
  },
  "errors": null
}
```

---

## 4. QUY CHUẨN MÃ LỖI & RESPONSE ENVELOPE

Mọi phản hồi từ AI Server đều tuân thủ cấu trúc phong bì thống nhất:

### 4.1. Lỗi Tham số / Nghiệp vụ (HTTP 400 Bad Request)
```json
{
  "success": false,
  "status_code": 400,
  "message": "Định dạng file '.bmp' không hợp lệ. Chỉ chấp nhận các file: .png, .jpg, .jpeg, .webp",
  "data": null,
  "errors": null
}
```

### 4.2. Lỗi Thiếu dữ liệu / Validate (HTTP 422 Unprocessable Entity)
```json
{
  "success": false,
  "status_code": 422,
  "message": "Dữ liệu yêu cầu không hợp lệ",
  "data": null,
  "errors": [
    {
      "field": "query",
      "message": "Field required"
    }
  ]
}
```

### 4.3. Lỗi Máy chủ nội bộ (HTTP 500 Internal Server Error)
```json
{
  "success": false,
  "status_code": 500,
  "message": "Đã xảy ra lỗi nội bộ hệ thống. Vui lòng thử lại sau.",
  "data": null,
  "errors": null
}
```

---

## 5. HƯỚNG DẪN HIỂN THỊ ẢNH (STATIC FILE URL)

AI Service đã mount sẵn các thư mục ảnh tĩnh:
- Đường dẫn tĩnh: `/dataset/...` (ảnh trong kho dữ liệu sản phẩm)
- Đường dẫn tĩnh: `/uploads/...` (ảnh upload)

**Công thức tạo URL ảnh đầy đủ cho Frontend:**
$$\text{FullImageUrl} = \text{base-url} + \text{"/"} + \text{image\_path}$$

*Ví dụ:* Nếu `image_path` trả về là `"dataset/train/sample_1001.jpg"`, URL hiển thị ảnh sẽ là:
👉 `http://localhost:8000/dataset/train/sample_1001.jpg`

---

## 6. CODE MẪU CHO JAVA SPRING BOOT

Dưới đây là trọn bộ DTO và Client Service hoàn chỉnh bằng Java Spring Boot để bạn copy trực tiếp vào dự án:

### 6.1. Các DTO Java (Sử dụng Java Record hoặc Class Lombok)

```java
package com.fasearch.dto.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

// 1. Envelope Response chung
public record AiApiResponse<T>(
    boolean success,
    @JsonProperty("status_code") int statusCode,
    String message,
    T data,
    Object errors
) {}

// 2. Data bọc danh sách kết quả
public record AiSearchData(
    int total,
    List<AiSearchResultItem> results
) {}

// 3. Từng item kết quả tìm kiếm
public record AiSearchResultItem(
    String id,
    double score,
    @JsonProperty("image_path") String imagePath,
    @JsonProperty("file_name") String fileName,
    String catalog,
    @JsonProperty("product_id") String productId,
    Map<String, Object> metadata
) {}

// 4. Request Body cho tìm kiếm Text
public record AiTextSearchRequest(
    String query,
    Integer limit
) {}
```

---

### 6.2. Service Client gọi sang AI Service (Dùng `RestClient` - Spring Boot 3+)

```java
package com.fasearch.service;

import com.fasearch.dto.ai.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
public class FashionAiSearchService {

    private final RestClient restClient;

    public FashionAiSearchService(@Value("${ai-service.base-url:http://localhost:8000}") String baseUrl) {
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
    }

    /**
     * 1. Tìm kiếm bằng Văn bản (Text Search)
     */
    public AiApiResponse<AiSearchData> searchByText(String query, int limit) {
        AiTextSearchRequest request = new AiTextSearchRequest(query, limit);

        return restClient.post()
                .uri("/api/search/text")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
    }

    /**
     * 2. Tìm kiếm bằng Hình ảnh (Image Search)
     */
    public AiApiResponse<AiSearchData> searchByImage(MultipartFile file, int limit) throws IOException {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        // Bọc file upload thành ByteArrayResource có kèm tên file
        ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        };

        body.add("file", fileResource);
        body.add("limit", limit);

        return restClient.post()
                .uri("/api/search/image")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
    }

    /**
     * 3. Tìm kiếm Đa phương thức kết hợp (Multimodal Search)
     */
    public AiApiResponse<AiSearchData> searchMultimodal(
            MultipartFile file,
            String queryText,
            int limit,
            float textWeight
    ) throws IOException {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

        ByteArrayResource fileResource = new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        };

        body.add("file", fileResource);
        body.add("query", queryText);
        body.add("limit", limit);
        body.add("text_weight", textWeight);

        return restClient.post()
                .uri("/api/search/multimodal")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<AiApiResponse<AiSearchData>>() {});
    }
}
```

---

### 6.3. Controller mẫu trong Spring Boot đón nhận từ Frontend

```java
package com.fasearch.controller;

import com.fasearch.dto.ai.AiApiResponse;
import com.fasearch.dto.ai.AiSearchData;
import com.fasearch.service.FashionAiSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/fashion/search")
public class FashionSearchController {

    private final FashionAiSearchService aiSearchService;

    public FashionSearchController(FashionAiSearchService aiSearchService) {
        this.aiSearchService = aiSearchService;
    }

    @PostMapping("/text")
    public ResponseEntity<AiApiResponse<AiSearchData>> searchByText(
            @RequestParam String query,
            @RequestParam(defaultValue = "5") int limit
    ) {
        return ResponseEntity.ok(aiSearchService.searchByText(query, limit));
    }

    @PostMapping("/image")
    public ResponseEntity<AiApiResponse<AiSearchData>> searchByImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "5") int limit
    ) throws IOException {
        return ResponseEntity.ok(aiSearchService.searchByImage(file, limit));
    }

    @PostMapping("/multimodal")
    public ResponseEntity<AiApiResponse<AiSearchData>> searchMultimodal(
            @RequestParam("file") MultipartFile file,
            @RequestParam("query") String query,
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(defaultValue = "0.5") float textWeight
    ) throws IOException {
        return ResponseEntity.ok(aiSearchService.searchMultimodal(file, query, limit, textWeight));
    }
}
```

---

## 7. KIỂM THỬ NHANH BẰNG CURL

Nếu cần test nhanh từ Terminal để kiểm tra server AI có phản hồi đúng hay không:

```powershell
# 1. Test Text Search
curl -X POST "http://localhost:8000/api/search/text" `
     -H "Content-Type: application/json" `
     -d '{"query": "white shirt", "limit": 3}'

# 2. Test Image Search
curl -X POST "http://localhost:8000/api/search/image" `
     -F "file=@./dataset/test/sample.jpg" `
     -F "limit=3"

# 3. Test Multimodal Search
curl -X POST "http://localhost:8000/api/search/multimodal" `
     -F "file=@./dataset/test/sample.jpg" `
     -F "query=red vintage style" `
     -F "text_weight=0.5" `
     -F "limit=3"
```

