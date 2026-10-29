"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authLogout, authMe, AuthApiError, formatAuthDate, type AuthIdentity } from "@/lib/customer-auth-client";
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
  const logoutRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    authMe(controller.signal)
      .then((identity) => setState({ kind: "ready", identity }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure instanceof AuthApiError && failure.status === 401) setState({ kind: "guest" });
        else setState({ kind: "error", message: failure instanceof Error ? failure.message : "Không tải được tài khoản." });
      });
    return () => controller.abort();
  }, [retry]);

  async function logout() {
    if (logoutRef.current) return;
    logoutRef.current = true;
    setLoggingOut(true);
    try {
      await authLogout();
      router.replace("/");
    } catch (failure) {
      setState({ kind: "error", message: failure instanceof Error ? failure.message : "Không thể đăng xuất." });
    } finally {
      logoutRef.current = false;
      setLoggingOut(false);
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
      return unavailable("Đơn gần đây", "Lịch sử đơn hàng chưa được kết nối trong pilot đọc/ghi tài khoản này. Không hiển thị dữ liệu đơn mẫu.");
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
