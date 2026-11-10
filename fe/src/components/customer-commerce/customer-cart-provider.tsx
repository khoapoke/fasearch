"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { CustomerCart } from "@/lib/customer-commerce";
import { fetchCustomerCart } from "@/lib/customer-commerce-client";

// A tiny browser store is used instead of React context because the header and
// route-level client chunks can be split by Turbopack; both must observe the
// exact same server-cart state. The token still never enters the browser.
type CartState = {
  cart: CustomerCart | null;
  loading: boolean;
  error: string;
  authState: "checking" | "authenticated" | "guest" | "error";
};

const EVENT = "fasearch-customer-cart-state";
const KEY = "__fasearchCustomerCartState";
const EMPTY: CartState = { cart: null, loading: true, error: "", authState: "checking" };

type GlobalCart = typeof globalThis & { [KEY]?: CartState };
function current(): CartState {
  if (typeof window === "undefined") return EMPTY;
  return (window as GlobalCart)[KEY] ?? EMPTY;
}
function publish(next: CartState) {
  if (typeof window === "undefined") return;
  (window as GlobalCart)[KEY] = next;
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
export function setCustomerCart(cart: CustomerCart | null) {
  const state = current();
  publish({ ...state, cart, loading: false, error: "", authState: cart ? "authenticated" : "guest" });
}
export async function refreshCustomerCart(signal?: AbortSignal) {
  const before = current();
  publish({ ...before, loading: true, error: "" });
  try {
    const cart = await fetchCustomerCart(signal);
    if (!signal?.aborted) publish({ cart, loading: false, error: "", authState: "authenticated" });
  } catch (failure) {
    if (signal?.aborted) return;
    const status = (failure as { status?: number })?.status ?? 0;
    if (status === 401) publish({ cart: null, loading: false, error: "", authState: "guest" });
    else publish({ cart: null, loading: false, error: failure instanceof Error ? failure.message : "Không tải được giỏ hàng.", authState: "error" });
  }
}

export function useCustomerCart() {
  const state = useSyncExternalStore(subscribe, current, () => EMPTY);
  const refresh = useCallback(async (signal?: AbortSignal) => refreshCustomerCart(signal), []);
  const setCart = useCallback((cart: CustomerCart | null) => setCustomerCart(cart), []);
  return { ...state, refresh, setCart };
}

export function CustomerCartProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => refreshCustomerCart(controller.signal));
    return () => controller.abort();
  }, []);
  return <>{children}</>;
}
