# TỔNG QUAN HỆ THỐNG & KIẾN TRÚC DỰ ÁN (PROJECT OVERVIEW)
*Hệ thống: Fashion AI Search Engine (`fasearch/ai`)*

> 📌 **Hồ sơ làm việc cho Developer & Agent:** Vui lòng xem các quy chuẩn bắt buộc, quy trình 2 bước và hướng dẫn vận hành tại [AGENTS.md](AGENTS.md).

---

## 1. BÀI TOÁN & GIẢI PHÁP KỸ THUẬT

### 1.1. Bài toán
Dự án là một Backend AI Service cung cấp khả năng **Tìm kiếm thời trang đa phương thức (Multimodal Fashion Search)** thế hệ mới:
- **Tìm kiếm bằng Văn bản (Text-to-Image):** Người dùng nhập mô tả bằng ngôn ngữ tự nhiên (vd: *"áo sơ mi trắng basic"*, *"black leather jacket"*, *"váy hoa nhí vintage"*), hệ thống tìm ra các sản phẩm thời trang tương đồng nhất.
- **Tìm kiếm bằng Hình ảnh (Image-to-Image):** Người dùng tải lên ảnh một bộ trang phục mẫu để tìm kiếm các sản phẩm có phong cách, kiểu dáng tương tự trong kho dữ liệu.

### 1.2. Giải pháp Deep Learning & Vector Database
- **Mô hình AI:** Sử dụng **CLIP** (`openai/clip-vit-base-patch32`) của OpenAI từ Hugging Face. Mô hình ánh xạ cả hình ảnh và văn bản vào cùng một không gian vector đa chiều (Shared Embedding Space) 512 chiều.
- **Vector Database:** Lưu trữ và truy vấn lân cận cosine trên GPU thông qua **Qdrant** (`qdrant/qdrant:v1.19-gpu-nvidia`):
  - **gRPC (Cổng 6334):** Kết nối hiệu năng cao phục vụ truy vấn vector và nạp dữ liệu theo batch.
  - **REST API (Cổng 6333):** Phục vụ dashboard quản trị Qdrant và các thao tác kiểm tra cấu hình.

---

## 2. TECH STACK & HẠ TẦNG CÔNG NGHỆ

| Phân tầng | Thư viện / Công nghệ | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Runtime** | Python 3.12 (`venv312`) | Môi trường thực thi chính |
| **API Framework** | `fastapi>=0.110.0`, `uvicorn>=0.30.0` | Server REST API bất đồng bộ hiệu năng cao |
| **Admin Console** | `streamlit>=1.35.0` | Giao diện Web trực quan quản trị Point, cấu hình và Playground test |
| **Deep Learning** | `torch==2.14.1`, `torchvision==0.29.1` (CUDA 12.4) | Tính toán Tensor trên GPU NVIDIA (RTX) |
| **AI Model** | `transformers==4.46.3` | Hugging Face CLIP (`openai/clip-vit-base-patch32`) |
| **Image Processing**| `pillow==11.0.0` (PIL) | Đọc, validate và chuẩn hóa RGB cho ảnh sản phẩm |
| **Vector DB Client** | `qdrant-client==1.12.1` | Thư viện kết nối Qdrant qua giao thức gRPC và HTTP |
| **Vector DB Server** | `qdrant/qdrant:v1.19-gpu-nvidia` | Container Docker chạy Qdrant tăng tốc phần cứng GPU |
| **Config Management**| `PyYAML==6.0.2` | Đọc và quản lý cấu hình từ `configs/database.yaml` và `.env` |
| **Upload Parser** | `python-multipart` | Xử lý upload file ảnh multipart/form-data |

---

## 3. CẤU TRÚC THƯ MỤC & CÁC MODULE

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
│       └── search_tester.py       # Sân chơi thử nghiệm Text-to-Image & Image-to-Image
├── configs/
│   └── database.yaml              # Cấu hình Qdrant, Model CLIP, thư mục ảnh
├── dataset/                       # Thư mục chứa dataset ảnh sản phẩm mẫu
│   ├── admin/                     # Nơi lưu trữ ảnh sản phẩm mới tải lên từ Admin Console
│   ├── raw/                       # Ảnh gốc chưa qua xử lý
│   └── test/                      # Tập dữ liệu kiểm thử
├── scripts/
│   ├── __init__.py
│   ├── init_qdrant.py             # Script khởi tạo/Reset Qdrant collection (vector_size: 512, cosine)
│   └── seed_data.py               # Script nạp ảnh hàng loạt từ dataset/ vào Qdrant qua Repository
├── src/
│   ├── __init__.py
│   ├── main.py                    # Entrypoint FastAPI, Lifespan startup, CORS, Static mounts
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints.py           # REST Endpoints: /api/search/text, /api/search/image
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
├── .env                           # Biến môi trường local
├── OVERVIEW.md                    # Tài liệu Tổng quan & Kiến trúc hệ thống
└── AGENTS.md                      # Hồ sơ quy chuẩn làm việc cho Developer & Agent
```

---

## 4. MÔ HÌNH PHÂN TẦNG KIẾN TRÚC (CLEAN ARCHITECTURE)

Hệ thống được thiết kế theo mô hình Clean Architecture 5 tầng độc lập, đảm bảo nguyên tắc Separation of Concerns:

```
[ Client / Frontend / Admin App ]
               │
               ▼
┌────────────────────────────────────────┐
│ 1. Controller / Router (src/api/)      │ ── Tiếp nhận HTTP Request, Validate DTO
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ 2. Business Service (src/services/)    │ ── Trích xuất Vector CLIP, chuẩn hóa L2 norm
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│ 3. Data Repository (src/repositories/) │ ── CRUD Vector Point, tự động lọc DELETED
└──────────────────┬─────────────────────┘
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
┌──────────────┐       ┌──────────────────────┐
│  Core Singletons     │ Vector DB Entity     │
│  (src/core/)         │ (src/db/models.py)   │
└──────────────┘       └──────────────────────┘
```

1. **Router Layer (`src/api/`):** Chỉ xử lý HTTP request, parse multipart form, validate DTO đầu vào qua `src/schemas/`, gọi Service và trả về response chuẩn qua envelope `ApiResponse[T]`.
2. **Service Layer (`src/services/`):** Chứa 100% logic nghiệp vụ AI (mã hóa CLIP, chuẩn hóa vector L2). Không phụ thuộc HTTP framework và không tương tác trực tiếp với database client mà thông qua Repository.
3. **Repository Layer (`src/repositories/`):** Đóng gói toàn bộ thao tác giao tiếp với Qdrant (`search_vectors`, `get_by_id`, `create`, `upsert_batch`, `update_payload`, `soft_delete`, `hard_delete`, `reset_collection`). Tự động gắn bộ lọc loại trừ (`must_not`) các point có trạng thái `DELETED`.
4. **Entity / Domain Layer (`src/db/`):** Định nghĩa thực thể dữ liệu lưu trữ `ImagePointPayload` và các Enum chuẩn hóa `PointStatus`, `CatalogCategory`.
5. **Presentation Schemas (`src/schemas/`):** Pydantic DTOs cho các request/response HTTP (`ApiResponse`, `SearchTextRequest`, `SearchData`, `SearchResultItem`).
6. **Core Layer (`src/core/`):** Quản lý cấu hình tập trung (`config.py`), vòng đời singleton của mô hình CLIP trên VRAM (`ai_model.py`) và kết nối singleton tới Qdrant (`qdrant_client.py`).

---

## 5. THỰC THỂ DỮ LIỆU VECTOR (QDRANT POINT SCHEMA)

- **Collection Name:** `image_gallery`
- **Vector Configuration:** 512 dimensions, khoảng cách Cosine (`Distance.COSINE`).
- **Cấu trúc Payload (`ImagePointPayload`):**
  - `id`: Chuỗi UUID định danh duy nhất của Point.
  - `image_path`: Đường dẫn ảnh tương đối phục vụ web (vd: `/dataset/test/1001.jpg`).
  - `file_name`: Tên gốc của file ảnh (vd: `1001.jpg`).
  - `catalog`: Danh mục sản phẩm (Enum: `FASHION_PRODUCT`, `TOPWEAR`, `BOTTOMWEAR`, `FOOTWEAR`).
  - `status`: Trạng thái bản ghi (Enum: `SEEDED`, `ACTIVE`, `INACTIVE`, `DELETED`).
  - `product_id`: Mã sản phẩm tùy chọn (Optional string).
  - `metadata`: Dữ liệu bổ sung dạng key-value (Optional dict).
  - `created_at`: Thời điểm tạo bản ghi theo chuẩn ISO 8601 UTC.

---

## 6. CƠ CHẾ PHỤC VỤ STATIC FILES

FastAPI server cấu hình mount các thư mục tĩnh:
- **`/dataset`** -> Mount tới thư mục vật lý `dataset/`: Cho phép Frontend và Client trực tiếp hiển thị ảnh sản phẩm từ URL `http://127.0.0.1:8000/dataset/...`.
- **`/uploads`** -> Mount tới thư mục vật lý `storage/uploads/`: Phục vụ các ảnh tạm do client upload lên để tìm kiếm so sánh.
