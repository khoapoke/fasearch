"use client";

import { useRef, useState } from "react";
import { formatVnd } from "@/lib/customer-catalog";
import { clampThumb, PRICE_STEP } from "@/lib/study-helpers";
import { parseExactPrice } from "@/lib/study-price";

export type PriceBounds = { lo: number | null; hi: number | null };
export type PriceExtent = { min: number; max: number };

/**
 * Khoảng giá trung thực:
 * - Mặc định = KHÔNG giới hạn ("Mọi mức giá"); hai ô nhập để trống, thang là
 *   khoảng giá thật của tập đang xem (extent do trang đọc từ BE).
 * - Chỉ commit khi người dùng tương tác: thả chuột/chạm, nhả phím mũi tên,
 *   Enter/blur ở ô số. Đầu mút trùng cực trị ⇒ bỏ tham số đó (không ghi 0 / max tuỳ ý).
 * - Slider + ô số dùng chung một draft nên luôn đồng bộ.
 */
export function PriceRange({
  extent,
  value,
  onCommit,
  idPrefix,
}: {
  extent: PriceExtent | null;
  value: PriceBounds;
  onCommit: (next: PriceBounds) => void;
  idPrefix: string;
}) {
  // draft = chỉ tồn tại trong lúc kéo / bấm phím; null ⇒ suy ra từ giá trị đã commit.
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const [typed, setTyped] = useState<{ lo?: string; hi?: string }>({});
  const [error, setError] = useState("");
  const trackRef = useRef<HTMLDivElement>(null);
  const dragThumb = useRef<0 | 1 | null>(null);
  const handledKey = useRef(false);

  const min = extent?.min ?? 0;
  const max = extent?.max ?? 0;
  const span = Math.max(1, max - min);
  const committed: [number, number] = [value.lo ?? min, value.hi ?? max];
  const [lo, hi] = draft ?? committed;
  const active = draft !== null || value.lo !== null || value.hi !== null;
  const pct = (v: number) => ((Math.min(Math.max(v, min), max) - min) / span) * 100;

  function commitDraft(d: [number, number]) {
    const next: PriceBounds = { lo: d[0] <= min ? null : d[0], hi: d[1] >= max ? null : d[1] };
    setDraft(null);
    setTyped({});
    setError("");
    if (next.lo !== value.lo || next.hi !== value.hi) onCommit(next);
  }

  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return min;
    const r = el.getBoundingClientRect();
    return min + Math.min(Math.max((clientX - r.left) / Math.max(1, r.width), 0), 1) * span;
  }

  function onThumbDown(thumb: 0 | 1) {
    return (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragThumb.current = thumb;
    };
  }

  function onTrackMove(e: React.PointerEvent) {
    const thumb = dragThumb.current;
    if (thumb === null) return;
    const v = valueFromClientX(e.clientX);
    const [a, b] = draft ?? committed;
    setDraft(clampThumb(thumb === 0 ? [v, b] : [a, v], thumb, min, max));
  }

  function endDrag(ok: boolean) {
    if (dragThumb.current === null) return;
    dragThumb.current = null;
    if (!ok || !draft) return setDraft(null);
    commitDraft(draft);
  }

  function thumbKeys(thumb: 0 | 1) {
    return {
      onKeyDown: (e: React.KeyboardEvent) => {
        const cur = draft ?? committed;
        const here = cur[thumb];
        const other = cur[thumb === 0 ? 1 : 0];
        let v: number;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = here - PRICE_STEP;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") v = here + PRICE_STEP;
        else if (e.key === "Home") v = thumb === 0 ? min : other;
        else if (e.key === "End") v = thumb === 0 ? other : max;
        else return;
        e.preventDefault();
        setDraft(clampThumb(thumb === 0 ? [v, other] : [other, v], thumb, min, max));
        handledKey.current = true;
      },
      // Chỉ commit sau khi nhả một phím giá đã xử lý — giữ phím không gọi API liên tục.
      onKeyUp: () => {
        if (!handledKey.current) return;
        handledKey.current = false;
        if (draft) commitDraft(draft);
      },
      onBlur: () => {
        if (!handledKey.current) return;
        handledKey.current = false;
        if (draft) commitDraft(draft);
      },
    };
  }

  function submitTyped() {
    const loText = typed.lo ?? (draft || value.lo !== null ? String(lo) : "");
    const hiText = typed.hi ?? (draft || value.hi !== null ? String(hi) : "");
    const a = parseExactPrice(loText);
    const b = parseExactPrice(hiText);
    if (a.kind === "invalid" || b.kind === "invalid") {
      setError("Chỉ nhập số tiền hợp lệ (đơn vị ₫), ví dụ 500000.");
      return;
    }
    const nlo = a.kind === "value" ? a.value : null;
    const nhi = b.kind === "value" ? b.value : null;
    if (nlo !== null && nhi !== null && nlo > nhi) {
      setError("Giá từ phải nhỏ hơn hoặc bằng giá đến.");
      return;
    }
    setError("");
    setTyped({});
    setDraft(null);
    if (nlo !== value.lo || nhi !== value.hi) onCommit({ lo: nlo, hi: nhi });
  }

  const shownLo = typed.lo ?? (draft || value.lo !== null ? String(lo) : "");
  const shownHi = typed.hi ?? (draft || value.hi !== null ? String(hi) : "");
  const errId = `${idPrefix}-err`;
  // Handler dựng trong sự kiện (không đọc ref lúc render).
  function fieldProps(key: "lo" | "hi") {
    return {
      inputMode: "numeric" as const,
      autoComplete: "off",
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errId : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setTyped((t) => ({ ...t, [key]: e.target.value }));
        setError("");
      },
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); submitTyped(); } },
      onBlur: () => { if (typed[key] !== undefined) submitTyped(); },
    };
  }

  return (
    <div className="cat-price">
      <p className="cat-price-readout" aria-live="polite">
        {active ? `${formatVnd(lo)} – ${formatVnd(hi)}` : "Mọi mức giá"}
      </p>
      {extent && max > min ? (
        <>
          <div
            className="cat-price-track"
            ref={trackRef}
            onPointerMove={onTrackMove}
            onPointerUp={() => endDrag(true)}
            onPointerCancel={() => endDrag(false)}
          >
            <span className="cat-price-rail" aria-hidden="true" />
            <span className="cat-price-fill" aria-hidden="true" style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }} />
            {([0, 1] as const).map((thumb) => {
              const v = thumb === 0 ? lo : hi;
              return (
                <div
                  key={thumb}
                  className="cat-price-thumb"
                  role="slider"
                  tabIndex={0}
                  aria-label={thumb === 0 ? "Giá thấp nhất" : "Giá cao nhất"}
                  aria-valuemin={thumb === 0 ? min : lo}
                  aria-valuemax={thumb === 0 ? hi : max}
                  aria-valuenow={v}
                  aria-valuetext={formatVnd(v)}
                  style={{ left: `${pct(v)}%` }}
                  onPointerDown={onThumbDown(thumb)}
                  {...thumbKeys(thumb)}
                />
              );
            })}
          </div>
          <div className="cat-price-scale" aria-hidden="true">
            <span>{formatVnd(min)}</span>
            <span>{formatVnd(max)}</span>
          </div>
        </>
      ) : (
        <p className="cat-filter-note" role="status">
          {extent ? `Tập này chỉ có một mức giá: ${formatVnd(extent.min)}.` : "Chưa có thang giá cho tập sản phẩm này — vẫn nhập giá chính xác bên dưới được."}
        </p>
      )}
      <div className="cat-price-grid">
        <div className="cat-field">
          <label htmlFor={`${idPrefix}-min`}>Từ</label>
          <input id={`${idPrefix}-min`} className="cat-input" placeholder={extent ? String(min) : "Không giới hạn"} value={shownLo} {...fieldProps("lo")} />
        </div>
        <div className="cat-field">
          <label htmlFor={`${idPrefix}-max`}>Đến</label>
          <input id={`${idPrefix}-max`} className="cat-input" placeholder={extent ? String(max) : "Không giới hạn"} value={shownHi} {...fieldProps("hi")} />
        </div>
      </div>
      {error ? <p className="cat-filter-note cat-price-error" role="alert" id={errId}>{error}</p> : null}
    </div>
  );
}
