"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authMe, AuthApiError, isAuthAbort, type AuthIdentity } from "@/lib/customer-auth-client";
import { fetchCustomerOrders } from "@/lib/customer-commerce-client";
import { formatMoney, orderStatusText, type CustomerOrder } from "@/lib/customer-commerce";
import "./auth.css";
import { EmailVerificationBanner } from "./email-verification-banner";
import { ProfileEditor } from "./profile-editor";

type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "forbidden"; message: string }
  | { kind: "ready"; identity: AuthIdentity }
  | { kind: "error"; message: string };

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "Khách hàng", STAFF: "Quản lý", ADMIN: "Quản trị viên" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Đang hoạt động", INACTIVE: "Chưa hoạt động", LOCKED: "Đang bị khóa", DELETED: "Đã vô hiệu hóa" };

/**
 * Nội dung trang tổng quan tài khoản.
 *
 * Điều hướng giữa các mục nằm ở AccountCenterShell (một nguồn duy nhất cho
 * đơn hàng, yêu thích, lịch sử AI, voucher, điểm, hồ sơ, bảo mật) — ở đây chỉ
 * còn nội dung tóm tắt, không dựng thanh tab song song hay câu "chưa có trong
 * pilot" cho những trang đã hoạt động thật.
 */
export function AccountHub({
  identity,
  orders,
  ordersError,
}: {
  identity: AuthIdentity;
  orders: CustomerOrder[] | null;
  ordersError: string;
}) {
  return (
    <>
      {identity.emailVerified === false ? <EmailVerificationBanner email={identity.email} /> : null}
      <section className="sfSideCard" aria-labelledby="account-profile-title">
        <div className="acct-section-head">
          <h2 id="account-profile-title">Hồ sơ</h2>
          {identity.role === "CUSTOMER" ? <Link className="acct-logout" href="/tai-khoan/thong-tin">Sửa thông tin</Link> : null}
        </div>
        {identity.role === "CUSTOMER" ? <ProfileEditor /> : (
          <>
            <dl className="acct-profile">
              <div className="acct-row"><dt>Mã tài khoản</dt><dd>{identity.id}</dd></div>
              <div className="acct-row"><dt>Tên đăng nhập</dt><dd>{identity.username}</dd></div>
              <div className="acct-row"><dt>Email</dt><dd>{identity.email}</dd></div>
              <div className="acct-row"><dt>Vai trò</dt><dd>{ROLE_LABEL[identity.role] ?? identity.role}</dd></div>
              <div className="acct-row"><dt>Trạng thái</dt><dd>{STATUS_LABEL[identity.status] ?? identity.status}</dd></div>
            </dl>
            <p className="acct-note">Tài khoản quản trị dùng trang quản trị riêng; hồ sơ khách hàng không áp dụng tại đây.</p>
          </>
        )}
      </section>

      <section className="sfSideCard" aria-labelledby="account-orders-title">
        <div className="acct-section-head">
          <h2 id="account-orders-title">Đơn gần đây</h2>
          <Link className="acct-logout" href="/don-hang">Xem tất cả</Link>
        </div>
        {ordersError ? (
          <p className="acct-note" role="alert">{ordersError} <Link className="auth-link" href="/don-hang">Mở đơn hàng →</Link></p>
        ) : null}
        {orders === null && !ordersError ? <p className="acct-note" role="status">Đang tải đơn gần đây…</p> : null}
        {orders && orders.length === 0 ? (
          <p className="acct-note">Chưa có đơn thật. <Link className="auth-link" href="/gio-hang">Mở giỏ hàng →</Link></p>
        ) : null}
        {orders && orders.length > 0 ? (
          <div className="acct-order-list">
            {orders.map((order) => (
              <Link className="acct-order-row" href={`/don-hang/${order.orderId}`} key={order.orderId}>
                <span><strong>{order.orderCode}</strong><small>{orderStatusText(order.status)} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString("vi-VN") : ""}</small></span>
                <strong>{formatMoney(order.totalAmount)}</strong>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </>
  );
}

/** Hook giữ phần đọc dữ liệu tách khỏi phần trình bày. */
export function useAccountHub() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    authMe(controller.signal)
      .then((identity) => {
        if (controller.signal.aborted) return;
        setState(identity.role === "CUSTOMER" || identity.role === "STAFF" || identity.role === "ADMIN"
          ? { kind: "ready", identity }
          : { kind: "forbidden", message: "Tài khoản này không có quyền xem khu vực tài khoản." });
      })
      .catch((failure) => {
        if (controller.signal.aborted || isAuthAbort(failure)) return;
        setState(failure instanceof AuthApiError && failure.status === 401
          ? { kind: "guest" }
          : { kind: "error", message: "Không tải được thông tin tài khoản. Thử lại." });
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const controller = new AbortController();
    setOrdersError("");
    fetchCustomerOrders("page=0&size=3", controller.signal)
      .then((result) => { if (!controller.signal.aborted) setOrders(result.items); })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setOrdersError(failure instanceof Error ? failure.message : "Không tải được đơn gần đây.");
        setOrders([]);
      });
    return () => controller.abort();
  }, [state]);

  return { state, orders, ordersError, retry: () => setRetry((n) => n + 1) };
}

/** Thân trang tổng quan: đọc dữ liệu rồi hiển thị, giữ trạng thái khách/lỗi rõ ràng. */
export function HubBody() {
  const { state, orders, ordersError } = useAccountHub();
  if (state.kind === "loading") return <p className="acct-note" role="status">Đang tải tài khoản…</p>;
  if (state.kind === "guest") return <p className="acct-note">Phiên đăng nhập đã kết thúc. Đăng nhập lại để xem tài khoản.</p>;
  if (state.kind === "forbidden") return <p className="acct-note" role="alert">{state.message}</p>;
  if (state.kind === "error") return <p className="acct-note" role="alert">{state.message}</p>;
  return <AccountHub identity={state.identity} orders={orders} ordersError={ordersError} />;
}
