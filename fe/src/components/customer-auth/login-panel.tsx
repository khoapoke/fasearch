"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { safeCustomerAuthReturn } from "@/lib/customer-auth-return";
import { authLogin, authMe, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import { AccessFrameIcon, EyeIcon } from "./auth-icons";
import { AuthEditorial } from "./auth-editorial";
import { AuthThreadline } from "./auth-threadline";
import "./auth.css";

export function LoginPanel({ next }: { next: string }) {
  const router = useRouter();
  const returnTo = safeCustomerAuthReturn(next);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const liveRef = useRef(true);
  const meRef = useRef<AbortController | null>(null);
  const submitRef = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    liveRef.current = true;
    const controller = new AbortController();
    meRef.current = controller;
    authMe(controller.signal)
      .then(() => { if (liveRef.current && !submitRef.current) router.replace(returnTo); })
      .catch(() => {});
    return () => {
      liveRef.current = false;
      controller.abort();
      submitRef.current?.abort();
      if (meRef.current === controller) meRef.current = null;
    };
  }, [returnTo, next, router]);

  // CF-02: lỗi nhập liệu phải chỉ đúng ô. Trước đây focus luôn nhảy vào khối
  // thông báo nên người dùng phải tự tìm ô sai. Ô cụ thể được focus trực tiếp;
  // khối thông báo chỉ nhận focus khi lỗi không gắn với ô nào (ví dụ lỗi máy chủ).
  const fieldFocus = useRef(false);
  useEffect(() => {
    if (!error) return;
    if (fieldFocus.current) { fieldFocus.current = false; return; }
    errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const firstInvalidId = !username.trim() ? "login-username" : !password ? "login-password" : null;
    if (firstInvalidId) {
      fieldFocus.current = true;
      setError("Nhập tên đăng nhập và mật khẩu.");
      requestAnimationFrame(() => document.getElementById(firstInvalidId)?.focus());
      return;
    }
    meRef.current?.abort();
    meRef.current = null;
    const controller = new AbortController();
    submitRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await authLogin(username.trim(), password, controller.signal);
      if (!liveRef.current || controller.signal.aborted || submitRef.current !== controller) return;
      setPassword("");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fasearch-auth-change"));
      }
      router.replace(returnTo);
    } catch (failure) {
      if (!liveRef.current || controller.signal.aborted || isAuthAbort(failure)) return;
      setError(failure instanceof AuthApiError ? failure.message : "Không thể đăng nhập lúc này. Thử lại.");
      setPassword("");
    } finally {
      if (submitRef.current === controller) {
        submitRef.current = null;
        busyRef.current = false;
        if (liveRef.current) setBusy(false);
      }
    }
  }

  return (
    <div className="authPage is-login">
      <AuthThreadline />
      <div className="auth-content">
        <div className="auth-layout">
          <AuthEditorial />
          <div className="auth-form-wrap">
            <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
              <span className="auth-rule" aria-hidden="true" />
              <p className="auth-access"><AccessFrameIcon /><span>Tài khoản FaSearch</span></p>
              <h1>Đăng nhập</h1>
              <p className="auth-welcome">Chào mừng bạn trở lại.</p>
              <div className="auth-field">
                <label htmlFor="login-username">Tên đăng nhập</label>
                <input
                  id="login-username"
                  className="auth-control"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (error) setError(""); }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="login-password">Mật khẩu</label>
                <div className="auth-password">
                  <input
                    id="login-password"
                    className="auth-control"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                    autoComplete="current-password"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "login-error" : undefined}
                    required
                  />
                  <button
                    className="auth-eye"
                    type="button"
                    aria-pressed={show}
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onClick={() => setShow((v) => !v)}
                  >
                    <EyeIcon hidden={show} />
                  </button>
                </div>
              </div>
              {error ? (
                <p ref={errorRef} id="login-error" tabIndex={-1} className="auth-status is-error" role="alert">{error}</p>
              ) : busy ? (
                <p className="auth-status is-info" role="status">Đang đăng nhập…</p>
              ) : null}
              <div className="auth-actions">
                <button className="auth-button is-primary" type="submit" disabled={busy}>
                  {busy ? "Đang đăng nhập…" : "Đăng nhập"}
                </button>
              </div>
              <div className="auth-links">
                <span className="auth-secondary">Chưa có tài khoản?</span>
                <Link className="auth-link" href="/dang-ky">Tạo tài khoản</Link>
              </div>
              <div className="auth-links">
                <span className="auth-secondary">Quên mật khẩu?</span>
                <Link className="auth-link" href="/quen-mat-khau">Đặt lại qua email</Link>
              </div>
              <p className="auth-note">Chỉ dùng tài khoản của bạn trên thiết bị này.</p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
