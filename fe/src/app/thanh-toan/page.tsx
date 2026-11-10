"use client";

import Link from "next/link";
import { LocationPicker, type DeliveryLocation } from "@/components/customer-commerce/location-picker";
import { AddressAutocomplete } from "@/components/customer-commerce/address-autocomplete";
import { PaymentCards, PointsToggle, VoucherPicker, etaLabel, variantLabel } from "@/components/customer-commerce/checkout-parts";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { ProductLineImage } from "@/components/customer-commerce/product-line-image";
import { createCustomerOrder, fetchShippingQuote, quoteCustomerCart } from "@/lib/customer-commerce-client";
import { createStripeCheckout, createVnpayCheckout } from "@/lib/customer-payments-client";
import { getSelfProfile, customerFullName } from "@/lib/customer-profile-client";
import { fetchPublicOffers } from "@/lib/offers-client";
import type { PublicOffer } from "@/lib/offers";
import { CommerceError, formatMoney, calculateCartWeightGram, type CustomerCartQuote } from "@/lib/customer-commerce";
import { newOperationKey } from "@/lib/commerce";
import "@/components/customer-commerce/commerce.css";
import "@/components/customer-commerce/checkout.css";

const DEFAULT_PROVINCE = "TP. Hồ Chí Minh";
const DEFAULT_DISTRICT = "Quận 1";
const QUOTE_DEBOUNCE_MS = 300;
const SHIPPING_DEBOUNCE_MS = 400;

type Quote = import("@/lib/customer-commerce").ShippingQuote & { key: string };
type CartQuoteState = { quote: CustomerCartQuote; cartSignature: string; code: string; pointsOn: boolean };

export default function CheckoutPage() {
  return <Suspense fallback={<StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none"><div className="commercePage"><p className="commerce-status" role="status">Đang tải dữ liệu thanh toán…</p></div></StorefrontShell>}><CheckoutPageContent /></Suspense>;
}

function CheckoutPageContent() {
  const router = useRouter();
  const { cart, authState, loading, error: cartError } = useCustomerCart();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [province, setProvince] = useState(DEFAULT_PROVINCE);
  const [district, setDistrict] = useState(DEFAULT_DISTRICT);
  const [note, setNote] = useState("");
  // Có đủ thông tin từ hồ sơ thì thu gọn thành thẻ tóm tắt; khách chỉ bấm "Sửa" khi cần.
  const [editing, setEditing] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const touched = useRef(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const initialVoucher = (useSearchParams().get("voucher") ?? "").trim().toUpperCase();
  const [appliedCode, setAppliedCode] = useState(initialVoucher);
  const [pointsOn, setPointsOn] = useState(false);
  const [cartQuote, setCartQuote] = useState<CartQuoteState | null>(null);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [offersState, setOffersState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [method, setMethod] = useState<"COD" | "STRIPE" | "VNPAY">("COD");
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const pending = useRef(false);
  const quoteReq = useRef(0);
  const voucherReq = useRef(0);
  const checkoutAttempt = useRef<{ signature: string; key: string } | null>(null);

  const weight = calculateCartWeightGram(cart?.totalItems ?? 0);
  const key = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weight}|${JSON.stringify(location)}|${appliedCode}`;
  const cartSignature = JSON.stringify(cart?.items.map(({ skuId, quantity, unitPrice, totalPrice }) => [skuId, quantity, unitPrice, totalPrice]) ?? []);
  // The server quote is the truth: it is "current" only for this exact cart, voucher and points choice.
  const shownQuote = cartQuote && cartQuote.cartSignature === cartSignature ? cartQuote : null;
  const currentCartQuote = shownQuote && shownQuote.code === appliedCode && shownQuote.pointsOn === pointsOn ? shownQuote.quote : null;
  const quoteIsCurrent = Boolean(currentCartQuote);
  const displayQuote = shownQuote?.quote ?? null;
  const shippingFresh = quote?.key === key && !quoteBusy;

  const requestCartQuote = useCallback(async (code: string, usePoints: boolean) => {
    if (!cart?.items.length) return;
    const my = ++voucherReq.current;
    setVoucherBusy(true);
    try {
      // First ask for the cap (0 points), then re-quote with the points the server allows.
      let result = await quoteCustomerCart(code || null, 0);
      if (voucherReq.current !== my) return;
      if (usePoints && result.allowedRedeemedPoints > 0) {
        result = await quoteCustomerCart(code || null, result.allowedRedeemedPoints);
        if (voucherReq.current !== my) return;
      }
      setCartQuote({ quote: result, cartSignature, code, pointsOn: usePoints });
      checkoutAttempt.current = null; setError("");
    } catch (failure) {
      if (voucherReq.current !== my) return;
      const message = failure instanceof Error ? failure.message : "Không thể báo giá ưu đãi.";
      setVoucherError(message);
      // A rejected voucher is dropped so the order can still be quoted without it.
      if (code) setAppliedCode("");
      else setCartQuote(null);
    } finally {
      if (voucherReq.current === my) setVoucherBusy(false);
    }
  }, [cart?.items.length, cartSignature]);

  const calculate = useCallback(async () => {
    if (!province.trim() || !district.trim() || !cart?.items.length) return null;
    const my = ++quoteReq.current;
    setQuoteBusy(true); setQuoteError("");
    try {
      const result = await fetchShippingQuote(province.trim(), district.trim(), weight, undefined, location, appliedCode);
      if (quoteReq.current !== my) return null;
      const next = { ...result, key };
      setQuote(next);
      return next;
    } catch (failure) {
      if (quoteReq.current !== my) return null;
      setQuote(null);
      setQuoteError(failure instanceof Error ? failure.message : "Không tính được phí giao hàng.");
      return null;
    } finally {
      if (quoteReq.current === my) setQuoteBusy(false);
    }
  }, [cart?.items.length, district, province, weight, location, appliedCode, key]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicOffers(controller.signal)
      .then(({ offers: list }) => { setOffers(list); setOffersState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setOffersState("error"); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") return;
    const c = new AbortController();
    getSelfProfile(c.signal)
      .then((p) => {
        if (c.signal.aborted || !p) return;
        const fullName = customerFullName(p);
        if (fullName) setName((prev) => (prev ? prev : fullName));
        if (p.phoneNumber) setPhone((prev) => (prev ? prev : p.phoneNumber));
        if (p.deliveryLatitude != null && p.deliveryLongitude != null) setLocation((prev) => prev ?? { deliveryLatitude: p.deliveryLatitude!, deliveryLongitude: p.deliveryLongitude! });
        if (p.address) {
          const addr = p.address;
          setAddress((prev) => (prev ? prev : addr));
        }
        if (!touched.current && fullName && p.phoneNumber && p.address && p.address.trim().length >= 5) setEditing(false);
      })
      .catch(() => {
        /* Best-effort prefill; never blocks checkout */
      });
    return () => c.abort();
  }, [authState]);

  // Auto re-quote (debounced) whenever cart, voucher or points choice changes.
  useEffect(() => {
    if (!cart?.items.length) return;
    const timer = window.setTimeout(() => { void requestCartQuote(appliedCode, pointsOn); }, QUOTE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [requestCartQuote, appliedCode, pointsOn, cart?.items.length]);

  // Auto re-quote shipping when address pin / area / voucher changes.
  useEffect(() => {
    if (!cart?.items.length) return;
    const timer = window.setTimeout(() => { void calculate(); }, SHIPPING_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [calculate, cart?.items.length, cartSignature]);

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

  function chooseVoucher(code: string) {
    setVoucherError(""); checkoutAttempt.current = null;
    setAppliedCode(code);
  }

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
      setEditing(true);
      setError(
        firstInvalid === "checkout-name" ? "Vui lòng nhập tên người nhận."
        : firstInvalid === "checkout-phone" ? "Số điện thoại phải có 9–11 chữ số."
        : "Vui lòng nhập địa chỉ giao hàng (ít nhất 5 ký tự).",
      );
      window.requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus());
      return;
    }
    if (!currentCartQuote) { setError("Giá đang được cập nhật. Thử lại sau giây lát."); return; }
    const current = quote?.key === key ? quote : await calculate();
    if (!current) { setError("Chưa có phí giao hàng hợp lệ. Hãy chọn vị trí trên bản đồ hoặc kiểm tra tỉnh/quận rồi thử lại."); return; }
    pending.current = true;
    setBusy(true); setError(""); setUncertain(false); setCreatedOrderId(null);
    try {
      const totalDue = currentCartQuote.merchandiseAmountDue + current.shippingFee;
      const payMethod = totalDue === 0 ? "COD" : method;
      const checkout = {
        ...location, deliveryAddress: address.trim(), receiverName: name.trim(), receiverPhone: phone.trim(),
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
        setAppliedCode("");
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
  const savings = (displayQuote ? displayQuote.voucherDiscount + displayQuote.pointsDiscount : 0) + (quote?.shippingDiscount ?? 0);
  const total = displayQuote && quote ? displayQuote.merchandiseAmountDue + quote.shippingFee : null;
  const updating = voucherBusy || quoteBusy || (quote !== null && quote.key !== key) || (shownQuote !== null && !currentCartQuote);
  const payLabel = method === "COD" || zeroDue ? "Đặt hàng" : "Đặt đơn và mở cổng thanh toán";
  const itemCount = cart?.totalItems ?? 0;
  return (
    <StorefrontShell active="/thanh-toan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn"><Link href="/gio-hang">Giỏ hàng</Link><span aria-hidden="true">›</span><span aria-current="page">Thanh toán</span></nav>
          <h1 className="commerce-title">Thanh toán</h1>
          <p className="commerce-sub">Kiểm tra thông tin nhận hàng và tổng tiền trước khi đặt.</p>

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
            <div className="checkout-grid co-grid">
              <form id="checkout-form" className="checkout-form-panel co-form" onSubmit={submit} noValidate>
                <section className="co-section" aria-labelledby="co-delivery">
                  <div className="co-head">
                    <p className="co-eyebrow">01 · Giao tới</p>
                    <h2 id="co-delivery">Thông tin nhận hàng</h2>
                  </div>
                  {!editing ? (
                    <div className="co-shipto">
                      <div className="co-shipto-body">
                        <p className="co-shipto-who"><b>{name}</b><span>{phone}</span></p>
                        <p className="co-shipto-addr">{address}</p>
                        {!location ? (
                          <p className="co-shipto-hint">
                            Phí giao đang tính theo {district}, {province}.{" "}
                            <button type="button" className="co-linkbtn" onClick={() => { touched.current = true; setEditing(true); }}>Ghim địa chỉ để tính chính xác</button>
                          </p>
                        ) : null}
                      </div>
                      <button type="button" className="co-edit" aria-label="Sửa thông tin nhận hàng" onClick={() => { touched.current = true; setEditing(true); }}>Sửa</button>
                    </div>
                  ) : (
                    <div className="co-editform">
                      <div className="checkout-grid-2">
                        <div className="checkout-field"><label htmlFor="checkout-name">Họ và tên</label><input id="checkout-name" className="checkout-input" value={name} onChange={(e) => { touched.current = true; setName(e.target.value); }} autoComplete="name" /></div>
                        <div className="checkout-field"><label htmlFor="checkout-phone">Số điện thoại</label><input id="checkout-phone" className="checkout-input" value={phone} onChange={(e) => { touched.current = true; setPhone(e.target.value); }} inputMode="tel" autoComplete="tel" /></div>
                      </div>
                      <div className="checkout-field">
                        <label htmlFor="checkout-address">Địa chỉ nhận hàng</label>
                        <AddressAutocomplete
                          id="checkout-address"
                          value={address}
                          onText={(text) => { touched.current = true; setAddress(text); setLocation(null); }}
                          onPick={(picked, at) => { touched.current = true; setAddress(picked); setLocation(at); }}
                          onLocate={(at) => { touched.current = true; setLocation(at); }}
                        />
                      </div>
                      {location ? (
                        <p className="co-pinned"><span aria-hidden="true">✓</span> Đã ghim vị trí, phí giao tính theo quãng đường thực tế.</p>
                      ) : (
                        <div className="co-area">
                          <p className="co-muted">Chưa ghim vị trí: chọn một gợi ý địa chỉ ở trên, hoặc điền tỉnh/quận để ước tính phí.</p>
                          <div className="checkout-grid-2">
                            <div className="checkout-field"><label htmlFor="checkout-province">Tỉnh/Thành phố</label><input id="checkout-province" className="checkout-input" value={province} onChange={(e) => setProvince(e.target.value)} /></div>
                            <div className="checkout-field"><label htmlFor="checkout-district">Quận/Huyện</label><input id="checkout-district" className="checkout-input" value={district} onChange={(e) => setDistrict(e.target.value)} /></div>
                          </div>
                        </div>
                      )}
                      <details className="co-map" open={mapOpen} onToggle={(e) => setMapOpen(e.currentTarget.open)}>
                        <summary>{location ? "Chỉnh ghim trên bản đồ" : "Ghim trên bản đồ"}</summary>
                        {mapOpen ? <LocationPicker mapOnly value={location} onChange={(at) => { touched.current = true; setLocation(at); }} /> : null}
                      </details>
                      {name.trim() && phone.trim() && address.trim().length >= 5 ? (
                        <button type="button" className="co-done" onClick={() => setEditing(false)}>Xong</button>
                      ) : null}
                    </div>
                  )}
                  <div className={`co-ship${quote && shippingFresh ? "" : " is-updating"}`} aria-live="polite">
                    {quote ? (
                      <>
                        <div className="co-ship-main">
                          <span className="co-ship-fee">{formatMoney(quote.shippingFee)}</span>
                          {(quote.shippingDiscount ?? 0) > 0 ? <span className="co-ship-free">FREE-SHIP −{formatMoney(quote.shippingDiscount ?? 0)}</span> : null}
                        </div>
                        <ul className="co-ship-facts">
                          {quote.distanceKm != null ? <li><b>{quote.distanceKm.toLocaleString("vi-VN")} km</b> {quote.method === "google" ? "theo tuyến đường" : "ước tính"}</li> : <li>Tính theo khu vực</li>}
                          {quote.estimatedDays ? <li>Giao trong <b>{etaLabel(quote.estimatedDays)}</b></li> : null}
                        </ul>
                      </>
                    ) : quoteError ? <span className="co-ship-error">{quoteError}</span> : <span className="co-muted">{quoteBusy ? "Đang tính phí giao hàng…" : "Nhập địa chỉ để xem phí giao hàng."}</span>}
                  </div>
                  {noteOpen || note ? (
                    <div className="checkout-field co-note"><label htmlFor="checkout-note">Ghi chú cho người giao</label><input id="checkout-note" className="checkout-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ví dụ: gọi trước khi giao, gửi bảo vệ…" /></div>
                  ) : (
                    <button type="button" className="co-linkbtn co-note-add" onClick={() => setNoteOpen(true)}>+ Thêm ghi chú cho người giao</button>
                  )}
                </section>

                <section className="co-section" aria-labelledby="co-offers">
                  <div className="co-head">
                    <p className="co-eyebrow">02 · Ưu đãi</p>
                    <h2 id="co-offers">Ưu đãi và điểm</h2>
                  </div>
                  <VoucherPicker offers={offers} offersState={offersState} appliedCode={appliedCode} busy={voucherBusy} error={voucherError} errorRef={voucherErrorRef} onApply={chooseVoucher} onClear={() => chooseVoucher("")} />
                  <PointsToggle
                    loaded={displayQuote !== null}
                    policyEnabled={displayQuote?.policyStatus === "ENABLED"}
                    available={displayQuote?.availablePoints ?? null}
                    allowed={displayQuote?.allowedRedeemedPoints ?? 0}
                    perPoint={displayQuote?.redeemCurrencyPerPoint ?? null}
                    remaining={displayQuote?.remainingMerchandiseAmount ?? 0}
                    on={pointsOn}
                    appliedDiscount={currentCartQuote?.pointsDiscount ?? displayQuote?.pointsDiscount ?? 0}
                    onToggle={(next) => { setPointsOn(next); setVoucherError(""); checkoutAttempt.current = null; }}
                  />
                </section>

                <section className="co-section" aria-labelledby="co-pay">
                  <div className="co-head">
                    <p className="co-eyebrow">03 · Thanh toán</p>
                    <h2 id="co-pay">Phương thức thanh toán</h2>
                  </div>
                  <PaymentCards method={method} onChange={setMethod} zeroDue={zeroDue} />
                </section>
              </form>

              <aside className="checkout-summary-panel co-summary" aria-label="Tóm tắt thanh toán" aria-busy={updating}>
                <h2>Đơn của bạn <span className="co-count">{itemCount} sản phẩm</span></h2>
                <ul className="co-lines">
                  {cart.items.map((line) => {
                    const quoted = displayQuote?.items.find((item) => item.skuId === line.skuId);
                    const variant = variantLabel(line.color, line.size);
                    return (
                      <li className="co-line" key={line.skuId}>
                        <ProductLineImage className="co-line-img" src={line.imageUrl?.replace(/^\/api\/v1\/products\/images\//, "/api/catalog/product-images/")} />
                        <span className="co-line-body">
                          <span className="co-line-name">{line.productName}</span>
                          {variant ? <span className="co-line-variant">{variant}</span> : null}
                          <span className="co-line-qty">Số lượng {line.quantity}</span>
                        </span>
                        <strong className="co-line-price">{formatMoney(quoted?.totalPrice ?? line.totalPrice)}</strong>
                      </li>
                    );
                  })}
                </ul>

                <dl className="co-rows">
                  <div className="co-row"><dt>Tạm tính</dt><dd>{formatMoney(displayQuote?.subTotal ?? cart.subTotal)}</dd></div>
                  {displayQuote?.voucherCode && displayQuote.voucherDiscount > 0 ? <div className="co-row is-save"><dt>Voucher {displayQuote.voucherCode}</dt><dd>−{formatMoney(displayQuote.voucherDiscount)}</dd></div> : null}
                  {displayQuote && displayQuote.pointsDiscount > 0 ? <div className="co-row is-save"><dt>Điểm thưởng ({displayQuote.redeemedPoints.toLocaleString("vi-VN")})</dt><dd>−{formatMoney(displayQuote.pointsDiscount)}</dd></div> : null}
                  <div className="co-row">
                    <dt>Phí giao hàng{quote?.distanceKm != null ? ` · ${quote.distanceKm.toLocaleString("vi-VN")} km` : ""}</dt>
                    <dd>
                      {quote ? (
                        <>
                          {(quote.shippingDiscount ?? 0) > 0 ? <s className="co-was">{formatMoney(quote.baseFee ?? 0)}</s> : null}
                          <span className={(quote.shippingDiscount ?? 0) > 0 ? "co-free" : undefined}>{quote.shippingFee === 0 ? "Miễn phí" : formatMoney(quote.shippingFee)}</span>
                        </>
                      ) : quoteBusy ? "Đang tính…" : "—"}
                    </dd>
                  </div>
                </dl>

                {savings > 0 ? <p className="co-saved">Bạn tiết kiệm <b>{formatMoney(savings)}</b></p> : null}

                <div className="checkout-total co-total">
                  <span>Tổng cộng</span>
                  <strong className={updating ? "is-stale" : undefined}>{total !== null ? formatMoney(total) : "—"}</strong>
                </div>
                <p className="co-pay-note">{zeroDue || method === "COD" ? "Thanh toán khi nhận hàng" : method === "STRIPE" ? "Thẻ quốc tế (Stripe, thử nghiệm)" : "VNPay (sandbox)"}</p>

                {quoteError && !quote ? <p className="commerce-status is-error co-inline-status" role="alert">{quoteError}</p> : null}
                {error ? <p ref={errorRef} tabIndex={-1} className="commerce-status is-error co-inline-status" role="alert">{error}</p> : null}
                {uncertain ? <p className="commerce-status co-inline-status" role="alert">Đơn có thể đã được tạo. <Link className="commerce-link" href={createdOrderId ? `/don-hang/${createdOrderId}` : "/don-hang"}>Mở Đơn hàng để đối soát →</Link></p> : null}
                <button className="commerce-primary co-submit" type="submit" form="checkout-form" disabled={busy || updating || !quoteIsCurrent || !shippingFresh}>
                  {busy ? (method === "COD" || zeroDue ? "Đang đặt đơn…" : "Đang mở cổng thanh toán…") : updating ? "Đang cập nhật giá…" : payLabel}
                </button>
                <p className="commerce-note">Giá và ưu đãi được xác nhận lại khi bạn đặt đơn.</p>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </StorefrontShell>
  );
}
