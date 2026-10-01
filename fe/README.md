# FaSearch Frontend

Next.js App Router website cho vertical slice tìm kiếm bằng ảnh.

## Chạy local

```bash
cd fe
npm ci
FASEARCH_BACKEND_URL=http://127.0.0.1:8080 npm run dev
```

Website gọi route cùng origin `POST /api/search/image`. Route handler chỉ proxy multipart request và trace ID tới Spring Boot; nó không chứa catalog/search business logic.
Ảnh kết quả dùng route cùng origin `GET /api/catalog/images/{productId}/{productVersionId}` để đọc bytes từ backend.
Login/CSRF/logout và Catalog Draft cũng dùng same-origin route handlers. Browser giữ duy nhất cookie session `HttpOnly`; CSRF token chỉ nằm trong bộ nhớ của trang lúc gửi request. Không có Access Token hoặc Refresh Token.
Trang Draft có thể thêm/thay ảnh chính sau khi tạo sản phẩm; upload tạo Product Version mới và preview đọc qua route đã kiểm quyền.

## Kiểm tra

```bash
npm run lint
npm run build
node --test tests/stale-guard.test.mjs
```

Trang chủ slice `stitch-search-ui`: header/hero/dropzone/kết quả theo Stitch
“FashionSearch AI Storefront” (Be Vietnam Pro, accent #FF4D00, brand
#aa3000), gọi đúng `POST /api/search/image` multipart `image + k=8`, giữ
thứ tự API, validation JPEG/PNG/WebP tối đa 10 MiB, guard chống stale
response (`src/components/stitch-search/request-guard.ts`, test trong
`tests/`). Không Tailwind CDN, không ảnh/font remote ngoài self-hosted
Be Vietnam Pro của `next/font`.

Public contract: `../contracts/public-api.openapi.json`.
