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
  items: CartQuoteLine[]; subTotal: number; voucherCode: string | null; voucherDiscount: number;
  remainingMerchandiseAmount: number; redeemedPoints: number; pointsDiscount: number; allowedRedeemedPoints: number;
  availablePoints: number | null; policyStatus: "UNCONFIGURED" | "DISABLED" | "ENABLED";
  loyaltyPolicyId: number | null; loyaltyPolicyVersion: number | null; redeemCurrencyPerPoint: number | null;
  merchandiseAmountDue: number; quoteFingerprint: string;
};

export type CustomerOrderDetail = CustomerOrder & {
  note: string | null;
  customer: { customerId: number; fullName: string | null; phoneNumber: string | null } | null;
  items: CustomerOrderItem[];
};

export type CustomerOrderPage = {
  items: CustomerOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  isLast: boolean;
};

export type ShippingQuote = { shippingFee: number; estimatedDays: string };

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
    subTotal: finite(v.subTotal), voucherCode: text(v.voucherCode), voucherDiscount: finite(v.voucherDiscount),
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
  return {
    ...base,
    note: text(v.note),
    customer: c ? { customerId: integer(c.customerId, 1), fullName: text(c.fullName), phoneNumber: text(c.phoneNumber) } : null,
    items: v.items.map((x) => {
      const i = record(x);
      if (base.voucherCode && (i.discountAmount === undefined || i.discountAmount === null)) throw new CommerceError(INVALID, 502);
      return { skuId: integer(i.skuId, 1), productName: typeof i.productName === "string" ? i.productName : "", color: text(i.color), size: text(i.size), imageUrl: text(i.imageUrl), quantity: integer(i.quantity, 1), unitPrice: finite(i.unitPrice), totalPrice: finite(i.totalPrice), discountAmount: finite(i.discountAmount ?? 0), pointsDiscountAmount: i.pointsDiscountAmount === null || i.pointsDiscountAmount === undefined ? null : finite(i.pointsDiscountAmount) };
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
  return { shippingFee: finite(v.shippingFee), estimatedDays: typeof v.estimatedDays === "string" ? v.estimatedDays : "" };
}

export function formatMoney(value: number): string {
  return Number.isFinite(value) ? `${value.toLocaleString("vi-VN")}₫` : "—";
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
