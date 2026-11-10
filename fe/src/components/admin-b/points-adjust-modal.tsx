"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/admin-format";
import { ADJUST_REASONS, adjustPoints, newRequestId, type AdjustResult } from "@/lib/admin-loyalty-client";
import "./s3.css";
import { AdminModal } from "./modal";
import { InfoHint } from "./info-hint";
import { useToast } from "./toast";

const MAX_BALANCE = 2_147_483_647;

/** ADMIN-only manual +/- point adjustment. A request id per opening makes a double submit harmless. */
export function PointsAdjustModal({ open, customerId, customerName, balance, onClose, onDone }: {
  open: boolean; customerId: string | number; customerName: string; balance: number; onClose: () => void; onDone: (result: AdjustResult) => void;
}) {
  const toast = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setDelta(""); setReason(""); setNote(""); setError(""); setBusy(false); setRequestId(newRequestId()); }
  }

  const value = useMemo(() => (/^[+-]?\d+$/.test(delta.trim()) ? Number(delta.trim()) : null), [delta]);
  const after = value === null ? null : balance + value;
  const problem = (() => {
    if (delta.trim() === "") return "";
    if (value === null || !Number.isSafeInteger(value)) return "Nhập số nguyên, ví dụ 50 hoặc -20.";
    if (value === 0) return "Số điểm điều chỉnh phải khác 0.";
    if (after !== null && after < 0) return "Số điểm sau điều chỉnh không được nhỏ hơn 0.";
    if (after !== null && after > MAX_BALANCE) return "Số dư sau điều chỉnh vượt quá mức tối đa cho phép.";
    return "";
  })();
  const noteMissing = reason === "KHAC" && !note.trim();
  const ready = value !== null && value !== 0 && !problem && reason !== "" && !noteMissing && !busy;

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!ready || value === null) return;
    setBusy(true); setError("");
    try {
      const result = await adjustPoints(customerId, { delta: value, reasonCode: reason, note: note.trim() ? note.trim() : null, requestId });
      toast.success(result.replayed || result.balanceAfter === null
        ? "Lần điều chỉnh này đã được ghi trước đó, không ghi thêm."
        : `Đã điều chỉnh ${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))} điểm. Số dư mới ${formatNumber(result.balanceAfter)}.`);
      onDone(result);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Không điều chỉnh được điểm. Thử lại.");
    } finally { setBusy(false); }
  }

  return <AdminModal open={open} title="Điều chỉnh điểm" description={customerName} size="sm" busy={busy} onClose={onClose}
    footer={<><button className="secondary" type="button" disabled={busy} onClick={onClose}>Hủy</button>
      <button className="primary" type="submit" form="pts-adjust-form" disabled={!ready}>{busy ? "Đang lưu…" : "Điều chỉnh"}</button></>}>
    <form id="pts-adjust-form" className="catalog-form pts-form" onSubmit={submit} noValidate>
      <dl className="pts-balance">
        <div><dt>Số dư hiện tại</dt><dd><strong className="t-amber">{formatNumber(balance)}</strong></dd></div>
        <div><dt>Sau điều chỉnh</dt><dd><strong className={after !== null && after >= 0 && !problem ? "t-amber" : "t-gray"}>{after === null || problem ? "—" : formatNumber(after)}</strong></dd></div>
      </dl>
      <div className="catalog-field">
        <label htmlFor="pts-delta">Số điểm thay đổi <InfoHint>Nhập số dương để cộng, số âm để trừ. Số dư không được xuống dưới 0 hoặc thấp hơn số điểm đang giữ cho đơn chưa hoàn tất.</InfoHint></label>
        <input id="pts-delta" className="catalog-input" inputMode="numeric" autoComplete="off" placeholder="Ví dụ 50 hoặc -20" value={delta}
          aria-invalid={problem ? true : undefined} aria-describedby={problem ? "pts-delta-err" : undefined} onChange={(e) => setDelta(e.target.value)} />
        {problem ? <p id="pts-delta-err" className="catalog-error" role="alert">{problem}</p> : null}
      </div>
      <div className="catalog-field">
        <label htmlFor="pts-reason">Lý do</label>
        <select id="pts-reason" className="catalog-input" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Chọn lý do</option>
          {ADJUST_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
      </div>
      <div className="catalog-field">
        <label htmlFor="pts-note">Ghi chú{reason === "KHAC" ? " *" : ""}</label>
        <textarea id="pts-note" className="catalog-input" rows={3} maxLength={500} value={note} placeholder={reason === "KHAC" ? "Bắt buộc khi chọn lý do Khác" : "Tùy chọn, chỉ nhân viên thấy"}
          aria-invalid={noteMissing && note.length > 0 ? true : undefined} onChange={(e) => setNote(e.target.value)} />
        {noteMissing ? <p className="meta">Lý do Khác cần có ghi chú.</p> : null}
      </div>
      {error ? <p className="catalog-error" role="alert">{error}</p> : null}
    </form>
  </AdminModal>;
}
