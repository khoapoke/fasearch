"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { createCustomerOrder, fetchShippingQuote, quoteCustomerCart } from "@/lib/customer-commerce-client";
import { CommerceError, formatMoney, type CustomerCartQuote } from "@/lib/customer-commerce";
import { newOperationKey } from "@/lib/commerce";
import "@/components/customer-commerce/commerce.css";

const WEIGHT_PER_ITEM_GRAM = 500;
const DEFAULT_PROVINCE = "TP. Hồ Chí Minh";
const DEFAULT_DISTRICT = "Quận 1";

type Quote = { shippingFee: number; estimatedDays: string; key: string };

export default function CheckoutPage() {
  return <Suspense fallback={<StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none"><div className="commercePage"><p className="commerce-status" role="status">Đang tải dữ liệu thanh toán…</p></div></StorefrontShell>}><CheckoutPageContent /></Suspense>;
}

function CheckoutPageContent() {
  const router = useRouter();
  const { cart, authState, loading, error: cartError } = useCustomerCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [province, setProvince] = useState(DEFAULT_PROVINCE);
  const [district, setDistrict] = useState(DEFAULT_DISTRICT);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const initialVoucher = useSearchParams().get("voucher") ?? "";
  const [voucherCode, setVoucherCode] = useState(initialVoucher);
  const [cartQuote, setCartQuote] = useState<{ quote: CustomerCartQuote; cartSignature: string } | null>(null);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  const quoteReq = useRef(0);
  const voucherReq = useRef(0);
  const initialQuoteRequested = useRef(false);
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);

  const weight = Math.max(1, (cart?.totalItems ?? 0) * WEIGHT_PER_ITEM_GRAM);
  const key = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weight}`;
  const cartSignature = JSON.stringify(cart?.items.map(({ skuId, quantity, unitPrice, totalPrice }) => [skuId, quantity, unitPrice, totalPrice]) ?? []);
  const currentCartQuote = cartQuote?.cartSignature === cartSignature && (cartQuote.quote.voucherCode ?? "") === voucherCode.trim().toUpperCase() ? cartQuote.quote : null;
  const quoteIsCurrent = Boolean(currentCartQuote);

  const applyQuote = useCallback(async (code: string | null) => {
    if (!cart?.items.length) return null;
    const my = ++voucherReq.current;
    setVoucherBusy(true); setVoucherError(""); setCartQuote(null);
    try {
      const result = await quoteCustomerCart(code);
      if (voucherReq.current !== my) return null;
      setCartQuote({ quote: result, cartSignature }); checkoutAttempt.current = null; setError("");
      return result;
    } catch (failure) {
      if (voucherReq.current !== my) return null;
      setCartQuote(null);
      setVoucherError(failure instanceof Error ? failure.message : "Không thể báo giá voucher.");
      return null;
    } finally {
      if (voucherReq.current === my) setVoucherBusy(false);
    }
  }, [cart?.items.length, cartSignature]);

  const calculate = useCallback(async () => {
    if (!province.trim() || !district.trim() || !cart?.items.length) return null;
    const my = ++quoteReq.current;
    setQuoteBusy(true); setQuoteError("");
    try {
      const result = await fetchShippingQuote(province.trim(), district.trim(), weight);
      if (quoteReq.current !== my) return null;
      const next = { ...result, key: `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weight}` };
      setQuote(next);
      return next;
    } catch (failure) {
      if (quoteReq.current !== my) return null;
      setQuoteError(failure instanceof Error ? failure.message : "Không tính được phí giao hàng.");
      return null;
    } finally {
      if (quoteReq.current === my) setQuoteBusy(false);
    }
  }, [cart?.items.length, district, province, weight]);

  useEffect(() => {
    if (!cart?.items.length) { initialQuoteRequested.current = false; return; }
    if (!initialQuoteRequested.current) {
      initialQuoteRequested.current = true;
      void applyQuote(null);
    }
    void Promise.resolve().then(() => calculate());
  }, [applyQuote, calculate, cart?.items.length, cartSignature]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const voucherErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (voucherError) voucherErrorRef.current?.focus(); }, [voucherError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !cart?.items.length) return;
    if (!name.trim() || !phone.trim() || !address.trim()) { setError("Điền đủ người nhận, số điện thoại và địa chỉ."); return; }
    if (!/^\d{9,11}$/.test(phone.replace(/[ .-]/g, ""))) { setError("Số điện thoại phải có 9–11 chữ số."); return; }
    if (address.trim().length < 5) { setError("Địa chỉ giao hàng quá ngắn."); return; }
    if (!currentCartQuote) { setError("Hãy báo giá giỏ hàng/voucher trước khi đặt đơn."); return; }
    const current = quote?.key === key ? quote : await calculate();
    if (!current) { setError("Chưa có phí giao hàng hợp lệ. Kiểm tra tỉnh/quận rồi thử lại."); return; }
    pending.current = true;
    setBusy(true); setError(""); setUncertain(false);
    try {
      const checkout = {
        deliveryAddress: address.trim(), receiverName: name.trim(), receiverPhone: phone.trim(),
        paymentMethod: "COD", shippingFee: current.shippingFee, ...(note.trim() ? { note: note.trim() } : {}),
        ...(currentCartQuote.voucherCode ? { voucherCode: currentCartQuote.voucherCode } : {}),
        quoteFingerprint: currentCartQuote.quoteFingerprint, expectedMerchandiseAmountDue: currentCartQuote.merchandiseAmountDue,
      };
      const signature = JSON.stringify(checkout);
      const checkoutKey = checkoutAttempt.current?.signature === signature ? checkoutAttempt.current.key : newOperationKey();
      checkoutAttempt.current = { signature, key: checkoutKey };
      const order = await createCustomerOrder({ ...checkout, checkoutKey });
      router.push(`/don-hang/${order.orderId}`);
    } catch (failure) {
      if (failure instanceof CommerceError && failure.code === "4107") {
        setCartQuote(null); checkoutAttempt.current = null;
        setVoucherError(failure.message); setError("");
      } else if (failure instanceof CommerceError) setError(failure.message);
      else {
        setUncertain(true);
        setError("Chưa xác định được đơn đã được tạo hay chưa. Không gửi lại tự động; mở Đơn hàng để đối soát trước.");
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const empty = authState === "authenticated" && cart && cart.items.length === 0;
  return (
    <StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn"><Link href="/gio-hang">Giỏ hàng</Link><span aria-hidden="true">›</span><span aria-current="page">Thanh toán</span></nav>
          <h1 className="commerce-title">Thanh toán</h1>
          <p className="commerce-sub">Đơn thử nghiệm trên dữ liệu tổng hợp · COD · không có cổng thanh toán hay giao dịch thật.</p>

          {authState === "guest" ? (
            <div className="commerce-empty"><h2>Cần đăng nhập</h2><p>Đăng nhập để dùng giỏ máy chủ và tạo đơn thử nghiệm.</p><Link className="commerce-primary" href="/dang-nhap?next=%2Fthanh-toan">Đăng nhập →</Link></div>
          ) : null}
          {authState === "checking" || (authState === "authenticated" && loading && !cart) ? <p className="commerce-status" role="status">Đang tải giỏ hàng…</p> : null}
          {authState === "error" ? <p className="commerce-status is-error" role="alert">{cartError}</p> : null}
          {empty ? <div className="commerce-empty"><h2>Giỏ đang trống</h2><p>Thêm sản phẩm trước khi thanh toán.</p><Link className="commerce-link" href="/nam">Xem sản phẩm →</Link></div> : null}

          {authState === "authenticated" && cart && cart.items.length > 0 ? (
            <div className="checkout-grid">
              <form className="checkout-form-panel" onSubmit={submit} noValidate>
                <h2>Thông tin nhận hàng</h2>
                <div className="checkout-field"><label htmlFor="checkout-name">Người nhận</label><input id="checkout-name" className="checkout-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
                <div className="checkout-field"><label htmlFor="checkout-phone">Số điện thoại</label><input id="checkout-phone" className="checkout-input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></div>
                <div className="checkout-field"><label htmlFor="checkout-address">Địa chỉ</label><input id="checkout-address" className="checkout-input" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" /></div>
                <div className="checkout-grid-2">
                  <div className="checkout-field"><label htmlFor="checkout-province">Tỉnh/Thành phố</label><input id="checkout-province" className="checkout-input" value={province} onChange={(e) => setProvince(e.target.value)} /></div>
                  <div className="checkout-field"><label htmlFor="checkout-district">Quận/Huyện</label><input id="checkout-district" className="checkout-input" value={district} onChange={(e) => setDistrict(e.target.value)} /></div>
                </div>
                <div className="checkout-field"><label htmlFor="checkout-note">Ghi chú (không bắt buộc)</label><input id="checkout-note" className="checkout-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
                <div className="checkout-field"><label htmlFor="checkout-voucher">Mã voucher (không bắt buộc)</label><div style={{ display: "flex", gap: 8 }}><input id="checkout-voucher" className="checkout-input" value={voucherCode} onChange={(e) => { setVoucherCode(e.target.value); voucherReq.current++; setVoucherBusy(false); setCartQuote(null); checkoutAttempt.current = null; setVoucherError(""); }} maxLength={50} autoComplete="off" /><button className="commerce-ghost" type="button" disabled={voucherBusy} onClick={() => { setError(""); void applyQuote(voucherCode.trim() || null); }}>{voucherBusy ? "Đang báo giá…" : voucherCode.trim() ? "Áp dụng mã" : "Bỏ mã / báo giá lại"}</button></div></div>
                <p className="checkout-test-note">Đơn thử nghiệm. Phí giao hàng lấy từ API BE với giả định {WEIGHT_PER_ITEM_GRAM}g/món vì DTO sản phẩm công khai chưa có trọng lượng; đây không phải metadata sản xuất.</p>
                {voucherError ? <p ref={voucherErrorRef} tabIndex={-1} className="commerce-status is-error" role="alert">{voucherError}</p> : null}
                {cartQuote && !quoteIsCurrent && !voucherBusy ? <p className="commerce-status" role="status">Giỏ hàng hoặc mã voucher đã thay đổi. Báo giá lại trước khi đặt đơn.</p> : null}
                {quoteError ? <p className="commerce-status is-error" role="alert">{quoteError}</p> : null}
                {error ? <p ref={errorRef} tabIndex={-1} className="commerce-status is-error" role="alert">{error}</p> : null}
                {uncertain ? <p className="commerce-status" role="alert">Đơn có thể đã được tạo. <Link className="commerce-link" href="/don-hang">Mở Đơn hàng để đối soát →</Link></p> : null}
                <button className="commerce-primary" type="submit" disabled={busy || quoteBusy || voucherBusy || !quoteIsCurrent}>{busy ? "Đang tạo đơn thử nghiệm…" : "Đặt đơn thử nghiệm (COD)"}</button>
                <p className="commerce-note">Không tự retry khi mất phản hồi; phí giao hàng vẫn theo biên giới legacy chưa được S1 xác thực. Tiền hàng và voucher do BE báo giá; tổng cuối trả về từ đơn đã chốt.</p>
              </form>
              <aside className="checkout-summary-panel" aria-label="Tóm tắt thanh toán">
                <h2>Đơn của bạn</h2>
                <ul className="checkout-lines">{cart.items.map((line) => { const quoted = currentCartQuote?.items.find((item) => item.skuId === line.skuId); return <li className="checkout-summary-line" key={line.skuId}><span>{line.productName} · {[line.color, line.size].filter(Boolean).join(" · ")} × {line.quantity}{quoted?.discountAmount ? <small style={{ display: "block" }}>Giảm theo voucher: {formatMoney(quoted.discountAmount)}</small> : null}</span><strong>{formatMoney(quoted?.totalPrice ?? line.totalPrice)}</strong></li>; })}</ul>
                <div className="checkout-summary-line"><span>Tạm tính hàng hóa</span><strong>{formatMoney(currentCartQuote?.subTotal ?? cart.subTotal)}</strong></div>
                {currentCartQuote?.voucherCode ? <div className="checkout-summary-line"><span>Voucher {currentCartQuote.voucherCode}</span><strong>−{formatMoney(currentCartQuote.voucherDiscount)}</strong></div> : null}
                <div className="checkout-summary-line"><span>Tiền hàng sau ưu đãi</span><strong>{currentCartQuote ? formatMoney(currentCartQuote.merchandiseAmountDue) : "—"}</strong></div>
                <div className="checkout-summary-line"><span>Phí giao hàng {quote ? `(${quote.estimatedDays})` : ""}</span><strong>{quote ? formatMoney(quote.shippingFee) : quoteBusy ? "Đang tính…" : "—"}</strong></div>
                <div className="checkout-total"><span>Tổng tạm tính</span><strong>{currentCartQuote && quote ? formatMoney(currentCartQuote.merchandiseAmountDue + quote.shippingFee) : "—"}</strong></div>
                <div className="checkout-cod"><span>Thanh toán</span><strong>COD — thu khi nhận</strong></div>
                <button className="commerce-ghost" type="button" onClick={() => { setQuote(null); void calculate(); }} disabled={quoteBusy}>{quoteBusy ? "Đang tính phí…" : "Tính lại phí giao hàng"}</button>
                <p className="commerce-note">Tổng hiển thị là ước tính; BE tính lại tổng khi tạo đơn và trả về tổng thật.</p>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </StorefrontShell>
  );
}
