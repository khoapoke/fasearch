import { CommerceError, normalizeCartQuote } from "./customer-commerce.ts";
import type { PosDraft, PosQuote, PosReceipt } from "./commerce.ts";
import type { Paged, PosCustomer, PosProduct, QuoteBenefitsInput } from "./commerce-client.ts";
export type { PosCustomer, PosProduct } from "./commerce-client.ts";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/staff/pos/${path}`, { cache: "no-store", ...init }); }
  catch { throw new CommerceError("Không kết nối được dịch vụ POS.", 503); }
  let payload: { success?: boolean; code?: string | number; message?: string; result?: unknown; errors?: Array<{ reason?: string }> } | null = null;
  try { payload = await response.json(); } catch { /* report the HTTP failure below */ }
  if (!response.ok || payload?.success !== true || payload.result === undefined) {
    const message = payload?.message || `Yêu cầu POS thất bại (HTTP ${response.status}).`;
    const reasons = payload?.errors?.map((item) => item.reason).filter((reason): reason is string => Boolean(reason));
    throw new CommerceError(reasons?.length ? `${message}: ${reasons.join("; ")}` : message, response.status || 502, payload?.code === undefined ? undefined : String(payload.code));
  }
  return payload.result as T;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CommerceError("Máy chủ trả về dữ liệu POS sai định dạng.", 502);
  return value as Record<string, unknown>;
}
function number(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) throw new CommerceError("Máy chủ trả về dữ liệu POS sai định dạng.", 502);
  return value;
}
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new CommerceError("Máy chủ trả về dữ liệu POS sai định dạng.", 502);
  return value;
}
function id(value: unknown): number {
  const result = integer(value);
  if (result < 1) throw new CommerceError("Máy chủ trả về dữ liệu POS sai định dạng.", 502);
  return result;
}

function draft(raw: unknown): PosDraft {
  const value = record(raw);
  if (!Array.isArray(value.items)) throw new CommerceError("Máy chủ trả về nháp POS thiếu dòng hàng.", 502);
  const customer = value.customer && typeof value.customer === "object" ? record(value.customer) : null;
  return {
    maDonHang: id(value.orderId),
    trangThai: typeof value.status === "string" ? value.status : "",
    maKh: customer?.customerId == null ? null : id(customer.customerId),
    customerName: typeof customer?.fullName === "string" ? customer.fullName : null,
    customerPhone: typeof customer?.phoneNumber === "string" ? customer.phoneNumber : null,
    items: value.items.map((rawItem) => {
      const item = record(rawItem);
      const skuId = id(item.skuId);
      return { maSku: skuId, tenSp: typeof item.productName === "string" ? item.productName : `SKU ${skuId}`, soLuong: id(item.quantity), donGia: number(item.unitPrice) };
    }),
  };
}

export async function posSearchProducts(q: string): Promise<Paged<PosProduct>> {
  const raw = await request<unknown>(`products?q=${encodeURIComponent(q)}`);
  if (!Array.isArray(raw)) throw new CommerceError("Máy chủ trả về danh sách POS sai định dạng.", 502);
  const data = raw.map((entry): PosProduct => {
    const item = record(entry);
    return {
      maSku: id(item.skuId), maSp: id(item.productId), tenSp: typeof item.productName === "string" ? item.productName : "",
      mauSac: typeof item.color === "string" ? item.color : null, kichCo: typeof item.size === "string" ? item.size : null,
      maVach: typeof item.barcode === "string" ? item.barcode : null, donGia: number(item.price),
      soLuongKhaDung: typeof item.availableStock === "number" ? number(item.availableStock) : null,
    };
  });
  return { data, page: 0, size: data.length, totalElements: data.length, totalPages: data.length ? 1 : 0 };
}

export async function posFindCustomer(phone: string): Promise<PosCustomer | null> {
  const result = record(await request<unknown>(`customers?phone=${encodeURIComponent(phone)}`));
  if (!Array.isArray(result.content)) throw new CommerceError("Máy chủ trả về danh sách khách POS sai định dạng.", 502);
  const customer = result.content.map(record).find((item) => item.phoneNumber === phone);
  if (!customer) return null;
  const name = `${typeof customer.firstName === "string" ? customer.firstName : ""} ${typeof customer.lastName === "string" ? customer.lastName : ""}`.trim();
  return {
    maKh: id(customer.id), hoTen: name, sdt: phone,
    diemTichLuy: typeof customer.accumulatePoint === "number" ? customer.accumulatePoint : null,
    tenHang: typeof customer.tierName === "string" ? customer.tierName : null,
  };
}

export async function posCreateDraft(body: { customerPhone?: string | null; note?: string; items: Array<{ maSku: number; soLuong: number }> }): Promise<PosDraft> {
  return draft(await request("drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    ...(body.customerPhone ? { customerPhone: body.customerPhone } : {}), ...(body.note ? { note: body.note } : {}),
    items: body.items.map(({ maSku, soLuong }) => ({ skuId: maSku, quantity: soLuong })),
  }) }));
}

export async function posListDrafts(): Promise<Paged<PosDraft>> {
  const raw = await request<unknown>("drafts");
  if (!Array.isArray(raw)) throw new CommerceError("Máy chủ trả về danh sách nháp POS sai định dạng.", 502);
  const data = raw.map(draft);
  return { data, page: 0, size: data.length, totalElements: data.length, totalPages: data.length ? 1 : 0 };
}

export async function posGetDraft(orderId: number): Promise<PosDraft> {
  return draft(await request(`drafts/${encodeURIComponent(String(orderId))}`));
}

export async function posQuote(orderId: number, benefits?: QuoteBenefitsInput): Promise<PosQuote> {
  const raw = record(await request<unknown>(`orders/${encodeURIComponent(String(orderId))}/quote`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      ...(benefits?.voucherCode ? { voucherCode: benefits.voucherCode } : {}),
      ...(benefits?.diemSuDung !== undefined && benefits.diemSuDung !== null ? { redeemedPoints: benefits.diemSuDung } : {}),
    }),
  }));
  if (id(raw.orderId) !== orderId) throw new CommerceError("Báo giá POS không khớp nháp hiện tại.", 502);
  const quote = normalizeCartQuote(raw);
  return {
    orderId, items: quote.items, tongTienHang: quote.subTotal,
    giamGia: quote.voucherDiscount + quote.pointsDiscount, phiVanChuyen: 0,
    tongThanhToan: quote.merchandiseAmountDue, voucherCode: quote.voucherCode,
    diemSuDung: quote.redeemedPoints, giamVoucher: quote.voucherDiscount,
    giamDiem: quote.pointsDiscount, diemDuocPhep: quote.allowedRedeemedPoints,
    maChinhSach: quote.loyaltyPolicyId, phienBanChinhSach: quote.loyaltyPolicyVersion,
    availablePoints: quote.availablePoints, allowedRedeemedPoints: quote.allowedRedeemedPoints,
    policyStatus: quote.policyStatus, remainingMerchandiseAmount: quote.remainingMerchandiseAmount,
    redeemCurrencyPerPoint: quote.redeemCurrencyPerPoint, quoteFingerprint: quote.quoteFingerprint,
  };
}

export function normalizePosReceipt(invoiceRaw: unknown, orderRaw: unknown): PosReceipt {
  const invoice = record(invoiceRaw);
  const order = record(orderRaw);
  const orderId = id(order.orderId);
  if (id(invoice.orderId) !== orderId || !Array.isArray(order.items)) throw new CommerceError("Máy chủ trả về biên lai POS không khớp đơn hàng.", 502);
  const totalActualPaid = number(invoice.totalActualPaid);
  if (totalActualPaid !== number(order.totalAmount)) throw new CommerceError("Số tiền trên hóa đơn POS không khớp đơn.", 502);
  const voucherDiscount = number(order.discountAmount);
  const pointsDiscount = order.pointsDiscount == null ? null : number(order.pointsDiscount);
  const redeemedPoints = order.redeemedPoints == null ? null : integer(order.redeemedPoints);
  const earnedPoints = order.earnedPoints == null ? null : integer(order.earnedPoints);
  const loyaltyPolicyId = order.loyaltyPolicyId == null ? null : id(order.loyaltyPolicyId);
  const loyaltyPolicyVersion = order.loyaltyPolicyVersion == null ? null : id(order.loyaltyPolicyVersion);
  const redeemCurrencyPerPointSnapshot = order.redeemCurrencyPerPointSnapshot == null ? null : number(order.redeemCurrencyPerPointSnapshot);
  if ((invoice.pointsDiscount == null ? null : number(invoice.pointsDiscount)) !== pointsDiscount
    || (invoice.redeemedPoints == null ? null : integer(invoice.redeemedPoints)) !== redeemedPoints
    || (invoice.earnedPoints == null ? null : integer(invoice.earnedPoints)) !== earnedPoints
    || (invoice.loyaltyPolicyId == null ? null : id(invoice.loyaltyPolicyId)) !== loyaltyPolicyId
    || (invoice.loyaltyPolicyVersion == null ? null : id(invoice.loyaltyPolicyVersion)) !== loyaltyPolicyVersion
    || (invoice.redeemCurrencyPerPointSnapshot == null ? null : number(invoice.redeemCurrencyPerPointSnapshot)) !== redeemCurrencyPerPointSnapshot) {
    throw new CommerceError("Ảnh chụp điểm trên biên lai không khớp đơn.", 502);
  }
  const items = order.items.map((rawItem) => {
      const item = record(rawItem);
      const skuId = id(item.skuId);
      return {
        maSku: skuId, tenSpSnapshot: typeof item.productName === "string" ? item.productName : `SKU ${skuId}`,
        soLuong: id(item.quantity), tongDong: number(item.totalPrice),
        tienGiamGia: number(item.discountAmount), diemGiam: item.pointsDiscountAmount == null ? null : number(item.pointsDiscountAmount),
      };
    });
  const allocatedPointsDiscount = items.reduce((sum, item) => sum + (item.diemGiam ?? 0), 0);
  if ((pointsDiscount !== null && pointsDiscount > 0 && items.some((item) => item.diemGiam === null))
    || Math.round(allocatedPointsDiscount * 100) !== Math.round((pointsDiscount ?? 0) * 100)) {
    throw new CommerceError("Phân bổ điểm trên biên lai không khớp đơn.", 502);
  }
  return {
    maHoaDon: id(invoice.invoiceId), maDonHang: orderId, tongThanhToan: totalActualPaid, tienThua: number(invoice.cashChange),
    giamGia: voucherDiscount + (pointsDiscount ?? 0), maVoucher: order.voucherId == null ? null : id(order.voucherId),
    diemSuDung: redeemedPoints, giamVoucher: voucherDiscount, giamDiem: pointsDiscount,
    earnedPoints, loyaltyPolicyId, loyaltyPolicyVersion, redeemCurrencyPerPointSnapshot,
    phanBoGiamXacDinh: true, items,
  };
}

export async function posPay(orderId: number, body: {
  amountPaid: number; quoteFingerprint: string; voucherCode?: string | null; redeemedPoints?: number | null;
}): Promise<PosReceipt> {
  const invoice = await request<unknown>("payments/process", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    orderId, paymentMethodCode: "CASH", amountPaid: body.amountPaid,
    ...(body.voucherCode ? { voucherCode: body.voucherCode } : {}),
    ...(body.redeemedPoints !== undefined && body.redeemedPoints !== null ? { redeemedPoints: body.redeemedPoints } : {}),
    quoteFingerprint: body.quoteFingerprint,
  }) });
  const order = await request(`orders/${encodeURIComponent(String(orderId))}`);
  return normalizePosReceipt(invoice, order);
}

export async function posCancel(orderId: number, reason: string): Promise<PosDraft> {
  return draft(await request(`orders/${encodeURIComponent(String(orderId))}/cancel`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }),
  }));
}
