"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { readOwnIdentity } from "@/components/account/account-session";
import {
  createOnlineOrder, fetchCart, fetchWarehouses, quoteCart,
} from "@/lib/commerce-client";
import {
  commerceErrorMessage, formatVndContract, newOperationKey, validateReceiver,
  type Cart, type Quote, type Warehouse,
} from "@/lib/commerce";
import {
  appliedBenefitsChanged, benefitErrorMessage, canonicalVoucherCode, validatePointsInput,
} from "@/lib/benefits";
import "@/components/storefront/preview.css";

export default function CheckoutPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [maKho, setMaKho] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [opKey, setOpKey] = useState(() => newOperationKey());
  const [voucher, setVoucher] = useState("");
  const [pointsRaw, setPointsRaw] = useState("");
  const [benefitIssue, setBenefitIssue] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [appliedPoints, setAppliedPoints] = useState(0);
  const busyRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const me = await readOwnIdentity().catch(() => null);
      if (!me) {
        router.replace("/dang-nhap?next=/thanh-toan");
        return;
      }
      const c = await fetchCart();
      setCart(c);
      try {
        const wh = await fetchWarehouses();
        setWarehouses(wh);
        const def = wh.find((w) => w.laMacDinh) ?? wh[0] ?? null;
        setMaKho(def ? def.maKho : null);
        if (def) {
          setQuoting(true);
          try {
            const q = await quoteCart(def.maKho, c.phienBan);
            setQuote(q);
          } finally {
            setQuoting(false);
          }
        }
      } catch {
        setWarehouses([]);
      }
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(status, e instanceof Error ? e.message : "Không tải được thanh toán."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  // Đưa tiêu điểm về thông báo lỗi sau khi React đã gắn node vào DOM: gọi
  // focus() ngay sau setError sẽ là no-op vì node lỗi còn chưa tồn tại.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function refreshQuote(maKhoV: number | null, cartV: Cart | null, benefits?: { voucherCode?: string | null; diemSuDung?: number | null }) {
    if (maKhoV === null || !cartV) return;
    setQuoting(true);
    setError("");
    setBenefitIssue("");
    try {
      const q = await quoteCart(maKhoV, cartV.phienBan, benefits);
      setQuote(q);
      setAppliedVoucher(benefits?.voucherCode ?? null);
      setAppliedPoints(benefits?.diemSuDung ?? 0);
      if (benefits && (benefits.voucherCode || (benefits.diemSuDung ?? 0) > 0) && !q.giamVoucher && !q.giamDiem) {
        setBenefitIssue("Máy chủ không áp dụng ưu đãi nào cho giỏ này (mã không khớp, hết hạn/tắt, hoặc điểm chưa đủ điều kiện). Tổng dưới đây là giá gốc.");
      }
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Lấy báo giá thất bại.";
      if (benefits && (status === 400 || status === 404)) {
        setBenefitIssue(benefitErrorMessage(status, null, msg) + " Mã/điểm đã nhập được giữ nguyên.");
      } else {
        setError(commerceErrorMessage(status, msg));
      }
      if (status === 409) {
        try {
          const fresh = await fetchCart();
          setCart(fresh);
          setQuote(null);
        } catch {
          /* keep */
        }
      }
    } finally {
      setQuoting(false);
    }
  }

  async function submit() {
    if (busyRef.current || submitting) return;
    try {
      validateReceiver(name, phone, address);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thông tin nhận hàng chưa hợp lệ.");
      return;
    }
    if (!cart || maKho === null || !quote) {
      setError("Cần giỏ, kho và báo giá máy chủ trước khi đặt. Tải lại báo giá.");
      return;
    }
    const voucherNow = voucher.trim() ? voucher.trim().toUpperCase() : null;
    const pointsNow = pointsRaw.trim() ? Number(pointsRaw) : 0;
    // Dirty-guard TRƯỚC khi khóa busy (R3-F1): return ở đây chưa khóa nên submit sau vẫn bấm được.
    if (appliedBenefitsChanged(voucherNow, pointsNow, appliedVoucher, appliedPoints)) {
      setError("Ưu đãi đã thay đổi sau báo giá — bấm “Áp dụng & tính lại” rồi mới đặt (không tự tính lại âm thầm).");
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const { order, replay } = await createOnlineOrder({
        khoaTam: opKey,
        maKho,
        phienBanGio: quote.phienBanGio,
        tongThanhToanDuKien: quote.tongThanhToan,
        nguoiNhan: name.trim(),
        sdtNhan: phone.trim(),
        diaChiGiao: address.trim(),
        ...(note.trim() ? { ghiChu: note.trim() } : {}),
        ...(appliedVoucher ? { voucherCode: appliedVoucher } : {}),
        ...(quote.maChinhSach !== undefined && quote.maChinhSach !== null ? { maChinhSach: quote.maChinhSach } : {}),
        ...(quote.phienBanChinhSach !== undefined && quote.phienBanChinhSach !== null ? { phienBanChinhSach: quote.phienBanChinhSach } : {}),
        ...(appliedPoints > 0 ? { diemSuDung: appliedPoints } : {}),
      });
      // Thành công: điều hướng tới đơn thật. Giỏ server đã tiêu thụ phần đã mua.
      router.replace(`/don-hang/${order.maDonHang}${replay ? "?replay=1" : ""}`);
    } catch (e) {
      const status = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Đặt hàng thất bại.";
      // Giữ nguyên giỏ + form khi lỗi; 409 yêu cầu refresh/requote, không retry mù.
      if (status === 409) {
        setError(`${commerceErrorMessage(status, msg)} Giỏ/form được giữ nguyên — tải lại báo giá rồi đặt lại với khóa mới.`);
        setOpKey(newOperationKey());
        try {
          const fresh = await fetchCart();
          setCart(fresh);
          setQuote(null);
        } catch {
          /* keep */
        }
      } else {
        setError(`${commerceErrorMessage(status, msg)} Giỏ và thông tin đã nhập được giữ nguyên — không mất hàng.`);
      }
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <StorefrontShell
      active="/thanh-toan"
      previewNote="Thanh toán thật: COD duy nhất, phí pilot cố định từ máy chủ, giảm giá 0. QR/thẻ chưa mở và hiển thị không khả dụng."
    >
      <div className="pvWrap">
        <nav className="pgCrumbs" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span>
          <Link href="/gio-hang">Giỏ hàng</Link><span aria-hidden="true">›</span>
          <span aria-current="page">Đặt hàng &amp; Thanh toán</span>
        </nav>
        <h1 className="pgTitle">Đặt Hàng &amp; Thanh Toán</h1>
        <div className="pvSteps" aria-label="Các bước">
          <Link href="/gio-hang"><span>1. Giỏ hàng ✓</span></Link>
          <span aria-current="step">2. Đặt hàng &amp; Thanh toán</span>
          <span>3. Đơn thật</span>
        </div>

        {loading ? <p className="pgState" role="status"><strong>Đang tải giỏ và báo giá…</strong></p> : null}
        {error ? (
          <div ref={errorRef} tabIndex={-1} className="pvCard" role="alert" aria-label="Lỗi thanh toán">
            <p className="sub">{error}</p>
            <p style={{ display: "flex", gap: 8 }}>
              <button className="hmCta hmCtaGhost" type="button" onClick={() => refreshQuote(maKho, cart)}>Tải lại báo giá (giữ form)</button>
            </p>
          </div>
        ) : null}

        {!loading ? (
          <div className="pvGrid">
            <div>
              <section className="pvCard" aria-label="Thông tin giao nhận">
                <h2>1. Thông tin giao nhận hàng</h2>
                <div className="pvField"><label htmlFor="co-name">Họ tên người nhận</label><input id="co-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn Hưng" autoComplete="name" /></div>
                <div className="pvField"><label htmlFor="co-phone">Số điện thoại</label><input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0901234567" autoComplete="tel" inputMode="tel" /></div>
                <div className="pvField"><label htmlFor="co-addr">Địa chỉ nhận hàng</label><input id="co-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường, quận, tỉnh/thành" autoComplete="street-address" /></div>
                <div className="pvField"><label htmlFor="co-note">Ghi chú (tùy chọn)</label><input id="co-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Giờ nhận, điểm mốc…" /></div>
              </section>
              <section className="pvCard" aria-label="Kho">
                <h2>2. Kho phục vụ (1 kho/đơn)</h2>
                {warehouses.length === 0 ? (
                  <p className="sub">Chưa tải được kho — thử tải lại trang.</p>
                ) : (
                  <div className="pvField">
                    <label htmlFor="co-wh">Kho</label>
                    <select
                      id="co-wh"
                      value={maKho ?? ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMaKho(v);
                        setQuote(null);
                        setAppliedVoucher(null);
                        setAppliedPoints(0);
                        setVoucher("");
                        setPointsRaw("");
                        if (cart) refreshQuote(v, cart);
                      }}
                    >
                      <option value="">— Chọn kho —</option>
                      {warehouses.map((w) => (
                        <option key={w.maKho} value={w.maKho}>{w.tenKho}{w.laMacDinh ? " (mặc định)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <p className="sub">Không tách kho trong đợt này.</p>
              </section>
              <section className="pvCard" aria-label="Thanh toán">
                <h2>3. Phương thức thanh toán</h2>
                <label className="pvRadio" aria-checked="true">
                  <input type="radio" checked readOnly />
                  <span><b>COD — Thanh toán khi nhận hàng</b><small>Máy chủ tự chọn COD cho đơn online.</small></span>
                </label>
                <p className="sub">QR/thẻ <b>chưa khả dụng</b> trong đợt này — không hiển thị thành công giả.</p>
              </section>
            </div>
            <aside>
              <section className="pvCard" aria-label="Tóm tắt đơn">
                <h2>Tóm tắt đơn hàng</h2>
                {!cart || cart.items.length === 0 ? (
                  <p className="mpMuted">Giỏ đang trống — <Link href="/nam">thêm SKU →</Link></p>
                ) : (
                  cart.items.map((i) => (
                    <div className="pvRow" key={i.maSku}>
                      <div style={{ flex: 1 }}>
                        <b className="name">{i.tenSp}</b>
                        <small>SKU {i.maSku} · SL: {i.soLuong}</small>
                      </div>
                      <b>{formatVndContract(i.tongDong)}</b>
                    </div>
                  ))
                )}
                {quoting ? <p className="mpMuted" role="status">Đang lấy báo giá máy chủ…</p> : null}
                {quote ? (
                  <>
                    <div className="pvLine"><span>Tạm tính</span><span>{formatVndContract(quote.tongTienHang)}</span></div>
                    {(quote.giamVoucher ?? 0) > 0 || (quote.giamDiem ?? 0) > 0 ? (
                      <>
                        {(quote.giamVoucher ?? 0) > 0 ? (
                          <div className="pvLine"><span>Voucher {appliedVoucher ?? ""}</span><span>−{formatVndContract(quote.giamVoucher)}</span></div>
                        ) : null}
                        {(quote.giamDiem ?? 0) > 0 ? (
                          <div className="pvLine"><span>Điểm đã dùng ({appliedPoints})</span><span>−{formatVndContract(quote.giamDiem)}</span></div>
                        ) : null}
                      </>
                    ) : (quote.giamGia ?? 0) > 0 ? (
                      <div className="pvLine"><span>Giảm giá</span><span>−{formatVndContract(quote.giamGia)}</span></div>
                    ) : null}
                    <div className="pvLine"><span>Phí pilot cố định</span><span>{formatVndContract(quote.phiVanChuyen)}</span></div>
                    <div className="pvLine total"><span>Tổng thanh toán</span><span>{formatVndContract(quote.tongThanhToan)}</span></div>
                    {!quote.coTheDat ? <p role="note" style={{ color: "#b42318", fontSize: 12.5 }}>Giỏ chưa thể đặt — kiểm tra khả dụng.</p> : null}
                  </>
                ) : (
                  <p className="mpMuted">Chưa có báo giá — chọn kho và tải lại.</p>
                )}
                <section className="pvCard" aria-label="Voucher và điểm" style={{ marginTop: 12 }}>
                  <h2>Voucher &amp; điểm (tùy chọn)</h2>
                  <p className="sub">Một mã voucher rồi mới tới điểm. Máy chủ tính giảm thật.</p>
                  <div className="pvField">
                    <label htmlFor="co-voucher">Mã voucher</label>
                    <input id="co-voucher" value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="VD WELCOME2026" autoComplete="off" />
                  </div>
                  <div className="pvField">
                    <label htmlFor="co-points">Điểm sử dụng (số nguyên)</label>
                    <input id="co-points" value={pointsRaw} onChange={(e) => setPointsRaw(e.target.value)} placeholder="0" inputMode="numeric" />
                  </div>
                  {benefitIssue ? <p className="mpMuted" role="status">{benefitIssue}</p> : null}
                  <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="hmCta hmCtaGhost"
                      style={{ padding: "9px 16px", fontSize: 13 }}
                      type="button"
                      disabled={quoting}
                      onClick={() => {
                        try {
                          const code = voucher.trim() ? canonicalVoucherCode(voucher) : null;
                          const pts = validatePointsInput(pointsRaw, Number.MAX_SAFE_INTEGER);
                          setVoucher(code ?? "");
                          refreshQuote(maKho, cart, { voucherCode: code, diemSuDung: pts > 0 ? pts : null });
                        } catch (e) {
                          setBenefitIssue(e instanceof Error ? e.message : "Ưu đãi chưa hợp lệ.");
                        }
                      }}
                    >
                      {quoting ? "Đang tính…" : "Áp dụng & tính lại"}
                    </button>
                    <button
                      className="hmCta hmCtaGhost"
                      style={{ padding: "9px 16px", fontSize: 13 }}
                      type="button"
                      disabled={quoting || (!voucher && !pointsRaw)}
                      onClick={() => {
                        setVoucher("");
                        setPointsRaw("");
                        setAppliedVoucher(null);
                        setAppliedPoints(0);
                        refreshQuote(maKho, cart);
                      }}
                    >
                      Bỏ ưu đãi
                    </button>
                  </p>
                </section>
                <button
                  className="hmCta hmCtaPrimary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
                  type="button"
                  disabled={submitting || !quote?.coTheDat}
                  onClick={submit}
                >
                  {submitting ? "Đang đặt (chống trùng)…" : "Đặt hàng COD"}
                </button>
                <p className="mpMuted" style={{ marginTop: 8, fontSize: 12 }}>
                  Khóa thao tác {opKey.slice(0, 8)}… · bấm 2 lần/timeout không trùng đơn.
                  Payload mới dùng khóa mới.
                </p>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </StorefrontShell>
  );
}
