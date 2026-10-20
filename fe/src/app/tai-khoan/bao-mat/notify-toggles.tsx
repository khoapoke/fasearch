"use client";

import { useState } from "react";
import "@/components/ui/switch.css";

// Tùy chọn thông báo lưu trên trình duyệt (máy chủ chưa có API preferences).
// Ghi nhãn minh họa rõ ràng, không giả đồng bộ tài khoản.
const KEYS = [
  { id: "sf-nt-order", label: "Thông báo đơn hàng", desc: "Biến động đơn, giao hàng" },
  { id: "sf-nt-voucher", label: "Khuyến mãi & Voucher", desc: "Mã mới, sắp hết hạn" },
  { id: "sf-nt-ai", label: "Trợ lý AI", desc: "Gợi ý phối đồ, BST mới" },
];

function read(id: string): boolean {
  try {
    return localStorage.getItem(id) !== "off";
  } catch {
    return true;
  }
}

export function NotifyToggles() {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(KEYS.map((k) => [k.id, read(k.id)])),
  );
  function flip(id: string) {
    const next = !state[id];
    try {
      localStorage.setItem(id, next ? "on" : "off");
    } catch {
      /* storage riêng tư */
    }
    setState((prev) => ({ ...prev, [id]: next }));
  }
  return (
    <div>
      <b>Cài đặt thông báo</b>
      <p className="sfIdentitySub" style={{ margin: "6px 0 10px" }}>
        Lưu trên trình duyệt này (minh họa) — máy chủ chưa có API tùy chọn thông báo.
      </p>
      {KEYS.map((k) => (
        <div key={k.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 13.5 }}>{k.label}</b>
            <p className="sfIdentitySub">{k.desc}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state[k.id]}
            aria-label={`${k.label} (lưu trình duyệt)`}
            onClick={() => flip(k.id)}
            className="mpSwitch"
            style={{ background: state[k.id] ? "#f97316" : "#d1d5db" }}
          />
        </div>
      ))}
    </div>
  );
}
