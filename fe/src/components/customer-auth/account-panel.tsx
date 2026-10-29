"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authLogout, authMe, AuthApiError, formatAuthDate, isAuthAbort, type AuthIdentity } from "@/lib/customer-auth-client";
import { fetchCustomerOrders } from "@/lib/customer-commerce-client";
import { formatMoney, orderStatusText, type CustomerOrder } from "@/lib/customer-commerce";
import "./auth.css";

type State =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "ready"; identity: AuthIdentity }
  | { kind: "error"; message: string };

type SectionKey = "orders" | "profile" | "security" | "points";
const SECTIONS: Array<[SectionKey, string]> = [
  ["orders", "Đơn gần đây"],
  ["profile", "Hồ sơ"],
  ["security", "Bảo mật"],
  ["points", "Điểm & voucher"],
];

const ROLE_LABEL: Record<string, string> = { CUSTOMER: "Khách hàng", STAFF: "Nhân viên", ADMIN: "Quản trị" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Đang hoạt động", INACTIVE: "Chưa hoạt động", LOCKED: "Đang bị khóa", DELETED: "Đã vô hiệu hóa" };

export function AccountPanel() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [section, setSection] = useState<SectionKey>("profile");
  const [retry, setRetry] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const meRef = useRef<AbortController | null>(null);
  const logoutRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    meRef.current = controller;
    authMe(controller.signal)
      .then((identity) => {
        if (!controller.signal.aborted) setState({ kind: "ready", identity });
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure instanceof AuthApiError && failure.status === 401) setState({ kind: "guest" });
        else setState({ kind: "error", message: failure instanceof Error ? failure.message : "Không tải được tài khoản." });
      });
    return () => {
      controller.abort();
      if (meRef.current === controller) meRef.current = null;
    };
  }, [retry]);

  useEffect(() => () => {
    meRef.current?.abort();
    logoutRef.current?.abort();
  }, []);

  useEffect(() => {
    if (section !== "orders" || orders !== null) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      try {
        const page = await fetchCustomerOrders("page=0&size=5", controller.signal);
        if (!controller.signal.aborted) setOrders(page.items);
      } catch (failure) {
        if (!controller.signal.aborted) setOrdersError(failure instanceof Error ? failure.message : "Không tải được đơn gần đây.");
      }
    });
    return () => controller.abort();
  }, [orders, section]);

  async function logout() {
    if (logoutRef.current) return;
    meRef.current?.abort();
    meRef.current = null;
    const controller = new AbortController();
    logoutRef.current = controller;
    setLoggingOut(true);
    try {
      await authLogout(controller.signal);
      if (controller.signal.aborted || logoutRef.current !== controller) return;
      router.replace("/");
    } catch (failure) {
      if (controller.signal.aborted || logoutRef.current !== controller || isAuthAbort(failure)) return;
      setState({ kind: "error", message: failure instanceof Error ? failure.message : "Không thể đăng xuất." });
    } finally {
      if (logoutRef.current === controller) {
        logoutRef.current = null;
        setLoggingOut(false);
      }
    }
  }

  function unavailable(title: string, body: string) {
    return (
      <section aria-labelledby="account-placeholder-title">
        <div className="acct-section-head"><h2>{title}</h2></div>
        <div className="acct-placeholder">
          <h3>Chưa có trong pilot này</h3>
          <p>{body}</p>
        </div>
      </section>
    );
  }

  function content(identity: AuthIdentity) {
    if (section === "profile") {
      return (
        <section aria-labelledby="account-profile-title">
          <div className="acct-section-head"><h2 id="account-profile-title">Hồ sơ</h2></div>
          <dl className="acct-profile">
            <div className="acct-row"><dt>Mã tài khoản</dt><dd>{identity.id}</dd></div>
            <div className="acct-row"><dt>Tên đăng nhập</dt><dd>{identity.username}</dd></div>
            <div className="acct-row"><dt>Email</dt><dd>{identity.email}</dd></div>
            <div className="acct-row"><dt>Vai trò</dt><dd>{ROLE_LABEL[identity.role] ?? identity.role}</dd></div>
            <div className="acct-row"><dt>Trạng thái</dt><dd>{STATUS_LABEL[identity.status] ?? identity.status}</dd></div>
            <div className="acct-row"><dt>Ngày tạo</dt><dd>{formatAuthDate(identity.createdAt)}</dd></div>
          </dl>
          <p className="acct-note">Thông tin lấy trực tiếp từ máy chủ xác thực. Các mục đơn hàng, bảo mật và điểm chưa được mở trong pilot này.</p>
        </section>
      );
    }
    if (section === "orders") {
      return (
        <section aria-labelledby="account-orders-title">
          <div className="acct-section-head"><h2 id="account-orders-title">Đơn gần đây</h2><Link className="acct-logout" href="/don-hang">Xem tất cả</Link></div>
          {ordersError ? <p className="acct-note" role="alert">{ordersError} <Link className="auth-link" href="/don-hang">Mở đơn hàng →</Link></p> : null}
          {orders === null && !ordersError ? <p className="acct-note" role="status">Đang tải đơn gần đây…</p> : null}
          {orders && orders.length === 0 ? <p className="acct-note">Chưa có đơn thật. <Link className="auth-link" href="/gio-hang">Mở giỏ hàng →</Link></p> : null}
          {orders && orders.length > 0 ? (
            <div className="acct-order-list">
              {orders.map((order) => (
                <Link className="acct-order-row" href={`/don-hang/${order.orderId}`} key={order.orderId}>
                  <span><strong>{order.orderCode}</strong><small>{orderStatusText(order.status)} · {order.createdAt ? formatAuthDate(order.createdAt) : ""}</small></span>
                  <strong>{formatMoney(order.totalAmount)}</strong>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      );
    }
    if (section === "security") {
      return unavailable("Bảo mật", "Đổi mật khẩu, phiên đăng nhập và thiết bị chưa được mở trong pilot này.");
    }
    return unavailable("Điểm & voucher", "Điểm tích lũy và voucher chưa được kết nối trong pilot này.");
  }

  if (state.kind === "loading") {
    return <div className="acctPage"><div className="acct-content"><p className="acct-note" role="status">Đang tải tài khoản…</p></div></div>;
  }
  if (state.kind === "guest") {
    return (
      <div className="acctPage"><div className="acct-content">
        <div className="acct-head"><h1>Tài khoản</h1></div>
        <div className="acct-state">
          <h2>Cần đăng nhập</h2>
          <p>Đăng nhập để xem thông tin tài khoản thật từ máy chủ.</p>
          <Link className="auth-button is-primary" href="/dang-nhap?next=%2Ftai-khoan" style={{ width: "auto" }}>Đăng nhập</Link>
        </div>
      </div></div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="acctPage"><div className="acct-content">
        <div className="acct-head"><h1>Tài khoản</h1></div>
        <div className="acct-state">
          <h2>Không tải được tài khoản</h2>
          <p>{state.message}</p>
          <button className="auth-button" type="button" onClick={() => { setState({ kind: "loading" }); setRetry((n) => n + 1); }}>Thử lại</button>
        </div>
      </div></div>
    );
  }

  return (
    <div className="acctPage">
      <div className="acct-content">
        <div className="acct-head"><h1>Tài khoản</h1></div>
        <div className="acct-layout">
          <div className="acct-nav-wrap">
            <nav className="acct-nav" aria-label="Điều hướng tài khoản">
              {SECTIONS.map(([key, label]) => (
                <button key={key} type="button" aria-current={section === key ? "true" : "false"} onClick={() => setSection(key)}>
                  {label}
                </button>
              ))}
            </nav>
            <p className="acct-hint" aria-hidden="true">Cuộn ngang để xem đủ mục</p>
          </div>
          <div className="acct-main">
            <div className="acct-identity">
              <strong>{state.identity.username}</strong>
              <span>{ROLE_LABEL[state.identity.role] ?? state.identity.role} · {STATUS_LABEL[state.identity.status] ?? state.identity.status}</span>
              <button className="acct-logout" type="button" onClick={logout} disabled={loggingOut}>
                {loggingOut ? "Đang đăng xuất…" : "Đăng xuất khỏi thiết bị này"}
              </button>
            </div>
            {content(state.identity)}
          </div>
        </div>
      </div>
    </div>
  );
}
