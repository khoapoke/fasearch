"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";

export function cartKey() {
  return "fasearch-cart-v1";
}

export type CartItem = { id: number; name: string; price: number; image?: string; qty: number; meta?: string };

export function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(cartKey());
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(cartKey(), JSON.stringify(items));
  cartCache = items;
  window.dispatchEvent(new CustomEvent("fasearch-cart", { detail: items.length }));
}

export function favKey() {
  return "fasearch-favs-v1";
}

// Favorite keys: `sp:<maSp>` for real catalog products, `look:<index>`
// for Stitch lookbook illustrations. Stored as strings; legacy numeric
// entries (batch-1 dev builds) are migrated to `sp:<id>`.
export function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(favKey());
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => (typeof v === "number" ? `sp:${v}` : String(v)));
  } catch {
    return [];
  }
}

export function toggleFav(id: string): boolean {
  const favs = readFavs();
  const i = favs.indexOf(id);
  const loved = i < 0;
  if (loved) favs.push(id);
  else favs.splice(i, 1);
  localStorage.setItem(favKey(), JSON.stringify(favs));
  favsCache = favs;
  window.dispatchEvent(new CustomEvent("fasearch-favs", { detail: favs }));
  return loved;
}

// Stable external-store snapshots: getSnapshot must return a cached
// reference, otherwise useSyncExternalStore re-renders in an infinite loop.
let cartCache: CartItem[] | null = null;
const EMPTY_CART: CartItem[] = [];

function cartSnapshot(): CartItem[] {
  if (!cartCache) cartCache = readCart();
  return cartCache;
}

function subscribeCart(notify: () => void) {
  const onChange = () => {
    cartCache = null;
    notify();
  };
  window.addEventListener("fasearch-cart", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("fasearch-cart", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(subscribeCart, cartSnapshot, () => EMPTY_CART);
}

let favsCache: string[] | null = null;
const EMPTY_FAVS: string[] = [];

function favsSnapshot(): string[] {
  if (!favsCache) favsCache = readFavs();
  return favsCache;
}

export function useFavs(): string[] {
  return useSyncExternalStore(
    (notify) => {
      const onChange = () => {
        favsCache = null;
        notify();
      };
      window.addEventListener("fasearch-favs", onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener("fasearch-favs", onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    favsSnapshot,
    () => EMPTY_FAVS,
  );
}

export function CartCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => setCount(readCart().reduce((n, i) => n + (i.qty || 0), 0));
    sync();
    window.addEventListener("fasearch-cart", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("fasearch-cart", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  if (!count) return null;
  return <span className="sfBadge">{count > 99 ? "99+" : count}</span>;
}

export function HeaderAccount() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => {
        if (live) setMe(identity);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <Link className="sfAccountLink" href="/tai-khoan">
      <span className="sfAvatar" aria-hidden="true">
        {me ? (me.username.slice(0, 1).toUpperCase()) : <Icon name="user" size={17} />}
      </span>
      <span>{me ? me.username : "Tài Khoản"}</span>
    </Link>
  );
}
