"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthApiError, type AuthIdentity } from "@/lib/customer-auth-client";
import { getAccountIdentity } from "@/lib/account-identity-cache";
import { fetchCustomerOrders } from "@/lib/customer-commerce-client";
import { orderStatusText, type CustomerOrder } from "@/lib/customer-commerce";
import { EmailVerificationBanner } from "./email-verification-banner";
import { ProfileEditor } from "./profile-editor";
import { NotificationPreferences } from "@/components/customer-notifications/preferences";
import { PriceTag } from "@/components/storefront/price-tag";
import ac from "@/components/account/account-cards.module.css";

type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "forbidden"; message: string }
  | { kind: "ready"; identity: AuthIdentity }
  | { kind: "error"; message: string };

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "Khách hàng", STAFF: "Quản lý", ADMIN: "Quản trị viên" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Đang hoạt động", INACTIVE: "Chưa hoạt động", LOCKED: "Đang bị khóa", DELETED: "Đã vô hiệu hóa" };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa cập nhật";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const isCustomer = identity.role === "CUSTOMER";
  return (
    <div className={ac.pageWide}>
      {identity.emailVerified === false ? <EmailVerificationBanner email={identity.email} /> : null}
      {isCustomer ? <ProfileEditor /> : (
        <section className={ac.card} aria-labelledby="account-profile-title">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Hồ sơ</p>
            <h2 id="account-profile-title" className={ac.title}>Hồ sơ</h2>
          </div>
          <dl className={ac.kv}>
            <div className={ac.kvRow}><dt>Mã tài khoản</dt><dd>{identity.id}</dd></div>
            <div className={ac.kvRow}><dt>Tên đăng nhập</dt><dd>{identity.username}</dd></div>
            <div className={ac.kvRow}><dt>Email</dt><dd>{identity.email}</dd></div>
            <div className={ac.kvRow}><dt>Vai trò</dt><dd>{ROLE_LABEL[identity.role] ?? identity.role}</dd></div>
            <div className={ac.kvRow}><dt>Trạng thái</dt><dd>{STATUS_LABEL[identity.status] ?? identity.status}</dd></div>
          </dl>
          <p className={ac.meta}>Tài khoản quản trị dùng trang quản trị riêng; hồ sơ khách hàng không áp dụng tại đây.</p>
        </section>
      )}

      {isCustomer ? <NotificationPreferences /> : null}

      <section className={ac.card} aria-labelledby="account-orders-title">
        <div className={ac.head}>
          <p className={ac.eyebrow}>{isCustomer ? "03 · Đơn hàng" : "02 · Đơn hàng"}</p>
          <h2 id="account-orders-title" className={ac.title}>Đơn gần đây</h2>
          <p className={ac.lead}>Ba đơn mới nhất của bạn. <Link className={ac.link} href="/don-hang">Xem tất cả</Link></p>
        </div>
        {ordersError ? (
          <p className={ac.alert} role="alert">{ordersError} <Link className={ac.link} href="/don-hang">Mở đơn hàng →</Link></p>
        ) : null}
        {orders === null && !ordersError ? <div className={ac.group} role="status"><div className={ac.skeleton} /><p className={ac.meta}>Đang tải đơn gần đây…</p></div> : null}
        {orders && orders.length === 0 && !ordersError ? (
          <div className={`${ac.card} ${ac.empty}`} style={{ padding: "20px 22px" }}>
            <p className={ac.meta}>Bạn chưa có đơn hàng nào.</p>
            <div className={ac.actions}>
              <Link className={ac.primary} href="/nam">Mua sắm ngay</Link>
            </div>
          </div>
        ) : null}
        {orders && orders.length > 0 ? (
          <ul className={ac.list}>
            {orders.map((order) => (
              <li key={order.orderId}>
                <span style={{ minWidth: 0 }}>
                  <Link className={ac.link} href={`/don-hang/${order.orderId}`} style={{ fontWeight: 650, fontSize: 14 }}>{order.orderCode}</Link>
                  <span className={ac.meta} style={{ display: "block", marginTop: 4 }}>{order.createdAt ? formatDate(order.createdAt) : "Chưa cập nhật"}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
                  <span className={ac.chip}>{orderStatusText(order.status)}</span>
                  <PriceTag value={order.totalAmount} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

/** Hook giữ phần đọc dữ liệu tách khỏi phần trình bày. */
export function useAccountHub() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [retry, setRetry] = useState(0);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    // Identity dùng chung với khung tài khoản (không fetch lại mỗi route con).
    let live = true;
    getAccountIdentity()
      .then((identity) => {
        if (!live) return;
        setState(identity.role === "CUSTOMER" || identity.role === "STAFF" || identity.role === "ADMIN"
          ? { kind: "ready", identity }
          : { kind: "forbidden", message: "Tài khoản này không có quyền xem khu vực tài khoản." });
      })
      .catch((failure) => {
        if (!live) return;
        setState(failure instanceof AuthApiError && failure.status === 401
          ? { kind: "guest" }
          : { kind: "error", message: "Không tải được thông tin tài khoản. Thử lại." });
      });
    return () => { live = false; };
  }, [retry]);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
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
  if (state.kind === "loading") return <div className={ac.page}><section className={ac.card}><p className={ac.meta} role="status">Đang tải tài khoản…</p><div className={ac.skeleton} /></section></div>;
  if (state.kind === "guest") return <div className={ac.page}><section className={ac.card}><div className={ac.head}><p className={ac.eyebrow}>Tài khoản</p><h2 className={ac.title}>Cần đăng nhập</h2></div><p className={ac.meta}>Phiên đăng nhập đã kết thúc. Đăng nhập lại để xem tài khoản.</p></section></div>;
  if (state.kind === "forbidden") return <div className={ac.page}><section className={ac.card}><p className={ac.alert} role="alert">{state.message}</p></section></div>;
  if (state.kind === "error") return <div className={ac.page}><section className={ac.card}><p className={ac.alert} role="alert">{state.message}</p></section></div>;
  return <AccountHub identity={state.identity} orders={orders} ordersError={ordersError} />;
}
