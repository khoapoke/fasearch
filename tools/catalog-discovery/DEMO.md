# DEMO — catalog-discovery (kịch bản kiểm tra tay, ~10 phút)

Preview: `http://127.0.0.1:3230` (stack task đang chạy; nếu dừng, xem RUNBOOK để start).

## 1. Duyệt catalog (2 phút)

1. Mở `/catalog` → thấy lưới 24 sản phẩm ảnh thật, `Hiển thị trang 1/25 · tổng 600 sản phẩm`.
2. Nhấn chip **Áo** → URL thành `/catalog?category=TOP`, tổng 200, trang 1/9.
3. Nhấn **Trang sau →** → URL `?category=TOP&page=2`, lưới đổi.
4. Nhấn Back browser → về trang 1, lưới khớp.
5. Sửa URL `?page=99` → empty state + nút **Về trang đầu**.

## 2. Chi tiết (2 phút)

1. Nhấn card đầu tiên → `/catalog/10425?v=...&s=catalog-20260908-pilot-v1`:
   ảnh lớn, title, danh mục, **Chưa có mô tả**, publication trong
   `Thông tin publication`, dải **Cùng danh mục**.
2. Mở `/catalog/no-such-product` → lỗi 404 rõ + mã tra cứu + **Quay lại**.
3. Mở `/catalog/10011?v=dataset-a-10011-v1&s=stale-snapshot` → lỗi snapshot 409 rõ.

## 3. Search nối detail (3 phút)

1. `/search/text`: nhập `áo thun nam màu xanh`, K=10 → kết quả giữ hạng/score;
   nhấn card → detail đúng version/snapshot; **Quay lại** → về `/search/text`.
2. Home `/`: tải ảnh sản phẩm thật (JPEG/PNG/WebP ≤10MiB) → kết quả;
   card rank 1 là chính ảnh vừa tải khi dùng ảnh catalog; nhấn → detail.
3. Từ detail nhấn **Tìm kết hợp với sản phẩm này** → `/search/composed`
   có preview sản phẩm đã xác thực + 2 nút chế độ.

## 4. Composed PRODUCT (3 phút)

1. Ở chế độ **Dùng sản phẩm đã chọn**: nhập `đổi sang màu navy` → tìm →
   diagnostics ghi `Tham chiếu PRODUCT`, `EXCLUDE_ANCHOR_PRODUCT`, anchor
   không xuất hiện trong kết quả.
2. Nhấn **Tải ảnh lên** → dropzone hiện lại, context anchor bị xóa →
   tải ảnh + tìm → `Tham chiếu UPLOAD` (regression).
3. Thử URL anchor sai (`anchor_catalog_snapshot_id=stale`) → lỗi hiển thị rõ,
   không tự fallback.

## Ghi chú

- Console có 1 lỗi 401 `/api/auth/me` khi chưa đăng nhập: hành vi có sẵn của
  AuthPanel, không liên quan task này.
- Không có giá/tồn kho/đánh giá/giỏ hàng ở bất kỳ đâu: đúng yêu cầu (pilot
  không có dữ liệu commerce).
