# FASHION AI SEARCH ENGINE (BACKEND AI SERVICE)

Hệ thống Tìm kiếm Thời trang Đa phương thức (Multimodal Fashion Search) xây dựng trên nền tảng **FastAPI**, **PyTorch**, **Transformers (CLIP)** và **Qdrant Vector Database (GPU)**.

> 📚 **Tài liệu tham khảo liên quan:**
> - [Tài liệu Tích hợp API cho Backend Java Spring Boot (docs/API_DOCUMENTATION.md)](docs/API_DOCUMENTATION.md) — Dành cho Kỹ sư Backend tích hợp DTO, RestClient, cURL.
> - [Dành cho Người dùng & Quản lý Sản phẩm (OVERVIEW.md)](OVERVIEW.md) — Tổng quan bài toán, trải nghiệm và giá trị thực tế của sản phẩm.
> - [Quy chuẩn phát triển dành cho AI Agent (AGENTS.md)](AGENTS.md) — Quy trình bắt buộc 2 bước, coding conventions và quy tắc an toàn.

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG

Dự án áp dụng mô hình **Clean Architecture 5 tầng độc lập**, đảm bảo tách biệt hoàn toàn giữa tầng giao tiếp (HTTP / UI), tầng nghiệp vụ AI (Domain Service) và tầng truy xuất dữ liệu (Data Access / Repository):

```text
[ Client / Frontend / Streamlit Admin App ]
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│ 1. Presentation Layer (src/api/, src/schemas/)         │
│    • FastAPI Endpoints (/api/search/text, /image)      │
│    • Pydantic DTOs & ApiResponse[T] Envelope           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Business Service Layer (src/services/)              │
│    • CLIP Encoding (Text-to-Vector, Image-to-Vector)   │
│    • Chuẩn hóa L2 Norm cho Cosine Similarity           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Data Access Layer (src/repositories/)               │
│    • Qdrant Vector Search (Tự động lọc Soft-Deleted)   │
│    • CRUD Point, Scroll phân trang, Count, Reset DB    │
└──────────────────────────┬─────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│ 4. Persistence Models     │ │ 5. Core Infrastructure    │
│    (src/db/)              │ │    (src/core/)            │
│    • ImagePointPayload    │ │    • CLIP Model Singleton │
│    • PointStatus, Catalog │ │    • Qdrant gRPC Client   │
└───────────────────────────┘ └───────────────────────────┘
```

---

## 2. NỀN TẢNG AI & VECTOR DATABASE

### 2.1. Mô hình Deep Learning CLIP
- **Model ID:** `openai/clip-vit-base-patch32` (Hugging Face Transformers).
- **Cơ chế Embedding:** Ánh xạ hình ảnh và văn bản vào cùng không gian vector chung 512 chiều (Shared Embedding Space).
- **Chuẩn hóa Vector:** Vector được chuẩn hóa $L_2$ norm ($v = \frac{v}{\|v\|_2}$) trước khi lưu trữ hoặc tìm kiếm, đảm bảo tích vô hướng (Dot Product) tương đương khoảng cách Cosine.
- **Quản lý GPU/VRAM:** Mô hình được nạp dạng Singleton lên VRAM ở chế độ đánh giá (`model.eval()`) trong vòng đời khởi động của ứng dụng (`lifespan`), hạn chế tải lại gây tràn bộ nhớ.

### 2.2. Vector Database Qdrant (GPU)
- **Container Server:** `qdrant/qdrant:v1.19-gpu-nvidia` (tăng tốc độ lập chỉ mục và truy vấn tương đồng lân cận qua GPU).
- **Cổng giao tiếp:**
  - `6334 (gRPC)`: Luồng kết nối nhị phân tốc độ cao phục vụ tính toán vector và nạp batch.
  - `6333 (REST / HTTP)`: Dashboard quản trị Qdrant và API kiểm tra.
- **Collection:** `image_gallery` (Vector size: `512`, Distance: `Cosine`).
- **Thực thể Payload (`ImagePointPayload`):**
  ```python
  class ImagePointPayload(BaseModel):
      image_path: str                 # Đường dẫn ảnh phục vụ web (/dataset/...)
      file_name: str                  # Tên file ảnh
      catalog: CatalogCategory        # Danh mục (FASHION_PRODUCT, TOPWEAR, BOTTOMWEAR, FOOTWEAR)
      status: PointStatus             # Trạng thái (SEEDED, ACTIVE, INACTIVE, DELETED)
      product_id: Optional[str]       # Mã sản phẩm nội bộ (tùy chọn)
      metadata: Optional[Dict]        # Thuộc tính động dạng JSON
      created_at: str                 # Thời điểm tạo (ISO 8601 UTC)
  ```

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN

```text
fasearch/ai/
├── admin_app/                     # Ứng dụng Streamlit quản trị và kiểm thử trực quan
│   ├── __init__.py
│   ├── app.py                     # Entrypoint Streamlit (Dashboard, Point CRUD, Playground)
│   ├── components/                # UI Helpers: xử lý ảnh, format badge trạng thái
│   │   ├── __init__.py
│   │   └── ui_helpers.py
│   └── views/                     # Các màn hình chức năng chính
│       ├── __init__.py
│       ├── overview.py            # Thống kê GPU/DB, sửa database.yaml, Danger Zone (Reset/Seed)
│       ├── point_manager.py       # Quản trị Point CRUD (Gallery, Thêm mới, Sửa, Xóa)
│       └── search_tester.py       # Sân chơi thử nghiệm Text, Image & Multimodal
├── configs/
│   └── database.yaml              # Cấu hình Qdrant, Model CLIP, thư mục ảnh
├── dataset/                       # Thư mục chứa dataset ảnh sản phẩm mẫu
│   ├── admin/                     # Nơi lưu trữ ảnh sản phẩm mới tải lên từ Admin UI
│   ├── raw/                       # Ảnh gốc chưa qua xử lý
│   └── test/                      # Tập dữ liệu kiểm thử
├── docs/                          # Tài liệu kỹ thuật dự án
│   ├── SETUP.md                   # Hướng dẫn chi tiết cài đặt môi trường
│   └── API_DOCUMENTATION.md       # Tài liệu tích hợp API cho Backend Java Spring Boot
├── scripts/
│   ├── __init__.py
│   ├── init_qdrant.py             # Script khởi tạo/Reset Qdrant collection (vector_size: 512, cosine)
│   └── seed_data.py               # Script nạp ảnh hàng loạt từ dataset/ vào Qdrant qua Repository
├── src/
│   ├── __init__.py
│   ├── main.py                    # Entrypoint FastAPI, Lifespan startup, CORS, Static mounts
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints.py           # REST Endpoints: /api/search/text, /image, /multimodal
│   ├── core/
│   │   ├── __init__.py
│   │   ├── ai_model.py            # Singleton quản lý mô hình CLIP trên VRAM (eval mode)
│   │   ├── config.py              # Centralized config loader (database.yaml + .env)
│   │   └── qdrant_client.py       # Singleton quản lý kết nối Qdrant qua gRPC (timeout: 5s)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── enums.py               # Enums chuẩn hóa: PointStatus, CatalogCategory
│   │   └── models.py              # Entity ImagePointPayload lưu trong Vector Point Qdrant
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py                # Base Repository trừu tượng hóa tương tác Qdrant
│   │   └── image_repository.py    # Repository CRUD, Scroll, Count & Vector search
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py              # ApiResponse[T] envelope chuẩn doanh nghiệp
│   │   └── search.py              # Pydantic DTOs cho Search Request & Response
│   └── services/
│       ├── __init__.py
│       └── search_service.py      # Nghiệp vụ trích xuất vector CLIP và truy vấn qua Repository
├── storage/
│   └── uploads/                   # Nơi lưu tạm file do client upload lên để tìm kiếm so sánh
├── test/                          # Các test script đơn lẻ (kiểm tra CPU, gRPC, seed, retrieve)
├── docker-compose.yml             # Docker compose khởi chạy Qdrant GPU (port 6333, 6334)
├── requirements.txt               # Danh sách thư viện Python
├── .env.example                   # Mẫu cấu hình môi trường local
├── OVERVIEW.md                    # Tài liệu tổng quan sản phẩm cho người dùng
├── AGENTS.md                      # Hồ sơ quy chuẩn phát triển cho Developer & Agent
└── README.md                      # Tài liệu kỹ thuật chi tiết của dự án
```

---

## 4. HƯỚNG DẪN CÀI ĐẶT & THIẾT LẬP MÔI TRƯỜNG

### 4.1. Yêu cầu Tiên quyết
- **Hệ điều hành:** Windows 10/11 hoặc Linux (Ubuntu 22.04+).
- **Python:** 3.12 (khuyến nghị sử dụng virtual environment `venv312`).
- **NVIDIA GPU:** Card đồ họa hỗ trợ CUDA (RTX 30xx/40xx hoặc tương đương), đã cài driver và CUDA 12.4.
- **Docker & Docker Compose:** Đã bật tính năng NVIDIA Container Toolkit.

### 4.2. Các bước Thiết lập

#### Bước 1: Khởi động Qdrant Vector Database (GPU)
```powershell
docker-compose up -d
docker-compose logs -f qdrant
```
- Dashboard Qdrant UI: `http://localhost:6333/dashboard`

#### Bước 2: Tạo Môi trường Ảo & Cài đặt Dependencies
```powershell
# Tạo môi trường ảo Python 3.12
python -m venv venv312

# Kích hoạt venv
.\venv312\Scripts\Activate.ps1

# Cài đặt toàn bộ packages
pip install -r requirements.txt
```

#### Bước 3: Khởi tạo Vector Collection
```powershell
python scripts/init_qdrant.py
```

#### Bước 4: Nạp Dữ liệu Mẫu (Seeding)
```powershell
# Nạp toàn bộ dữ liệu mẫu trong dataset/ theo batch
python scripts/seed_data.py
```

---

## 5. HƯỚNG DẪN VẬN HÀNH ỨNG DỤNG

### 5.1. Khởi chạy REST API Server (FastAPI)
```powershell
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```
- **Swagger UI Interactive Docs:** `http://127.0.0.1:8000/docs`
- **ReDoc Alternative Docs:** `http://127.0.0.1:8000/redoc`

### 5.2. Khởi chạy Admin Console & Test Playground (Streamlit)
```powershell
streamlit run admin_app/app.py
```
- **Admin Console Web UI:** `http://localhost:8501`

---

## 6. DANH SÁCH REST API ENDPOINTS

> 📖 **Xem tài liệu chi tiết và code mẫu tích hợp cho Java Spring Boot tại:** [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)

### 6.1. Tìm kiếm bằng Văn bản (`POST /api/search/text`)
- **Phân quyền:** `PUBLIC`
- **Content-Type:** `application/json`
- **Request Body (JSON):**
  ```json
  {
    "query": "áo sơ mi trắng basic",
    "limit": 5
  }
  ```
- **Response:** Chuẩn hóa theo phong bì `ApiResponse[SearchData]`:
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
          "image_path": "dataset/test/1001.jpg",
          "file_name": "1001.jpg",
          "catalog": "FASHION_PRODUCT"
        }
      ]
    },
    "errors": null
  }
  ```

### 6.2. Tìm kiếm bằng Hình ảnh (`POST /api/search/image`)
- **Phân quyền:** `PUBLIC`
- **Request Type:** `multipart/form-data`
- **Form Parameters:**
  - `file`: File ảnh (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - `limit`: Số lượng kết quả tối đa (mặc định: 5).

### 6.3. Tìm kiếm Đa phương thức kết hợp (`POST /api/search/multimodal`)
- **Phân quyền:** `PUBLIC`
- **Request Type:** `multipart/form-data`
- **Form Parameters:**
  - `file`: File ảnh thời trang mẫu (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - `query`: Chuỗi mô tả bổ trợ hoặc điều chỉnh phong cách (vd: *"nhưng màu xanh"*, *"dáng oversize"*).
  - `limit`: Số lượng kết quả tối đa (mặc định: 5).
  - `text_weight`: Trọng số ưu tiên văn bản từ `0.0` đến `1.0` (mặc định: `0.5` cân bằng 50% ảnh + 50% chữ).
- **Response:** Chuẩn hóa theo phong bì `ApiResponse[SearchData]`.

### 6.4. Static Mounts
- `/dataset/...` -> Mount trực tiếp thư mục `dataset/` để frontend hiển thị ảnh sản phẩm.
- `/uploads/...` -> Mount thư mục `storage/uploads/` phục vụ ảnh tạm tải lên.

---

## 7. QUY CHUẨN KỸ THUẬT KHI VIẾT CODE

- **Type Safety:** 100% tham số và hàm bắt buộc có type hint rõ ràng.
- **Enum Policy:** 100% Enum và Status viết bằng **TIẾNG ANH IN HOA** kế thừa `StrEnum`.
- **Soft Delete Pattern:** Khi xóa bản ghi, ưu tiên chuyển `status = PointStatus.DELETED`. Tầng Repository tự động loại trừ các bản ghi này khỏi kết quả tìm kiếm bằng bộ lọc `must_not`.
- **Upload Safety:** Mọi file upload tạm thời bắt buộc đặt tên kèm tiền tố UUID và phải dọn dẹp trong khối `try ... finally`.
- **Bảo vệ tài nguyên:** Tuyệt đối không quét đệ quy các thư mục nặng (`venv312/`, `dataset/`). Xử lý batch ảnh bằng PyTorch luôn gọi `del tensor` và `torch.cuda.empty_cache()` để chống rò rỉ VRAM.
