# FaSearch Frontend

Next.js App Router website cho vertical slice tìm kiếm bằng ảnh.

## Chạy local

```bash
cd fe
npm ci
FASEARCH_BACKEND_URL=http://127.0.0.1:8080 npm run dev
```

Website gọi route cùng origin `POST /api/search/image`. Route handler chỉ proxy multipart request và trace ID tới Spring Boot; nó không chứa catalog/search business logic.

## Kiểm tra

```bash
npm run lint
npm run build
```

Public contract: `../contracts/public-api.openapi.json`.
