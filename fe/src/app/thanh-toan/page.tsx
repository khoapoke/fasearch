"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { createCustomerOrder, fetchShippingQuote, quoteCustomerCart } from "@/lib/customer-commerce-client";
import { createStripeCheckout, createVnpayCheckout } from "@/lib/customer-payments-client";
import { getSelfProfile } from "@/lib/customer-profile-client";
import { CommerceError, formatMoney, DEFAULT_WEIGHT_PER_ITEM_GRAM, calculateCartWeightGram, type CustomerCartQuote } from "@/lib/customer-commerce";
import { validatePointsInput } from "@/lib/benefits";
import { newOperationKey } from "@/lib/commerce";
import "@/components/customer-commerce/commerce.css";

const WEIGHT_PER_ITEM_GRAM = DEFAULT_WEIGHT_PER_ITEM_GRAM;
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
  const [pointsRaw, setPointsRaw] = useState("0");
  const [cartQuote, setCartQuote] = useState<{ quote: CustomerCartQuote; cartSignature: string } | null>(null);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [method, setMethod] = useState<"COD" | "STRIPE" | "VNPAY">("COD");
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  const quoteReq = useRef(0);
  const voucherReq = useRef(0);
  const initialQuoteRequested = useRef(false);
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);

  const weight = calculateCartWeightGram(cart?.totalItems ?? 0);
  const key = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weight}`;
  const cartSignature = JSON.stringify(cart?.items.map(({ skuId, quantity, unitPrice, totalPrice }) => [skuId, quantity, unitPrice, totalPrice]) ?? []);
  const pointsRequested = pointsRaw.trim() === "" ? 0 : /^\d+$/.test(pointsRaw.trim()) && Number.isSafeInteger(Number(pointsRaw)) ? Number(pointsRaw) : null;
  const currentCartQuote = cartQuote?.cartSignature === cartSignature
    && (cartQuote.quote.voucherCode ?? "") === voucherCode.trim().toUpperCase()
    && pointsRequested !== null && cartQuote.quote.redeemedPoints === pointsRequested ? cartQuote.quote : null;
  const quoteIsCurrent = Boolean(currentCartQuote);

  const applyQuote = useCallback(async (code: string | null, redeemedPoints: number) => {
    if (!cart?.items.length) return null;
    const my = ++voucherReq.current;
    setVoucherBusy(true); setVoucherError(""); setCartQuote(null);
    try {
      const result = await quoteCustomerCart(code, redeemedPoints);
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
    if (authState !== "authenticated") return;
    const c = new AbortController();
    getSelfProfile(c.signal)
      .then((p) => {
        if (c.signal.aborted || !p) return;
        const fullName = [p.lastName, p.firstName].filter(Boolean).join(" ").trim();
        if (fullName) setName((prev) => (prev ? prev : fullName));
        if (p.phoneNumber) setPhone((prev) => (prev ? prev : p.phoneNumber));
        if (p.address) {
          const addr = p.address;
          setAddress((prev) => (prev ? prev : addr));
        }
      })
      .catch(() => {
        /* Best-effort prefill; never blocks checkout */
      });
    return () => c.abort();
  }, [authState]);

  useEffect(() => {
    if (!cart?.items.length) { initialQuoteRequested.current = false; return; }
    if (!initialQuoteRequested.current) {
      initialQuoteRequested.current = true;
      void applyQuote(null, 0);
    }
    void Promise.resolve().then(() => calculate());
  }, [applyQuote, calculate, cart?.items.length, cartSignature]);

  // Ô nhập sai được focus trực tiếp; effect chỉ focus khối lỗi khi lỗi KHÔNG
  // gắn với một ô cụ thể (nếu không, nó sẽ cướp focus khỏi ô vừa trỏ tới).
  const fieldFocus = useRef(false);
  useEffect(() => {
    if (!error) return;
    if (fieldFocus.current) { fieldFocus.current = false; return; }
    errorRef.current?.focus();
  }, [error]);

  const voucherErrorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (voucherError) voucherErrorRef.current?.focus(); }, [voucherError]);

  const zeroDue = Boolean(currentCartQuote && quote && currentCartQuote.merchandiseAmountDue + quote.shippingFee <= 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !cart?.items.length) return;
    // AC-04: lỗi đầu tiên được nêu rõ VÀ focus đúng ô để sửa ngay.
    const firstInvalid =
      !name.trim() ? "checkout-name"
      : !phone.trim() || !/^\d{9,11}$/.test(phone.replace(/[ .-]/g, "")) ? "checkout-phone"
      : !address.trim() || address.trim().length < 5 ? "checkout-address"
      : null;
    if (firstInvalid) {
      fieldFocus.current = true;
      setError(
        firstInvalid === "checkout-name" ? "Vui lòng nhập tên người nhận."
        : firstInvalid === "checkout-phone" ? "Số điện thoại phải có 9–11 chữ số."
        : "Vui lòng nhập địa chỉ giao hàng (ít nhất 5 ký tự).",
      );
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    if (!currentCartQuote) { setError("Hãy áp dụng ưu đãi hoặc báo giá lại trước khi đặt hàng."); return; }
    const current = quote?.key === key ? quote : await calculate();
    if (!current) { setError("Chưa có phí giao hàng hợp lệ. Kiểm tra tỉnh/quận rồi thử lại."); return; }
    pending.current = true;
    setBusy(true); setError(""); setUncertain(false); setCreatedOrderId(null);
    try {
      const totalDue = (currentCartQuote?.merchandiseAmountDue ?? -1) + (quote?.shippingFee ?? 0);
      const payMethod = totalDue === 0 ? "COD" : method;
      const checkout = {
        deliveryAddress: address.trim(), receiverName: name.trim(), receiverPhone: phone.trim(),
        paymentMethod: payMethod, shippingFee: current.shippingFee, ...(note.trim() ? { note: note.trim() } : {}),
        ...(currentCartQuote.voucherCode ? { voucherCode: currentCartQuote.voucherCode } : {}),
        redeemedPoints: currentCartQuote.redeemedPoints,
        quoteFingerprint: currentCartQuote.quoteFingerprint, expectedMerchandiseAmountDue: currentCartQuote.merchandiseAmountDue,
      };
      const signature = JSON.stringify(checkout);
      const checkoutKey = checkoutAttempt.current?.signature === signature ? checkoutAttempt.current.key : newOperationKey();
      checkoutAttempt.current = { signature, key: checkoutKey };
      const order = await createCustomerOrder({ ...checkout, checkoutKey });
      setCreatedOrderId(order.orderId);
      if (payMethod === "COD") {
        router.push(`/don-hang/${order.orderId}`);
        return;
      }
      // Order created with the real paymentMethod; settlement only via a verified provider webhook.
      try {
        // One stable key per (order, provider): a retry or refresh reuses the same session.
        const payKey = `pay-order-${order.orderId}-${payMethod}`.slice(0, 100);
        const attempt = payMethod === "STRIPE"
          ? await createStripeCheckout(order.orderId, payKey)
          : await createVnpayCheckout(order.orderId, payKey);
        if (!attempt.checkoutUrl) throw new Error("Cổng thanh toán chưa trả địa chỉ chuyển hướng.");
        try {
          sessionStorage.setItem("fasearch:pay-attempt", JSON.stringify({ attemptId: attempt.attemptId, orderId: order.orderId, provider: payMethod }));
        } catch { /* best-effort return hint; ket-qua falls back to recent orders */ }
        window.location.assign(attempt.checkoutUrl);
      } catch (providerFailure) {
        // The order exists; never auto-retry a provider session from here.
        setUncertain(true);
        setError(providerFailure instanceof Error ? providerFailure.message : "Không mở được cổng thanh toán.");
      }
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
          <p className="commerce-sub">Kiểm tra thông tin nhận hàng và tổng tiền trước khi đặt. Thanh toán khi nhận hàng (COD).</p>

          {authState === "guest" ? (
            <div className="commerce-empty"><h2>Cần đăng nhập</h2><p>Đăng nhập để xem giỏ hàng và đặt đơn của bạn.</p><Link className="commerce-primary" href="/dang-nhap?next=%2Fthanh-toan">Đăng nhập →</Link></div>
          ) : null}
          {authState === "checking" || (authState === "authenticated" && loading && !cart) ? <p className="commerce-status" role="status">Đang tải giỏ hàng…</p> : null}
          {authState === "error" ? (
            <div className="commerce-empty" role="alert">
              <h2>{cartError.includes("quyền") ? "Khu vực mua sắm dành cho khách hàng" : "Không tải được giỏ hàng"}</h2>
              <p>{cartError.includes("quyền")
                ? "Tài khoản của bạn hiện có vai trò Quản trị viên/Quản lý nên không thể tạo đơn hàng mua sắm. Vui lòng đăng nhập bằng tài khoản Khách hàng để thanh toán hoặc quay lại trang Quản trị."
                : cartError}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                {cartError.includes("quyền") ? (
                  <>
                    <Link className="commerce-primary" href="/quan-tri">Đến trang Quản trị →</Link>
                    <Link className="commerce-ghost" href="/dang-nhap?next=%2Fthanh-toan">Đăng nhập tài khoản Khách hàng</Link>
                  </>
                ) : (
                  <Link className="commerce-ghost" href="/gio-hang">Quay lại giỏ hàng</Link>
                )}
              </div>
            </div>
          ) : null}
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
                <div className="checkout-field"><label htmlFor="checkout-voucher">Mã voucher (không bắt buộc)</label><input id="checkout-voucher" className="checkout-input" value={voucherCode} onChange={(e) => { setVoucherCode(e.target.value); voucherReq.current++; setVoucherBusy(false); setCartQuote(null); checkoutAttempt.current = null; setVoucherError(""); }} maxLength={50} autoComplete="off" /></div>
                <div className="checkout-field"><label htmlFor="checkout-points">Điểm muốn đổi (không bắt buộc)</label><input id="checkout-points" className="checkout-input" value={pointsRaw} onChange={(e) => { setPointsRaw(e.target.value); voucherReq.current++; setVoucherBusy(false); setCartQuote(null); checkoutAttempt.current = null; setVoucherError(""); }} inputMode="numeric" /></div>
                <div className="checkout-field">
                  <span id="checkout-method-label">Phương thức thanh toán</span>
                  <div role="radiogroup" aria-labelledby="checkout-method-label" style={{ display: "grid", gap: 8, marginTop: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <input type="radio" name="pay-method" value="COD" checked={method === "COD"} onChange={() => setMethod("COD")} />
                      <span><strong>Thanh toán khi nhận hàng (COD)</strong><br /><small>Thu tiền mặt khi giao hàng.</small></span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: zeroDue ? 0.5 : 1 }}>
                      <input type="radio" name="pay-method" value="STRIPE" checked={method === "STRIPE"} onChange={() => setMethod("STRIPE")} disabled={zeroDue} />
                      <span><strong>Thẻ quốc tế qua Stripe (thử nghiệm)</strong><br /><small>Chế độ test, thẻ công khai 4242; chỉ webhook đã ký mới ghi nhận thanh toán.</small></span>
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: zeroDue ? 0.5 : 1 }}>
                      <input type="radio" name="pay-method" value="VNPAY" checked={method === "VNPAY"} onChange={() => setMethod("VNPAY")} disabled={zeroDue} />
                      <span><strong>VNPAY sandbox</strong><br /><small>Kênh sandbox; kết quả cuối hiển thị sau đối soát IPN, đơn không tự đánh dấu đã trả.</small></span>
                    </label>
                  </div>
                  {zeroDue ? <p className="commerce-note">Đơn 0đ chỉ thanh toán khi nhận hàng (COD).</p> : null}
                </div>
                <button className="commerce-ghost" type="button" disabled={voucherBusy} onClick={() => {
                  setError("");
                  try { void applyQuote(voucherCode.trim() || null, validatePointsInput(pointsRaw, Number.MAX_SAFE_INTEGER)); }
                  catch (e) { setVoucherError(e instanceof Error ? e.message : "Điểm sử dụng chưa hợp lệ."); }
                }}>{voucherBusy ? "Đang báo giá…" : "Áp dụng ưu đãi / báo giá lại"}</button>
                <p className="checkout-test-note">Thanh toán khi nhận hàng (COD).</p>
                {voucherError ? <p ref={voucherErrorRef} tabIndex={-1} className="commerce-status is-error" role="alert">{voucherError}</p> : null}
                {cartQuote && !quoteIsCurrent && !voucherBusy ? <p className="commerce-status" role="status">Giỏ hàng hoặc mã voucher đã thay đổi. Báo giá lại trước khi đặt đơn.</p> : null}
                {quoteError ? <p className="commerce-status is-error" role="alert">{quoteError}</p> : null}
                {error ? <p ref={errorRef} tabIndex={-1} className="commerce-status is-error" role="alert">{error}</p> : null}
                {uncertain ? <p className="commerce-status" role="alert">Đơn có thể đã được tạo. <Link className="commerce-link" href={createdOrderId ? `/don-hang/${createdOrderId}` : "/don-hang"}>Mở Đơn hàng để đối soát →</Link></p> : null}
                <button className="commerce-primary" type="submit" disabled={busy || quoteBusy || voucherBusy || !quoteIsCurrent}>{busy ? (method === "COD" || zeroDue ? "Đang đặt đơn…" : "Đang mở cổng thanh toán…") : (method === "COD" || zeroDue ? "Đặt hàng (COD)" : "Đặt đơn và mở cổng thanh toán")}</button>
                <p className="commerce-note">Giá và ưu đãi được xác nhận lại khi bạn đặt đơn.</p>
              </form>
              <aside className="checkout-summary-panel" aria-label="Tóm tắt thanh toán">
                <h2>Đơn của bạn</h2>
                <ul className="checkout-lines">{cart.items.map((line) => { const quoted = currentCartQuote?.items.find((item) => item.skuId === line.skuId); return <li className="checkout-summary-line" key={line.skuId}><span>{line.productName} · {[line.color, line.size].filter(Boolean).join(" · ")} × {line.quantity}{quoted?.discountAmount ? <small style={{ display: "block" }}>Giảm theo voucher: {formatMoney(quoted.discountAmount)}</small> : null}</span><strong>{formatMoney(quoted?.totalPrice ?? line.totalPrice)}</strong></li>; })}</ul>
                <div className="checkout-summary-line"><span>Tạm tính hàng hóa</span><strong>{formatMoney(currentCartQuote?.subTotal ?? cart.subTotal)}</strong></div>
                {currentCartQuote?.voucherCode ? <div className="checkout-summary-line"><span>Voucher {currentCartQuote.voucherCode}</span><strong>−{formatMoney(currentCartQuote.voucherDiscount)}</strong></div> : null}
                {currentCartQuote && currentCartQuote.pointsDiscount > 0 ? <div className="checkout-summary-line"><span>Đổi {currentCartQuote.redeemedPoints} điểm</span><strong>−{formatMoney(currentCartQuote.pointsDiscount)}</strong></div> : null}
                {currentCartQuote && currentCartQuote.allowedRedeemedPoints > 0 ? <p className="commerce-note">Bạn có thể dùng tối đa {currentCartQuote.allowedRedeemedPoints.toLocaleString("vi-VN")} điểm cho đơn này.</p> : null}
                <div className="checkout-summary-line"><span>Tiền hàng sau ưu đãi</span><strong>{currentCartQuote ? formatMoney(currentCartQuote.merchandiseAmountDue) : "—"}</strong></div>
                <div className="checkout-summary-line"><span>Phí giao hàng {quote ? `(${quote.estimatedDays})` : ""}</span><strong>{quote ? formatMoney(quote.shippingFee) : quoteBusy ? "Đang tính…" : "—"}</strong></div>
                <div className="checkout-total"><span>Tổng tạm tính</span><strong>{currentCartQuote && quote ? formatMoney(currentCartQuote.merchandiseAmountDue + quote.shippingFee) : "—"}</strong></div>
                <div className="checkout-cod"><span>Thanh toán</span><strong>{zeroDue ? "COD — thu khi nhận (đơn 0đ)" : method === "COD" ? "COD — thu khi nhận" : method === "STRIPE" ? "Stripe (sandbox) — chuyển cổng sau khi đặt" : "VNPAY (sandbox) — chuyển cổng sau khi đặt"}</strong></div>
                <button className="commerce-ghost" type="button" onClick={() => { setQuote(null); void calculate(); }} disabled={quoteBusy}>{quoteBusy ? "Đang tính phí…" : "Tính lại phí giao hàng"}</button>
                <p className="commerce-note">Tổng cuối cùng hiển thị sau khi đơn được xác nhận.</p>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </StorefrontShell>
  );
}
