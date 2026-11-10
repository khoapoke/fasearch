"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { requestPasswordReset, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import { AccessFrameIcon } from "./auth-icons";
import { AuthEditorial } from "./auth-editorial";
import "./auth.css";

export function ForgotPasswordPanel() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const liveRef = useRef(true);
  const submitRef = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      submitRef.current?.abort();
    };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (sent) doneRef.current?.focus(); }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Nhập địa chỉ email đúng định dạng.");
      requestAnimationFrame(() => document.getElementById("forgot-email")?.focus());
      return;
    }
    const controller = new AbortController();
    submitRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email.trim(), controller.signal);
      if (!liveRef.current || controller.signal.aborted || submitRef.current !== controller) return;
      setSent(true);
    } catch (failure) {
      if (!liveRef.current || controller.signal.aborted || isAuthAbort(failure)) return;
      setError(failure instanceof AuthApiError ? failure.message : "Không gửi được yêu cầu lúc này. Thử lại.");
    } finally {
      if (submitRef.current === controller) {
        submitRef.current = null;
        busyRef.current = false;
        if (liveRef.current) setBusy(false);
      }
    }
  }

  return (
    <div className="authPage">
      <div className="auth-content">
        <div className="auth-layout">
          <AuthEditorial />
          <div className="auth-form-wrap">
            <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
              <span className="auth-rule" aria-hidden="true" />
              <p className="auth-access"><AccessFrameIcon /><span>Tài khoản FaSearch</span></p>
              <h1>Quên mật khẩu</h1>
              <p className="auth-welcome">Nhập email đã đăng ký, chúng tôi gửi liên kết đặt lại mật khẩu.</p>
              {sent ? (
                <p ref={doneRef} tabIndex={-1} className="auth-status is-info" role="status">
                  Nếu email đã đăng ký, liên kết đặt lại mật khẩu đã được gửi. Kiểm tra hộp thư (kể cả thư rác).
                  Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.
                </p>
              ) : (
                <div className="auth-field">
                  <label htmlFor="forgot-email">Email</label>
                  <input
                    id="forgot-email"
                    className="auth-control"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "forgot-error" : undefined}
                    required
                  />
                </div>
              )}
              {error ? (
                <p ref={errorRef} id="forgot-error" tabIndex={-1} className="auth-status is-error" role="alert">{error}</p>
              ) : busy ? (
                <p className="auth-status is-info" role="status">Đang gửi yêu cầu…</p>
              ) : null}
              {!sent ? (
                <div className="auth-actions">
                  <button className="auth-button is-primary" type="submit" disabled={busy}>
                    {busy ? "Đang gửi…" : "Gửi liên kết đặt lại"}
                  </button>
                </div>
              ) : null}
              <div className="auth-links">
                <span className="auth-secondary">Nhớ mật khẩu rồi?</span>
                <Link className="auth-link" href="/dang-nhap">Đăng nhập</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
