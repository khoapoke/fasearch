"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { cancelCustomerOrder, fetchCustomerOrder } from "@/lib/customer-commerce-client";
import { createStripeCheckout, createVnpayCheckout, fetchPaymentAttempt } from "@/lib/customer-payments-client";
import {
  CommerceError,
  formatMoney,
  orderStatusText,
  paymentAttemptStatusText,
  type CustomerOrderDetail,
  type PaymentAttempt,
} from "@/lib/customer-commerce";
import "@/components/customer-commerce/commerce.css";

function dateText(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function clientImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const m = trimmed.match(/^\/api\/v1\/products\/images\/(.+)$/);
  if (m) return `/api/catalog/product-images/${m[1]}`;
  return trimmed;
}

function statusClass(status: string): string {
  switch (status) {
    case "PENDING":
      return "pending";
    case "CONFIRMED":
      return "confirmed";
    case "SHIPPING":
      return "shipping";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "default";
  }
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [storedAttempt, setStoredAttempt] = useState<PaymentAttempt | null>(null);
  const [paying, setPaying] = useState<"" | "STRIPE" | "VNPAY">("");
  const [payError, setPayError] = useState("");
  const busy = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!/^\d+$/.test(id)) {
      setError("Mã đơn hàng không hợp lệ.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setOrder(await fetchCustomerOrder(id));
    } catch (failure) {
      const status = failure instanceof CommerceError ? failure.status : 0;
      setErrorStatus(status);
      if (status === 401) {
        router.replace(`/dang-nhap?next=${encodeURIComponent(`/don-hang/${id}`)}`);
        return;
      }
      setError(failure instanceof Error ? failure.message : "Không tải được thông tin đơn hàng.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  async function cancel() {
    if (!order || busy.current) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do hủy đơn hàng.");
      return;
    }
    busy.current = true;
    setCancelling(true);
    setError("");
    try {
      const updated = await cancelCustomerOrder(String(order.orderId), reason.trim());
      setOrder(updated);
      setConfirming(false);
      setReason("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không hủy được đơn hàng.");
    } finally {
      busy.current = false;
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    try {
      const raw = sessionStorage.getItem("fasearch:pay-attempt");
      if (!raw) return;
      const ref = JSON.parse(raw) as { attemptId?: number; orderId?: number };
      if (ref?.orderId !== order.orderId || !ref?.attemptId) return;
      fetchPaymentAttempt(String(ref.attemptId)).then(setStoredAttempt).catch(() => { /* best-effort hint */ });
    } catch { /* storage unavailable */ }
  }, [order]);

  async function payOnline(provider: "STRIPE" | "VNPAY") {
    if (!order || paying) return;
    setPaying(provider); setPayError("");
    try {
      if (storedAttempt?.provider === provider && storedAttempt.checkoutUrl
        && (storedAttempt.status === "CREATED" || storedAttempt.status === "PENDING")) {
        window.location.assign(storedAttempt.checkoutUrl);
        return;
      }
      const key = `pay-order-${order.orderId}-${provider}`.slice(0, 100);
      const attempt = provider === "STRIPE"
        ? await createStripeCheckout(order.orderId, key)
        : await createVnpayCheckout(order.orderId, key);
      if (!attempt.checkoutUrl) throw new Error("Cổng thanh toán chưa trả địa chỉ chuyển hướng.");
      try {
        sessionStorage.setItem("fasearch:pay-attempt", JSON.stringify({ attemptId: attempt.attemptId, orderId: order.orderId, provider }));
      } catch { /* best-effort return hint */ }
      window.location.assign(attempt.checkoutUrl);
    } catch (failure) {
      setPayError(failure instanceof Error ? failure.message : "Không mở được cổng thanh toán.");
    } finally {
      setPaying("");
    }
  }

  const cancellable = order && (order.status === "PENDING" || order.status === "CONFIRMED");
  const orderDisplayCode = order ? (order.orderCode || `Đơn hàng #${order.orderId}`) : `#${id}`;

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="commercePage">
        <div className="commerce-content">
          <nav className="commerce-crumbs" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <Link href="/tai-khoan">Tài khoản</Link>
            <span aria-hidden="true">›</span>
            <Link href="/don-hang">Đơn hàng</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{orderDisplayCode}</span>
          </nav>

          <Link className="commerce-back-link" href="/don-hang">
            ← Quay lại danh sách đơn hàng
          </Link>

          <h1 className="commerce-title">Chi tiết đơn hàng</h1>
          <p className="commerce-sub">Theo dõi thông tin và tiến độ giao hàng của đơn.</p>

          {loading ? (
            <p className="commerce-status" role="status">Đang tải thông tin đơn hàng…</p>
          ) : null}

          {error ? (
            <div ref={errorRef} tabIndex={-1} className="commerce-empty" role="alert">
              <h2>{errorStatus === 403 ? "Không có quyền truy cập đơn hàng này" : "Không tải được đơn hàng"}</h2>
              <p>{errorStatus === 403
                ? "Đơn hàng này thuộc về khách hàng khác hoặc vai trò tài khoản hiện tại không được phép truy cập."
                : error}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                {errorStatus === 403 ? (
                  <>
                    <Link className="commerce-primary" href="/don-hang">Về danh sách đơn của bạn</Link>
                    <Link className="commerce-ghost" href="/quan-tri/don-hang">Mở quản trị đơn hàng</Link>
                  </>
                ) : (
                  <button className="commerce-primary" type="button" onClick={load} style={{ width: "auto" }}>
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {order ? (
            <div className="commerce-layout">
              <section className="commerce-panel" aria-label={`Đơn ${orderDisplayCode}`}>
                <div className="commerce-card">
                  <div className="commerce-toolbar" style={{ marginBottom: 0 }}>
                    <div>
                      <strong style={{ fontSize: 18 }}>{orderDisplayCode}</strong>
                      <p className="commerce-note" style={{ marginTop: 4 }}>
                        Đặt lúc: {dateText(order.createdAt)}
                      </p>
                    </div>
                    <div>
                      <span className={`commerce-badge ${statusClass(order.status)}`}>
                        {orderStatusText(order.status)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="commerce-card" style={{ marginTop: 20 }}>
                  <h2>Danh sách sản phẩm</h2>
                  <ul className="commerce-lines">
                    {order.items.map((line) => {
                      const img = clientImageUrl(line.imageUrl);
                      return (
                        <li className="commerce-line" key={line.skuId}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="commerce-line-image"
                              src={img}
                              alt={line.productName || "Sản phẩm"}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="commerce-line-image" aria-hidden="true" />
                          )}
                          <div>
                            <p className="commerce-line-name">{line.productName || "Sản phẩm"}</p>
                            <p className="commerce-line-meta">
                              {[line.color, line.size].filter(Boolean).join(" · ") || "Phân loại tiêu chuẩn"}
                              {" · "}Số lượng: {line.quantity}
                              {" · "}Đơn giá: {formatMoney(line.unitPrice)}
                              {order.voucherCode && line.discountAmount > 0
                                ? ` · Giảm voucher: ${formatMoney(line.discountAmount)}`
                                : ""}
                              {(line.pointsDiscountAmount ?? 0) > 0
                                ? ` · Giảm điểm: ${formatMoney(line.pointsDiscountAmount ?? 0)}`
                                : ""}
                            </p>
                          </div>
                          <strong className="commerce-line-total">{formatMoney(line.totalPrice)}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="commerce-card" style={{ marginTop: 20 }}>
                  <h2>Thông tin giao nhận</h2>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div>
                      <p className="commerce-label">Người nhận</p>
                      <p className="commerce-value">
                        <strong>{order.customer?.fullName || "—"}</strong>
                        {order.customer?.phoneNumber ? ` · ${order.customer.phoneNumber}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="commerce-label">Địa chỉ nhận hàng</p>
                      <p className="commerce-value commerce-prose">{order.deliveryAddress || "—"}</p>
                    </div>
                    {order.note ? (
                      <div>
                        <p className="commerce-label">Ghi chú đơn hàng</p>
                        <p className="commerce-value commerce-prose">{order.note}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {cancellable ? (
                  <div className="commerce-card" style={{ marginTop: 20 }}>
                    <h2>Hủy đơn hàng</h2>
                    <p className="commerce-note" style={{ marginTop: 0, marginBottom: 14 }}>
                      Bạn có thể hủy đơn khi đơn hàng đang ở trạng thái Chờ xác nhận hoặc Đã xác nhận.
                    </p>
                    {!confirming ? (
                      <button className="commerce-ghost" type="button" onClick={() => setConfirming(true)}>
                        Yêu cầu hủy đơn hàng này
                      </button>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div className="checkout-field">
                          <label htmlFor="cancel-reason">Lý do hủy đơn</label>
                          <input
                            id="cancel-reason"
                            className="checkout-input"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={500}
                            placeholder="Nhập lý do hủy đơn của bạn…"
                          />
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <button
                            className="commerce-primary"
                            type="button"
                            disabled={cancelling}
                            onClick={cancel}
                            style={{ width: "auto", marginTop: 0 }}
                          >
                            {cancelling ? "Đang hủy đơn…" : "Xác nhận hủy đơn"}
                          </button>
                          <button
                            className="commerce-ghost"
                            type="button"
                            disabled={cancelling}
                            onClick={() => {
                              setConfirming(false);
                              setReason("");
                            }}
                          >
                            Không hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="commerce-note" style={{ marginTop: 16 }}>
                    Đơn hàng ở trạng thái này không thể tự hủy.
                  </p>
                )}
              </section>

              <aside className="commerce-summary" aria-label="Tóm tắt đơn hàng">
                <h2>Tóm tắt đơn hàng</h2>
                <div className="commerce-summary-row">
                  <span>Tạm tính</span>
                  <strong>{formatMoney(order.subTotal)}</strong>
                </div>

                {order.voucherCode || (order.discountAmount ?? 0) > 0 ? (
                  <div className="commerce-summary-row">
                    <span>
                      Voucher {order.voucherCode ?? ""}
                      {order.voucherCampaignName ? ` (${order.voucherCampaignName})` : ""}
                    </span>
                    <strong>−{formatMoney(order.discountAmount)}</strong>
                  </div>
                ) : null}

                {(order.redeemedPoints ?? 0) > 0 || (order.pointsDiscount ?? 0) > 0 ? (
                  <div className="commerce-summary-row">
                    <span>Đổi {order.redeemedPoints ?? 0} điểm</span>
                    <strong>
                      −{order.pointsDiscount === null ? "—" : formatMoney(order.pointsDiscount)}
                    </strong>
                  </div>
                ) : null}

                <div className="commerce-summary-row">
                  <span>Phí giao hàng</span>
                  <strong>{formatMoney(order.shippingFee)}</strong>
                </div>

                <div className="commerce-summary-total">
                  <span>Tổng cộng</span>
                  <strong>{formatMoney(order.totalAmount)}</strong>
                </div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--st-line)" }}>
                  <p className="commerce-label">Phương thức thanh toán</p>
                  <p className="commerce-value" style={{ fontWeight: 500 }}>
                    Thanh toán khi nhận hàng (COD)
                  </p>
                </div>
                {order.status === "PENDING" && order.totalAmount > 0 ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--st-line)" }}>
                    <p className="commerce-label">Thanh toán trực tuyến (sandbox)</p>
                    {storedAttempt ? (
                      <p className="commerce-note" style={{ margin: "4px 0 8px" }}>
                        Kênh {storedAttempt.provider}: {paymentAttemptStatusText(storedAttempt.status)}
                      </p>
                    ) : null}
                    {payError ? <p className="commerce-status is-error" role="alert">{payError}</p> : null}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="commerce-ghost" type="button" disabled={paying !== ""} onClick={() => payOnline("STRIPE")}>
                        {paying === "STRIPE" ? "Đang mở Stripe…" : "Trả bằng Stripe"}
                      </button>
                      <button className="commerce-ghost" type="button" disabled={paying !== ""} onClick={() => payOnline("VNPAY")}>
                        {paying === "VNPAY" ? "Đang mở VNPAY…" : "Trả bằng VNPAY"}
                      </button>
                    </div>
                    <p className="commerce-note">Chỉ webhook/IPN đã ký mới ghi nhận thanh toán; làm mới không trừ tiền thêm.</p>
                  </div>
                ) : null}
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </StorefrontShell>
  );
}
