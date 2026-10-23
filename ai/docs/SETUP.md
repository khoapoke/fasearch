# Fashion AI Search - Setup và vận hành

Tài liệu này hướng dẫn team cài đặt, cấu hình và chạy backend tìm kiếm thời trang trong thư mục `ai`.

## 1. Kiến trúc và thành phần

- **FastAPI**: API tìm kiếm tại `src\main.py`.
- **CLIP**: `openai/clip-vit-base-patch32`, dùng để chuyển văn bản/ảnh thành vector 512 chiều.
- **Qdrant**: cơ sở dữ liệu vector, chạy bằng Docker.
- **Dataset kiểm thử**: `dataset\test` hiện có 20 ảnh JPEG. Không cần tải hoặc đọc `dataset\versmall` và `dataset\verlarge` khi setup thông thường.
- **Storage**: ảnh upload tạm được lưu trong `storage\uploads` rồi xóa sau khi tìm kiếm bằng ảnh hoàn tất.

## 2. Yêu cầu môi trường

### Bắt buộc

- Windows 10/11.
- Python 3.12 (môi trường hiện có của dự án là `venv312`).
- Docker  đang chạy.
- Kết nối Internet lần đầu để tải package và model CLIP từ Hugging Face.

### GPU (khuyến nghị)

- NVIDIA GPU, driver tương thích và NVIDIA Container Toolkit nếu muốn chạy Qdrant GPU theo `docker-compose.yml`.
- PyTorch trong `requirements.txt` dùng index CUDA `cu124`.
- Nếu không có GPU, code tự chuyển CLIP sang CPU. Có thể chậm hơn đáng kể.

## 3. Tạo môi trường Python

Mở PowerShell tại thư mục `ai`:

```powershell
cd D:\fasearch\ai
py -3.12 -m venv venv312
.\venv312\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Nếu PowerShell chặn việc activate môi trường:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv312\Scripts\Activate.ps1
```

Mỗi terminal mới cần activate lại môi trường trước khi chạy Python.

## 4. Cấu hình biến môi trường cho Docker

Tạo hoặc cập nhật file `ai\.env` dựa trên `ai\.env.example`:

```dotenv
STORAGE_DOCKER=D:/DockerData/qdrant
```

`STORAGE_DOCKER` là thư mục trên máy host dùng để lưu dữ liệu Qdrant. Nên dùng đường dẫn tuyệt đối và bảo đảm Docker Desktop có quyền truy cập thư mục đó.

File `.env` chỉ phục vụ nội suy biến của Docker Compose. Ứng dụng Python hiện đọc cấu hình chính từ `configs\database.yaml`, không đọc các giá trị Qdrant từ `.env`.

## 5. Khởi động Qdrant

Từ thư mục `ai`:

```powershell
docker compose up -d qdrant
docker compose ps
```

Kiểm tra Qdrant qua HTTP:

```powershell
curl.exe http://localhost:6333
```

Các cổng được sử dụng:

| Cổng | Mục đích |
|---|---|
| `6333` | Qdrant HTTP API/Dashboard |
| `6334` | Qdrant gRPC, được backend sử dụng |
| `8000` | FastAPI |

Nếu máy không có NVIDIA hoặc Docker báo lỗi liên quan đến GPU, cần điều chỉnh service `qdrant` trong `docker-compose.yml` sang image/cấu hình Qdrant không yêu cầu GPU trước khi khởi động.

## 6. Kiểm tra cấu hình ứng dụng

Các giá trị mặc định trong `configs\database.yaml`:

```yaml
qdrant:
  host: localhost
  grpc_port: 6334
  http_port: 6333
  collection_name: image_gallery
  vector_size: 512
  prefer_grpc: true

model:
  id: openai/clip-vit-base-patch32
  device: auto

app:
  upload_dir: storage/uploads
  raw_data_dir: dataset/test
  max_search_limit: 5
  vector_size: 512
```

Không đổi `vector_size` khỏi `512` nếu vẫn dùng model CLIP hiện tại. Nếu đổi model, cần xác nhận kích thước vector của model và tạo lại collection tương ứng.

## 7. Khởi tạo collection Qdrant

Với Qdrant đang chạy:

```powershell
python scripts\init_qdrant.py
```

Script hiện gọi `init_db(reset=True)`, nên sẽ xóa collection `image_gallery` cũ và tạo lại collection với khoảng cách cosine. Chỉ chạy lệnh này khi muốn reset toàn bộ dữ liệu vector.

## 8. Nạp dataset kiểm thử

### Cách đang hoạt động với `dataset\test`

Script kiểm thử `test\insert_data.py` đang trỏ trực tiếp đến:

```text
D:\fasearch\ai\dataset\test
```

Chạy từ thư mục gốc repository (`D:\fasearch`, không phải `D:\fasearch\ai`) để import `ai.test.core_setup` đúng:

```powershell
cd D:\fasearch
.\ai\venv312\Scripts\Activate.ps1
python -m ai.test.insert_data
```

Script này tự reset collection trước khi nạp 20 ảnh test. Không chạy đồng thời với server đang cần truy vấn collection.

### Lưu ý về `scripts\seed_data.py`

`configs\database.yaml` khai báo dữ liệu là `dataset/test`, nhưng `scripts\seed_data.py` hiện tính đường dẫn nạp ảnh là `ai\data\raw`. Thư mục này không nằm trong cấu trúc hiện tại. Vì vậy, không dùng lệnh sau với `dataset\test` nếu chưa đồng bộ lại đường dẫn:

```powershell
python scripts\seed_data.py
```

Team cần chọn một trong hai cách trước khi dùng script này cho dataset lớn:

1. Chỉnh `RAW_DATA_DIR` trong `scripts\seed_data.py` để trỏ đến thư mục dataset mong muốn; hoặc
2. Tạo `ai\data\raw` và đặt dữ liệu vào đó.

Không đưa `dataset\versmall` hoặc `dataset\verlarge` vào quy trình kiểm thử thường ngày nếu không cần thiết.

## 9. Chạy FastAPI

Từ thư mục `ai`, sau khi Qdrant đã chạy và collection đã có vector:

```powershell
cd D:\fasearch\ai
.\venv312\Scripts\Activate.ps1
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

Lần khởi động đầu tiên có thể mất thời gian vì `transformers` tải model CLIP. Server sẽ tải model một lần rồi tái sử dụng singleton trong suốt vòng đời process.

Kiểm tra:

```powershell
curl.exe http://localhost:8000/
```

Mở tài liệu Swagger tại <http://localhost:8000/docs>.

## 10. API sử dụng nhanh

### Tìm kiếm bằng văn bản

```powershell
curl.exe -X POST http://localhost:8000/api/search/text `
  -H "Content-Type: application/json" `
  -d '{"query":"black sneakers","limit":5}'
```

Response có dạng:

```json
{
  "results": [
    {
      "id": "qdrant-point-id",
      "score": 0.85,
      "image_path": "D:\\fasearch\\ai\\dataset\\test\\sneaker1.jpg",
      "file_name": "sneaker1.jpg",
      "catalog": "fashion_product"
    }
  ]
}
```

### Tìm kiếm bằng ảnh

```powershell
curl.exe -X POST http://localhost:8000/api/search/image `
  -F "file=@D:\fasearch\ai\dataset\test\sneaker1.jpg" `
  -F "limit=5"
```

File upload được lưu tạm tại `storage\uploads` và bị xóa sau khi truy vấn thành công.

## 11. Quy trình chạy đầy đủ cho thành viên mới

```powershell
cd D:\fasearch\ai
py -3.12 -m venv venv312
.\venv312\Scripts\Activate.ps1
pip install -r requirements.txt

# Tạo ai\.env trước khi chạy Docker
docker compose up -d qdrant
python scripts\init_qdrant.py

# Nạp 20 ảnh test; chạy lệnh này từ D:\fasearch
cd D:\fasearch
.\ai\venv312\Scripts\Activate.ps1
python -m ai.test.insert_data

cd D:\fasearch\ai
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

## 12. Dừng và reset dữ liệu

Dừng container nhưng giữ dữ liệu:

```powershell
cd D:\fasearch\ai
docker compose stop
```

Dừng và xóa container/network:

```powershell
docker compose down
```

Xóa toàn bộ vector collection:

```powershell
python scripts\init_qdrant.py
```

Lệnh cuối có tác dụng reset vì script đang hard-code `reset=True`; hãy xác nhận trước khi chạy trên dữ liệu dùng chung.

## 13. Sự cố thường gặp

| Hiện tượng | Nguyên nhân/cách xử lý |
|---|---|
| Không kết nối được Qdrant | Kiểm tra `docker compose ps`, cổng `6334`, và chạy `curl.exe http://localhost:6333`. |
| Qdrant không khởi động | Kiểm tra `STORAGE_DOCKER`, quyền truy cập thư mục Docker và yêu cầu NVIDIA trong Compose. |
| `ModuleNotFoundError: src` | Chạy Uvicorn từ `D:\fasearch\ai` với `src.main:app`; chạy test module từ `D:\fasearch` với `python -m ai.test.insert_data`. |
| Không tìm thấy collection | Chạy `python scripts\init_qdrant.py`, sau đó nạp dữ liệu. |
| Kết quả tìm kiếm rỗng | Kiểm tra collection đã có vector và dataset đã được nạp thành công. |
| Hết VRAM | Giảm `batch_size` khi nạp dữ liệu; đóng process khác dùng GPU. |
| Tải model thất bại | Kiểm tra Internet, dung lượng ổ đĩa/cache Hugging Face và quyền ghi thư mục cache. |
| `seed_data.py` không thấy dữ liệu | Đây là khác biệt đường dẫn `data\raw` và `dataset\test`; xem mục 8 trước khi chạy. |

## 14. Quy tắc làm việc cho team

- Không commit `venv312`, `.env`, `storage` hoặc dataset lớn vào Git.
- Không chạy script reset collection trên Qdrant dùng chung nếu chưa thông báo team.
- Khi thay đổi model hoặc kích thước vector, phải cập nhật `configs\database.yaml`, tạo lại collection và nạp lại dữ liệu.
- Khi triển khai production, thay `allow_origins=["*"]` trong `src\main.py` bằng danh sách domain frontend cụ thể.
