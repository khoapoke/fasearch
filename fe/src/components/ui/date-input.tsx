"use client";

import { useEffect, useRef, useState } from "react";
import "./date-input.css";

/** yyyy-MM-dd -> dd/MM/yyyy ("" nếu không hợp lệ). */
export function isoToVnDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** dd/MM/yyyy (hoặc d/M/yyyy) -> yyyy-MM-dd; null nếu sai định dạng hoặc ngày không tồn tại. */
export function vnDateToIso(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Props = {
  id?: string;
  value: string; // yyyy-MM-dd hoặc ""
  onChange: (iso: string) => void; // yyyy-MM-dd khi hợp lệ, "" khi trống; chữ đang gõ dở được phát nguyên để form tự báo lỗi
  className?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * Ô ngày dùng chung: hiện và nhận dd/MM/yyyy, giá trị phát ra vẫn là yyyy-MM-dd như input type="date".
 * Nút lịch mở bộ chọn ngày của trình duyệt khi có hỗ trợ.
 */
export function DateInput({ id, value, onChange, className, min, max, disabled, required, autoComplete, ...aria }: Props) {
  const [text, setText] = useState(isoToVnDate(value));
  const [bad, setBad] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const emitted = useRef(value);
  useEffect(() => {
    // Chỉ đồng bộ khi cha tự đổi giá trị (đặt lại, chọn nhanh); giá trị do chính ô này phát ra thì giữ nguyên chữ đang gõ.
    if (value === emitted.current) return;
    emitted.current = value;
    setText(isoToVnDate(value));
    setBad(false);
  }, [value]);

  function emit(iso: string) {
    emitted.current = iso;
    onChange(iso);
  }

  function handleText(next: string) {
    setText(next);
    const trimmed = next.trim();
    if (trimmed === "") {
      setBad(false);
      emit("");
      return;
    }
    const iso = vnDateToIso(trimmed);
    if (iso === null) {
      // Chưa đủ hoặc sai ngày: phát nguyên chữ (không phải yyyy-MM-dd) để các kiểm tra sẵn có của form báo lỗi như cũ.
      setBad(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed));
      emit(trimmed);
      return;
    }
    setBad(false);
    emit(iso);
  }

  function openPicker() {
    const el = picker.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  return (
    <span className="dateInput">
      <input
        id={id}
        className={className}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={text}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setBad(text.trim() !== "" && vnDateToIso(text) === null)}
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"] ?? (bad ? true : undefined)}
      />
      <button type="button" className="dateInputBtn" onClick={openPicker} disabled={disabled} aria-label="Mở lịch chọn ngày" tabIndex={-1}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </button>
      <input
        ref={picker}
        className="dateInputNative"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          setText(isoToVnDate(e.target.value));
          setBad(false);
          emit(e.target.value);
        }}
      />
    </span>
  );
}
