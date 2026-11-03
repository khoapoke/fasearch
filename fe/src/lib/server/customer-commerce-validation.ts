export type CheckoutBodyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string; status: number; code: string };

const invalid = (message: string, code = "INVALID_REQUEST"): CheckoutBodyResult => ({ ok: false, message, status: 400, code });

export function checkoutBody(body: Record<string, unknown>): CheckoutBodyResult {
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
  const receiverName = typeof body.receiverName === "string" ? body.receiverName.trim() : "";
  const receiverPhone = typeof body.receiverPhone === "string" ? body.receiverPhone.trim() : "";
  const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  const shippingFee = body.shippingFee;
  if (deliveryAddress.length < 5 || deliveryAddress.length > 255) return invalid("Địa chỉ giao hàng chưa hợp lệ.", "INVALID_ADDRESS");
  if (receiverName.length < 2 || receiverName.length > 100) return invalid("Tên người nhận chưa hợp lệ.", "INVALID_RECEIVER");
  if (!/^\d{9,11}$/.test(receiverPhone.replace(/[ .-]/g, ""))) return invalid("Số điện thoại người nhận chưa hợp lệ.", "INVALID_PHONE");
  if (paymentMethod !== "COD" && paymentMethod !== "STRIPE" && paymentMethod !== "VNPAY") return invalid("Phương thức thanh toán chưa hỗ trợ.", "UNSUPPORTED_PAYMENT");
  if (typeof shippingFee !== "number" || !Number.isFinite(shippingFee) || shippingFee < 0 || shippingFee > 10000000) return invalid("Phí giao hàng chưa hợp lệ.", "INVALID_SHIPPING_FEE");
  if (body.note !== undefined && typeof body.note !== "string") return invalid("Ghi chú chưa hợp lệ.", "INVALID_NOTE");
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 500) return invalid("Ghi chú tối đa 500 ký tự.", "INVALID_NOTE");

  const rawCode = body.voucherCode;
  if (rawCode !== undefined && rawCode !== null && typeof rawCode !== "string") return invalid("Mã voucher chưa hợp lệ.");
  const voucherCode = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : null;
  if (voucherCode && voucherCode.length > 50) return invalid("Mã voucher phải tối đa 50 ký tự.");
  const redeemedPoints = body.redeemedPoints;
  if (redeemedPoints !== undefined && (!Number.isSafeInteger(redeemedPoints) || (redeemedPoints as number) < 0 || (redeemedPoints as number) > 2_147_483_647)) return invalid("Điểm sử dụng phải là số nguyên không âm trong giới hạn cho phép.", "INVALID_REDEEMED_POINTS");
  const hasFreshness = ["quoteFingerprint", "expectedMerchandiseAmountDue", "checkoutKey"].some((key) => body[key] !== undefined);
  const hasVoucher = Boolean(voucherCode);
  const hasBenefits = hasVoucher || (typeof redeemedPoints === "number" && redeemedPoints > 0);
  let confirmation: Record<string, unknown> = {};
  if (hasFreshness || hasBenefits) {
    const fingerprint = body.quoteFingerprint;
    const due = body.expectedMerchandiseAmountDue;
    const key = body.checkoutKey;
    if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint) || typeof due !== "number" || !Number.isFinite(due) || due < 0 || typeof key !== "string" || !key.trim() || key.length > 100) {
      return invalid("Báo giá không còn hợp lệ. Hãy báo giá lại trước khi đặt hàng.", "INVALID_QUOTE");
    }
    confirmation = { quoteFingerprint: fingerprint, expectedMerchandiseAmountDue: due, checkoutKey: key };
  }

  // Zero-due orders settle locally only; the BE rejects external attempts for them.
  if (paymentMethod !== "COD" && typeof shippingFee === "number" && typeof body.expectedMerchandiseAmountDue === "number"
    && body.expectedMerchandiseAmountDue === 0 && shippingFee === 0) {
    return invalid("Đơn 0đ chỉ thanh toán khi nhận hàng (COD).", "ZERO_DUE_ONLINE_UNSUPPORTED");
  }
  return {
    ok: true,
    body: {
      deliveryAddress, receiverName, receiverPhone, paymentMethod, shippingFee,
      ...(note ? { note } : {}),
      ...(voucherCode ? { voucherCode } : rawCode !== undefined ? { voucherCode: null } : {}),
      ...(redeemedPoints !== undefined ? { redeemedPoints } : {}),
      ...confirmation,
    },
  };
}
