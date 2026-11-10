const MAX_POINTS = 2_147_483_647;

function code(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length <= 32 && /^[A-Z0-9_-]+$/.test(normalized) ? normalized : null;
}

function points(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_POINTS;
}

export function posDraftBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const customerPhone = body.customerPhone;
  if (customerPhone !== undefined && customerPhone !== null && (typeof customerPhone !== "string" || !/^\d{9,11}$/.test(customerPhone))) return null;
  if (body.note !== undefined && (typeof body.note !== "string" || [...body.note].length > 500)) return null;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) return null;
  const seen = new Set<number>();
  const items = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (!Number.isSafeInteger(item.skuId) || (item.skuId as number) < 1 || !Number.isSafeInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 999 || seen.has(item.skuId as number)) return null;
    seen.add(item.skuId as number);
    items.push({ skuId: item.skuId, quantity: item.quantity });
  }
  return { ...(customerPhone ? { customerPhone } : {}), ...(body.note ? { note: body.note.trim() } : {}), items };
}

export function posQuoteBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const rawCode = body.voucherCode;
  if (rawCode !== undefined && rawCode !== null && (typeof rawCode !== "string" || (rawCode.trim() && !code(rawCode)))) return null;
  const redeemedPoints = body.redeemedPoints;
  if (redeemedPoints !== undefined && !points(redeemedPoints)) return null;
  const voucherCode = typeof rawCode === "string" && rawCode.trim() ? code(rawCode) : null;
  return { ...(voucherCode ? { voucherCode } : {}), ...(redeemedPoints !== undefined ? { redeemedPoints } : {}) };
}

export function posPaymentBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const { orderId, paymentMethodCode, amountPaid, note, voucherCode: rawCode, redeemedPoints, quoteFingerprint } = body;
  if (!Number.isSafeInteger(orderId) || (orderId as number) < 1 || paymentMethodCode !== "CASH") return null;
  if (typeof amountPaid !== "number" || !Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid >= 1e17 || !Number.isInteger(amountPaid)) return null;
  if (note !== undefined && (typeof note !== "string" || [...note].length > 500)) return null;
  if (rawCode !== undefined && rawCode !== null && (typeof rawCode !== "string" || (rawCode.trim() && !code(rawCode)))) return null;
  if (redeemedPoints !== undefined && !points(redeemedPoints)) return null;
  const voucherCode = typeof rawCode === "string" && rawCode.trim() ? code(rawCode) : null;
  if (quoteFingerprint !== undefined && (typeof quoteFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(quoteFingerprint))) return null;
  if ((voucherCode || (typeof redeemedPoints === "number" && redeemedPoints > 0)) && typeof quoteFingerprint !== "string") return null;
  return {
    orderId, paymentMethodCode, amountPaid,
    ...(note ? { note: note.trim() } : {}),
    ...(voucherCode ? { voucherCode } : {}),
    ...(redeemedPoints !== undefined ? { redeemedPoints } : {}),
    ...(quoteFingerprint ? { quoteFingerprint } : {}),
  };
}
