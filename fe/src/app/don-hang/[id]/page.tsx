"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import "@/components/customer-auth/auth.css";
import ac from "@/components/account/account-cards.module.css";
import { PriceTag } from "@/components/storefront/price-tag";
import { cancelCustomerOrder, fetchCustomerOrder } from "@/lib/customer-commerce-client";
import { createStripeCheckout, createVnpayCheckout, fetchPaymentAttempt } from "@/lib/customer-payments-client";
import {
  CommerceError,
  orderStatusText,
  paymentAttemptStatusText,
  type CustomerOrderDetail,
  type PaymentAttempt,
} from "@/lib/customer-commerce";
import { paymentMethodLabel } from "@/lib/commerce";
import { parseOrderNote } from "@/lib/order-recipient";

function dateText(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa cập nhật";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function clientImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const m = trimmed.match(/^\/api\/v1\/products\/images\/(.+)$/);
  if (m) return `/api/catalog/product-images/${m[1]}`;
  return trimmed;
}

function paidMethodName(method: string): string {
  if (method === "STRIPE") return "Stripe";
  if (method === "VNPAY" || method === "VNPAY_QR") return "VNPay";
  if (method === "MOMO") return "MoMo";
  if (method === "BANK_TRANSFER") return "Chuyển khoản";
  if (method === "E_WALLET") return "Ví điện tử";
  if (method === "CASH") return "Tiền mặt";
  try {
    return paymentMethodLabel(method);
  } catch {
    return method;
  }
}

function isPaidOrder(order: CustomerOrderDetail | null): boolean {
  return order?.paymentStatus === "PAID";
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [cancelError, setCancelError] = useState("");
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
    setCancelError("");
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
    if (error) errorRef.current?.focus();
  }, [error]);

  async function cancel() {
    if (!order || busy.current) return;
    if (!confirming) {
      setConfirming(true);
      setCancelError("");
      return;
    }
    if (!reason.trim()) {
      setCancelError("Vui lòng nhập lý do hủy đơn hàng.");
      return;
    }
    busy.current = true;
    setCancelling(true);
    setCancelError("");
    try {
      const updated = await cancelCustomerOrder(String(order.orderId), reason.trim());
      setOrder(updated);
      setConfirming(false);
      setReason("");
    } catch (failure) {
      setCancelError(failure instanceof Error ? failure.message : "Không hủy được đơn hàng.");
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

  const paid = isPaidOrder(order);
  const recipientNote = parseOrderNote(order?.note);
  const cancellable = order && (order.status === "PENDING" || order.status === "CONFIRMED") && !paid;
  const orderDisplayCode = order ? (order.orderCode || `Đơn hàng #${order.orderId}`) : `#${id}`;

  return (
    <StorefrontShell active="/tai-khoan" themed palette="customer" header="customer" footer="none">
      <div className="acctPage">
        <div className="acct-content">
          <nav className="sfCrumbs" aria-label="Đường dẫn">
            <Link href="/">Trang chủ</Link>
            <span aria-hidden="true">›</span>
            <Link href="/tai-khoan">Tài khoản</Link>
            <span aria-hidden="true">›</span>
            <Link href="/don-hang">Đơn hàng</Link>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{orderDisplayCode}</span>
          </nav>
          <div className="acct-head">
            <h1>Chi tiết đơn hàng</h1>
          </div>
          <Link className={ac.link} href="/don-hang">
            ← Quay lại danh sách đơn hàng
          </Link>

          <div className={ac.pageWide} style={{ marginTop: 16 }}>
            {loading ? (
              <section className={ac.card} aria-labelledby="order-loading">
                <div className={ac.head}>
                  <p className={ac.eyebrow}>Đơn hàng</p>
                  <h2 id="order-loading" className={ac.title}>Đang tải đơn hàng</h2>
                </div>
                <div className={ac.group} role="status">
                  <div className={ac.skeleton} />
                  <div className={ac.skeleton} />
                  <p className={ac.meta}>Đang tải thông tin đơn hàng…</p>
                </div>
              </section>
            ) : null}

            {error ? (
              <div ref={errorRef} tabIndex={-1} className={ac.card} role="alert">
                <div className={ac.head}>
                  <p className={ac.eyebrow}>Đơn hàng</p>
                  <h2 className={ac.title}>{errorStatus === 403 ? "Không có quyền xem đơn này" : "Không tải được đơn hàng"}</h2>
                  <p className={ac.lead}>{errorStatus === 403
                    ? "Đơn hàng này thuộc về khách hàng khác hoặc vai trò tài khoản hiện tại không được phép truy cập."
                    : error}</p>
                </div>
                <div className={ac.actions}>
                  {errorStatus === 403 ? (
                    <>
                      <Link className={ac.primary} href="/don-hang">Về danh sách đơn của bạn</Link>
                      <Link className={ac.secondary} href="/quan-tri/don-hang">Mở quản trị đơn hàng</Link>
                    </>
                  ) : (
                    <button className={ac.secondary} type="button" onClick={load}>
                      Thử lại
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {order ? (
              <>
                <section className={ac.card} aria-label={`Đơn ${orderDisplayCode}`}>
                  <div className={ac.head}>
                    <p className={ac.eyebrow}>01 · Tổng quan</p>
                    <h2 className={ac.title}>{orderDisplayCode}</h2>
                    <p className={ac.lead}>Đặt lúc: {dateText(order.createdAt)} · <span className={ac.chip}>{orderStatusText(order.status)}</span></p>
                  </div>
                </section>

                <section className={ac.card} aria-labelledby="order-items">
                  <div className={ac.head}>
                    <p className={ac.eyebrow}>02 · Sản phẩm</p>
                    <h2 id="order-items" className={ac.title}>Danh sách sản phẩm</h2>
                  </div>
                  <ul className={ac.list}>
                    {order.items.map((line) => {
                      const img = clientImageUrl(line.imageUrl);
                      return (
                        <li key={line.skuId} className={ac.itemRow}>
                          <span style={{ display: "flex", gap: 12, minWidth: 0 }}>
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img}
                                alt={line.productName || "Sản phẩm"}
                                referrerPolicy="no-referrer"
                                style={{ width: 56, height: 72, objectFit: "cover", borderRadius: 4, flex: "none" }}
                              />
                            ) : (
                              <span aria-hidden="true" style={{ width: 56, height: 72, borderRadius: 4, background: "var(--st-select)", flex: "none" }} />
                            )}
                            <span style={{ minWidth: 0 }}>
                              <strong style={{ display: "block", fontSize: 14 }}>{line.productName || "Sản phẩm"}</strong>
                              <span className={ac.meta} style={{ display: "block", marginTop: 4 }}>
                                {[line.color, line.size].filter(Boolean).join(" · ") || "Phân loại tiêu chuẩn"}
                                {" · "}Số lượng: {line.quantity}
                                {" · "}Đơn giá: {line.unitPrice.toLocaleString("vi-VN")}đ
                                {order.voucherCode && line.discountAmount > 0
                                  ? ` · Giảm voucher: ${line.discountAmount.toLocaleString("vi-VN")}đ`
                                  : ""}
                                {(line.pointsDiscountAmount ?? 0) > 0
                                  ? ` · Giảm điểm: ${(line.pointsDiscountAmount ?? 0).toLocaleString("vi-VN")}đ`
                                  : ""}
                              </span>
                            </span>
                          </span>
                          <PriceTag value={line.totalPrice} />
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className={ac.card} aria-labelledby="order-shipping">
                  <div className={ac.head}>
                    <p className={ac.eyebrow}>03 · Giao nhận</p>
                    <h2 id="order-shipping" className={ac.title}>Thông tin giao nhận</h2>
                  </div>
                  <dl className={ac.kv}>
                    <div className={ac.kvRow}>
                      <dt>Người nhận</dt>
                      <dd>
                        <strong>{recipientNote.recipient?.name || order.customer?.fullName || "—"}</strong>
                        {(recipientNote.recipient?.phone || order.customer?.phoneNumber) ? ` · ${recipientNote.recipient?.phone || order.customer?.phoneNumber}` : ""}
                      </dd>
                    </div>
                    <div className={ac.kvRow}>
                      <dt>Địa chỉ nhận hàng</dt>
                      <dd className={ac.prose}>{order.deliveryAddress || "Chưa cập nhật"}</dd>
                    </div>
                    {recipientNote.text ? (
                      <div className={ac.kvRow}>
                        <dt>Ghi chú đơn hàng</dt>
                        <dd className={ac.prose}>{recipientNote.text}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section className={ac.card} aria-labelledby="order-summary">
                  <div className={ac.head}>
                    <p className={ac.eyebrow}>04 · Thanh toán</p>
                    <h2 id="order-summary" className={ac.title}>Tóm tắt đơn hàng</h2>
                  </div>
                  <ul className={ac.list}>
                    <li><span>Tạm tính</span><PriceTag value={order.subTotal} /></li>
                    {order.voucherCode || (order.discountAmount ?? 0) > 0 ? (
                      <li>
                        <span>Voucher {order.voucherCode ?? ""}{order.voucherCampaignName ? ` (${order.voucherCampaignName})` : ""}</span>
                        <span>−{order.discountAmount.toLocaleString("vi-VN")}đ</span>
                      </li>
                    ) : null}
                    {(order.redeemedPoints ?? 0) > 0 || (order.pointsDiscount ?? 0) > 0 ? (
                      <li>
                        <span>Đổi {order.redeemedPoints ?? 0} điểm</span>
                        <span>−{order.pointsDiscount === null ? "—" : `${order.pointsDiscount.toLocaleString("vi-VN")}đ`}</span>
                      </li>
                    ) : null}
                    <li><span>Phí giao hàng</span><PriceTag value={order.shippingFee} /></li>
                    <li><span><strong>Tổng cộng</strong></span><PriceTag value={order.totalAmount} /></li>
                  </ul>
                  {paid ? (
                    <p className={ac.meta}>Đã thanh toán{order.paymentMethod ? ` · ${paidMethodName(order.paymentMethod)}` : ""}</p>
                  ) : (
                    <p className={ac.meta}>Phương thức thanh toán: Thanh toán khi nhận hàng (COD)</p>
                  )}
                  {order.status === "PENDING" && !paid && order.totalAmount > 0 ? (
                    <div>
                      <p className={ac.label}>Thanh toán trực tuyến (thử nghiệm)</p>
                      {storedAttempt ? (
                        <p className={ac.meta}>
                          Kênh {storedAttempt.provider}: {paymentAttemptStatusText(storedAttempt.status)}
                        </p>
                      ) : null}
                      {payError ? <p className={ac.alert} role="alert">{payError}</p> : null}
                      <div className={ac.actions}>
                        <button className={ac.secondary} type="button" disabled={paying !== ""} onClick={() => payOnline("STRIPE")}>
                          {paying === "STRIPE" ? "Đang mở Stripe…" : "Trả bằng Stripe"}
                        </button>
                        <button className={ac.secondary} type="button" disabled={paying !== ""} onClick={() => payOnline("VNPAY")}>
                          {paying === "VNPAY" ? "Đang mở VNPAY…" : "Trả bằng VNPAY"}
                        </button>
                      </div>
                      <p className={ac.meta}>Đơn chỉ được ghi nhận đã thanh toán khi cổng thanh toán xác nhận. Tải lại trang không trừ thêm tiền.</p>
                    </div>
                  ) : null}
                </section>

                {cancellable ? (
                  <section className={ac.card} aria-labelledby="order-cancel">
                    <div className={ac.head}>
                      <p className={ac.eyebrow}>05 · Hủy đơn</p>
                      <h2 id="order-cancel" className={ac.title}>Hủy đơn hàng</h2>
                      <p className={ac.lead}>Bạn có thể hủy khi đơn đang ở trạng thái Chờ xác nhận hoặc Đã xác nhận.</p>
                    </div>
                    {!confirming ? (
                      <div className={ac.actions}>
                        <button className={ac.secondary} type="button" onClick={() => { setConfirming(true); setCancelError(""); }}>
                          Yêu cầu hủy đơn hàng này
                        </button>
                      </div>
                    ) : (
                      <div className={ac.group}>
                        <div className={ac.field}>
                          <label className={ac.label} htmlFor="cancel-reason">Lý do hủy đơn</label>
                          <input
                            id="cancel-reason"
                            className={ac.input}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={500}
                            placeholder="Nhập lý do hủy đơn của bạn…"
                          />
                        </div>
                        <div className={ac.actions}>
                          <button
                            className={ac.primary}
                            type="button"
                            disabled={cancelling}
                            onClick={cancel}
                          >
                            {cancelling ? "Đang hủy đơn…" : "Xác nhận hủy đơn"}
                          </button>
                          <button
                            className={ac.secondary}
                            type="button"
                            disabled={cancelling}
                            onClick={() => {
                              setConfirming(false);
                              setReason("");
                              setCancelError("");
                            }}
                          >
                            Không hủy
                          </button>
                        </div>
                        {cancelError ? <p className={ac.alert} role="alert">{cancelError}</p> : null}
                      </div>
                    )}
                  </section>
                ) : (
                  <p className={ac.meta}>
                    Đơn hàng ở trạng thái này không thể tự hủy.
                  </p>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}
