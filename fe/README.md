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
node --test tests/composed-workbench.test.mjs
```

Trang `/search/composed` là workbench live upload+modification: proxy
`POST /api/search/composed` giữ nguyên session cookie/CSRF (route này
không thuộc diện CSRF exception như image) và chuyển tiếp multipart tới
`POST /api/v1/search/composed`. Validation client trong
`src/components/composed-search/validation.ts`; server kiểm tra lại toàn
bộ. Product-anchor picker/detail là ticket sau.


Public contract: `../contracts/public-api.openapi.json`.
