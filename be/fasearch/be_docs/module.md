# BẢNG DANH MỤC CHỨC NĂNG TOÀN HỆ THỐNG (FA SEARCH BACKEND)

Tài liệu này liệt kê toàn bộ yêu cầu chức năng (Functional Requirements) của hệ thống **FaSearch Backend**, phân nhóm theo từng Module nghiệp vụ.

> **Tài liệu liên quan:**
> - Bộ nhớ làm việc & Tiến độ 5 phiên gần nhất: **[memory.md](./memory.md)**
> - Bối cảnh bài toán & 10 phân hệ nghiệp vụ: **[OVERVIEW.md](../OVERVIEW.md)**
> - Hướng dẫn kỹ thuật & cài đặt: **[README.md](../README.md)**
> - Quy tắc phát triển & Coding Standards: **[AGENTS.md](../AGENTS.md)**
> - Đặc tả kỹ thuật Request / Response API: **[api/README.md](./api/README.md)**

### Chú giải cột Trạng thái & Vai trò

| Ký hiệu | Trạng thái | Ý nghĩa |
| :---: | :--- | :--- |
| X | Hoàn thành | Đã triển khai, đã test và sẵn sàng sử dụng |
| O | Đang làm | Đang trong quá trình triển khai |
| (để trống) | Chưa làm | Chưa bắt đầu code, nằm trong kế hoạch |
| ~ | Một phần | Đã có một phần hành vi trong source; phần thiếu ghi ở cột Mô tả (*Evidence*) |
| N | Chưa có trong source | Đã đối chiếu source tại `4e5369c5`: không có controller/service thực thi (không phải trống chưa kiểm tra) |

> Cập nhật tracker theo bằng chứng source tại commit `4e5369c5`; chú thích *Evidence* ghi `Controller#method`, HTTP mapping và `file:line`. Các dòng đã `X` mà không có chú thích *Evidence* chưa được đối chiếu lại trong đợt này.

| Viết tắt | Vai trò | Mô tả |
| :---: | :--- | :--- |
| `A` | `ADMIN` | Quản trị viên hệ thống (tài khoản đăng nhập, phân quyền, khóa/xóa tài khoản + mọi quyền của Quản lý) |
| `S` | `STAFF` | **Quản lý** (mã vai trò `STAFF` giữ nguyên): toàn bộ nghiệp vụ cửa hàng — sản phẩm/danh mục, tồn kho, đơn hàng, khách hàng, hồ sơ nhân sự, khuyến mãi/voucher, tích điểm, báo cáo. KHÔNG quản lý tài khoản đăng nhập/phân quyền (chỉ `ADMIN`) |
| `C` | `CUSTOMER` | Khách hàng mua sắm |
| `P` | `PUBLIC` | Không cần đăng nhập (Công khai) |
| `SYS` | `SYSTEM` | Hệ thống tự động xử lý (không cần giao diện) |

---

## 1. Quản lý Tài khoản & Xác thực (Module `auth`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-01 | Xem danh sách tài khoản | Hiển thị danh sách tài khoản, tìm kiếm/lọc theo Tên, Tên đăng nhập, SĐT hoặc Vai trò | `A` | X |
| FR-02 | Thêm mới tài khoản | Tạo tài khoản mới với Họ tên, Tên đăng nhập, Mật khẩu, Email, SĐT và Vai trò | `A` | X |
| FR-03 | Cập nhật tài khoản | Chỉnh sửa thông tin cá nhân, Email, SĐT hoặc thay đổi Mật khẩu / Vai trò | `A` | X |
| FR-04 | Xóa / Khóa tài khoản | Chuyển trạng thái tài khoản sang `LOCKED` hoặc `DELETED` để ngăn đăng nhập | `A` | X |
| FR-05 | Đăng nhập & Xác thực | Xác thực tên đăng nhập và mật khẩu, cấp JWT Token để truy cập hệ thống | `P` | X |
| FR-06 | Đăng ký tài khoản | Khách hàng tự đăng ký tài khoản mới với vai trò `CUSTOMER` | `P` | X |
| FR-07 | Xem thông tin tài khoản hiện tại | Lấy thông tin tài khoản đang đăng nhập từ JWT Token | `A` `S` `C` | X |
| FR-08 | Phân quyền truy cập (RBAC) | Giới hạn quyền truy cập chức năng và dữ liệu dựa trên Vai trò (`ADMIN`, `STAFF`, `CUSTOMER`) | `SYS` | X |
| FR-09 | Ghi nhật ký hệ thống | Tự động ghi vết người dùng, thời gian và dữ liệu thay đổi khi Thêm / Sửa / Xóa — *Evidence @4e5369c5: no controller/service/entity; only table `nhat_ky_he_thong` (`db/migration/V1__init_database.sql:98`) and seed `V1_9__seed_doi_tra_nhat_ky_ht.sql:12`. KHÔNG có code ghi vết* | `SYS` | N |

**Ghi chú xác thực (đối chiếu source `4e5369c5`):** `AuthController` (`auth/controller/AuthController.java`) có `POST /api/v1/auth/login` (`:32`), `POST /api/v1/auth/register` (`:39`), `GET /api/v1/auth/my-info` (`:46`), `POST /api/v1/auth/change-password` (`:54`); quản trị tài khoản ở `AccountController` `/api/v1/auth/accounts`. **KHÔNG có** `/api/v1/auth/logout`, `/api/v1/auth/csrf`, `/api/v1/auth/profile`. BE chỉ dùng JWT (`SecurityConfig`: `csrf.disable()`, dòng 61); đăng xuất là thao tác phía FE (xóa cookie cục bộ), không có thu hồi token phía BE.

---

## 2. Quản lý Người dùng & Nhân sự (Module `user`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-10 | Xem danh sách khách hàng | Hiển thị danh sách khách hàng, tìm kiếm/lọc theo Tên, SĐT, Hạng thành viên | `A` `S` | X |
| FR-11 | Xem chi tiết khách hàng | Xem thông tin chi tiết hồ sơ khách hàng theo ID | `A` `S` `C` | X |
| FR-12 | Thêm / Sửa khách hàng | Tạo mới hoặc chỉnh sửa hồ sơ khách hàng (Họ tên, Ngày sinh, Địa chỉ, Email) | `A` `S` | X |
| FR-13 | Xóa mềm khách hàng | Chuyển trạng thái `da_xoa = true`, không xóa vĩnh viễn khỏi CSDL | `A` | X |
| FR-14 | Tra cứu khách hàng tại quầy | Hiển thị thông tin KH (Họ tên, Hạng, Điểm tích lũy) khi nhập SĐT tại quầy POS — *Evidence @4e5369c5: chỉ có tra cứu chung `UserController#getCustomers` `GET /api/v1/users/customers?keyword=` (tên/SĐT, `A` `S`; `user/controller/UserController.java:41`, `UserServiceImpl.java:61-70`) trả `accumulatePoint` + `salesTier*` (`CustomerRes`); KHÔNG có endpoint POS tra cứu theo SĐT riêng* | `S` | ~ |
| FR-15 | Xem danh sách nhân viên | Hiển thị danh sách nhân viên, tìm kiếm/lọc theo Tên, SĐT, CCCD | `A` | X |
| FR-16 | Thêm / Sửa nhân viên | Tạo mới hoặc chỉnh sửa hồ sơ nhân viên (Họ tên, CCCD, SĐT, Giới tính, Địa chỉ) | `A` | X |
| FR-17 | Xóa mềm nhân viên | Chuyển trạng thái `da_xoa = true` cho nhân viên nghỉ việc | `A` | X |

---

## 3. Khách hàng thân thiết & Tích điểm (Module `loyalty` + `user`; đối chiếu source `4e5369c5`)

S2 routes nằm tại `/api/v1/thanh-vien` và `/api/v1/quan-tri/thanh-vien`; historical fixed-rate/point-threshold examples không phải runtime policy. S3 reporting không được đánh dấu hoàn thành trong S2.

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-18 | Tích điểm tự động S2 | Cộng earning theo policy version đã snapshot, từ `Invoice.totalActualPaid`; opening chỉ ghi nhận legacy balance, không grant lại — *Evidence @4e5369c5: `PaymentServiceImpl:370` → `LoyaltyServiceImpl#settleOrder:299` (`settleLegacyEarn:357`); policy `LoyaltyController#createPolicy/updatePolicy` `POST /api/v1/thanh-vien/chinh-sach`, `PUT .../{policyId}` (`loyalty/controller/LoyaltyController.java:78,85`); opening `AdminLoyaltyController#openLegacyBalance` `POST /api/v1/quan-tri/thanh-vien/mo-dau` (`:26`)* | `SYS` | X |
| FR-19 | Hạng theo doanh số | Chọn ngưỡng cumulative paid sales đã cấu hình; giữ nguyên tierId/tierName/thresholdPoint legacy và biểu diễn thiếu lịch sử là unknown — *Evidence @4e5369c5: `LoyaltyServiceImpl#salesSummary:420` + `enrichCustomerProfile:412` (gắn `salesTier*` vào `CustomerRes`); ngưỡng cấu hình qua `LoyaltyController#salesTiers/updateSalesTier` `GET /api/v1/thanh-vien/chinh-sach/hang`, `PUT .../hang/{tierId}` (`:92,98`)* | `SYS` | X |
| FR-20 | Đổi điểm khi quote/settle | Redeem chỉ sau once-only opening và enabled policy; giữ điểm atomically, cap theo remaining merchandise, giải phóng/tiêu thụ đúng một lần — *Evidence @4e5369c5: `CheckoutBenefitServiceImpl:72,121` → `LoyaltyServiceImpl#quote:211`/`quoteForCommit:217`/`holdOrder:263`/`releaseOrderHold:286`/`settleOrder:299`; vào qua `CartController#quote` `POST /api/v1/cart/quote` (`order/controller/CartController.java:45`) và `OrderController#checkout` `POST /api/v1/orders/checkout` (`:52`)* | `C` `S` | X |

---

## 4. Quản lý Sản phẩm & Danh mục (Module `product` / `category`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-21 | Quản lý danh mục sản phẩm | Xem, Thêm, Sửa, Xóa các danh mục (Áo sơ mi, Quần Jean, Phụ kiện...) | `A` | X |
| FR-22 | Xem danh sách & Tìm kiếm SP | Hiển thị danh sách SP, tìm kiếm/lọc theo Tên, Mã SP, Danh mục, Khoảng giá, Trạng thái | `A` `S` `C` | X |
| FR-23 | Thêm mới sản phẩm | Nhập thông tin: Tên, Danh mục, Chất liệu, Kiểu dáng, Mô tả, Giá bán, Giá nhập, Hình ảnh | `A` | X |
| FR-24 | Cập nhật sản phẩm | Chỉnh sửa thông tin chi tiết, hình ảnh và giá niêm yết của sản phẩm đã tồn tại | `A` | X |
| FR-25 | Xóa / Tạm ẩn sản phẩm | Xóa SP (nếu chưa có giao dịch) hoặc chuyển trạng thái `DISCONTINUED` để ẩn khỏi danh mục | `A` | X |
| FR-26 | Quản lý biến thể (Màu/Size) | Thêm / Sửa / Xóa thuộc tính Màu sắc và Size, tự động sinh mã SKU duy nhất | `A` | X |
| FR-27 | Xuất mã vạch (Barcode) | Xuất dữ liệu mã vạch chuẩn tương ứng từng mã SKU biến thể phục vụ in tem dán | `A` `S` | X |
| FR-28 | Tìm kiếm SP tại quầy (POS) | Tìm nhanh sản phẩm bằng Mã SKU / Tên hoặc quét mã vạch (Barcode) | `S` | X |

---

## 5. Tìm kiếm thông minh đa phương thức (Module `search` — AI Feature)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-NC1 | Tìm kiếm SP bằng mô tả tự nhiên | Tìm kiếm sản phẩm theo ngôn ngữ tự nhiên qua mô tả văn bản | `C` `S` | X |
| FR-NC2 | Tìm kiếm SP bằng hình ảnh | Tìm kiếm sản phẩm bằng hình ảnh sản phẩm do người dùng tải lên | `C` `S` | X |
| FR-NC3 | Tìm kiếm đa phương thức | Kết hợp cả mô tả văn bản và hình ảnh để tìm sản phẩm chính xác nhất | `C` `S` | X |

---

## 6. Quản lý Kho hàng & Tồn kho (Module `inventory`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-29 (overview projection `GET /inventory/stock-summary` added rev2) | Tra cứu tồn kho | Xem số lượng tồn kho khả dụng của từng mã SKU theo từng chi nhánh / kho | `A` `S` | X |
| FR-30 | Lập phiếu nhập kho | Tạo phiếu nhập kho từ nhà cung cấp, tự động cộng số lượng tồn kho theo SKU | `A` | X |
| FR-31 | Lập phiếu xuất / Chuyển kho | Tạo phiếu xuất hủy (hàng lỗi) hoặc phiếu chuyển kho giữa các chi nhánh | `A` | X |
| FR-32 | Kiểm kê kho | Tạo phiếu kiểm kê, ghi nhận số lượng đếm thực tế bằng quét mã vạch | `A` `S` | X |
| FR-33 | Cân bằng kho | Tự động tạo phiếu cân bằng để điều chỉnh tồn phần mềm khớp với thực tế — *Evidence @4e5369c5: `InventoryController` `POST /api/v1/inventory/stocktakes` chỉ tạo phiếu `PENDING_APPROVAL` + tính `difference` (`InventoryServiceImpl#createStocktake:410-470`); KHÔNG có endpoint duyệt/cân bằng, `StocktakeStatus.RECONCILED` chưa được dùng, tồn kho không bị điều chỉnh* | `SYS` | N |
| FR-34 | Cảnh báo tồn kho thấp | Gửi thông báo khi số lượng tồn kho SKU xuống bằng hoặc dưới ngưỡng tối thiểu — *Evidence @4e5369c5: chỉ có số liệu tổng hợp `lowStock` trong `GET /api/v1/inventory/stock-summary` (`InventoryServiceImpl:82-88`, `InventoryRepository#countLowStock:38`); KHÔNG có thông báo/cảnh báo* | `SYS` | N |

---

## 7. Quản lý Đơn hàng & Giỏ hàng (Module `order` / `cart`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-35A | Quản lý giỏ hàng trực tuyến | Xem giỏ hàng, thêm sản phẩm theo SKU, cập nhật số lượng và xóa mặt hàng khỏi giỏ | `C` | X |
| FR-35B | Đặt hàng trực tuyến (Checkout) | Chốt giỏ hàng tạo đơn hàng mới, tạm giữ tồn kho và áp dụng mã giảm giá | `C` | X |
| FR-36 | Xem danh sách & Chi tiết đơn hàng | Lọc đơn hàng theo Mã đơn, SĐT khách, Ngày đặt hoặc Trạng thái | `A` `S` `C` | X |
| FR-37 | Cập nhật trạng thái đơn hàng | Chuyển trạng thái tuần tự: `PENDING` → `CONFIRMED` → `PACKING` → `SHIPPING` → `COMPLETED` | `A` `S` | X |
| FR-38 | Hủy đơn hàng | Hủy đơn trước khi hoàn tất thanh toán, không ghi nhận doanh thu | `A` `S` `C` | X |
| FR-39 | Tạm lưu đơn hàng (POS) | Lưu tạm đơn đang tính dở để phục vụ khách tiếp theo, mở lại khi cần | `A` `S` | X |
| FR-40 | Tạm giữ & Hoàn trả tồn kho | Tự động khóa tồn kho khi tạo đơn, hoàn trả nếu đơn bị Hủy / Giao thất bại | `SYS` | X |
| FR-41 | Tính phí vận chuyển | Tự động tính phí giao hàng dựa trên Địa chỉ, Trọng lượng và đối tác vận chuyển | `SYS` | X |

---

## 8. Quản lý Thanh toán & Hóa đơn (Module `payment`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-42 | Tính tiền đơn hàng | Tự động tính tổng tiền sau khi trừ chiết khấu khuyến mãi hoặc ưu đãi hạng thành viên | `SYS` | X |
| FR-43 | Thanh toán & Xuất hóa đơn | Chọn phương thức (`CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO`), trừ tồn kho và xuất hóa đơn | `S` `C` | X |

---

## 9. Quản lý Khuyến mãi & Mã giảm giá (Module `promotion`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-44 | Xem danh sách khuyến mãi | Admin xem/lọc campaign; khách xem ưu đãi công khai đang hiệu lực qua `GET /api/v1/promotions` | `A` `P` | X |
| FR-45 | Thêm mới chương trình KM | Thiết lập KM: Thời gian, SP áp dụng, Mức giảm (`PERCENTAGE` / `FIXED_AMOUNT`), Số lượng voucher — *Evidence @4e5369c5: `AdminCampaignController#create` `POST /api/v1/khuyen-mai` (`khuyenmai/controller/AdminCampaignController.java:37`) → `KhuyenMaiServiceImpl#create:44` (tạo ở trạng thái `TAM_DUNG`); phát hành mã/số lượng: `#createCode` `POST /api/v1/khuyen-mai/{id}/codes` (`:67`, `ServiceImpl:125`)* | `A` | X |
| FR-46 | Sửa / Tạm dừng KM | Chỉnh sửa điều kiện hoặc tạm dừng chương trình KM trước thời hạn — *Evidence @4e5369c5: `AdminCampaignController#update` `PUT /api/v1/khuyen-mai/{id}` (`:43`) → `KhuyenMaiServiceImpl#update:59` (`trangThai` `HOAT_DONG`/`TAM_DUNG`, khóa lạc quan theo `phienBan`)* | `A` | X |
| FR-47 | Xác thực mã giảm giá | Kiểm tra và từ chối mã giảm giá khi đơn không thỏa điều kiện hoặc mã đã hết lượt — *Evidence @4e5369c5: `CheckoutBenefitServiceImpl#plan:200` từ chối mã không tồn tại/tạm dừng/chưa bắt đầu/hết hạn/hết lượt/không áp dụng (`VOUCHER_*`); gọi qua `POST /api/v1/cart/quote` (`CartController:45`) và `POST /api/v1/orders/checkout` (`OrderServiceImpl:272`); KHÔNG có endpoint validate riêng* | `SYS` | X |

---

## 10. Quản lý Đổi / Trả hàng (Module `returnorder`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-48 | Tra cứu hóa đơn đổi trả | Tìm kiếm hóa đơn cũ theo Mã đơn hàng hoặc SĐT khách hàng — *Evidence @4e5369c5: không có controller/service/entity/repository; chỉ enum `ReturnOrderType`/`ReturnOrderStatus` (`common/enums`) và bảng `phieu_doi_tra` trong migration* | `A` `S` | N |
| FR-49 | Kiểm tra điều kiện đổi trả | Tự động từ chối nếu thời hạn tính từ lúc mua vượt quá số ngày quy định — *Evidence @4e5369c5: không có logic kiểm tra hạn đổi trả* | `SYS` | N |
| FR-50 | Lập phiếu đổi / trả hàng | Tính chênh lệch giá khi đổi sang SP khác, hủy nếu chênh lệch vượt mức cho phép — *Evidence @4e5369c5: không có logic lập phiếu / tính chênh lệch* | `A` `S` | N |
| FR-51 | Nhập kho hàng trả lại | Tự động tạo phiếu nhập kho thu hồi cho SP đủ điều kiện tái kinh doanh — *Evidence @4e5369c5: không có logic tạo phiếu nhập kho thu hồi* | `SYS` | N |

---

## 11. Báo cáo & Thống kê (Module `analytics`)

| Mã | Chức năng | Mô tả | Vai trò | Trạng thái |
| :--- | :--- | :--- | :---: | :---: |
| FR-52 | Báo cáo doanh thu | Xuất tổng doanh thu, lợi nhuận theo Ngày/Tuần/Tháng, lọc theo kênh bán (POS vs Online) — *Evidence @4e5369c5: `AdminAnalyticsController#revenue` `GET /api/v1/analytics/revenue` (`analytics/controller/AdminAnalyticsController.java:34`, `AnalyticsServiceImpl#revenue:81`; DAY/WEEK/MONTH/YEAR). `totalCogs`/`grossProfit` luôn `null` (chưa có lịch sử giá vốn); kênh chỉ `ALL`, KHÔNG tách POS/Online (`channelNote`/`cogsNote`)* | `A` | ~ |
| FR-53 | Báo cáo hiệu quả sản phẩm | Xuất Top N SP/SKU bán chạy nhất hoặc danh sách hàng tồn chậm luân chuyển — *Evidence @4e5369c5: `AdminAnalyticsController#topProducts` `GET /api/v1/analytics/top-products` (`:48`; `BEST_SELLER`/`SLOW_MOVING`)* | `A` | X |
| FR-54 | Báo cáo Xuất - Nhập - Tồn | Xuất biến động tồn kho (Tồn đầu kỳ, Nhập, Xuất bán, Tồn cuối kỳ) theo từng SKU — *Evidence @4e5369c5: `AdminAnalyticsController#inventoryMovement` `GET /api/v1/analytics/inventory-movement` (`:58`, `AnalyticsServiceImpl:165-181`); chỉ có `totalSold` + `closingStock` (tồn hiện tại); `openingStock`/`totalImport`/`totalDamaged` luôn `null`* | `A` | ~ |

---

## Tổng kết tiến độ

Đối chiếu source tại `4e5369c5` (tổng 58 dòng FR).

| Trạng thái | Số lượng | Ghi chú |
| :--- | :---: | :--- |
| X (Hoàn thành) | 48 | Đã triển khai (controller + service) |
| ~ (Một phần) | 3 | FR-14, FR-52, FR-54 (xem cột Mô tả) |
| N (Chưa có trong source) | 7 | FR-09, FR-33, FR-34, FR-48..51 |
| O (Đang làm) | 0 | — |
| (trống) | 0 | — |
