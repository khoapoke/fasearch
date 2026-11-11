# TÀI LIỆU API: MODULE SHIPPING (VẬN CHUYỂN & BẢN ĐỒ)

Module `shipping` tính phí vận chuyển theo khoảng cách từ kho đến tọa độ giao hàng (hoặc theo vùng / cân nặng khi chưa có tọa độ), hỗ trợ miễn phí vận chuyển bằng voucher `FREE_SHIP` và cung cấp gợi ý địa chỉ / chuyển địa chỉ thành tọa độ cho khách hàng khi đặt hàng. Khi đặt hàng, gửi cặp `deliveryLatitude` / `deliveryLongitude` trong `POST /api/v1/orders/checkout` ([api-order.md](./api-order.md)) để server tính lại phí ship.

---

## 1. Tính phí vận chuyển tự động (FR-41)

- **Endpoint:** `POST /api/v1/orders/calculate-shipping-fee`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Có cặp tọa độ thì tính theo khoảng cách đường đi từ kho (≤ 3 km: 15.000đ; ≤ 7 km: 25.000đ; ≤ 15 km: 35.000đ; xa hơn +3.000đ mỗi km, tối đa 150.000đ). Không có tọa độ thì tính phí cố định theo tỉnh / thành và cân nặng. Gửi `voucherCode` loại `FREE_SHIP` hợp lệ để miễn toàn bộ phí.

### Request Body
```json
{
  "province": "TP. Hồ Chí Minh",
  "district": "Tân Phú",
  "totalWeightGram": 300,
  "deliveryLatitude": 10.8070354,
  "deliveryLongitude": 106.6287031,
  "voucherCode": "FREESHIP"
}
```

| Trường | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `province` | String | Có | Tỉnh / Thành phố |
| `district` | String | Có | Quận / Huyện |
| `totalWeightGram` | Integer | Có | Tổng trọng lượng đơn hàng (gram, `>= 1`) |
| `deliveryLatitude` | Double | Không | Vĩ độ giao hàng `[-90, 90]`, gửi cùng `deliveryLongitude` |
| `deliveryLongitude` | Double | Không | Kinh độ giao hàng `[-180, 180]`, gửi cùng `deliveryLatitude` |
| `voucherCode` | String | Không | Mã voucher, tối đa 50 ký tự; chỉ loại `FREE_SHIP` miễn phí vận chuyển |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Tính phí vận chuyển thành công",
  "result": {
    "shippingFee": 0,
    "fee": 0,
    "baseFee": 15000,
    "shippingDiscount": 15000,
    "distanceKm": 0.0,
    "distance_km": 0.0,
    "method": "estimate",
    "estimatedDays": "1 - 3 ngày"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

- `method`: `google` (khoảng cách đường đi từ Google Routes), `estimate` (ước tính theo đường chim bay × hệ số đường đi, khi Google lỗi hoặc chưa cấu hình), `flat` (không có tọa độ; `distanceKm` là `null`). `fee` và `distance_km` là alias của `shippingFee` và `distanceKm`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `400 INVALID_REQUEST` — "Dữ liệu yêu cầu không hợp lệ." (tọa độ lệch cặp; thông báo thực tế có thể chi tiết hơn); xác thực body trả mã `400`, thông báo "Dữ liệu không hợp lệ." và thông tin trường. Khi gửi voucher: `400 CART_EMPTY` — "Giỏ hàng đang trống."; `4102 VOUCHER_PAUSED` — "Voucher đang tạm dừng."; `4103 VOUCHER_NOT_STARTED` — "Voucher chưa đến thời gian sử dụng."; `4104 VOUCHER_EXPIRED` — "Voucher đã hết hạn."; `4106 VOUCHER_NOT_APPLICABLE` — "Voucher không áp dụng cho giỏ hàng này.".
- **HTTP 401 Unauthorized:** `401 UNAUTHENTICATED` — "Bạn cần đăng nhập để truy cập tài nguyên này.".
- **HTTP 403 Forbidden:** `403 ACCESS_DENIED` — "Bạn không có quyền truy cập tài nguyên này.".
- **HTTP 404 Not Found:** Khi gửi voucher: `404 CUSTOMER_NOT_FOUND` — "Không tìm thấy khách hàng."; `4101 VOUCHER_UNKNOWN` — "Không tìm thấy mã Voucher.".
- **HTTP 409 Conflict:** Khi gửi voucher: `4105 VOUCHER_EXHAUSTED` — "Voucher đã hết lượt sử dụng."; `4208 LOYALTY_STATE_CONFLICT` — "Trạng thái điểm đã thay đổi. Tải lại và thử lại.".

---

## 2. Gợi ý địa chỉ (Maps Autocomplete)

- **Endpoint:** `GET /api/v1/shipping/maps/autocomplete`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Gợi ý địa chỉ từ chuỗi người dùng nhập (Google Places). Giới hạn 20 yêu cầu mỗi người dùng mỗi phút; kết quả được cache 5 phút.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `input` | String | Có | Chuỗi địa chỉ đang gõ (không trống, tối đa 200 ký tự) |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Địa chỉ gợi ý",
  "result": [
    {
      "placeId": "ChIJ8Wv3pLwndTERgdbQh3x4qJQ",
      "label": "140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, Thành phố Hồ Chí Minh"
    }
  ],
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `400 INVALID_REQUEST` — "Dữ liệu yêu cầu không hợp lệ." (`input` trống hoặc quá dài); thiếu `input` trả mã `400` với thông báo "Thiếu tham số 'input'.".
- **HTTP 401 Unauthorized:** `401 UNAUTHENTICATED` — "Bạn cần đăng nhập để truy cập tài nguyên này.".
- **HTTP 403 Forbidden:** `403 ACCESS_DENIED` — "Bạn không có quyền truy cập tài nguyên này.".
- **HTTP 429 Too Many Requests:** `4303 MAPS_RATE_LIMITED` — "Vui lòng chờ trước khi tìm địa chỉ tiếp".
- **HTTP 503 Service Unavailable:** `4301 MAPS_NOT_CONFIGURED` — "Chưa bật tìm địa chỉ; hãy chọn ghim trên bản đồ"; `4302 MAPS_UNAVAILABLE` — "Tìm địa chỉ đang bận; hãy chọn ghim trên bản đồ".

---

## 3. Chuyển địa chỉ thành tọa độ (Maps Geocode)

- **Endpoint:** `GET /api/v1/shipping/maps/geocode`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Lấy tọa độ giao hàng từ `placeId` (kết quả gợi ý) hoặc từ chuỗi địa chỉ. Cùng giới hạn tốc độ và cache như mục 2.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `placeId` | String | Không | ID địa điểm từ mục 2; ưu tiên sử dụng khi khác `null` |
| `address` | String | Không | Địa chỉ dạng chuỗi; ít nhất một trong hai tham số phải không trống và dài tối đa 255 ký tự |

### Response Thành công (HTTP 200 OK)
```json
{
  "success": true,
  "code": 200,
  "message": "Vị trí giao hàng",
  "result": {
    "latitude": 10.8070354,
    "longitude": 106.6287031,
    "formattedAddress": "140 Lê Trọng Tấn, Tây Thạnh, Tân Phú, Thành phố Hồ Chí Minh, Việt Nam",
    "placeId": "ChIJ8Wv3pLwndTERgdbQh3x4qJQ"
  },
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `400 INVALID_REQUEST` — "Dữ liệu yêu cầu không hợp lệ." (cả hai tham số đều thiếu, trống hoặc quá dài).
- **HTTP 401 Unauthorized:** `401 UNAUTHENTICATED` — "Bạn cần đăng nhập để truy cập tài nguyên này.".
- **HTTP 403 Forbidden:** `403 ACCESS_DENIED` — "Bạn không có quyền truy cập tài nguyên này.".
- **HTTP 404 Not Found:** `404 RESOURCE_NOT_FOUND` — "Không tìm thấy tài nguyên.".
- **HTTP 429 Too Many Requests:** `4303 MAPS_RATE_LIMITED` — "Vui lòng chờ trước khi tìm địa chỉ tiếp".
- **HTTP 503 Service Unavailable:** `4301 MAPS_NOT_CONFIGURED` — "Chưa bật tìm địa chỉ; hãy chọn ghim trên bản đồ"; `4302 MAPS_UNAVAILABLE` — "Tìm địa chỉ đang bận; hãy chọn ghim trên bản đồ".
