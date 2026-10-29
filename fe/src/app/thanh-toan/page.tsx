"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { createCustomerOrder, fetchShippingQuote } from "@/lib/customer-commerce-client";
import { CommerceError, formatMoney } from "@/lib/customer-commerce";
import "@/components/customer-commerce/commerce.css";

const WEIGHT_PER_ITEM_GRAM = 500;
const DEFAULT_PROVINCE = "TP. Hồ Chí Minh";
const DEFAULT_DISTRICT = "Quận 1";

type Quote = { shippingFee: number; estimatedDays: string; key: string };

export default function CheckoutPage() {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const quoteReq = useRef(0);

  const weight = Math.max(1, (cart?.totalItems ?? 0) * WEIGHT_PER_ITEM_GRAM);
  const key = `${province.trim().toLowerCase()}|${district.trim().toLowerCase()}|${weight}`;

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
    if (!cart?.items.length) return;
    void Promise.resolve().then(() => calculate());
  }, [calculate, cart?.items.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !cart?.items.length) return;
    if (!name.trim() || !phone.trim() || !address.trim()) { setError("Điền đủ người nhận, số điện thoại và địa chỉ."); return; }
    if (!/^\d{9,11}$/.test(phone.replace(/[ .-]/g, ""))) { setError("Số điện thoại phải có 9–11 chữ số."); return; }
    if (address.trim().length < 5) { setError("Địa chỉ giao hàng quá ngắn."); return; }
    const current = quote?.key === key ? quote : await calculate();
    if (!current) { setError("Chưa có phí giao hàng hợp lệ. Kiểm tra tỉnh/quận rồi thử lại."); return; }
    pending.current = true;
    setBusy(true); setError(""); setUncertain(false);
    try {
      const order = await createCustomerOrder({
        deliveryAddress: address.trim(), receiverName: name.trim(), receiverPhone: phone.trim(),
        paymentMethod: "COD", shippingFee: current.shippingFee, ...(note.trim() ? { note: note.trim() } : {}),
      });
      router.push(`/don-hang/${order.orderId}`);
    } catch (failure) {
      if (failure instanceof CommerceError) setError(failure.message);
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
                <p className="checkout-test-note">Đơn thử nghiệm. Phí giao hàng lấy từ API BE với giả định {WEIGHT_PER_ITEM_GRAM}g/món vì DTO sản phẩm công khai chưa có trọng lượng; đây không phải metadata sản xuất.</p>
                {quoteError ? <p className="commerce-status is-error" role="alert">{quoteError}</p> : null}
                {error ? <p className="commerce-status is-error" role="alert">{error}</p> : null}
                {uncertain ? <p className="commerce-status" role="alert">Đơn có thể đã được tạo. <Link className="commerce-link" href="/don-hang">Mở Đơn hàng để đối soát →</Link></p> : null}
                <button className="commerce-primary" type="submit" disabled={busy || quoteBusy}>{busy ? "Đang tạo đơn thử nghiệm…" : "Đặt đơn thử nghiệm (COD)"}</button>
                <p className="commerce-note">Không tự retry khi mất phản hồi; không có phí vận chuyển do trình duyệt tự đặt. Tổng cuối do BE trả về.</p>
              </form>
              <aside className="checkout-summary-panel" aria-label="Tóm tắt thanh toán">
                <h2>Đơn của bạn</h2>
                <ul className="checkout-lines">{cart.items.map((line) => <li className="checkout-summary-line" key={line.skuId}><span>{line.productName} · {[line.color, line.size].filter(Boolean).join(" · ")} × {line.quantity}</span><strong>{formatMoney(line.totalPrice)}</strong></li>)}</ul>
                <div className="checkout-summary-line"><span>Tạm tính</span><strong>{formatMoney(cart.subTotal)}</strong></div>
                <div className="checkout-summary-line"><span>Phí giao hàng {quote ? `(${quote.estimatedDays})` : ""}</span><strong>{quote ? formatMoney(quote.shippingFee) : quoteBusy ? "Đang tính…" : "—"}</strong></div>
                <div className="checkout-total"><span>Tổng tạm tính</span><strong>{quote ? formatMoney(cart.subTotal + quote.shippingFee) : "—"}</strong></div>
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
