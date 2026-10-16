"use client";

import { useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { PREVIEW_VOUCHERS } from "@/lib/preview-data";

function copyCode(code: string, done: (c: string) => void) {
  const t = async () => {
    try {
      await navigator.clipboard.writeText(code);
      done(code);
    } catch {
      done("");
    }
  };
  void t();
}

type Row = { code: string; program: string; level: string; cond: string; used: string; time: string; on: boolean };

const SEED: Row[] = [
  { code: "SALE30-T9", program: "Flash Sale tháng 9 · % theo đơn", level: "30% tối đa 200K", cond: "Đơn từ 499K", used: "1.204 / 2.000", time: "01/09 – 30/09/2026", on: true },
  { code: "FREESHIP20", program: "Miễn phí vận chuyển · Freeship", level: "25K", cond: "Đơn từ 200K", used: "3.877 / 5.000", time: "01/10 – 31/10/2026", on: true },
  { code: "POLO50", program: "Polo & Sơ mi · tiền cố định", level: "50K", cond: "Nhóm Polo/Sơ mi", used: "212 / 1.000", time: "15/09 – 15/10/2026", on: false },
];

export default function MerchantVouchers() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [form, setForm] = useState({ code: "", level: "", cond: "" });
  const [msg, setMsg] = useState("");
  const [find, setFind] = useState("");
  const [tab, setTab] = useState<"all" | "on" | "off">("all");
  const [copied, setCopied] = useState("");
  const shown = rows.filter((r) => (tab === "all" || (tab === "on") === r.on) && (!find.trim() || r.code.includes(find.trim().toUpperCase())));

  function toggle(code: string) {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, on: !r.on } : r)));
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.level.trim()) {
      setMsg("Nhập tối thiểu mã code và mức giảm.");
      return;
    }
    setRows((prev) => [...prev, { code: form.code.trim().toUpperCase(), program: "Chương trình mới · preview", level: form.level.trim(), cond: form.cond.trim() || "Mọi đơn", used: "0 / 1.000", time: "Từ hôm nay · 30 ngày", on: true }]);
    setForm({ code: "", level: "", cond: "" });
    setMsg("Đã tạo voucher ở bản preview — chưa phát hành trên máy chủ.");
  }

  return (
    <MerchantShell
      active="vouchers"
      previewNote="Quản lý voucher preview: mã minh họa, tạo/tạm dừng chỉ đổi trên trình duyệt, máy chủ chưa có API voucher."
    >
      <div className="mpCard">
        <h2>Quản Lý Voucher &amp; Khuyến Mãi</h2>
        <p className="mpMuted">Gợi ý mã cá nhân hiện tại: {PREVIEW_VOUCHERS.map((v) => v.code).join(" · ")}</p>
        {msg ? <p className="mpPreviewBar" role="status" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>
      <div className="mpCard">
        <form className="mpSearch" style={{ maxWidth: 340, marginBottom: 10 }} role="search" onSubmit={(e) => e.preventDefault()}>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Tìm theo mã voucher…" aria-label="Tìm voucher" />
        </form>
        <div className="pvTabs" style={{ display: "flex", gap: 8, marginBottom: 10 }} role="group" aria-label="Trạng thái (trang này)">
          {(["all", "on", "off"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "all" ? `Tất cả (${rows.length})` : t === "on" ? `Đang chạy (${rows.filter((r) => r.on).length})` : `Tạm dừng (${rows.filter((r) => !r.on).length})`}
            </button>
          ))}
        </div>
        <div className="mpTableWrap">
          <table className="mpTable">
            <thead>
              <tr><th>Mã code voucher</th><th>Chương trình &amp; loại KM</th><th>Mức giảm</th><th>Điều kiện áp dụng</th><th>Lượt dùng / phát hành</th><th>Thời gian hiệu lực</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.code}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 800, border: "1.5px dashed #f0b49a", background: "#fff8f4", borderRadius: 8, padding: "6px 10px", whiteSpace: "nowrap" }}>{r.code}</span>
                    <button className="mpTopBtn" style={{ padding: "5px 10px", fontSize: 11.5, marginLeft: 6 }} type="button" onClick={() => copyCode(r.code, setCopied)}>
                      {copied === r.code ? "Đã chép ✓" : "Chép mã"}
                    </button>
                  </td>
                  <td>{r.program}</td>
                  <td>{r.level}</td>
                  <td>{r.cond}</td>
                  <td>
                    {r.used}
                    <span className="pvFreeBar" style={{ marginTop: 6 }}><i style={{ width: usagePct(r.used) }} /></span>
                  </td>
                  <td>{r.time}</td>
                  <td>
                    <button className="mpSwitch" type="button" role="switch" aria-checked={r.on} aria-label={`Bật/tắt ${r.code} (preview)`} onClick={() => toggle(r.code)} />
                  </td>
                  <td style={{ textAlign: "right" }}><span className="mpMuted">{r.on ? "Đang chạy" : "Tạm dừng"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mpCard">
        <h2>Tạo Mã Voucher &amp; Khuyến Mãi Mới</h2>
        <form onSubmit={create} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Mã code*" aria-label="Mã code" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }} />
          <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Mức giảm*" aria-label="Mức giảm" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }} />
          <input value={form.cond} onChange={(e) => setForm({ ...form, cond: e.target.value })} placeholder="Điều kiện" aria-label="Điều kiện" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 13 }} />
          <button className="mpTopBtn primary" type="submit">Tạo mã</button>
        </form>
      </div>
    </MerchantShell>
  );
}

function usagePct(used: string): string {
  const m = used.replace(/[.,]/g, "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return "0%";
  const pct = Math.round((Number(m[1]) / Math.max(Number(m[2]), 1)) * 100);
  return `${Math.min(100, pct)}%`;
}
