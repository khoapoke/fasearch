# Shipping

`POST /api/v1/orders/calculate-shipping-fee` — CUSTOMER
```json
{"province":"TP. Hồ Chí Minh","district":"Tân Phú","totalWeightGram":300,"deliveryLatitude":10.8070354,"deliveryLongitude":106.6287031,"voucherCode":"FREESHIP"}
```
```json
{"success":true,"code":200,"result":{"distanceKm":0,"distance_km":0,"shippingFee":0,"fee":0,"baseFee":15000,"shippingDiscount":15000,"method":"estimate","estimatedDays":"1 - 3 ngày"}}
```

`POST /api/v1/orders/checkout` — existing fields + `deliveryLatitude`, `deliveryLongitude`.
Coordinates: nullable pair, latitude [-90,90], longitude [-180,180]. Server recomputes shipping; mismatched submitted fee → QUOTE_CHANGED (4107/409). No coordinates → existing flat-fee compatibility. Persisted order response: `deliveryLatitude`, `deliveryLongitude`, `distanceKm`, `shippingMethod`.

`PATCH /api/v1/users/customers/{id}` — existing ownership + optional coordinate pair. Changed address without pin clears old coordinates.

`GET /api/v1/shipping/maps/autocomplete?input=140%20Le%20Trong%20Tan` — CUSTOMER; result `[{"placeId":"...","label":"..."}]`.

`GET /api/v1/shipping/maps/geocode?placeId=...` (or `address=...`) — CUSTOMER; result `{"latitude":10.807,"longitude":106.629,"formattedAddress":"...","placeId":"..."}`.

| Code | HTTP |
| --- | --- |
| MAPS_NOT_CONFIGURED (4301) | 503 |
| MAPS_UNAVAILABLE (4302) | 503 |
| MAPS_RATE_LIMITED (4303) | 429 |

Maps: 20 requests/user/minute; bounded 5-minute cache; 3-second timeout; routes failure → estimate. Key: BE env or `~/.config/fasearch/google-maps.env`; restart after key change. Warehouse: configured coordinates or geocode once at startup. OSM lookup 2026-11-05: Nominatim way/523650595, 140 Lê Trọng Tấn, HUIT, 10.8070354/106.6287031 (OpenStreetMap contributors, ODbL).

`POST/PUT /api/v1/khuyen-mai[/{id}]` — ADMIN, STAFF; `loaiGiam: FREE_SHIP`, `giaTriGiam: 1` (positive compatibility sentinel, not currency). Whole shipping waived; merchandise discount 0. Existing product scope remains an eligibility check. One voucher/order; cannot stack another merchandise voucher; points retain existing rules. Existing active/date/quota/fingerprint/hold/consume/release rules apply. No minimum order or maximum distance for this type. Public `GET /api/v1/promotions` includes active free-ship codes.
