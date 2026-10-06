"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { fetchCsrf } from "@/components/account/account-session";
import { validProductId } from "@/lib/library-contract";
import styles from "./save-button.module.css";

// Shared own-library client store: one login probe + one saved-id snapshot
// per page lifetime; every SaveButton subscribes and re-renders together.
// The backend stays authoritative — this is only a read-through cache that is
// rolled back visibly on any failed mutation.

type Snapshot = {
  checked: boolean;
  loggedIn: boolean;
  saved: Set<string>;
  version: number;
};

let snapshot: Snapshot = { checked: false, loggedIn: false, saved: new Set(), version: 0 };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...snapshot, version: snapshot.version + 1 };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

let inflight: Promise<void> | null = null;

export function refreshLibraryStore(): Promise<void> {
  if (!inflight) {
    inflight = (async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (!me.ok) {
          snapshot = { ...snapshot, checked: true, loggedIn: false, saved: new Set() };
          return;
        }
        const listed = await fetch("/api/me/saved-products?size=100", { cache: "no-store" });
        const saved = new Set<string>();
        if (listed.ok) {
          const payload = (await listed.json()) as { items?: Array<{ product_id: string }> };
          for (const item of payload.items ?? []) saved.add(item.product_id);
        }
        snapshot = { ...snapshot, checked: true, loggedIn: true, saved };
      } finally {
        inflight = null;
        emit();
      }
    })();
  }
  return inflight;
}

export function useLibraryStore(): Snapshot {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!current.checked) void refreshLibraryStore();
  }, [current.checked]);
  return current;
}

async function mutateSave(productId: string, save: boolean): Promise<boolean> {
  const csrf = await fetchCsrf();
  const response = await fetch(`/api/me/saved-products/${encodeURIComponent(productId)}`, {
    method: save ? "PUT" : "DELETE",
    headers: { [csrf.header]: csrf.token },
  });
  return response.ok;
}

export function SaveButton({ productId, title }: { productId: string; title: string }) {
  const store = useLibraryStore();

  const saved = store.saved.has(productId);
  const toggle = useCallback(async () => {
    if (!validProductId(productId)) return;
    const next = !snapshot.saved.has(productId);
    const updated = new Set(snapshot.saved);
    if (next) updated.add(productId);
    else updated.delete(productId);
    snapshot = { ...snapshot, saved: updated };
    emit();
    try {
      const ok = await mutateSave(productId, next);
      if (!ok) throw new Error("not ok");
    } catch {
      const rolledBack = new Set(snapshot.saved);
      if (next) rolledBack.delete(productId);
      else rolledBack.add(productId);
      snapshot = { ...snapshot, saved: rolledBack };
      emit();
    }
  }, [productId]);

  if (!store.checked) {
    return (
      <button type="button" className={styles.save} disabled aria-label="Đang kiểm tra phiên lưu">
        <span aria-hidden="true">♡</span>
      </button>
    );
  }
  if (!store.loggedIn) {
    return (
      <Link
        className={styles.loginHint}
        href={`/dang-nhap?next=${encodeURIComponent(`/catalog/${encodeURIComponent(productId)}`)}`}
        aria-label={`Đăng nhập để lưu ${title}`}
        title="Đăng nhập để lưu sản phẩm"
      >
        <span aria-hidden="true">♡</span> Lưu
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={saved ? `${styles.save} ${styles.active}` : styles.save}
      aria-pressed={saved}
      aria-label={saved ? `Bỏ lưu ${title}` : `Lưu ${title}`}
      title={saved ? "Bỏ lưu khỏi thư viện" : "Lưu vào thư viện"}
      onClick={() => void toggle()}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
      <span className={styles.word}>{saved ? "Đã lưu" : "Lưu"}</span>
    </button>
  );
}
