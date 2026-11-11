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

### 2.3. Bộ Chuyển đổi Truy vấn Thời trang Việt - Anh (Query Translation)
- **Mục đích:** Mô hình CLIP được tiền huấn luyện chủ yếu trên văn bản tiếng Anh. Nhằm hỗ trợ người dùng tìm kiếm tự nhiên bằng tiếng Việt (vd: *"áo sơ mi nam dài tay"*, *"quần bò xanh"*, *"đồng hồ thể thao"*), hệ thống tích hợp bộ dịch thuật từ khóa chuyên ngành thời trang.
- **Cơ chế hoạt động:**
  - Tra cứu và thay thế từ điển thuật ngữ thời trang song ngữ (`src/services/fashion_glossary_vi_en.json`).
  - Chuẩn hóa xóa dấu, xử lý quy tắc ngữ pháp thời trang (`src/services/query_translation.py`).
  - Chuyển hóa chuỗi tìm kiếm tiếng Việt sang tiếng Anh tối ưu ngữ nghĩa trước khi đưa vào CLIP text encoder, giúp nâng cao độ chính xác truy hồi vector.

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN (FOLDER STRUCTURE)

Cấu trúc thư mục được tổ chức theo cấp độ module và package chuẩn Clean Architecture:

```text
fasearch/ai/
├── admin_app/                     # Bảng điều khiển quản trị Streamlit & Test Playground
│   ├── components/                # UI widgets & helpers (hiển thị ảnh, format badge, dialog CSV)
│   └── views/                     # Màn hình: Overview, Point Manager, Search Tester, Evaluation
├── configs/                       # Cấu hình hệ thống tĩnh (database.yaml)
├── dataset/                       # Dữ liệu ảnh và nhãn chuẩn Ground Truth (styles.csv)
│   ├── admin/                     # Thư mục lưu trữ ảnh sản phẩm mới tải lên từ Admin UI
│   ├── raw/                       # Ảnh gốc chưa qua tiền xử lý
│   └── test/                      # Tập dữ liệu kiểm thử và nhãn Ground Truth (styles.csv)
├── docs/                          # Tài liệu kỹ thuật dự án (SETUP.md, API_DOCUMENTATION.md)
├── scripts/                       # Bộ công cụ CLI vận hành & đo lường offline
│   ├── init_qdrant.py             # Script khởi tạo / Reset collection trên Qdrant (512 chiều, Cosine)
│   ├── seed_data.py               # Script nạp ảnh hàng loạt từ dataset vào Qdrant qua Repository
│   ├── run_benchmark.py           # Script chạy đánh giá toàn diện mô hình tìm kiếm trên terminal
│   ├── eval_runner.py             # Runner chạy đánh giá offline qua tập queries.json và qrels.json
│   └── eval_metrics.py            # Thư viện tính toán offline metrics (P@K, R@K, NDCG@K, MRR)
├── src/                           # Mã nguồn chính của dịch vụ AI (FastAPI & Clean Architecture)
│   ├── api/                       # Presentation Layer: Endpoints Public (/api/search) & Internal (/api/internal)
│   ├── core/                      # Core Infrastructure: CLIP Model Singleton, Qdrant gRPC, Config, Exceptions
│   ├── db/                        # Persistence Layer: ImagePointPayload, Enums (PointStatus, CatalogCategory)
│   ├── repositories/              # Data Access Layer: Qdrant Base & ImageRepository (Vector CRUD, Filter)
│   ├── schemas/                   # Data Transfer Objects: ApiResponse[T], Search DTOs, Evaluation DTOs
│   ├── services/                  # Business Logic: SearchService, PointService, Translation, Evaluation
│   └── utils/                     # Shared Utilities: CSV helpers, Metrics IR math, Path helpers, Point ID
├── storage/                       # Thư mục lưu trữ tạm (ảnh upload từ client để tìm kiếm)
├── test/                          # Hệ thống kiểm thử độc lập (Testing & Benchmarks)
│   ├── benchmarks/                # Bộ 143 kịch bản kiểm thử song ngữ chuẩn hóa (styles.csv)
│   └── unit/                      # Bộ kiểm thử đơn vị Pytest (API search, internal, translation, point IDs)
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

### 6.5. Endpoints Nội bộ Đồng bộ Dữ liệu (Internal Index API)
- **Phân quyền:** `ADMIN / LOOPBACK ONLY` (Chỉ chấp nhận gọi từ `127.0.0.1`, `localhost`, `::1`).
- **Các phương thức:**
  - `POST /internal/v1/index/upsert`: Nhận multipart form (`product_id`, `name`, `description`, `brand_slug`, `model`, `file`) để trích xuất vector CLIP và đồng bộ thêm mới / cập nhật point sản phẩm trong Qdrant.
  - `DELETE /internal/v1/index/products/{product_id}`: Xóa point sản phẩm khỏi Qdrant khi backend unpublish sản phẩm.
  - `GET /internal/v1/health`: Kiểm tra sức khỏe kết nối API nội bộ.

---

## 7. HƯỚNG DẪN CHẠY KIỂM THỬ & ĐÁNH GIÁ (TESTING & BENCHMARKS)

Hệ thống cung cấp 3 cấp độ kiểm thử và đo lường độc lập, từ kiểm thử logic đơn vị đến đánh giá chỉ số chuyên sâu:

### 7.1. Chạy Kiểm thử Đơn vị (Unit Tests)

Bộ kiểm thử đơn vị được xây dựng bằng **Pytest** đặt tại thư mục `test/unit/`, đảm bảo tính đúng đắn của logic nghiệp vụ trước khi triển khai:

```powershell
# Chạy toàn bộ các ca kiểm thử đơn vị
pytest test/unit -v

# 1. Kiểm thử module Dịch thuật Truy vấn Việt - Anh (Glossary, Rule-based mapping)
pytest test/unit/test_query_translation.py -v

# 2. Kiểm thử luồng REST API Tìm kiếm (Text, Image, Multimodal, Pagination)
pytest test/unit/test_search_api.py -v

# 3. Kiểm thử Internal Index API (Upsert, Delete, Loopback auth, Validation ID)
pytest test/unit/test_internal_api.py -v

# 4. Kiểm thử cơ chế sinh và phân giải Point ID trong Qdrant
pytest test/unit/test_point_ids_config.py -v
```

### 7.2. Chạy Đánh giá Toàn diện Hệ thống (Benchmark Suite)

Đo lường độ chính xác của mô hình CLIP và thuật toán tìm kiếm dựa trên Ground Truth `dataset/test/styles.csv`. Bộ kịch bản kiểm thử được định nghĩa độc lập tại `test/benchmarks/search_cases.py` với **143 ca kiểm thử song ngữ** (Query tiếng Anh, Description tiếng Việt) tương ứng 143 giá trị của cột `articleType`.

#### Cách 1: Chạy trực quan trên Giao diện Streamlit Admin (Khuyến nghị)
1. Khởi chạy Admin App:
   ```powershell
   python -m streamlit run admin_app/app.py
   ```
2. Mở trình duyệt tại `http://localhost:8501`, chọn trang **"Đánh giá & Benchmark (Evaluation)"**.
3. Chọn Collection cần đánh giá (ví dụ: `image_gallery` hoặc `fashion_gallery`).
4. Lựa chọn phạm vi kịch bản:
   - **Bộ trọng tâm (36 ngành hàng chính):** Chạy nhanh (~0.5 - 1s), bao phủ >96% sản phẩm thực tế.
   - **Bộ toàn diện (Tất cả 143 danh mục trong styles.csv):** Quét toàn bộ mọi ngành hàng thời trang.
5. Chọn các ngưỡng Top $K$ cần đo (`[1, 3, 5, 10, 15, 20]`) và bấm **"Chạy Đánh giá Hệ thống"**.
6. Theo dõi các chỉ số KPI:
   - **mAP (Mean Average Precision):** Đánh giá chất lượng xếp hạng trung bình toàn bộ câu truy vấn.
   - **MRR (Mean Reciprocal Rank):** Đánh giá vị trí xuất hiện của kết quả đúng đầu tiên.
   - **Precision@K & Recall@K:** Độ chính xác và độ bao phủ tại từng ngưỡng $K$.
   - **Thời gian phản hồi trung bình (ms):** Tốc độ trích xuất vector và truy hồi trên Qdrant.
   - **Hit / Miss Visual Inspection:** Bảng kiểm tra trực quan chi tiết từng ảnh trả về (HIT màu xanh, MISS màu đỏ).

#### Cách 2: Chạy tự động qua dòng lệnh (CLI Script)
```powershell
# Chạy đánh giá tự động trên terminal
python scripts/run_benchmark.py
```
Script tự động kiểm tra dữ liệu, nạp dữ liệu mẫu nếu DB trống, chạy kịch bản kiểm thử và in bảng báo cáo chỉ số ra màn hình console.

### 7.3. Chạy Đánh giá Tìm kiếm Ngoại tuyến (Offline Search Evaluation Runner)

Phục vụ việc đánh giá độ chuẩn xác từ kết quả truy hồi offline theo tập dữ liệu câu truy vấn (`queries.json`) và nhãn phán quyết độ phù hợp (`qrels.json`):

```powershell
python scripts/eval_runner.py --queries <path_to_queries.json> --qrels <path_to_qrels.json> --output <path_to_results.json> --k 10
```

- **Định dạng file đầu vào:**
  - `queries.json`: Danh sách câu hỏi kiểm thử `[{"query_id": "q1", "query": "áo sơ mi", "mode": "text", "limit": 5}]`.
  - `qrels.json`: File nhãn phán quyết `{"q1": ["product_id_1", "product_id_2"]}`.
- **Các chỉ số IR được tính toán:**
  - $\text{NDCG}@K$ (Normalized Discounted Cumulative Gain)
  - $\text{MRR}$ (Mean Reciprocal Rank)
  - $\text{Precision}@K$ và $\text{Recall}@K$
  - $\text{MAP}$ (Mean Average Precision)
- **Cơ chế an toàn:** Nếu file `qrels` bị thiếu hoặc sai schema, script sẽ xuất báo cáo `BLOCKED` chỉ rõ định dạng cần bổ sung mà không tự ý sinh nhãn giả lập.

---

## 8. QUY CHUẨN KỸ THUẬT KHI VIẾT CODE

- **Type Safety:** 100% tham số và hàm bắt buộc có type hint rõ ràng.
- **Enum Policy:** 100% Enum và Status viết bằng **TIẾNG ANH IN HOA** kế thừa `StrEnum`.
- **Soft Delete Pattern:** Khi xóa bản ghi, ưu tiên chuyển `status = PointStatus.DELETED`. Tầng Repository tự động loại trừ các bản ghi này khỏi kết quả tìm kiếm bằng bộ lọc `must_not`.
- **Upload Safety:** Mọi file upload tạm thời bắt buộc đặt tên kèm tiền tố UUID và phải dọn dẹp trong khối `try ... finally`.
- **Bảo vệ tài nguyên:** Tuyệt đối không quét đệ quy các thư mục nặng (`venv312/`, `dataset/`). Xử lý batch ảnh bằng PyTorch luôn gọi `del tensor` và `torch.cuda.empty_cache()` để chống rò rỉ VRAM.
