# HỒ SƠ QUY CHUẨN DỰ ÁN & QUY TRÌNH PHÁT TRIỂN (PROJECT GUIDELINES)
*Hệ thống: Fashion AI Search Engine (`fasearch/ai`)*

> 📖 **Tài liệu tham khảo chuyên sâu:** Xem toàn bộ bài toán, bảng Tech Stack, cấu trúc thư mục chi tiết và mô hình phân tầng kiến trúc tại [OVERVIEW.md](OVERVIEW.md).

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

## 1. QUY ƯỚC VIẾT CODE CỐT LÕI (CODING CONVENTIONS)

1. **Đặt tên:**
   - File, thư mục, hàm, biến: `snake_case` (ví dụ: `search_service.py`, `search_by_text`).
   - Class, Schema Pydantic: `PascalCase` (ví dụ: `SearchResultItem`, `ImagePointPayload`).
   - Hằng số cấu hình: `UPPER_SNAKE_CASE` (ví dụ: `COLLECTION_NAME`, `QDRANT_HOST`).

2. **Quy tắc BẮT BUỘC về Enum & Status:**
   - **100% Enum, Status, hằng số phân loại phải viết bằng TIẾNG ANH IN HOA**.
   - Phải kế thừa từ `StrEnum` (hoặc `str, Enum`) để đảm bảo Type Safety.
   - Ví dụ chuẩn hóa trong `src/db/enums.py`:
     ```python
     from enum import StrEnum

     class PointStatus(StrEnum):
         ACTIVE = "ACTIVE"
         SEEDED = "SEEDED"
         INACTIVE = "INACTIVE"
         DELETED = "DELETED"

     class CatalogCategory(StrEnum):
         FASHION_PRODUCT = "FASHION_PRODUCT"
         TOPWEAR = "TOPWEAR"
         BOTTOMWEAR = "BOTTOMWEAR"
         FOOTWEAR = "FOOTWEAR"
     ```

3. **Type Safety:**
   - Đầy đủ type hints cho mọi tham số đầu vào và kiểu trả về của các hàm.
   - Tránh dùng kiểu `Any` trừ khi bất khả kháng.

4. **Chuẩn hóa CRUD:**
   - Khi xây dựng bất kỳ module thực thể nào, phải ưu tiên hoàn thiện đầy đủ 4 thao tác CRUD cốt lõi:
     - `Create`: Tạo mới bản ghi / Upload & trích xuất vector.
     - `Read`: Tìm kiếm theo vector (Text/Image) và xem chi tiết theo ID / Scroll phân trang.
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

## 2. AN TOÀN HỆ THỐNG & XỬ LÝ LỖI (SYSTEM SAFETY)

### 2.1. An toàn tải file (Upload Safety)
- Không lưu file tạm với tên gốc trực tiếp từ client để tránh Race Condition (bị ghi đè khi upload cùng lúc).
- Luôn đặt tên file tạm bằng UUID: `f"{uuid.uuid4()}_{file.filename}"`.
- Việc xóa file tạm sau khi search phải luôn nằm trong khối `try ... finally` để đảm bảo không để lại file rác kể cả khi gặp lỗi.

### 2.2. Chuẩn hóa Phản hồi (API Response Envelope)
Toàn bộ API trả về cấu trúc thống nhất qua schema `ApiResponse[T]`:
```json
{
  "success": true,
  "status_code": 200,
  "message": "Search completed successfully",
  "data": { ... },
  "errors": null
}
```

### 2.3. Bắt lỗi tập trung (Global Exception Handler)
- Không bắt `try...except` thô thiển rồi ném `raise HTTPException(status_code=500, detail=str(e))` làm lộ stack trace nội bộ.
- Triển khai Global Exception Handler trong `src/main.py`:
  - `RequestValidationError` (Pydantic / FastAPI 422): Chuẩn hóa danh sách lỗi validate.
  - `HTTPException`: Trả về lỗi có kiểm soát với mã status tương ứng.
  - `Exception` chung (500): Ghi log chi tiết ra server, trả về thông báo lỗi thân thiện cho client mà không lộ thông tin nhạy cảm.

### 2.4. Tránh lỗi Encode Terminal Windows
- Hạn chế dùng `print()` in tiếng Việt có dấu trực tiếp ra console Windows để tránh `UnicodeEncodeError` (lỗi charmap cp1252).
- Sử dụng module `logging` chuẩn (`logger.info(...)`) để ghi log an toàn.

---

## 3. BẢNG LỆNH CLI & QUY TRÌNH VẬN HÀNH

### 3.1. Khởi động Docker Qdrant (GPU)
```powershell
# Chạy container Qdrant ở chế độ background
docker-compose up -d

# Xem log container
docker-compose logs -f qdrant
```
- Qdrant REST: `http://localhost:6333`
- Qdrant Dashboard UI: `http://localhost:6333/dashboard`
- Qdrant gRPC: `localhost:6334`

### 3.2. Môi trường & Dependencies
```powershell
# Kích hoạt venv
.\venv312\Scripts\Activate.ps1

# Cài đặt / cập nhật packages
pip install -r requirements.txt
```

### 3.3. Khởi tạo & Seed Database
```powershell
# 1. Khởi tạo/Reset collection 'image_gallery'
python scripts/init_qdrant.py

# 2. Quét ảnh trong dataset/ và nạp vào Qdrant
python scripts/seed_data.py
```

### 3.4. Chạy Server Development (FastAPI)
```powershell
python -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```
- Swagger UI (Docs): `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 3.5. Chạy Admin Console & Test Playground (Streamlit)
```powershell
# Khởi chạy giao diện Admin & kiểm thử trực quan
streamlit run admin_app/app.py
```
- Admin Console UI: `http://localhost:8501`

---

## 4. LƯU Ý KHI LÀM VIỆC VỚI HỆ THỐNG

- **Tuyệt đối không quét hoặc xử lý đệ quy qua các thư mục nặng:** `venv312` và `dataset`.
- **Quản lý tài nguyên VRAM/RAM:** Khi xử lý batch ảnh bằng PyTorch và PIL, luôn gọi `img.close()` (hoặc dùng `with Image.open(...)`), `del tensor`, và `torch.cuda.empty_cache()` để tránh tràn bộ nhớ card đồ họa.
