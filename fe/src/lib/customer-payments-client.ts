import {
  normalizePaymentAttempt, normalizeProviderCheckout,
  type PaymentAttempt, type ProviderCheckout,
} from "./customer-commerce.ts";
import { readCommerceResponse } from "./customer-commerce-client.ts";

// Same-origin BFF proxies; provider checkout URLs are validated https-only by the normalizers.
async function postCheckout(path: string, orderId: number, idempotencyKey: string, signal?: AbortSignal): Promise<ProviderCheckout> {
  const response = await fetch(path, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId, idempotencyKey }), cache: "no-store", signal,
  });
  return readCommerceResponse(response, normalizeProviderCheckout);
}

export const createStripeCheckout = (orderId: number, key: string, signal?: AbortSignal): Promise<ProviderCheckout> =>
  postCheckout("/api/customer-commerce/payments/stripe/checkout", orderId, key, signal);

export const createVnpayCheckout = (orderId: number, key: string, signal?: AbortSignal): Promise<ProviderCheckout> =>
  postCheckout("/api/customer-commerce/payments/vnpay/checkout", orderId, key, signal);

export async function fetchPaymentAttempt(id: string, signal?: AbortSignal): Promise<PaymentAttempt> {
  const response = await fetch(`/api/customer-commerce/payments/attempts/${encodeURIComponent(id)}`, { method: "GET", cache: "no-store", signal });
  return readCommerceResponse(response, normalizePaymentAttempt);
}

export type { PaymentAttempt, ProviderCheckout };
