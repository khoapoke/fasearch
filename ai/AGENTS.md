# HỒ SƠ QUY CHUẨN DỰ ÁN & QUY TRÌNH PHÁT TRIỂN (PROJECT GUIDELINES)
*Hệ thống: Fashion AI Search Engine (`fasearch/ai`)*

---

## ⚠️ QUY TRÌNH LÀM VIỆC BẮT BUỘC (HỎI TRƯỚC KHI LÀM)

Đối với **MỌI yêu cầu/task tiếp theo** được giao, trợ lý/developer **TUYỆT ĐỐI KHÔNG ĐƯỢC VIẾT CODE NGAY**, mà phải tuân thủ nghiêm ngặt 2 bước:

### 📌 BƯỚC 1: PHÂN TÍCH & HỎI XÁC NHẬN
Trước khi đụng vào code, phải trình bày rõ:
1. **Danh sách file tác động:** Liệt kê rõ các file dự kiến sẽ tạo mới, chỉnh sửa hoặc xóa.
2. **Đặt câu hỏi làm rõ các điểm rủi ro / dễ sai sót:**
   - **Phân quyền (Auth & Roles):** Role nào được phép gọi API/hành động này (ví dụ: `PUBLIC`, `USER`, `ADMIN`)?
   - **Dữ liệu & Validate:** Trường nào bắt buộc (`required`), trường nào tùy chọn (`optional`), có thêm Enum/Status mới nào không?
   - **Logic ngoại lệ & Ràng buộc:** Ràng buộc khóa ngoại, điều kiện chặn lỗi, xử lý xóa mềm (`soft delete` với status `DELETED`) hay xóa cứng (`hard delete`).
3. **Tóm tắt ngắn gọn các bước sẽ thực hiện.**
4. **👉 DỪNG LẠI CHỜ USER TRẢ LỜI & PHÊ DUYỆT.**

### 📌 BƯỚC 2: THỰC THI CHUẨN CHỈ
- **Chỉ khi User trả lời các câu hỏi và xác nhận "OK / Làm đi"**, mới bắt đầu viết code và chạy lệnh theo đúng các quy chuẩn bên dưới.

---

## 1. TỔNG QUAN & CÁC MODULE CHÍNH

### 1.1. Bài toán
Dự án là một Backend AI Service cung cấp khả năng **Tìm kiếm thời trang đa phương thức (Multimodal Fashion Search)**:
- Cho phép tìm kiếm bằng văn bản (Text-to-Image) hoặc bằng hình ảnh tương đồng (Image-to-Image).
- Trích xuất đặc trưng vector 512 chiều bằng mô hình CLIP (`openai/clip-vit-base-patch32`).
- Lưu trữ và truy vấn lân cận cosine trên GPU qua Vector Database **Qdrant** (giao thức gRPC).

### 1.2. Cấu trúc thư mục & Module
```text
fasearch/ai/
├── admin_app/                # Ứng dụng Streamlit quản trị và kiểm thử trực quan
│   ├── __init__.py
│   ├── app.py                # Entrypoint Streamlit (Dashboard, Point CRUD, Playground)
│   ├── components/           # UI Helpers: xử lý ảnh, badges trạng thái
│   └── views/                # Các màn hình: overview, point_manager, search_tester
├── configs/
│   └── database.yaml         # Cấu hình Qdrant, Model CLIP, thư mục ảnh, tham số search
├── dataset/                  # Thư mục chứa dataset ảnh (test, raw,...); nguồn nạp dữ liệu chính
│   └── admin/                # Nơi lưu trữ ảnh sản phẩm mới tải lên từ Admin UI
├── scripts/
│   ├── __init__.py
│   ├── init_qdrant.py        # Khởi tạo/Reset Qdrant collection (vector_size: 512, cosine)
│   └── seed_data.py          # Script nạp ảnh hàng loạt từ dataset/ vào Qdrant qua Repository
├── src/
│   ├── __init__.py
│   ├── main.py               # Entrypoint FastAPI, Lifespan startup, CORS, Static mounts
│   ├── api/
│   │   ├── __init__.py
│   │   └── endpoints.py      # Endpoints: /api/search/text, /api/search/image
│   ├── core/
│   │   ├── __init__.py
│   │   ├── ai_model.py       # Singleton quản lý mô hình CLIP trên VRAM (eval mode)
│   │   ├── config.py         # Nạp cấu hình từ database.yaml và .env
│   │   └── qdrant_client.py  # Singleton quản lý kết nối Qdrant qua gRPC (cổng 6334)
│   ├── db/
│   │   ├── __init__.py
│   │   ├── enums.py          # Enums chuẩn hóa: PointStatus, CatalogCategory
│   │   └── models.py         # Entity ImagePointPayload lưu trong Vector Point
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py           # Base Repository trừu tượng hóa tương tác Qdrant
│   │   └── image_repository.py # Repository CRUD & Vector search cho collection image_gallery
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py         # ApiResponse[T] envelope chuẩn doanh nghiệp
│   │   └── search.py         # Pydantic DTOs cho Search Request & Response
│   └── services/
│       ├── __init__.py
│       └── search_service.py # Nghiệp vụ trích xuất vector CLIP và truy vấn qua Repository
├── storage/
│   └── uploads/              # Nơi lưu tạm file do client upload lên để tìm kiếm so sánh
├── test/                     # Các test script đơn lẻ (kiểm tra CPU, gRPC, seed, retrieve)
├── docker-compose.yml        # Chạy Qdrant GPU (port 6333 REST, 6334 gRPC)
├── requirements.txt          # Danh sách thư viện Python
├── .env                      # Biến môi trường local (vd: STORAGE_DOCKER)
└── AGENTS.md                 # Hồ sơ quy chuẩn và hướng dẫn làm việc
```

### 1.3. Cơ chế phục vụ Static Files
- `/dataset` -> Mount tĩnh tới thư mục `dataset/` (để Frontend hiển thị ảnh trong kho dữ liệu mẫu).
- `/uploads` -> Mount tĩnh tới thư mục `storage/uploads/` (để phục vụ ảnh tạm thời do client gửi lên nếu cần).

### 1.4. Thực thể Vector (Qdrant Point Payload)
- **Collection:** `image_gallery`
- **Vector:** 512 chiều, Cosine distance.
- **Payload Schema:**
  - `id`: Chuỗi UUID (hoặc int trong một số test legacy)
  - `image_path`: Đường dẫn ảnh
  - `file_name`: Tên file ảnh
  - `catalog`: Phân loại danh mục (vd: `FASHION_PRODUCT`)
  - `status`: Trạng thái bản ghi (vd: `SEEDED`, `ACTIVE`, `DELETED`)

---

## 2. TECH STACK & PACKAGES

| Lớp | Thư viện / Công nghệ | Vai trò |
| :--- | :--- | :--- |
| **Runtime** | Python 3.12 (`venv312`) | Môi trường thực thi chính |
| **API Framework** | `fastapi>=0.110.0`, `uvicorn>=0.30.0` | Server REST API bất đồng bộ |
| **Upload Parser** | `python-multipart==0.0.9` | Parse upload file ảnh multipart/form-data |
| **Deep Learning** | `torch==2.14.1`, `torchvision==0.29.1`, `torchaudio==2.11.0` (CUDA 12.4) | Tính toán Tensor trên GPU NVIDIA (RTX) |
| **AI Model** | `transformers==4.46.3` | Hugging Face CLIP (`openai/clip-vit-base-patch32`) |
| **Image IO** | `pillow==11.0.0` (PIL) | Đọc, chuẩn hóa RGB cho ảnh |
| **Vector DB Client** | `qdrant-client==1.12.1` | Kết nối Qdrant qua gRPC (6334) và REST (6333) |
| **Vector DB Server** | `qdrant/qdrant:v1.19-gpu-nvidia` | Docker service chạy Qdrant GPU |
| **Config Loader** | `PyYAML==6.0.2` | Đọc cấu hình từ `configs/database.yaml` |
| **Data Processing** | `numpy==2.1.3`, `pandas==2.2.3`, `matplotlib==3.9.2` | Xử lý mảng vector và dữ liệu |

---

## 3. KIẾN TRÚC & LUỒNG DỮ LIỆU

### 3.1. Phân tầng kiến trúc (Clean Architecture)
- **Controller / Router (`src/api/`):** Chỉ xử lý tiếp nhận HTTP, validate input DTO qua `src/schemas/`, điều phối Service, trả response chuẩn qua `ApiResponse`.
- **Service (`src/services/`):** Nơi chứa 100% logic nghiệp vụ AI (CLIP encoding, chuẩn hóa vector L2). Không gọi trực tiếp DB client mà tương tác thông qua tầng Repository. Không phụ thuộc HTTP request.
- **Repository (`src/repositories/`):** Đóng gói toàn bộ thao tác giao tiếp với Qdrant (truy vấn vector, tự động lọc soft-deleted, CRUD point, batch upsert).
- **Domain Models & Enums (`src/db/`):** Chứa thực thể dữ liệu lưu trữ của Vector Point (`ImagePointPayload`) và các Enums quy chuẩn (`PointStatus`, `CatalogCategory`).
- **DTO Schemas (`src/schemas/`):** Định nghĩa Type-Safe DTOs qua Pydantic cho Request/Response HTTP (`ApiResponse`, `SearchTextRequest`, `SearchData`,...).
- **Core (`src/core/`):** Quản lý cấu hình tập trung (`config.py`), Lifespan model CLIP (`ai_model.py`) và kết nối singleton (`qdrant_client.py`).

### 3.2. An toàn tải file (Upload Safety)
- Không lưu file tạm với tên gốc trực tiếp từ client để tránh Race Condition (bị ghi đè khi upload cùng lúc).
- Luôn đặt tên file tạm bằng UUID: `f"{uuid.uuid4()}_{file.filename}"`.
- Việc xóa file tạm sau khi search phải luôn nằm trong khối `try ... finally` để đảm bảo không để lại file rác kể cả khi gặp lỗi.

### 3.3. Chuẩn hóa Phản hồi (API Response Envelope)
Toàn bộ API trả về cấu trúc thống nhất:
```json
{
  "success": true,
  "status_code": 200,
  "message": "Search completed successfully",
  "data": { ... },
  "errors": null
}
```

### 3.4. Bắt lỗi tập trung (Global Exception Handler)
- Không bắt `try...except` thô thiển rồi ném `raise HTTPException(status_code=500, detail=str(e))` làm lộ stack trace nội bộ.
- Triển khai Global Exception Handler trong `src/main.py`:
  - `RequestValidationError` (Pydantic / FastAPI 422): Chuẩn hóa danh sách lỗi validate.
  - `HTTPException`: Trả về lỗi có kiểm soát với mã status tương ứng.
  - `Exception` chung (500): Ghi log chi tiết ra server, trả về thông báo lỗi thân thiện cho client mà không lộ thông tin nhạy cảm.

---

## 4. QUY ƯỚC VIẾT CODE (CODING CONVENTIONS)

1. **Đặt tên:**
   - File, thư mục, hàm, biến: `snake_case` (ví dụ: `search_service.py`, `search_by_text`).
   - Class, Schema Pydantic: `PascalCase` (ví dụ: `SearchResultItem`, `SearchResponse`).
   - Hằng số cấu hình: `UPPER_SNAKE_CASE` (ví dụ: `COLLECTION_NAME`, `PREFER_GRPC`).
2. **Quy tắc BẮT BUỘC về Enum & Status:**
   - **100% Enum, Status, hằng số phân loại phải viết bằng TIẾNG ANH IN HOA**.
   - Phải kế thừa từ `str, Enum` để đảm bảo Type Safety.
   - Ví dụ:
     ```python
     from enum import StrEnum

     class PointStatus(StrEnum):
         ACTIVE = "ACTIVE"
         PENDING = "PENDING"
         DELETED = "DELETED"
         SEEDED = "SEEDED"

     class CatalogCategory(StrEnum):
         FASHION_PRODUCT = "FASHION_PRODUCT"
         TOPWEAR = "TOPWEAR"
         BOTTOMWEAR = "BOTTOMWEAR"
     ```
3. **Type Safety:**
   - Đầy đủ type hints cho mọi tham số đầu vào và kiểu trả về của các hàm.
   - Tránh dùng kiểu `Any` trừ khi bất khả kháng.
4. **Chuẩn hóa CRUD:**
   - Khi xây dựng bất kỳ module thực thể nào, phải ưu tiên hoàn thiện đầy đủ 4 thao tác CRUD cốt lõi:
     - `Create`: Tạo mới bản ghi / Upload & sinh vector.
     - `Read`: Tìm kiếm theo vector (Text/Image) và xem chi tiết theo ID.
     - `Update`: Cập nhật payload thông tin / cập nhật vector.
     - `Delete`: Hỗ trợ cả 2 cơ chế Xóa mềm (`Soft Delete` gán status `DELETED`) và Xóa cứng (`Hard Delete`).
5. **Quy chuẩn Phân quyền (Auth & Roles):**
   - **Tìm kiếm (Read / Search):** Quyền `PUBLIC` (người dùng chưa đăng nhập hoặc khách có thể tìm kiếm sản phẩm thời trang).
   - **Thao tác Ghi / Sửa / Xóa (Create, Update, Delete - CUD):** Bắt buộc phân quyền `ADMIN` (chỉ quản trị viên hoặc luồng nội bộ được phép tạo, cập nhật hoặc xóa dữ liệu sản phẩm / vector).
6. **Cơ chế Xóa (Soft Delete vs Hard Delete):**
   - **Mặc định:** Sử dụng **Xóa mềm (Soft Delete)** bằng cách chuyển `status` sang `PointStatus.DELETED`.
   - **Lọc tự động:** Khi thực hiện tìm kiếm tương đồng vector, tầng Repository tự động thêm filter loại trừ (`must_not`) tất cả các bản ghi có trạng thái `DELETED`.
   - **Xóa cứng (Hard Delete):** Cung cấp hàm xóa dứt điểm khỏi Vector DB để phục vụ dọn dẹp hệ thống khi có yêu cầu từ Admin.
7. **Gói Python:**
   - Mọi thư mục chứa code (`admin_app/`, `src/`, `src/api/`, `src/core/`, `src/db/`, `src/repositories/`, `src/schemas/`, `src/services/`, `scripts/`, `test/`) phải có file `__init__.py`.

---

## 5. BẢNG LỆNH CLI & QUY TRÌNH VẬN HÀNH

### 5.1. Khởi động Docker Qdrant (GPU)
```powershell
# Chạy container Qdrant ở chế độ background
docker-compose up -d

# Xem log container
docker-compose logs -f qdrant
```
- Qdrant REST: `http://localhost:6333`
- Qdrant Dashboard UI: `http://localhost:6333/dashboard`
- Qdrant gRPC: `localhost:6334`

### 5.2. Môi trường & Dependencies
```powershell
# Kích hoạt venv
.\venv312\Scripts\Activate.ps1

# Cài đặt / cập nhật packages
pip install -r requirements.txt
```

### 5.3. Khởi tạo & Seed Database
```powershell
# 1. Khởi tạo/Reset collection 'image_gallery'
python scripts/init_qdrant.py

# 2. Quét ảnh trong dataset/ và nạp vào Qdrant
python scripts/seed_data.py
```

### 5.4. Chạy Server Development (FastAPI)
```powershell
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```
- Swagger UI (Docs): `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 5.5. Chạy Admin Console & Test Playground (Streamlit)
```powershell
# Khởi chạy giao diện Admin & kiểm thử trực quan
streamlit run admin_app/app.py
```
- Admin Console UI: `http://localhost:8501`

---

## 6. LƯU Ý KHI LÀM VIỆC VỚI HỆ THỐNG
- **Tuyệt đối không quét hoặc xử lý đệ quy qua các thư mục nặng:** `venv312` và `dataset`.
- **Quản lý tài nguyên VRAM/RAM:** Khi xử lý batch ảnh bằng PyTorch và PIL, luôn gọi `img.close()` (hoặc dùng `with Image.open(...)`), `del tensor`, và `torch.cuda.empty_cache()` để tránh tràn bộ nhớ card đồ họa.
