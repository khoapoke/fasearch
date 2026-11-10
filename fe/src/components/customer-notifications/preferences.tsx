"use client";
import { useEffect, useState } from "react";
import { notificationApi, type NotificationPreference } from "@/lib/notification-client";
import ac from "@/components/account/account-cards.module.css";
import "./notifications.css";

export function NotificationPreferences() {
  const [value, setValue] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    notificationApi<NotificationPreference>("/api/customer-account/notifications/preferences", undefined, "PUT", controller.signal)
      .then((result) => { setValue(result.orderUpdates); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Không tải được tùy chọn thông báo."); });
    return () => controller.abort();
  }, [retry]);
  async function change(next: boolean) {
    const previous = value;
    setValue(next); setBusy(true); setError(""); setSaved(false);
    try {
      const result = await notificationApi<NotificationPreference>("/api/customer-account/notifications/preferences", { orderUpdates: next });
      setValue(result.orderUpdates); setSaved(true);
    } catch (e) { setValue(previous); setError(e instanceof Error ? e.message : "Không lưu được tùy chọn thông báo."); }
    finally { setBusy(false); }
  }
  return <section className={ac.card} aria-labelledby="notification-preference-title">
    <div className={ac.head}><h2 className={ac.title} id="notification-preference-title">Thông báo email</h2><p className={ac.lead}>Theo dõi tiến trình giao hàng và xử lý đổi/trả.</p></div>
    <div className={ac.group}>
      <label className="customer-notification-toggle"><input type="checkbox" checked={value === true} disabled={value === null || busy} onChange={(e) => void change(e.target.checked)} />Nhận email cập nhật đơn hàng</label>
      {value === null && !error ? <p className={ac.meta} role="status">Đang tải tùy chọn…</p> : null}
      {busy || saved ? <p className={ac.meta} role="status">{busy ? "Đang lưu…" : "Đã lưu tùy chọn thông báo."}</p> : null}
      {error ? <p className={ac.alert} role="alert">{error} {value === null ? <button type="button" className={ac.secondary} onClick={() => setRetry((n) => n + 1)}>Thử lại</button> : null}</p> : null}
    </div>
  </section>;
}
