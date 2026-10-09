# Docker runtime chung của FaSearch

Chỉ dùng một Compose project tên `fasearch`. Các task dùng chung runtime này;
không tạo PostgreSQL/S3 riêng cho mỗi branch hoặc mỗi lượt kiểm thử. Container
Testcontainers dùng cho test tự động phải được dọn khi test kết thúc.

| Service | Container | Cổng trên máy |
| --- | --- | --- |
| PostgreSQL | fasearch-postgres | 127.0.0.1:55732 |
| S3 / SeaweedFS | fasearch-storage | 127.0.0.1:38535 |
| Qdrant shadow, bật khi cần | fasearch-qdrant | 127.0.0.1:16333 / 16334 |

```bash
bash infra/fasearch/manage.sh up -d postgres storage
bash infra/fasearch/manage.sh ps -a
bash infra/fasearch/manage.sh --profile shadow up -d qdrant
bash infra/fasearch/manage.sh stop qdrant
```

Backend/Frontend/AI hiện chạy trên host bằng lifecycle của checkout Catalog.
Backend dùng DB `jdbc:postgresql://127.0.0.1:55732/fasearch` và object endpoint
`http://127.0.0.1:38535`. FAISS tiếp tục là baseline; Qdrant chỉ là shadow.

Local `.env` giữ cấu hình và tên các volume đang có; file này được ignore,
quyền0600. Compose dùng external volumes để tái sử dụng dữ liệu hiện tại.
Không dùng `down -v`, không reset volume khi đổi task. Để dựng trên máy khác,
tạo các volume được đặt tên trong `.env.example`, rồi điền `.env` của máy đó.

Migration05/10/2026 giữ nguyên dữ liệu PostgreSQL/S3 và600points Qdrant.
VietFeed được giữ nguyên container/image/mount. Theo yêu cầu người dùng, các
container/volume Docker khác và image/buildcache không còn sử dụng được dọn.
Manifest và kết quả đối chiếu nằm ở `runtime/` (ignored, không phải source).
