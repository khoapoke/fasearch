"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthIdentity } from "@/lib/customer-auth-client";
import { hasPermission } from "@/lib/admin-roles";
import { notificationApi, type BellResult } from "@/lib/notification-client";
import "./n1.css";

export function NotificationBell({ identity }: { identity: AuthIdentity }) {
  const [data, setData] = useState<BellResult | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const allowed = ["ORDER_VIEW", "RETURN_VIEW", "INVENTORY_VIEW"] as const;
  const permitted = allowed.some((permission) => hasPermission(identity.role, identity.permissions, permission));
  const load = useCallback(async (signal?: AbortSignal) => {
    try { setData(await notificationApi<BellResult>("/api/admin/notifications", undefined, "POST", signal)); setError(""); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Không tải được thông báo."); }
  }, []);
  useEffect(() => {
    if (!permitted) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial external read and polling subscription
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 30_000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [permitted, load]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function read(id: number) {
    setBusy(id);
    try { await notificationApi(`/api/admin/notifications/${id}/read`, {}, "POST"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Không đánh dấu được thông báo."); }
    finally { setBusy(null); }
  }
  if (!permitted) return null;
  const items = data?.items.filter((item) => hasPermission(identity.role, identity.permissions, item.permission)) ?? [];
  return <div className="n1-bell" ref={root}>
    <button ref={button} className="icon-btn n1-bell-button" type="button" aria-label={`Thông báo${data ? `, ${data.unreadCount} chưa đọc` : ""}`} aria-expanded={open} aria-controls="admin-notification-list" onClick={() => { setOpen((v) => !v); if (!open) void load(); }}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {data && data.unreadCount > 0 ? <span className="n1-bell-count">{data.unreadCount > 99 ? "99+" : data.unreadCount}</span> : null}
    </button>
    {open ? <section className="n1-dropdown" id="admin-notification-list" aria-label="Thông báo quản trị">
      <div className="n1-dropdown-head"><h2>Thông báo</h2><span>{data?.unreadCount ?? "…"} chưa đọc</span></div>
      {error ? <div className="n1-message" role="alert">{error} <button className="text-link" type="button" onClick={() => void load()}>Thử lại</button></div> : null}
      {!data && !error ? <p className="n1-message" role="status">Đang tải thông báo…</p> : null}
      {data && !items.length ? <p className="n1-message">Chưa có thông báo.</p> : null}
      <ul>{items.map((item) => <li key={item.id} className={item.read ? "" : "n1-unread"}>
        <a href={item.href} onClick={async (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (!item.read) await read(item.id);
          setOpen(false);
          // A document navigation also reopens a return whose detail modal was already closed.
          window.location.assign(item.href);
        }}>{item.title}<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></a>
        {!item.read ? <button className="text-link" type="button" disabled={busy === item.id} onClick={() => void read(item.id)}>{busy === item.id ? "Đang lưu…" : "Đánh dấu đã đọc"}</button> : <span className="n1-read-label">Đã đọc</span>}
      </li>)}</ul>
    </section> : null}
  </div>;
}
