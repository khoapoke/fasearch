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
| `deliveryLatitude` | Number | Không | Vĩ độ giao hàng `[-90, 90]`, gửi cùng `deliveryLongitude` |
| `deliveryLongitude` | Number | Không | Kinh độ giao hàng `[-180, 180]`, gửi cùng `deliveryLatitude` |
| `voucherCode` | String | Không | Mã giảm giá `FREE_SHIP`, tối đa 50 ký tự |

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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

- `method`: `google` (khoảng cách đường đi từ Google Routes), `estimate` (ước tính theo đường chim bay × hệ số đường đi, khi Google lỗi hoặc chưa cấu hình), `flat` (không có tọa độ; `distanceKm` là `null`). `fee` và `distance_km` là alias của `shippingFee` và `distanceKm`.

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu trường bắt buộc, tọa độ lệch cặp hoặc ngoài miền hợp lệ.
- **HTTP 401 Unauthorized:** Chưa đăng nhập.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.

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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** `input` trống hoặc quá dài.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.
- **HTTP 429 Too Many Requests:** Vượt 20 yêu cầu/phút (`4303 MAPS_RATE_LIMITED`).
- **HTTP 503 Service Unavailable:** Chưa bật tìm địa chỉ (`4301 MAPS_NOT_CONFIGURED`) hoặc Google đang bận (`4302 MAPS_UNAVAILABLE`); FE cho khách chọn ghim trên bản đồ.

---

## 3. Chuyển địa chỉ thành tọa độ (Maps Geocode)

- **Endpoint:** `GET /api/v1/shipping/maps/geocode`
- **Quyền hạn:** `CUSTOMER`
- **Mô tả:** Lấy tọa độ giao hàng từ `placeId` (kết quả gợi ý) hoặc từ chuỗi địa chỉ. Cùng giới hạn tốc độ và cache như mục 2.

### Query Params
| Tham số | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `placeId` | String | Không | ID địa điểm từ mục 2 (tối đa 255 ký tự) |
| `address` | String | Không | Địa chỉ dạng chuỗi (tối đa 255 ký tự); phải có `placeId` hoặc `address` |

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
  "errors": null,
  "timestamp": "2026-11-05T09:00:00"
}
```

### Response Lỗi thường gặp
- **HTTP 400 Bad Request:** Thiếu cả `placeId` và `address`, hoặc giá trị quá dài.
- **HTTP 403 Forbidden:** Không phải `CUSTOMER`.
- **HTTP 404 Not Found:** Không tìm thấy tọa độ cho địa chỉ.
- **HTTP 429 Too Many Requests:** Vượt 20 yêu cầu/phút (`4303 MAPS_RATE_LIMITED`).
- **HTTP 503 Service Unavailable:** Chưa bật tìm địa chỉ (`4301 MAPS_NOT_CONFIGURED`) hoặc Google đang bận (`4302 MAPS_UNAVAILABLE`).
