import type { AuthIdentity } from "./customer-auth-client";

export type CustomerHeaderAuthState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "forbidden"; message?: string }
  | { status: "error"; message?: string }
  | { status: "authenticated"; identity: AuthIdentity };

export interface HeaderAccountNavModel {
  label: string;
  href: string;
  ariaLabel?: string;
  title?: string;
  showAdminEntry: boolean;
  status: "loading" | "guest" | "forbidden" | "error" | "authenticated";
  isGuest: boolean;
}

/**
 * Distinguishes 401 session expiry/guest from 403 permission denied and transient 500/network errors.
 * Never displays guest login on permission/server error and never redirects valid users as expired.
 * Renders neutral/retry/permission state without stale previous user identity.
 */
export function resolveHeaderAccountNav(
  state: CustomerHeaderAuthState,
  destination: string = "/tai-khoan"
): HeaderAccountNavModel {
  switch (state.status) {
    case "loading":
      return {
        label: "Tài khoản",
        href: destination,
        ariaLabel: "Đang tải thông tin tài khoản",
        title: "Đang tải…",
        showAdminEntry: false,
        status: "loading",
        isGuest: false,
      };
    case "guest":
      return {
        label: "Đăng nhập",
        href: `/dang-nhap?next=${encodeURIComponent(destination)}`,
        ariaLabel: "Đăng nhập vào tài khoản",
        title: "Đăng nhập",
        showAdminEntry: false,
        status: "guest",
        isGuest: true,
      };
    case "forbidden":
      // 403: user is authenticated but not permitted / role mismatch.
      // Retain on /tai-khoan to view explanation; do not treat as guest.
      return {
        label: "Tài khoản",
        href: destination,
        ariaLabel: "Tài khoản — Quyền truy cập bị từ chối",
        title: state.message || "Quyền truy cập bị từ chối",
        showAdminEntry: false,
        status: "forbidden",
        isGuest: false,
      };
    case "error":
      // 500 / network error: transient failure.
      // Retain neutral state with retry capability; do not treat as guest.
      return {
        label: "Tài khoản",
        href: destination,
        ariaLabel: "Tài khoản — Lỗi kết nối, bấm để thử lại",
        title: "Lỗi kết nối — bấm để thử lại",
        showAdminEntry: false,
        status: "error",
        isGuest: false,
      };
    case "authenticated":
      return {
        label: state.identity.username || "Tài khoản",
        href: destination,
        ariaLabel: `Tài khoản ${state.identity.username}`,
        title: state.identity.username,
        showAdminEntry: state.identity.role === "ADMIN" || state.identity.role === "STAFF",
        status: "authenticated",
        isGuest: false,
      };
  }
}
