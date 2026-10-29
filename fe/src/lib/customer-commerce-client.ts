import {
  CommerceError, normalizeCart, normalizeOrderDetail, normalizeOrderPage,
  normalizeShipping, normalizeOrder, type CustomerCart, type CustomerOrder,
  type CustomerOrderDetail, type CustomerOrderPage, type ShippingQuote,
} from "./customer-commerce";

async function read<T>(response: Response, normalize: (raw: unknown) => T): Promise<T> {
  let body: { success?: boolean; message?: string; code?: string; result?: unknown } | null = null;
  try { body = await response.json(); } catch { /* non-json */ }
  if (!response.ok || body?.success !== true || body.result === undefined) {
    throw new CommerceError(body?.message || "Không thể kết nối máy chủ giỏ hàng.", response.status || 502, body?.code);
  }
  return normalize(body.result);
}

async function call<T>(url: string, init: RequestInit, normalize: (raw: unknown) => T): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return read(response, normalize);
}

export const fetchCustomerCart = (signal?: AbortSignal): Promise<CustomerCart> =>
  call("/api/customer-commerce/cart", { method: "GET", signal }, normalizeCart);

export const addCustomerCartItem = (skuId: number, quantity: number, signal?: AbortSignal): Promise<CustomerCart> =>
  call("/api/customer-commerce/cart/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ skuId, quantity }), signal }, normalizeCart);

export const updateCustomerCartItem = (skuId: number, quantity: number, signal?: AbortSignal): Promise<CustomerCart> =>
  call(`/api/customer-commerce/cart/items/${skuId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ quantity }), signal }, normalizeCart);

export const removeCustomerCartItem = (skuId: number, signal?: AbortSignal): Promise<CustomerCart> =>
  call(`/api/customer-commerce/cart/items/${skuId}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}", signal }, normalizeCart);

export async function clearCustomerCart(signal?: AbortSignal): Promise<void> {
  const response = await fetch("/api/customer-commerce/cart", { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store", signal });
  if (response.ok) return;
  let body: { message?: string } | null = null;
  try { body = await response.json(); } catch { /* non-json */ }
  throw new CommerceError(body?.message || "Không xóa được giỏ hàng.", response.status || 502);
}

export const fetchShippingQuote = (province: string, district: string, totalWeightGram: number, signal?: AbortSignal): Promise<ShippingQuote> =>
  call("/api/customer-commerce/shipping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ province, district, totalWeightGram }), signal }, normalizeShipping);

export type CheckoutInput = { deliveryAddress: string; receiverName: string; receiverPhone: string; paymentMethod: string; shippingFee: number; note?: string };
export const createCustomerOrder = (input: CheckoutInput, signal?: AbortSignal): Promise<CustomerOrder> =>
  call("/api/customer-commerce/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal }, normalizeOrder);

export const fetchCustomerOrders = (query: string, signal?: AbortSignal): Promise<CustomerOrderPage> =>
  call(`/api/customer-commerce/orders?${query}`, { method: "GET", signal }, normalizeOrderPage);

export const fetchCustomerOrder = (id: string, signal?: AbortSignal): Promise<CustomerOrderDetail> =>
  call(`/api/customer-commerce/orders/${encodeURIComponent(id)}`, { method: "GET", signal }, normalizeOrderDetail);

export const cancelCustomerOrder = (id: string, reason: string, signal?: AbortSignal): Promise<CustomerOrderDetail> =>
  call(`/api/customer-commerce/orders/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }), signal }, normalizeOrderDetail);
