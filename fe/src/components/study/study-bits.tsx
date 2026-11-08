"use client";

import { useEffect, useRef, useState } from "react";
import { formatVnd, type CatalogProduct } from "@/lib/customer-catalog";
import { boundsErrorText, parseExactPrice, validatePriceBounds } from "@/lib/study-price";
import { clampThumb, PRICE_STEP as STEP } from "@/lib/study-helpers";
import { formatShortVnd, type PriceExtent } from "./use-study-catalog";

export type PriceBounds = { lo: number | null; hi: number | null };

/** Product card: fashion-first, no card-kit chrome — image + quiet text. */
export function StudyCard({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="st-card">
      <a className="st-photo" href={`/san-pham/${product.id}`} aria-label={`Xem ${product.name}`}>
        {!product.imageUrl || failed ? (
          <span className="st-noimg" role="img" aria-label={`Không tải được ảnh: ${product.name}`}>Không tải được ảnh sản phẩm</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh BE/minh họa
          <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        )}
      </a>
      <div className="st-meta">
        {product.brandName ? <span className="st-brand">{product.brandName}</span> : null}
        <h3><a href={`/san-pham/${product.id}`}>{product.name}</a></h3>
        <span className="st-price">{formatVnd(product.price)}</span>
      </div>
    </article>
  );
}


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
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const [exactError, setExactError] = useState<string | null>(null);
  const [loText, setLoText] = useState<string | null>(null);
  const [hiText, setHiText] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragThumb = useRef<0 | 1 | null>(null);
  // R4: nhãn thang thích ứng theo chỗ đo được — 196px chỉ đủ 3 nhãn;
  // endpoint luôn hiện, giá trị chính xác nằm ở readout + ô nhập.
  const [tickFractions, setTickFractions] = useState<number[]>([0, 0.5, 1]);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const pick = (w: number) => (w < 240 ? [0, 0.5, 1] : w < 340 ? [0, 1 / 3, 2 / 3, 1] : [0, 0.25, 0.5, 0.75, 1]);
    setTickFractions(pick(el.clientWidth));
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setTickFractions(pick(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const handledKey = useRef(false);
  const draftRef = useRef<[number, number] | null>(null);
  // Draft theo committed mới (vd: preset/chip/reset từ nơi khác).
  const axisMin = extent?.min ?? null;
  const axisMax = extent?.max ?? null;
  useEffect(() => {
    if (extent) {
      const d: [number, number] = [value.lo ?? extent.min, value.hi ?? extent.max];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
      setDraft(d);
      draftRef.current = d;
      setLoText(value.lo === null ? "" : String(value.lo));
      setHiText(value.hi === null ? "" : String(value.hi));
    } else {
      setLoText(value.lo === null ? "" : String(value.lo));
      setHiText(value.hi === null ? "" : String(value.hi));
    }
    setExactError(null);
  }, [extent, value.lo, value.hi]);

  // R3-3: cùng chính sách trục cho giá trị từ URL/Back, không chỉ form nhập.
  // Không tự diễn giải lại filter: trạng thái vô hiệu hiển thị rõ + slider an
  // toàn bị khóa; người dùng sửa qua ô nhập hoặc Xóa giá. Không push sửa loop.
  const urlError = validatePriceBounds(value.lo, value.hi, axisMin, axisMax);
  const sliderLocked = urlError !== null;

  if (!extent) {
    return (
      <div className="st-range">
        <p className="st-note" role="status">Chưa đọc được thang giá — nhập giá chính xác ở dưới vẫn lọc được, máy chủ kiểm tra lại.</p>
        <ExactForm
          idPrefix={idPrefix}
          loText={loText ?? ""}
          hiText={hiText ?? ""}
          setLoText={setLoText}
          setHiText={setHiText}
          exactError={exactError}
          setExactError={setExactError}
          axisMin={null}
          axisMax={null}
          onValid={(lo, hi) => onCommit({ lo, hi })}
        />
        <PresetRow
          extent={null}
          value={value}
          onPick={(d) => onCommit({ lo: d[0], hi: d[1] })}
          onReset={() => { setExactError(null); onCommit({ lo: null, hi: null }); }}
        />
      </div>
    );
  }
  const { min, max } = extent;
  const span = Math.max(1, max - min);
  const [lo, hi] = draft ?? [min, max];
  // R8-F-R7-PREVIEW: nhãn mặc định chỉ khi thực sự nhàn rỗi và không ràng buộc;
  // đang kéo/phím thì đọc draft hiện tại, hủy về lại mặc định.
  const unboundedIdle = value.lo === null && value.hi === null && lo === min && hi === max;
  const pct = (v: number) => ((Math.min(Math.max(v, min), max) - min) / span) * 100;

  function maybeCommit(next: PriceBounds) {
    if (next.lo !== value.lo || next.hi !== value.hi) onCommit(next);
  }

  function commitDraft(d: [number, number]) {
    const full = d[0] <= min && d[1] >= max;
    maybeCommit(full ? { lo: null, hi: null } : { lo: d[0], hi: d[1] });
  }

  // R3/R8: quantize active thumb only; other handle keeps exact value.
  const clampDraft = (next: [number, number], active: 0 | 1): [number, number] => clampThumb(next, active, min, max);

  function valueFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return min;
    const r = el.getBoundingClientRect();
    return min + (Math.min(Math.max((clientX - r.left) / Math.max(1, r.width), 0), 1) * span);
  }

  function onThumbPointerDown(thumb: 0 | 1) {
    return (e: React.PointerEvent) => {
      if (sliderLocked) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragThumb.current = thumb;
    };
  }

  function onTrackPointerMove(e: React.PointerEvent) {
    if (dragThumb.current === null || sliderLocked) return;
    const v = valueFromClientX(e.clientX);
    setDraft((prev) => {
      const [a, b] = prev ?? [min, max];
      const next = clampDraft(dragThumb.current === 0 ? [v, b] : [a, v], dragThumb.current as 0 | 1);
      draftRef.current = next;
      return next;
    });
  }

  function endDrag(commit: boolean) {
    if (dragThumb.current === null) return;
    dragThumb.current = null;
    // pointercancel: hoàn tác, giữ nguyên query đã commit (không commit).
    if (!commit) {
      const d: [number, number] = [value.lo ?? min, value.hi ?? max];
      setDraft(d);
      draftRef.current = d;
      return;
    }
    if (draftRef.current) commitDraft(draftRef.current);
  }

  function onThumbKey(thumb: 0 | 1, other: number) {
    return {
      onKeyDown: (e: React.KeyboardEvent) => {
        let v: number | null = null;
        const cur = thumb === 0 ? lo : hi;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = cur - STEP;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") v = cur + STEP;
        else if (e.key === "Home") v = thumb === 0 ? min : other;
        else if (e.key === "End") v = thumb === 0 ? other : max;
        else return; // Tab và phím khác: giữ nguyên, không chặn.
        e.preventDefault();
        // Xem trước cục bộ; giữ phím (repeat) không gọi API.
        const next = clampDraft(thumb === 0 ? [v, other] : [other, v], thumb);
        setDraft(next);
        draftRef.current = next;
        handledKey.current = true;
      },
      // R3-2: chỉ commit khi vừa nhả một phím giá đã xử lý; Tab thuần không
      // bao giờ tạo commit/bound mới.
      onKeyUp: () => {
        if (!handledKey.current) return;
        handledKey.current = false;
        if (draftRef.current) commitDraft(draftRef.current);
      },
      onBlur: () => {
        // Lưới an toàn khi focus rời mà keyup bị lỡ: commit nếu đổi, rồi xóa cờ.
        if (handledKey.current) {
          handledKey.current = false;
          if (draftRef.current) commitDraft(draftRef.current);
        }
      },
    };
  }

  return (
    <div className="st-range">
      {urlError ? (
        <p className="st-err" role="alert">
          Giá trong URL không hợp lệ ({boundsErrorText(urlError, min, max)}) — thang giá tạm khóa; sửa ở dưới hoặc xóa giá.
        </p>
      ) : null}
      <div className="st-range-readout" aria-live="polite">
        {unboundedIdle ? (
          <span className="st-range-any">Mọi mức giá</span>
        ) : (
          <>
            <span>{formatVnd(lo)}</span>
            <span aria-hidden="true">–</span>
            <span>{formatVnd(hi)}</span>
          </>
        )}
      </div>
      <div
        className="st-track"
        ref={trackRef}
        onPointerMove={onTrackPointerMove}
        onPointerUp={() => endDrag(true)}
        onPointerCancel={() => endDrag(false)}
      >
        {/* trục thang chia độ trơn (không phải biểu đồ phân phối) */}
        <div className="st-ticks" aria-hidden="true">
          {tickFractions.map((t) => (
            <span key={t} className="st-tick" style={{ left: `${t * 100}%` }}>
              <i />
              <em>{formatShortVnd(Math.round(min + t * span))}</em>
            </span>
          ))}
        </div>
        <div className="st-fill" aria-hidden="true" style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }} />
        {([0, 1] as const).map((thumb) => {
          const v = thumb === 0 ? lo : hi;
          const handlers = onThumbKey(thumb, thumb === 0 ? hi : lo);
          return (
            <div
              key={thumb}
              className="st-thumb"
              role="slider"
              tabIndex={sliderLocked ? -1 : 0}
              aria-disabled={sliderLocked || undefined}
              aria-label={thumb === 0 ? "Giá thấp nhất" : "Giá cao nhất"}
              aria-valuemin={thumb === 0 ? min : lo}
              aria-valuemax={thumb === 0 ? hi : max}
              aria-valuenow={v}
              aria-valuetext={formatVnd(v)}
              style={{ left: `${pct(v)}%` }}
              onPointerDown={onThumbPointerDown(thumb)}
              onKeyDown={handlers.onKeyDown}
              onKeyUp={handlers.onKeyUp}
              onBlur={handlers.onBlur}
            />
          );
        })}
      </div>
      <ExactForm
        idPrefix={idPrefix}
        loText={loText ?? ""}
        hiText={hiText ?? ""}
        setLoText={setLoText}
        setHiText={setHiText}
        exactError={exactError}
        setExactError={setExactError}
        axisMin={min}
        axisMax={max}
        onValid={(a, b) => {
          const next: [number, number] = [a ?? min, b ?? max];
          setDraft(next);
          draftRef.current = next;
          commitDraft(next);
        }}
      />
      <PresetRow
        extent={extent}
        value={value}
        onPick={(d) => { setDraft(d); draftRef.current = d; commitDraft(d); }}
        onReset={() => { setExactError(null); commitDraft([min, max]); }}
      />
    </div>
  );
}


/**
 * Budget instrument: dual thumbs on one scale + exact inputs + presets.
 * R2 guards: crossing clamps the ACTIVE thumb (other fixed); pointercancel
 * reverts; arrows preview locally and commit once on keyup (no per-repeat
 * API); exact inputs use strict parse (F1) + axis policy (F2); extent-load
 * failure still renders inputs + presets (no false promise).
 */
function ExactForm({
  idPrefix, loText, hiText, setLoText, setHiText, exactError, setExactError, axisMin, axisMax, onValid,
}: {
  idPrefix: string;
  loText: string;
  hiText: string;
  setLoText: (s: string) => void;
  setHiText: (s: string) => void;
  exactError: string | null;
  setExactError: (s: string | null) => void;
  axisMin: number | null;
  axisMax: number | null;
  onValid: (lo: number | null, hi: number | null) => void;
}) {
  function submit() {
    // F1: rác (chữ, âm, thập phân, quá lớn) bị từ chối, giữ nguyên ô nhập.
    const a = parseExactPrice(loText);
    const b = parseExactPrice(hiText);
    if (a.kind === "invalid" || b.kind === "invalid") {
      setExactError("Chỉ nhập số nguyên không âm, ví dụ 500000 hoặc 1.000.000.");
      return;
    }
    const lo = a.kind === "value" ? a.value : null;
    const hi = b.kind === "value" ? b.value : null;
    // F2: chính sách rõ ràng — giá phải nằm trong trục đã biết (nếu đã biết).
    const err = validatePriceBounds(lo, hi, axisMin, axisMax);
    if (err) {
      setExactError(boundsErrorText(err, axisMin, axisMax));
      return;
    }
    setExactError(null);
    onValid(lo, hi);
  }

  const errId = `${idPrefix}-exact-error`;
  return (
    <form
      className="st-exact"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <label htmlFor={`${idPrefix}-lo`}>
        Từ
        <input
          id={`${idPrefix}-lo`}
          className="st-input"
          inputMode="numeric"
          autoComplete="off"
          value={loText}
          placeholder="Không đặt"
          maxLength={12}
          aria-invalid={exactError ? true : undefined}
          aria-describedby={exactError ? errId : undefined}
          onChange={(e) => { setLoText(e.target.value); if (exactError) setExactError(null); }}
        />
      </label>
      <label htmlFor={`${idPrefix}-hi`}>
        Đến
        <input
          id={`${idPrefix}-hi`}
          className="st-input"
          inputMode="numeric"
          autoComplete="off"
          value={hiText}
          placeholder="Không đặt"
          maxLength={12}
          aria-invalid={exactError ? true : undefined}
          aria-describedby={exactError ? errId : undefined}
          onChange={(e) => { setHiText(e.target.value); if (exactError) setExactError(null); }}
        />
      </label>
      <button className="st-btn" type="submit">Lọc giá</button>
      {exactError ? <p className="st-err" role="alert" id={errId}>{exactError}</p> : null}
    </form>
  );
}

function PresetRow({
  extent, value, onPick, onReset,
}: {
  extent: PriceExtent | null;
  value: PriceBounds;
  onPick: (d: [number, number]) => void;
  onReset: () => void;
}) {
  const min = extent?.min ?? 0;
  const max = extent?.max ?? 99_999_999;
  return (
    <div className="st-presets" role="group" aria-label="Mức giá gợi ý">
      {[
        { label: "Dưới 500K", lo: min, hi: 500_000 },
        { label: "500K–1TR", lo: 500_000, hi: 1_000_000 },
        { label: "Trên 1TR", lo: 1_000_000, hi: max },
      ].map((pr) => {
        const active = value.lo === pr.lo && value.hi === pr.hi;
        return (
          <button
            key={pr.label}
            type="button"
            className="st-chip"
            aria-pressed={active}
            onClick={() => onPick([pr.lo, pr.hi])}
          >
            {pr.label}
          </button>
        );
      })}
      <button type="button" className="st-linkbtn" onClick={onReset}>
        Xóa giá
      </button>
    </div>
  );
}

/** Jump form shared by both directions (same precision contract, different shells). */
export function StudyJump({ totalPages, page, onGoto, id }: { totalPages: number; page: number; onGoto: (p0: number) => void; id: string }) {
  const [jump, setJump] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
  useEffect(() => { setErr(null); }, [totalPages]);
  return (
    <form
      className="st-jump"
      onSubmit={(e) => {
        e.preventDefault();
        const t = jump.trim();
        if (!t) { setErr("Vui lòng nhập số trang."); return; }
        if (!/^\d+$/.test(t)) { setErr("Chỉ nhập số nguyên dương."); return; }
        const n = Number(t);
        if (!Number.isSafeInteger(n) || n < 1 || n > totalPages) { setErr(`Nhập số trang từ 1 đến ${totalPages}.`); return; }
        setErr(null);
        // Trang hiện tại: không fetch trùng, không đẩy history thừa.
        if (n - 1 !== page) onGoto(n - 1);
      }}
    >
      <label htmlFor={id}>Đến trang</label>
      <input id={id} className="st-input st-jumpinput" inputMode="numeric" autoComplete="off" value={jump} maxLength={10}
        placeholder={`1–${totalPages}`} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-err` : undefined}
        onChange={(e) => setJump(e.target.value)} />
      <button className="st-btn" type="submit">Đi</button>
      {err ? <p className="st-err" role="alert" id={`${id}-err`}>{err}</p> : null}
    </form>
  );
}
