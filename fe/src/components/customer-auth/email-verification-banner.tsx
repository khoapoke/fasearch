"use client";

import { useEffect, useRef, useState } from "react";
import { requestVerificationEmail, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import "./auth.css";

/**
 * Banner "chua xac thuc email" + nut gui lai. Dung o trang tai khoan va bao mat.
 * Chi hien khi da biet chac chua xac thuc (emailVerified === false).
 */
export function EmailVerificationBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const liveRef = useRef(true);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    liveRef.current = true;
    return () => { liveRef.current = false; };
  }, []);
  useEffect(() => {
    if (sent || error) statusRef.current?.focus();
  }, [sent, error]);

  async function resend() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    try {
      await requestVerificationEmail(controller.signal);
      if (!liveRef.current || controller.signal.aborted) return;
      setSent(true);
    } catch (failure) {
      if (!liveRef.current || controller.signal.aborted || isAuthAbort(failure)) return;
      setError(failure instanceof AuthApiError ? failure.message : "Gửi email xác thực chưa thành công. Thử lại.");
    } finally {
      busyRef.current = false;
      if (liveRef.current) setBusy(false);
    }
  }

  return (
    <section className="auth-verify-banner" aria-label="Xác thực email" role="region">
      <p className="auth-verify-title">Email chưa được xác thực</p>
      <p className="auth-verify-text">
        Tài khoản dùng email <strong>{email}</strong> nhưng địa chỉ này chưa được xác thực.
        Bạn vẫn đăng nhập và mua sắm bình thường; xác thực giúp khôi phục mật khẩu khi cần.
      </p>
      {sent ? (
        <p ref={statusRef} tabIndex={-1} className="auth-status is-info" role="status">
          Email xác thực đã được gửi. Kiểm tra hộp thư (kể cả thư rác) — liên kết có hiệu lực trong 24 giờ.
        </p>
      ) : (
        <button className="auth-button" type="button" onClick={resend} disabled={busy} aria-busy={busy}>
          {busy ? "Đang gửi…" : "Gửi lại email xác thực"}
        </button>
      )}
      {error ? (
        <p ref={statusRef} tabIndex={-1} className="auth-status is-error" role="alert">{error}</p>
      ) : null}
    </section>
  );
}
