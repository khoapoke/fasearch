# FaSearch Frontend

Next.js 16 (App Router) + React 19. Gồm cửa hàng cho khách, kênh bán tại quầy (POS) và không gian quản trị `/quan-tri`. Trình duyệt chỉ gọi các route same-origin `/api/*` (BFF); BFF chuyển tiếp tới backend Spring Boot bằng token trong cookie httpOnly.

## Chạy local

```bash
cd fe
npm ci
FASEARCH_BACKEND_URL=http://127.0.0.1:8080 npm run dev -- --port 3000
```

| Biến môi trường | Ý nghĩa |
|---|---|
| `FASEARCH_BACKEND_URL` | URL backend (bắt buộc khi BE không chạy ở mặc định) |
| `FASEARCH_CUSTOMER_AUTH_BACKEND_URL` | Backend cho đăng nhập khách (mặc định bằng `FASEARCH_BACKEND_URL`) |
| `FASEARCH_CATALOG_BACKEND_URL` | Backend cho catalog (mặc định bằng `FASEARCH_BACKEND_URL`) |
| `FASEARCH_AUTH_PILOT_ORIGIN` | Origin của trang web, dùng kiểm tra Origin cho request ghi |

Bản production: `npm run build` rồi `npm run start -- --port <port>`.

## Kiểm tra

```bash
npx tsc --noEmit
npm run lint
node --test tests/*.test.mjs
npm run e2e            # cần FE + BE đang chạy; xem e2e/README
```

## Các khu vực chính

| Đường dẫn | Nội dung |
|---|---|
| `/`, `/nam`, `/nu`, `/hang-moi`, `/sale`, `/san-pham/[id]` | Cửa hàng, danh mục, chi tiết sản phẩm |
| `/tim-kiem-ai`, `/lich-su-ai` | Tìm kiếm AI bằng chữ, ảnh hoặc kết hợp |
| `/gio-hang`, `/thanh-toan`, `/don-hang/[id]` | Giỏ hàng, thanh toán (COD, Stripe, VNPay), Voucher, điểm thành viên |
| `/tai-khoan/*`, `/dang-nhap`, `/dang-ky` | Tài khoản khách, đăng ký, xác thực email, đặt lại mật khẩu |
| `/kenh-ban/*` | POS tại quầy |
| `/quan-tri/*` | Quản trị: Dashboard, đơn hàng, khách hàng, sản phẩm (Draft, Publish), danh mục, kho (phiếu nhập/xuất, kiểm kê, Barcode, in tem), khuyến mãi, chính sách điểm, Report, nhân sự, tài khoản nội bộ và phân quyền, thùng rác |

## Quản trị

- Khung `/quan-tri` (`app/quan-tri/layout.tsx`) giữ phiên, theme và menu khi chuyển trang; theme đặt trước khi vẽ nên không nháy trắng.
- Quyền: Quản trị viên có toàn quyền; Quản lý theo danh sách quyền do Quản trị viên bật/tắt ở "Tài khoản nội bộ → Vai trò & quyền". Menu và nút ẩn theo quyền; backend là nơi quyết định cuối cùng.
- Bộ thành phần dùng chung ở `src/components/admin-b/`: `AdminModal`, `ConfirmDialog`, `useToast`, `InfoHint`, `PageHeader`, `BarChart`, `MoneyInput`, `StatusBadge`.
- Thuật ngữ giữ tiếng Anh: SKU, Barcode, Voucher, Draft, Publish, Unpublish, Dashboard, Report, Import/Export CSV.

## Ranh giới

- Không gọi thẳng backend từ trình duyệt; không lưu token ở localStorage.
- Kiểm tra dữ liệu phía client chỉ để báo sớm; backend là nguồn đúng.
- Đọc `AGENTS.md` trước khi sửa: bản Next.js này có API khác với bản quen thuộc.
