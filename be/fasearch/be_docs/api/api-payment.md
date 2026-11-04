# TÀI LIỆU API: MODULE PAYMENT (THANH TOÁN & HÓA ĐƠN)

Module `payment` tính tiền, ghi nhận invoice/payment và bàn giao settlement loyalty/voucher cho transaction thanh toán. S2 loyalty behavior tuân theo contract v1.4; không có tỷ lệ tích/đổi mặc định.

---

## 1. Tính toán thanh toán (FR-42)

- **Endpoint:** `POST /api/v1/payments/calculate`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER` (CUSTOMER chỉ tính đơn của mình).
- **Request Body:**
```json
{
  "orderId": 1001,
  "voucherCode": "FASEARCH10",
  "redeemedPoints": 2
}
```

- **Response (HTTP 200):**
```json
{
  "success": true,
  "code": 200,
  "message": "Tính toán hóa đơn thành công",
  "result": {
    "subTotal": 630000.00,
    "redeemedPoints": 2,
    "voucherDiscount": 63000.00,
    "pointDiscount": 2000.00,
    "shippingFee": 30000.00,
    "taxVat": 47600.00,
    "finalAmount": 595000.00
  },
  "errors": null,
  "timestamp": "2026-10-31T12:00:00"
}
```

`calculate` là preview-only: không sửa tổng đơn, không giữ điểm/quota, không ghi ledger và không cho phép thu tiền dựa trên request preview.

- Với đơn có loyalty snapshot S2 đã lưu, response dùng snapshot persisted; bỏ `redeemedPoints` thì dùng điểm trên đơn, còn nếu gửi thì phải khớp snapshot hoặc trả HTTP 409 / `4107 QUOTE_CHANGED`.
- Với đơn pre-S2 có snapshot voucher S1, dùng voucher discount persisted; điểm dương gửi riêng bị từ chối HTTP 400.
- Với đơn pre-S2 không có voucher snapshot, giữ legacy non-voucher point calculation chỉ để hiển thị; đây không phải quyền redeem/settle và không đổi order/ledger.
- `shippingFee` lấy từ đơn hiện có. Earning/tier (khi settle) dựa trên `Invoice.totalActualPaid`, không dựa trên tiền tender/change.

Response dùng `Cache-Control: no-store`. Field `pointDiscount` giữ tên legacy trên endpoint này; các quote/order snapshot dùng `pointsDiscount`.

## 2. Danh sách phương thức thanh toán

- **Endpoint:** `GET /api/v1/payments/methods`
- **Quyền hạn:** Public theo cấu hình hiện tại.
- Trả các phương thức đang `ACTIVE`, gồm `CASH`, `BANK_TRANSFER`, `VNPAY_QR`, `MOMO` nếu có trong DB. Việc phương thức xuất hiện trong danh sách không chứng minh đã cấu hình cổng thanh toán bên ngoài.

## 3. Thực hiện thanh toán & xuất hóa đơn (FR-43)

- **Endpoint:** `POST /api/v1/payments/process`
- **Quyền hạn:** `ADMIN`, `STAFF`, `CUSTOMER`; CUSTOMER chỉ thanh toán đơn của chính mình. Đơn voucher COD chỉ do nhân viên thu CASH sau khi handoff.
- **Request Body (online / legacy):**
```json
{
  "orderId": 1001,
  "paymentMethodCode": "CASH",
  "amountPaid": 595000.00,
  "note": "Khách thanh toán đủ"
}
```

Với POS, request có thể thêm `voucherCode`, `redeemedPoints` và `quoteFingerprint`; các trường benefit chỉ được nhận cho order POS (`POS-...`). Gửi fingerprint chính xác từ `POST /api/v1/orders/pos/{orderId}/quote`. POS chỉ thu CASH; customerless draft không redeem/earn. Điểm phải là số nguyên không âm; không nhận point input bị cắt/truncate.

Service khóa order, tính lại quote draft nếu POS, và trong một transaction tạo invoice/payment, tiêu thụ voucher/điểm giữ chỗ, ghi earning ledger, cập nhật số dư và trừ tồn POS. Một order có tối đa một invoice. Request POS lặp giống hệt trả invoice hiện có với HTTP 200; thay đổi financial input trả HTTP 409 / `4108 IDEMPOTENCY_CONFLICT`. Request đầu thành công trả HTTP 201. Replay được nhận diện qua HTTP status; `InvoiceRes` không thêm cờ replay ngoài contract.

`InvoiceRes` giữ các trường cũ và thêm trực tiếp các trường S2 nullable:
`redeemedPoints`, `pointsDiscount`, `loyaltyPolicyId`, `loyaltyPolicyVersion`, `redeemCurrencyPerPointSnapshot`, `earnedPoints`.

```json
{
  "success": true,
  "code": 201,
  "message": "Thanh toán và xuất hóa đơn thành công",
  "result": {
    "invoiceId": 801,
    "invoiceCode": "HD-20261031-001",
    "orderId": 1001,
    "orderCode": "DH-20261031-001",
    "totalActualPaid": 595000.00,
    "vatAmount": 47600.00,
    "cashReceived": 600000.00,
    "cashChange": 5000.00,
    "paymentStatus": "PAID",
    "paymentMethod": "CASH",
    "redeemedPoints": 2,
    "pointsDiscount": 2000.00,
    "loyaltyPolicyId": 7,
    "loyaltyPolicyVersion": 2,
    "redeemCurrencyPerPointSnapshot": 1000.00,
    "earnedPoints": 5,
    "note": "Khách thanh toán đủ",
    "issuedAt": "2026-10-31T12:05:00"
  },
  "errors": null,
  "timestamp": "2026-10-31T12:05:00"
}
```

`totalActualPaid` là tiền invoice dùng để earn/tier; `cashReceived` và `cashChange` không phải earning basis. Với no-snapshot/pre-S2 invoice, loyalty fields giữ `null`; không tạo retroactive earning theo policy S2. Với S2 policy snapshot, earn floor theo rate đã chốt trên order, chỉ tính actual paid, và ghi tối đa một lần. Không có tỷ lệ earning mặc định; policy mới mặc định `DISABLED`. Nếu invoice actual paid là zero thì earned points bằng zero. Zero-due invoice không tạo payment row có số tiền giả.

Legacy fixed-rate award (đơn pre-S2 không có loyalty snapshot và không có voucher) giữ nguyên tỷ lệ cũ `1 điểm / 100.000đ` tính trên `totalActualPaid`, nhưng được settle nguyên tử: khóa row khách hàng, cộng chính xác có kiểm tra tràn (`4208 LOYALTY_STATE_CONFLICT` khi vượt `Integer.MAX_VALUE`) và rollback toàn bộ invoice/payment/order nếu thất bại. Khi khách hàng đã có baseline `OPENING`, mỗi đơn ghi đúng một ledger `EARN` với `sourceKey = earn:<orderId>`, nên settle lặp lại không cộng trùng. Đơn không có baseline `OPENING` chỉ cập nhật số dư legacy, không sinh ledger history; đây là chủ ý, không phải thiếu history. Response vẫn trả `earnedPoints = null` cho đơn pre-S2 vì field này chỉ thuộc snapshot S2.

## 4. Lỗi ổn định S2

`ApiResponse.code` là business code độc lập với HTTP status:

| Business code | Stable name | HTTP |
|---:|---|---:|
| 4107 | `QUOTE_CHANGED` | 409 |
| 4108 | `IDEMPOTENCY_CONFLICT` | 409 |
| 4201 | `LEGACY_OPENING_REQUIRED` | 409 |
| 4202 | `LOYALTY_POLICY_UNAVAILABLE` | 409 |
| 4203 | `LOYALTY_POLICY_DISABLED` | 409 |
| 4204 | `INSUFFICIENT_POINTS` | 409 |
| 4205 | `OPENING_ALREADY_RECORDED` | 409 |
| 4206 | `LOYALTY_POLICY_VERSION_CHANGED` | 409 |
| 4207 | `LOYALTY_TIER_VERSION_CHANGED` | 409 |
| 4208 | `LOYALTY_STATE_CONFLICT` | 409 |

`4204` trả `errors[].reason` chứa `Allowed maximum: N`. Điểm âm/phân số/overflow là HTTP 400 / business code 400. Sensitive loyalty/payment responses và S2 conflict responses dùng `Cache-Control: no-store`.

## 5. Cổng thanh toán bên ngoài

Stripe (test mode) và VNPAY (sandbox) có endpoint checkout/webhook/IPN riêng — xem mục "Provider checkout (test/sandbox)" bên dưới; endpoint tạo URL và callback/IPN **có tồn tại** trong source (`StripeCheckoutController`, `StripeWebhookController`, `VnpayController`). MoMo **chưa** có endpoint. Các method code trong danh mục không tự hàm ý tích hợp provider; không dùng dữ liệu giả hay gửi giao dịch thật.

## Invoice code allocation (concurrency)

`Invoice.invoiceCode` is generated as `HD-YYYYMMDD-XXX` where `XXX` is the next sequential number for the current date. To prevent the TOCTOU race between `countByInvoiceCodeStartingWith` and `existsByInvoiceCode` under concurrent settlements, allocation is serialized per database transaction via `pg_advisory_xact_lock`. The lock is transaction-scoped and released automatically on commit or rollback, so no partial invoice or payment row can be left behind. Single-order settlement is unaffected; concurrent settlements now serialize at the code-allocation step instead of failing with a duplicate-key error.


## Payment attempt skeleton (provider pending)

- `POST /api/v1/payments/attempts` — `CUSTOMER`, body `{orderId, provider, idempotencyKey}`; server derives amount/currency from the persisted order, enforces own-order ownership and returns `CREATED`.
- `GET /api/v1/payments/attempts/{id}` — `CUSTOMER`, own attempt only.
- Additive tables `payment_attempt` and `payment_event` (migration V15). Event dedup key is **`(provider, provider_event_id)`**, not a global event ID.
- Late provider success after `CANCELLED`/`EXPIRED` becomes `REVIEW_REQUIRED`; no financial rule is invented. (Verified provider success now settles through the authoritative path described under "Provider checkout".)
- `StripeSignatureVerifier` and `VnpaySignatureVerifier` implement the signature checks used by the webhook/IPN endpoints. Stripe/VNPAY sandbox E2E is tracked in the `payment-sandbox-readiness` packet, not here.
- COD/cash settlement via `POST /api/v1/payments/process` is unchanged; non-cash methods are rejected there. Provider settlement happens only through the verified Stripe webhook / VNPAY IPN (see "Provider checkout").
- Still unresolved policy: refunds/partials and double-payment of an order by two attempts. Do not mark `PAID` from a redirect.

## Provider checkout (test/sandbox, candidate-only)

- `POST /api/v1/payments/stripe/checkout` — `CUSTOMER`, body `{orderId, idempotencyKey}`; server derives amount/currency from the persisted order; creates or reuses a customer-owned attempt, then creates a Stripe test-mode Hosted Checkout session and stores `providerReference`/`checkoutUrl`. Test keys only; live keys rejected.
- `POST /api/v1/payments/stripe/webhook` — public route, verified by `Stripe-Signature` HMAC-SHA256 with timestamp tolerance; only `checkout.session.completed`/`async_payment_succeeded` (and failure/expired variants) are processed; unknown types are ignored. Verified success settles through the authoritative invoice/loyalty/stock path exactly once (see below); it never marks `PAID` from the redirect.
- `POST /api/v1/payments/vnpay/checkout` — `CUSTOMER`, body `{orderId, idempotencyKey}`; server derives VND amount (×100) and signs canonical params with `vnp_HashSecret`; returns sandbox payment URL and stores `TxnRef`.
- `GET /api/v1/payments/vnpay/return` — display-only result check, no settlement.
- `GET /api/v1/payments/vnpay/ipn` — verifies HMAC-SHA512, merchant, amount/currency/order; success requires `vnp_ResponseCode == "00"` and `vnp_TransactionStatus == "00"`; dedup by `(provider, provider_event_id)`; failure/timeout/expiry handled without marking `PAID`.
- Non-cash `POST /api/v1/payments/process` is rejected (`400`); CUSTOMER cannot mark `PAID` via an unverified request. COD/cash settlement remains unchanged.
- Verified provider success settles via the existing authoritative path: order lock, amount/currency match to the persisted order total, invoice `PAID` + payment row (once per order), `checkoutBenefitService.consume`, `loyaltyService.settleOrder/settleLegacyEarn`, order `PENDING` → `CONFIRMED`. Retry/replay is idempotent: existing `PAID` invoice returns without double invoice/earn/stock/quota.
- Late success after `CANCELLED`/`EXPIRED`/closed order stays `REVIEW_REQUIRED`; no automatic fulfillment, no refund module, no silent stock change.
- Attempt `FAILURE`/`EXPIRED`/`CANCELLED` alone never cancels the order and never releases holds; holds release only via the authoritative `cancelOrder`/expiry path, exactly once.
- Zero-due orders are rejected from external checkout and settle only through the existing local zero-settlement path; no fake external charge.

## Re-pay after a terminal attempt (idempotent retry contract)

The storefront sends one stable `idempotencyKey` per order/provider (e.g. `pay-order-{orderId}-{provider}`). `payment_attempt` keeps `UNIQUE (provider, idempotency_key)` (V15), so the server resolves the *newest attempt of that key family* inside `PaymentAttemptServiceImpl#create` (used by `POST /payments/attempts`, `/payments/stripe/checkout`, `/payments/vnpay/checkout`):

| Latest attempt of the key | Result of the next request with the same key |
| :--- | :--- |
| none | new attempt `CREATED` with the client key |
| `CREATED`, `PENDING`, `SETTLEMENT_PENDING` (open) | same attempt returned; checkout endpoints return the stored `checkoutUrl` (idempotent) |
| `SETTLED`, `REVIEW_REQUIRED` | same attempt returned (HTTP 201 with the stored attempt and its `checkoutUrl`, no new session, no error); never replaced. A re-pay after settlement therefore *returns the settled attempt*, it does not fail |
| `FAILED`, `CANCELLED`, `EXPIRED` (terminal) | a **new** attempt `CREATED` is stored under the derived key `<clientKey>~r<n>` (`n` = 1, 2, …; the client key is clipped to 90 chars so the key fits `VARCHAR(100)`), with its own `providerReference`; the checkout endpoint then creates a **fresh** Stripe session / VNPAY `TxnRef` |

- Retry is rejected with `ORDER_ALREADY_PAID` (400) if the order already has an invoice; the key still conflicting with another order stays `DATA_CONFLICT` (409).
- Ownership/payability is checked on a plain read first (a customer cannot row-lock someone else's order). The order row lock (`findByIdForUpdate`) is taken only when a new attempt may be written, and the key family is re-resolved under the lock, so two concurrent re-pay clicks open at most one retry **attempt** (see residual risk 2 for provider sessions).
- No schema change and no FE change: the response shape (`attemptId`, `checkoutUrl`) is unchanged; the derived key is internal.
- Webhook/IPN handling is unchanged: events are matched by `(provider, providerReference)`, so a late event for an old attempt only affects that old attempt; dedup key `(provider, provider_event_id)`, amount/currency check and PAID-only-via-verified-event are unchanged.

### Known residual risks (accepted, no settlement-semantics change in this candidate)

1. **Late success on a `FAILED` attempt still settles** (`settleVerifiedSuccess` only routes `CANCELLED`/`EXPIRED` late successes to `REVIEW_REQUIRED`). Since a fresh `K~r<n>` attempt can now be open beside an old `FAILED` one, a customer could be charged on both; the second verified success finds the invoice, is recorded `DUPLICATE`/`SETTLED`, and no review/refund is raised. Providers rarely send success after failure for one session; decide the rule (review on success-after-FAILED or when another attempt already settled the invoice) before any real money.
2. **Concurrent first checkout can open two provider sessions for one attempt.** The order lock is released when `create` commits; the provider session is created and `attachProviderSession` runs afterwards, outside the lock and without a "URL already attached" check. Two simultaneous requests may both create sessions and the last attach wins; a payment on the overwritten session cannot be matched (webhook 404 / IPN `01`). The FE `paying` busy state mitigates it. Follow-up: attach only when `providerCheckoutUrl` is null, otherwise return the stored URL.
3. **`ORDER_ALREADY_PAID` is checked only on the retry path.** If the latest attempt is open, its URL is returned even when a sibling provider attempt already paid the order.
4. **Re-pay after settlement returns the settled attempt** (HTTP 201, stored `checkoutUrl`) instead of an error; clients must use `status` of the response (`SETTLED`) rather than assume a payable URL.
