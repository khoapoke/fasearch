"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchPublicOffers, OffersError } from "@/lib/offers-client";
import { offerDiscountLabel, offerValidityLabel, type PublicOffer } from "@/lib/offers";
import "@/components/storefront/preview.css";
import "./voucher.css";

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

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

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
      <section className="vcIntro" aria-label="Ưu đãi đang mở">
        <h2>Ưu đãi đang mở</h2>
        <p>Danh sách dưới đây là các chương trình công khai còn hiệu lực. Mức giảm thực tế được xác nhận lại khi bạn đặt đơn.</p>
      </section>

      {state.kind === "loading" ? (
        <p className="vcState" role="status">Đang tải ưu đãi…</p>
      ) : null}

      {state.kind === "error" ? (
        <div className="vcState vcStateError" role="alert" ref={errorRef} tabIndex={-1}>
          <strong>Không tải được ưu đãi</strong>
          <p>{state.message}</p>
          <button className="auth-button" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}

      {state.kind === "ready" && state.offers.length === 0 ? (
        <div className="vcState">
          <strong>Hiện chưa có mã công khai</strong>
          <p>Bạn vẫn có thể nhập mã đã nhận được ở ô bên dưới khi thanh toán.</p>
        </div>
      ) : null}

      {state.kind === "ready" && state.offers.length > 0 ? (
        <ul className="vcList">
          {state.offers.map((offer) => (
            <li key={offer.campaignId} className="vcOffer">
              <div className="vcOfferMain">
                <p className="vcOfferDiscount">{offerDiscountLabel(offer)}</p>
                <h3>{offer.title}</h3>
                {offer.conditionText ? <p className="vcOfferCond">{offer.conditionText}</p> : null}
                <p className="vcOfferMeta">
                  <span className="vcCode">{offer.code}</span>
                  {offerValidityLabel(offer) ? <span>{offerValidityLabel(offer)}</span> : null}
                </p>
              </div>
              <div className="vcOfferActions">
                <button className="auth-button" type="button" onClick={() => copy(offer)}>
                  {copied === offer.code ? "Đã sao chép" : "Sao chép mã"}
                </button>
                <Link className="auth-button is-primary" href={`/thanh-toan?voucher=${encodeURIComponent(offer.code)}`}>
                  Dùng mã này
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="vcManual" aria-label="Nhập mã voucher">
        <h2>Đã có mã riêng?</h2>
        <form className="vcForm" onSubmit={applyManual}>
          <label className="vcField">
            <span>Mã voucher</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={50}
              placeholder="Ví dụ: WELCOME2026"
              aria-label="Mã voucher"
              autoComplete="off"
            />
          </label>
          <button className="auth-button is-primary" type="submit">Dùng mã tại thanh toán</button>
        </form>
        {issue ? <p className="vcIssue" role="alert">{issue}</p> : null}
        <p className="vcNote">Mã được kiểm tra lại trên giỏ hàng và đơn hàng; điều kiện áp dụng theo chương trình.</p>
      </section>

      <p className="vcNote"><Link href="/sale">Xem thêm sản phẩm đang giảm →</Link></p>
    </AccountCenterShell>
  );
}
