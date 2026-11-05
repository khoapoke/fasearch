"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/customer-commerce";
import { isPlaceholder } from "@/lib/variant-select";
import { offerDiscountLabel, offerValidityLabel, type PublicOffer } from "@/lib/offers";

// Placeholder list is shared with the PDP/cart (lib/variant-select); NOISE only adds checkout-line extras.
const NOISE = /^(none|null|-|—)$/i;

/** Variant text only when it tells the customer something: drops empty/placeholder axis values. */
export function variantLabel(color: string | null, size: string | null): string {
  return [color, size].map((value) => value?.trim() ?? "").filter((value) => value && !isPlaceholder(value) && !NOISE.test(value)).join(" · ");
}

/** "1-2 ngày" stays as is; a bare number gets its unit. */
export function etaLabel(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  return /ngày|giờ|h$/i.test(text) ? text : `${text} ngày`;
}

function CheckIcon() {
  return (
    <svg className="co-check" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type OfferProps = {
  offers: PublicOffer[];
  offersState: "loading" | "ready" | "error";
  appliedCode: string;
  busy: boolean;
  error: string;
  errorRef: React.RefObject<HTMLParagraphElement | null>;
  onApply: (code: string) => void;
  onClear: () => void;
};

export function VoucherPicker({ offers, offersState, appliedCode, busy, error, errorRef, onApply, onClear }: OfferProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState("");
  const manualId = useId();
  const appliedIsListed = offers.some((offer) => offer.code.toUpperCase() === appliedCode);

  function submitManual() {
    const code = manual.trim().toUpperCase();
    if (!code) return;
    onApply(code);
    setManual("");
    setManualOpen(false);
  }

  return (
    <div className="co-block">
      <h3 className="co-h3" id="co-voucher-label">Ưu đãi</h3>
      {offersState === "loading" ? <p className="co-muted" role="status">Đang tìm ưu đãi đang mở…</p> : null}
      {offersState === "ready" && offers.length === 0 && !appliedCode ? <p className="co-muted">Hiện chưa có ưu đãi đang mở.</p> : null}
      {offers.length > 0 || appliedCode ? (
        <ul className="co-offers" aria-labelledby="co-voucher-label" aria-busy={busy}>
          {offers.map((offer) => {
            const selected = offer.code.toUpperCase() === appliedCode;
            const free = offer.discountType === "FREE_SHIP";
            const until = offerValidityLabel(offer);
            return (
              <li key={offer.campaignId}>
                <button type="button" className={`co-offer${free ? " is-free" : ""}`} aria-pressed={selected} onClick={() => (selected ? onClear() : onApply(offer.code.toUpperCase()))}>
                  <span className="co-offer-tag">{offerDiscountLabel(offer)}</span>
                  <span className="co-offer-title">{offer.title}</span>
                  <span className="co-offer-meta">
                    <span className="co-offer-code">{offer.code}</span>
                    {offer.conditionText ? <span>{offer.conditionText}</span> : null}
                    {until ? <span>{until}</span> : null}
                  </span>
                  <span className="co-offer-mark" aria-hidden="true"><CheckIcon /></span>
                </button>
              </li>
            );
          })}
          {appliedCode && !appliedIsListed ? (
            <li>
              <button type="button" className="co-offer" aria-pressed="true" onClick={onClear}>
                <span className="co-offer-tag">Mã đã nhập</span>
                <span className="co-offer-title"><span className="co-offer-code">{appliedCode}</span></span>
                <span className="co-offer-meta"><span>Chạm để bỏ mã</span></span>
                <span className="co-offer-mark" aria-hidden="true"><CheckIcon /></span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
      {offersState === "error" ? <p className="co-muted">Không tải được danh sách ưu đãi. Bạn vẫn có thể nhập mã.</p> : null}
      {error ? <p ref={errorRef} tabIndex={-1} className="commerce-status is-error co-inline-status" role="alert">{error}</p> : null}
      {manualOpen ? (
        <div className="co-manual">
          <label htmlFor={manualId} className="co-sr">Mã voucher</label>
          <input
            id={manualId} className="checkout-input" value={manual} maxLength={50} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="Nhập mã voucher" onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitManual(); } if (event.key === "Escape") setManualOpen(false); }}
            autoFocus
          />
          <button type="button" className="co-btn" disabled={!manual.trim()} onClick={submitManual}>Áp dụng</button>
        </div>
      ) : (
        <button type="button" className="co-textbtn" onClick={() => setManualOpen(true)}>Nhập mã khác</button>
      )}
    </div>
  );
}

type PointsProps = {
  loaded: boolean;
  policyEnabled: boolean;
  available: number | null;
  allowed: number;
  perPoint: number | null;
  remaining: number;
  on: boolean;
  appliedDiscount: number;
  onToggle: (next: boolean) => void;
};

export function PointsToggle({ loaded, policyEnabled, available, allowed, perPoint, remaining, on, appliedDiscount, onToggle }: PointsProps) {
  const id = useId();
  if (!loaded) return <div className="co-block"><h3 className="co-h3">Điểm thưởng</h3><p className="co-muted" role="status">Đang kiểm tra điểm của bạn…</p></div>;
  if (!policyEnabled) {
    return <div className="co-block"><h3 className="co-h3">Điểm thưởng</h3><p className="co-muted">Chương trình đổi điểm hiện chưa áp dụng.</p></div>;
  }
  const balance = available ?? 0;
  const usable = on ? Math.max(allowed, 0) : allowed;
  const estimate = on ? appliedDiscount : Math.min(Math.floor(usable * (perPoint ?? 0)), Math.max(remaining, 0));
  const canUse = usable > 0 && estimate > 0;
  return (
    <div className="co-block">
      <h3 className="co-h3">Điểm thưởng</h3>
      <div className={`co-points${canUse || on ? "" : " is-empty"}`}>
        <div className="co-points-text">
          <span id={`${id}-label`} className="co-points-title">
            {canUse || on ? <>Dùng <b>{usable.toLocaleString("vi-VN")}</b> điểm <span className="co-points-save">(−{formatMoney(estimate)})</span></> : "Chưa có điểm để dùng cho đơn này"}
          </span>
          <span className="co-points-sub">Bạn đang có {balance.toLocaleString("vi-VN")} điểm{canUse || on ? ` · tối đa ${usable.toLocaleString("vi-VN")} cho đơn này` : ""}</span>
        </div>
        <button
          type="button" role="switch" aria-checked={on} aria-labelledby={`${id}-label`} className="co-switch"
          disabled={!canUse && !on} onClick={() => onToggle(!on)}
        >
          <span className="co-switch-knob" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type Method = "COD" | "STRIPE" | "VNPAY";

export function PaymentCards({ method, onChange, zeroDue }: { method: Method; onChange: (next: Method) => void; zeroDue: boolean }) {
  const options: Array<{ value: Method; title: string; text: string; badge?: string; test?: boolean }> = [
    { value: "COD", title: "Thanh toán khi nhận hàng", text: "Trả tiền mặt cho người giao hàng.", badge: "Mặc định" },
    { value: "STRIPE", title: "Thẻ quốc tế (Stripe)", text: "Chế độ thử nghiệm, dùng thẻ test 4242. Thanh toán chỉ được ghi nhận khi cổng xác nhận.", badge: "Thử nghiệm", test: true },
    { value: "VNPAY", title: "VNPay", text: "Môi trường sandbox. Kết quả cuối hiển thị sau khi đối soát, đơn không tự đánh dấu đã trả.", badge: "Thử nghiệm", test: true },
  ];
  return (
    <div className="co-block">
      <h3 className="co-h3" id="co-method-label">Thanh toán</h3>
      <div role="radiogroup" aria-labelledby="co-method-label" className="co-methods">
        {options.map((option) => {
          const disabled = zeroDue && option.value !== "COD";
          return (
            <label key={option.value} className={`co-method${disabled ? " is-disabled" : ""}`}>
              <input type="radio" name="pay-method" value={option.value} checked={method === option.value} disabled={disabled} onChange={() => onChange(option.value)} />
              <span className="co-method-body">
                <span className="co-method-head">
                  <span className="co-method-title">{option.title}</span>
                  {option.badge ? <span className={`co-badge${option.test ? " is-test" : ""}`}>{option.badge}</span> : null}
                </span>
                <span className="co-method-text">{option.text}</span>
              </span>
              <span className="co-method-mark" aria-hidden="true"><CheckIcon /></span>
            </label>
          );
        })}
      </div>
      {zeroDue ? <p className="co-muted">Đơn 0đ chỉ thanh toán khi nhận hàng.</p> : null}
    </div>
  );
}
