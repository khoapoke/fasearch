"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import ac from "@/components/account/account-cards.module.css";
import { fetchPublicOffers, OffersError } from "@/lib/offers-client";
import { offerDiscountLabel, offerValidityLabel, type PublicOffer } from "@/lib/offers";

type State =
  | { kind: "loading" }
  | { kind: "ready"; offers: PublicOffer[] }
  | { kind: "error"; message: string };

export default function VouchersPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [issue, setIssue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setState({ kind: "loading" });
    const controller = new AbortController();
    fetchPublicOffers(controller.signal)
      .then(({ offers }) => setState({ kind: "ready", offers }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: failure instanceof OffersError ? failure.message : "Không tải được ưu đãi đang mở." });
      });
    return () => controller.abort();
  }, []);

  // Initial fetch runs directly in the effect so the loading state (already the
  // initial value) is only updated in the data callbacks below. Retry via
  // the button still goes through load(), which resets to loading first.
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicOffers(controller.signal)
      .then(({ offers }) => setState({ kind: "ready", offers }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: failure instanceof OffersError ? failure.message : "Không tải được ưu đãi đang mở." });
      });
    return () => controller.abort();
  }, []);

  async function copy(offer: PublicOffer) {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(offer.code);
      window.setTimeout(() => setCopied((value) => (value === offer.code ? null : value)), 2200);
    } catch {
      setCopied(null);
      setIssue("Trình duyệt không cho phép sao chép tự động. Hãy chọn mã và sao chép thủ công.");
    }
  }

  function applyManual(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized || normalized.length > 50) {
      setIssue("Mã voucher phải có từ 1 đến 50 ký tự.");
      return;
    }
    setIssue("");
    window.location.assign(`/thanh-toan?voucher=${encodeURIComponent(normalized)}`);
  }

  return (
    <AccountCenterShell active="/voucher" title="Voucher & ưu đãi" allowGuest>
      <div className={ac.pageWide}>
        <section className={ac.card} aria-labelledby="voucher-open">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Ưu đãi đang mở</p>
            <h2 id="voucher-open" className={ac.title}>Ưu đãi dành cho bạn</h2>
            <p className={ac.lead}>Danh sách dưới đây là các chương trình công khai còn hiệu lực. Mức giảm thực tế được xác nhận lại khi bạn đặt đơn.</p>
          </div>

          {state.kind === "loading" ? (
            <div className={ac.group} role="status">
              <div className={ac.skeleton} />
              <p className={ac.meta}>Đang tải ưu đãi…</p>
            </div>
          ) : null}

          {state.kind === "error" ? (
            <div role="alert" ref={errorRef} tabIndex={-1}>
              <p className={ac.alert}>
                <strong>Không tải được ưu đãi</strong><br />{state.message}
              </p>
              <div className={ac.actions}>
                <button className={ac.secondary} type="button" onClick={load}>Thử lại</button>
              </div>
            </div>
          ) : null}

          {state.kind === "ready" && state.offers.length === 0 ? (
            <div className={`${ac.card} ${ac.empty}`} style={{ padding: "20px 22px" }}>
              <p className={ac.meta}>Hiện chưa có mã công khai. Bạn vẫn có thể nhập mã đã nhận được ở ô bên dưới khi thanh toán.</p>
            </div>
          ) : null}

          {state.kind === "ready" && state.offers.length > 0 ? (
            <ul className={ac.list}>
              {state.offers.map((offer) => (
                <li key={offer.campaignId} className={ac.offerRow}>
                  <span style={{ minWidth: 0 }}>
                    <span className={ac.chipBrand}>{offerDiscountLabel(offer)}</span>
                    <strong style={{ display: "block", marginTop: 8, fontSize: 15 }}>{offer.title}</strong>
                    {offer.conditionText ? <span className={ac.meta} style={{ display: "block", marginTop: 4 }}>{offer.conditionText}</span> : null}
                    <span className={ac.meta} style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span className={ac.chip}>{offer.code}</span>
                      {offerValidityLabel(offer) ? <span>{offerValidityLabel(offer)}</span> : null}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: "none" }}>
                    <button className={ac.secondary} type="button" onClick={() => copy(offer)}>
                      {copied === offer.code ? "Đã sao chép" : "Sao chép mã"}
                    </button>
                    <Link className={ac.primary} href={`/thanh-toan?voucher=${encodeURIComponent(offer.code)}`}>
                      Dùng mã này
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className={ac.card} aria-labelledby="voucher-manual">
          <div className={ac.head}>
            <p className={ac.eyebrow}>02 · Mã riêng</p>
            <h2 id="voucher-manual" className={ac.title}>Đã có mã riêng?</h2>
          </div>
          <form className={ac.form} onSubmit={applyManual}>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="voucher-code">Mã voucher</label>
              <input
                id="voucher-code"
                className={ac.input}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                placeholder="Ví dụ: WELCOME2026"
                aria-label="Mã voucher"
                autoComplete="off"
              />
            </div>
            <div className={ac.actions}>
              <button className={ac.primary} type="submit">Dùng mã tại thanh toán</button>
            </div>
          </form>
          {issue ? <p className={ac.error} role="alert">{issue}</p> : null}
          <p className={ac.meta}>Mã được kiểm tra lại trên giỏ hàng và đơn hàng; điều kiện áp dụng theo chương trình.</p>
        </section>

        <p className={ac.meta}><Link className={ac.link} href="/sale">Xem thêm sản phẩm đang giảm →</Link></p>
      </div>
    </AccountCenterShell>
  );
}
