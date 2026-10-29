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
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) throw new CommerceError(INVALID, 502);
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
  return {
    orderId: integer(v.orderId, 1), orderCode: typeof v.orderCode === "string" ? v.orderCode : "",
    status: typeof v.status === "string" ? v.status : "", customerName: text(v.customerName),
    customerPhone: text(v.customerPhone), deliveryAddress: text(v.deliveryAddress),
    subTotal: finite(v.subTotal), discountAmount: finite(v.discountAmount ?? 0), shippingFee: finite(v.shippingFee ?? 0),
    totalAmount: finite(v.totalAmount), createdAt: typeof v.createdAt === "string" ? v.createdAt : "",
  };
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
      return { skuId: integer(i.skuId, 1), productName: typeof i.productName === "string" ? i.productName : "", color: text(i.color), size: text(i.size), imageUrl: text(i.imageUrl), quantity: integer(i.quantity, 1), unitPrice: finite(i.unitPrice), totalPrice: finite(i.totalPrice) };
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
