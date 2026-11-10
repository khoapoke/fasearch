"use client";

import { createPortal } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; message: string; leaving: boolean };
export type ToastApi = { success: (message: string) => void; error: (message: string) => void };

const NOOP: ToastApi = { success: () => {}, error: () => {} };
const ToastContext = createContext<ToastApi>(NOOP);

/** `const toast = useToast(); toast.success("Đã lưu")`. Safe outside the provider (does nothing). */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const LIFE = { success: 4000, error: 8000 } as const;
const EXIT_MS = 120;

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef<number>(LIFE[item.kind]);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (paused || item.leaving) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.id, item.leaving, onDismiss]);

  return (
    <div
      className={`toast ${item.kind}${item.leaving ? " leaving" : ""}`}
      role={item.kind === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon name={item.kind === "success" ? "check" : "circle-alert"} size={18} />
      <p>{item.message}</p>
      <button className="toast-close" type="button" aria-label="Đóng thông báo" onClick={() => onDismiss(item.id)}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    if (!message) return;
    const id = nextId.current++;
    setItems((list) => [...list.slice(-3), { id, kind, message, leaving: false }]);
  }, []);

  // A modal dialog makes everything outside itself inert, even the top layer. So while a modal is open
  // the toast stack is rendered inside the newest open dialog, and goes back to the page when it closes.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let open: HTMLDialogElement[] = Array.from(document.querySelectorAll<HTMLDialogElement>("dialog[open]"));
    const sync = () => setHost(open.length ? open[open.length - 1] : null);
    sync();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (record.type !== "attributes" || !(target instanceof HTMLDialogElement)) continue;
        const index = open.indexOf(target);
        if (target.open && index < 0) open.push(target);
        else if (!target.open && index >= 0) open.splice(index, 1);
      }
      // A dialog unmounted while open (delete, then redirect) never loses its `open` attribute.
      open = open.filter((dialog) => dialog.isConnected);
      sync();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["open"], childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const stack = useRef<HTMLDivElement>(null);
  // Top layer popover: toasts stay above everything on the page and above the dialog that hosts them.
  useEffect(() => {
    const el = stack.current;
    if (!el || !el.isConnected || typeof el.showPopover !== "function") return;
    if (items.length === 0) { if (el.matches(":popover-open")) el.hidePopover(); return; }
    if (el.matches(":popover-open")) el.hidePopover();
    el.showPopover();
  }, [items.length, host]);

  const api = useMemo<ToastApi>(() => ({ success: (m) => push("success", m), error: (m) => push("error", m) }), [push]);

  const stackEl = (
    <div ref={stack} popover="manual" className="toast-stack" aria-label="Thông báo">
      {items.map((item) => <ToastCard key={item.id} item={item} onDismiss={dismiss} />)}
    </div>
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      {host ? createPortal(stackEl, host) : stackEl}
    </ToastContext.Provider>
  );
}
