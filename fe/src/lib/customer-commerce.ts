// Typed, narrow client for candidate BE cart/order APIs. The token never enters
// this module: it calls the same-origin BFF and receives normalized data only.

export type CustomerCartItem = {
  skuId: number;
  productName: string;
  color: string | null;
  size: string | null;
  barcode: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
};

export type CustomerCart = {
  cartId: number;
  totalItems: number;
  subTotal: number;
  items: CustomerCartItem[];
};

export type CustomerOrder = {
  orderId: number;
  orderCode: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  subTotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  voucherId: number | null;
  voucherCode: string | null;
  voucherCampaignName: string | null;
  voucherCampaignVersion: number | null;
  redeemedPoints: number | null;
  pointsDiscount: number | null;
  loyaltyPolicyId: number | null;
  loyaltyPolicyVersion: number | null;
  redeemCurrencyPerPointSnapshot: number | null;
  earnedPoints: number | null;
  replayed: boolean;
  createdAt: string;
};

export type CustomerOrderItem = {
  skuId: number;
  productName: string;
  color: string | null;
  size: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount: number;
  pointsDiscountAmount: number | null;
};

export type CartQuoteLine = { skuId: number; productName: string; quantity: number; unitPrice: number; totalPrice: number; discountAmount: number; pointsDiscountAmount: number };
export type CustomerCartQuote = {
  freeShipping?: boolean; items: CartQuoteLine[]; subTotal: number; voucherCode: string | null; voucherDiscount: number;
  remainingMerchandiseAmount: number; redeemedPoints: number; pointsDiscount: number; allowedRedeemedPoints: number;
  availablePoints: number | null; policyStatus: "UNCONFIGURED" | "DISABLED" | "ENABLED";
  loyaltyPolicyId: number | null; loyaltyPolicyVersion: number | null; redeemCurrencyPerPoint: number | null;
  merchandiseAmountDue: number; quoteFingerprint: string;
};

export type CustomerOrderDetail = CustomerOrder & {
  note: string | null;
  customer: { customerId: number; fullName: string | null; phoneNumber: string | null } | null;
  items: CustomerOrderItem[];
  paidAmount?: number | null;
  refundedAmount?: number | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
};

export type CustomerOrderPage = {
  items: CustomerOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
};

export type ShippingQuote = { shippingFee: number; estimatedDays: string; distanceKm?: number | null; method?: string; baseFee?: number; shippingDiscount?: number };

export const DEFAULT_WEIGHT_PER_ITEM_GRAM = 300;

export function calculateCartWeightGram(totalItems: number): number {
  return Math.max(1, (Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0) * DEFAULT_WEIGHT_PER_ITEM_GRAM);
}

export function isCustomerSafeReason(reason: unknown): reason is string {
  if (typeof reason !== "string") return false;
  const trimmed = reason.trim();
  if (!trimmed) return false;
  // Reject pure English / technical / raw BE strings
  if (/[a-zA-Z]/.test(trimmed) && !/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ]/.test(trimmed)) {
    return false;
  }
  // Reject internal backend markers
  if (/sku|sql|null|undefined|exception|dto|stack|trace|500|400|403|404|entity|table|column|insufficient/i.test(trimmed)) {
    return false;
  }
  return true;
}

/** Warm PDP/cart stock copy — no "biến thể" / "tồn kho" jargon. */
export const STOCK_OUT_MESSAGE =
  "Lựa chọn này tạm hết hàng — bạn thử chọn tuỳ chọn khác hoặc quay lại sau nhé.";

export function stockMessageFor(haystack: string): string {
  const m =
    haystack.match(/còn\s*:?\s*(\d+)/i) ??
    haystack.match(/\bcon\b\s*:?\s*(\d+)/i) ??
    haystack.match(/remaining\D*(\d+)/i) ??
    haystack.match(/available\D*(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isSafeInteger(n) && n > 0) {
      return `Chỉ còn ${n} sản phẩm cho lựa chọn này — bạn giảm số lượng rồi thử lại nhé.`;
    }
  }
  return STOCK_OUT_MESSAGE;
}

export function formatCommerceUpstreamError(
  status: number,
  payload: { code?: unknown; message?: unknown; errors?: unknown } | null,
  safeErrors = false,
  businessErrors = false,
): { status: number; body: { success: false; code: number | string; message: string; errors?: Array<{ field: string; reason: string }>; result: null } } {
  let code: number | string = status;
  let upstreamMessage = "";
  let errors: Array<{ field: string; reason: string }> | undefined;
  if (payload && typeof payload === "object") {
    if (typeof payload.code === "number" && Number.isSafeInteger(payload.code)) code = payload.code;
    if (typeof payload.message === "string") upstreamMessage = payload.message;
    if (Array.isArray(payload.errors)) {
      errors = payload.errors.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        return typeof item.field === "string" && typeof item.reason === "string" ? [{ field: item.field, reason: item.reason }] : [];
      });
    }
  }

  const messages: Record<number, string> = {
    4101: "Mã voucher không tồn tại.", 4102: "Chiến dịch hoặc mã voucher đang tạm dừng.",
    4103: "Voucher chưa đến thời gian sử dụng.", 4104: "Voucher đã hết hạn.",
    4105: "Voucher đã hết lượt sử dụng.", 4106: "Voucher không áp dụng cho giỏ hàng này.",
    4107: "Giá hoặc ưu đãi đã thay đổi. Hãy báo giá lại trước khi đặt hàng.",
    4108: "Yêu cầu đặt hàng đã thay đổi. Hãy tải lại giỏ hàng.",
    4109: "Chiến dịch đã được cập nhật. Hãy tải lại trước khi sửa tiếp.",
    4202: "Chưa có chính sách điểm để đổi.",
    4203: "Chính sách điểm đang tắt; số dư vẫn được giữ.",
    4204: "Điểm vượt quá số dư hoặc mức giảm tối đa hiện tại.",
    4205: "Số dư khách đã được ghi nhận mở đầu trước đó.",
    4206: "Chính sách đã đổi. Tải lại rồi thử lại.",
    4207: "Ngưỡng hạng đã đổi. Tải lại rồi thử lại.",
    4208: "Trạng thái điểm đã thay đổi đồng thời. Tải lại báo giá.",
  };

  let message = typeof code === "number" && messages[code] ? messages[code] : "";
  if (!message && upstreamMessage) {
    if (/insufficient.*stock|hết hàng|tồn kho/i.test(upstreamMessage)) {
      message = stockMessageFor(upstreamMessage);
    } else if (/cart.*empty|giỏ hàng.*trống/i.test(upstreamMessage)) {
      message = "Giỏ hàng hiện đang trống.";
    } else if (/access denied|forbidden|không có quyền|permission/i.test(upstreamMessage)) {
      message = "Tài khoản không có quyền thực hiện thao tác này.";
    } else if (/unauthenticated|unauthorized|hết phiên|chưa đăng nhập/i.test(upstreamMessage)) {
      message = "Vui lòng đăng nhập lại để tiếp tục.";
    } else if (/not found|không tìm thấy/i.test(upstreamMessage)) {
      message = "Không tìm thấy dữ liệu yêu cầu.";
    } else if (/already paid|đã thanh toán/i.test(upstreamMessage)) {
      message = "Đơn hàng đã được thanh toán.";
    } else if (/invoice before completion/i.test(upstreamMessage)) {
      message = "Đơn hàng cần được ghi nhận thu tiền (hóa đơn) trước khi hoàn tất.";
    }
  }

  if (!message && errors?.length) {
    for (const err of errors) {
      if (/insufficient.*stock|hết hàng|tồn kho/i.test(err.reason)) {
        message = stockMessageFor(errors.map((e) => e.reason).join(" ") + " " + upstreamMessage);
        break;
      } else if (/cart.*empty|giỏ hàng.*trống/i.test(err.reason)) {
        message = "Giỏ hàng hiện đang trống.";
        break;
      } else if (/access denied|forbidden|không có quyền|permission/i.test(err.reason)) {
        message = "Tài khoản không có quyền thực hiện thao tác này.";
        break;
      } else if (/not found|không tìm thấy/i.test(err.reason)) {
        message = "Không tìm thấy dữ liệu yêu cầu.";
        break;
      }
    }
  }

  if (!message) {
    message = status === 401 ? "Vui lòng đăng nhập lại."
      : status === 403 ? "Bạn không có quyền thực hiện thao tác này."
        : status === 404 ? "Không tìm thấy dữ liệu yêu cầu."
          : status === 409 ? "Dữ liệu đã thay đổi. Tải lại rồi thử lại."
            : status >= 500 ? "Dịch vụ đang bận. Thử lại sau."
              : "Yêu cầu chưa thể xử lý. Kiểm tra lại dữ liệu.";
  }

  // Returns sends curated Vietnamese AppException reasons; preserve these for actionable validation.
  if (businessErrors && upstreamMessage && status >= 400 && status !== 500 && status !== 401 && status !== 403)
    message = upstreamMessage;
  const forwardedErrors = safeErrors ? undefined : (errors?.length ? errors : undefined);
  return {
    status,
    body: {
      success: false,
      code,
      message,
      ...(forwardedErrors ? { errors: forwardedErrors } : {}),
      result: null,
    },
  };
}

export class CommerceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code = "COMMERCE_ERROR") {
    super(message);
    this.name = "CommerceError";
    this.status = status;
    this.code = code;
  }
}

const INVALID = "Dữ liệu máy chủ trả về không đúng định dạng. Thử lại.";
const finite = (v: unknown, min = 0): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) throw new CommerceError(INVALID, 502);
  return v;
};
const integer = (v: unknown, min = 0): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min) throw new CommerceError(INVALID, 502);
  return v;
};
const text = (v: unknown): string | null => typeof v === "string" ? v : null;

function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new CommerceError(INVALID, 502);
  return v as Record<string, unknown>;
}

function normalizeItem(raw: unknown): CustomerCartItem {
  const v = record(raw);
  return {
    skuId: integer(v.skuId, 1), productName: typeof v.productName === "string" ? v.productName : "",
    color: text(v.color), size: text(v.size), barcode: text(v.barcode), imageUrl: text(v.imageUrl),
    unitPrice: finite(v.unitPrice), quantity: integer(v.quantity, 1), totalPrice: finite(v.totalPrice),
  };
}

export function normalizeCart(raw: unknown): CustomerCart {
  const v = record(raw);
  if (!Array.isArray(v.items)) throw new CommerceError(INVALID, 502);
  return {
    cartId: integer(v.cartId, 1), totalItems: integer(v.totalItems, 0), subTotal: finite(v.subTotal),
    items: v.items.map(normalizeItem),
  };
}

export function normalizeOrder(raw: unknown): CustomerOrder {
  const v = record(raw);
  const voucherId = v.voucherId === null || v.voucherId === undefined ? null : integer(v.voucherId, 1);
  const voucherCode = text(v.voucherCode);
  const voucherCampaignName = text(v.voucherCampaignName);
  const voucherCampaignVersion = v.voucherCampaignVersion === null || v.voucherCampaignVersion === undefined ? null : integer(v.voucherCampaignVersion, 0);
  const legacyVoucherReference = voucherId !== null
    && (v.voucherCode === null || v.voucherCode === undefined)
    && v.discountAmount !== null && v.discountAmount !== undefined;
  if ((voucherCode && (!voucherId || !voucherCampaignName || voucherCampaignVersion === null || v.discountAmount === undefined || v.discountAmount === null)) || (voucherId !== null && !voucherCode && !legacyVoucherReference)) throw new CommerceError(INVALID, 502);
  return {
    orderId: integer(v.orderId, 1), orderCode: typeof v.orderCode === "string" ? v.orderCode : "",
    status: typeof v.status === "string" ? v.status : "", customerName: text(v.customerName),
    customerPhone: text(v.customerPhone), deliveryAddress: text(v.deliveryAddress),
    subTotal: finite(v.subTotal), discountAmount: finite(v.discountAmount ?? 0), shippingFee: finite(v.shippingFee ?? 0),
    totalAmount: finite(v.totalAmount), voucherId, voucherCode, voucherCampaignName, voucherCampaignVersion,
    redeemedPoints: v.redeemedPoints === null || v.redeemedPoints === undefined ? null : integer(v.redeemedPoints),
    pointsDiscount: v.pointsDiscount === null || v.pointsDiscount === undefined ? null : finite(v.pointsDiscount),
    loyaltyPolicyId: v.loyaltyPolicyId === null || v.loyaltyPolicyId === undefined ? null : integer(v.loyaltyPolicyId, 1),
    loyaltyPolicyVersion: v.loyaltyPolicyVersion === null || v.loyaltyPolicyVersion === undefined ? null : integer(v.loyaltyPolicyVersion, 1),
    redeemCurrencyPerPointSnapshot: v.redeemCurrencyPerPointSnapshot === null || v.redeemCurrencyPerPointSnapshot === undefined ? null : finite(v.redeemCurrencyPerPointSnapshot),
    earnedPoints: v.earnedPoints === null || v.earnedPoints === undefined ? null : integer(v.earnedPoints),
    replayed: v.replayed === true, createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
  };
}

export function normalizeCheckoutOrder(raw: unknown, requestedVoucherCode?: string): CustomerOrder {
  const order = normalizeOrder(raw);
  const code = requestedVoucherCode?.trim().toUpperCase();
  if (code && (order.voucherId === null || order.voucherCode?.trim().toUpperCase() !== code || !order.voucherCampaignName || order.voucherCampaignVersion === null)) throw new CommerceError(INVALID, 502);
  // ID-only voucher compatibility is for persisted reads, never a new checkout response.
  if (!code && (order.voucherId !== null || order.voucherCode !== null || order.voucherCampaignName !== null || order.voucherCampaignVersion !== null)) throw new CommerceError(INVALID, 502);
  return order;
}

export function normalizeCartQuote(raw: unknown): CustomerCartQuote {
  const v = record(raw);
  if (!Array.isArray(v.items) || (v.voucherCode !== null && typeof v.voucherCode !== "string")
    || typeof v.quoteFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(v.quoteFingerprint)
    || !["UNCONFIGURED", "DISABLED", "ENABLED"].includes(String(v.policyStatus))) throw new CommerceError(INVALID, 502);
  const quote = {
    items: v.items.map((rawItem) => {
      const item = record(rawItem);
      return { skuId: integer(item.skuId, 1), productName: typeof item.productName === "string" ? item.productName : "", quantity: integer(item.quantity, 1), unitPrice: finite(item.unitPrice), totalPrice: finite(item.totalPrice), discountAmount: finite(item.discountAmount), pointsDiscountAmount: finite(item.pointsDiscountAmount) };
    }),
    freeShipping: v.freeShipping === true, subTotal: finite(v.subTotal), voucherCode: text(v.voucherCode), voucherDiscount: finite(v.voucherDiscount),
    remainingMerchandiseAmount: finite(v.remainingMerchandiseAmount), redeemedPoints: integer(v.redeemedPoints),
    pointsDiscount: finite(v.pointsDiscount), allowedRedeemedPoints: integer(v.allowedRedeemedPoints),
    availablePoints: v.availablePoints === null ? null : integer(v.availablePoints),
    policyStatus: v.policyStatus as CustomerCartQuote["policyStatus"],
    loyaltyPolicyId: v.loyaltyPolicyId === null ? null : integer(v.loyaltyPolicyId, 1),
    loyaltyPolicyVersion: v.loyaltyPolicyVersion === null ? null : integer(v.loyaltyPolicyVersion, 1),
    redeemCurrencyPerPoint: v.redeemCurrencyPerPoint === null ? null : finite(v.redeemCurrencyPerPoint),
    merchandiseAmountDue: finite(v.merchandiseAmountDue), quoteFingerprint: v.quoteFingerprint,
  };
  if (Math.abs(quote.remainingMerchandiseAmount - (quote.subTotal - quote.voucherDiscount)) > 0.01
    || Math.abs(quote.merchandiseAmountDue - (quote.remainingMerchandiseAmount - quote.pointsDiscount)) > 0.01
    || quote.pointsDiscount > quote.remainingMerchandiseAmount) throw new CommerceError(INVALID, 502);
  return quote;
}

export function normalizeOrderDetail(raw: unknown): CustomerOrderDetail {
  const base = normalizeOrder(raw);
  const v = record(raw);
  if (!Array.isArray(v.items)) throw new CommerceError(INVALID, 502);
  const c = v.customer === null || v.customer === undefined ? null : record(v.customer);
  const paymentStatus = typeof v.paymentStatus === "string" ? v.paymentStatus : null;
  const paymentMethod = typeof v.paymentMethod === "string" ? v.paymentMethod : null;
  return {
    ...base,
    note: text(v.note),
    paymentStatus,
    paymentMethod,
    paidAmount: v.paidAmount == null ? null : finite(v.paidAmount),
    refundedAmount: v.refundedAmount == null ? null : finite(v.refundedAmount),
    customer: c ? { customerId: integer(c.customerId, 1), fullName: text(c.fullName), phoneNumber: text(c.phoneNumber) } : null,
    items: v.items.map((x) => {
      const i = record(x);
      if (base.voucherCode && (i.discountAmount === undefined || i.discountAmount === null)) throw new CommerceError(INVALID, 502);
      return { skuId: integer(i.skuId, 1), productName: typeof i.productName === "string" ? i.productName : "", color: text(i.color), size: text(i.size), imageUrl: sameOriginProductImage(text(i.imageUrl)), quantity: integer(i.quantity, 1), unitPrice: finite(i.unitPrice), totalPrice: finite(i.totalPrice), discountAmount: finite(i.discountAmount ?? 0), pointsDiscountAmount: i.pointsDiscountAmount === null || i.pointsDiscountAmount === undefined ? null : finite(i.pointsDiscountAmount) };
    }),
  };
}

export function normalizeOrderPage(raw: unknown): CustomerOrderPage {
  const v = record(raw);
  if (!Array.isArray(v.content)) throw new CommerceError(INVALID, 502);
  return {
    items: v.content.map(normalizeOrder), page: integer(v.pageNumber, 0), size: integer(v.pageSize, 1),
    totalElements: integer(v.totalElements, 0), totalPages: integer(v.totalPages, 0), isLast: v.last === true,
  };
}

export function normalizeShipping(raw: unknown): ShippingQuote {
  const v = record(raw);
  return { shippingFee: finite(v.shippingFee), estimatedDays: typeof v.estimatedDays === "string" ? v.estimatedDays : "", distanceKm: v.distanceKm == null ? null : finite(v.distanceKm), method: typeof v.method === "string" ? v.method : "flat", baseFee: v.baseFee == null ? finite(v.shippingFee) : finite(v.baseFee), shippingDiscount: finite(v.shippingDiscount ?? 0) };
}

/** BE trả path ảnh dạng /api/v1/products/images/<file>; FE chỉ phục vụ qua BFF catalog. */
function sameOriginProductImage(raw: string | null): string | null {
  const m = raw?.match(/^\/api\/v1\/products\/images\/(.+)$/);
  return m ? `/api/catalog/product-images/${m[1]}` : raw;
}

/** Tiền cho khách: một kiểu duy nhất "1.450.000đ" (không dấu cách). */
export function formatMoney(value: number): string {
  return Number.isFinite(value) ? `${value.toLocaleString("vi-VN")}đ` : "—";
}

export function orderStatusText(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Chờ xác nhận", CONFIRMED: "Đã xác nhận", PACKING: "Đang đóng gói",
    SHIPPING: "Đang giao", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy", RETURNED: "Đã trả lại",
  };
  return labels[status] ?? status;
}

export function orderStatusTone(status: string): string {
  if (status === "CANCELLED" || status === "RETURNED") return "cancelled";
  if (status === "COMPLETED") return "delivered";
  if (status === "SHIPPING") return "shipping";
  return "pending";
}

export type PaymentAttempt = {
  id: number; orderId: number; provider: string; status: string;
  amount: number; currency: string; checkoutUrl: string | null;
  createdAt: string; expiresAt: string | null;
};

export function normalizePaymentAttempt(raw: unknown): PaymentAttempt {
  const v = record(raw);
  const checkoutUrl = text(v.checkoutUrl);
  if (checkoutUrl !== null && !/^https:\/\//.test(checkoutUrl)) throw new CommerceError(INVALID, 502);
  return {
    id: integer(v.id, 1), orderId: integer(v.orderId, 1),
    provider: typeof v.provider === "string" ? v.provider : "",
    status: typeof v.status === "string" ? v.status : "",
    amount: finite(v.amount), currency: typeof v.currency === "string" ? v.currency : "",
    checkoutUrl, createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
    expiresAt: text(v.expiresAt),
  };
}

// Provider checkout returns only { attemptId, checkoutUrl }; the attempt read returns the
// full record. Keep them separate so a checkout response is never parsed as an attempt.
export type ProviderCheckout = { attemptId: number; checkoutUrl: string };

export function normalizeProviderCheckout(raw: unknown): ProviderCheckout {
  const v = record(raw);
  const checkoutUrl = text(v.checkoutUrl);
  if (checkoutUrl === null || !/^https:\/\//.test(checkoutUrl)) throw new CommerceError(INVALID, 502);
  return { attemptId: integer(v.attemptId, 1), checkoutUrl };
}

export function paymentAttemptStatusText(status: string): string {
  const labels: Record<string, string> = {
    CREATED: "Đã tạo, chờ thanh toán", PENDING: "Đang chờ thanh toán",
    SETTLEMENT_PENDING: "Đã trả tiền, đang đối soát", SETTLED: "Đã thanh toán",
    FAILED: "Thanh toán thất bại", CANCELLED: "Đã hủy thanh toán",
    EXPIRED: "Phiên thanh toán hết hạn", REVIEW_REQUIRED: "Cần đối soát thủ công",
  };
  return labels[status] ?? status;
}
