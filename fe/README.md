# FaSearch Frontend — account slice (be-draft-account-web)

Next.js 16 + React 19. Giao diện tái sử dụng có chọn lọc từ
`codex/team-integration@75c6f89` theo `REUSE_MANIFEST.md` của packet
(be-draft-account-web); chỉ các route/thành phần account thật sự nối backend mới.

## Chạy local

```bash
cd fe
cp .env.example .env   # điền FASEARCH_BACKEND_URL (mặc định 127.0.0.1:18082)
npm ci
npm run dev -- --port 3001
```

Mở http://127.0.0.1:3001. Backend chạy ở `FASEARCH_BACKEND_URL` (xem BE README).

## Kiểm tra

```bash
npm run lint
npm run build
node --test tests/account-contract.test.mjs
```

## Luồng website

`/dang-nhap` → `/tai-khoan` (giữ phiên khi reload) → `/tai-khoan/thong-tin`
(sửa hồ sơ FR37) → `/tai-khoan/bao-mat` (đổi mật khẩu, mọi phiên hết hiệu lực,
về login) → đăng nhập lại → đăng xuất. `/dang-ky` chỉ là thông báo chưa mở đăng ký
công khai (non-goal, trung thực — không form giả).

## Ranh giới

- Mọi request đi qua proxy same-origin `/api/auth/*` (cookie `FASEARCH_SESSION` +
  CSRF header); không JWT/localStorage, không gọi thẳng backend từ browser.
- Header/footer/nav chỉ link route thật trong slice; không catalog/search/library.
- Validate client chỉ mirror (username ≤50, email ≤100, mật khẩu 15–64 ký tự/72B);
  backend mới là authoritative.
