"use client";
import { useState } from "react";
import { notificationApi, type FavoriteAlert } from "@/lib/notification-client";
import "./notifications.css";

export function FavoriteAlertToggles({ value, onChange }: { value: FavoriteAlert; onChange: (value: FavoriteAlert) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(field: "stockAlert" | "priceAlert", checked: boolean) {
    setBusy(true); setError("");
    const next = { ...value, [field]: checked };
    onChange(next);
    try {
      await notificationApi(`/api/customer-account/notifications/favorites/${value.productId}`, { stockAlert: next.stockAlert, priceAlert: next.priceAlert });
      onChange(next);
    } catch (e) { onChange(value); setError(e instanceof Error ? e.message : "Không lưu được cảnh báo."); }
    finally { setBusy(false); }
  }
  return <div className="favorite-notification-options" aria-label="Cảnh báo sản phẩm yêu thích" aria-busy={busy}>
    {value.availableStock <= 0 || value.stockAlert ? <label className="customer-notification-toggle"><input type="checkbox" checked={value.stockAlert} disabled={busy} onChange={(e) => void change("stockAlert", e.target.checked)} />Báo khi có hàng</label> : null}
    <label className="customer-notification-toggle"><input type="checkbox" checked={value.priceAlert} disabled={busy} onChange={(e) => void change("priceAlert", e.target.checked)} />Báo khi giảm giá</label>
    {error ? <p className="customer-notification-error" role="alert">{error}</p> : null}
  </div>;
}
