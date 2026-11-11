"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { resetPassword, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import { AccessFrameIcon, EyeIcon } from "./auth-icons";
import { AuthEditorial } from "./auth-editorial";
import "./auth.css";

export function ResetPasswordPanel({ token }: { token: string }) {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
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
  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    if (next.length < 6 || next.length > 100) {
      setError("Mật khẩu mới phải từ 6 đến 100 ký tự.");
      requestAnimationFrame(() => document.getElementById("reset-new")?.focus());
      return;
    }
    if (next !== confirm) {
      setError("Mật khẩu nhập lại chưa khớp.");
      requestAnimationFrame(() => document.getElementById("reset-confirm")?.focus());
      return;
    }
    const controller = new AbortController();
    submitRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await resetPassword(token, next, controller.signal);
      if (!liveRef.current || controller.signal.aborted || submitRef.current !== controller) return;
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (failure) {
      if (!liveRef.current || controller.signal.aborted || isAuthAbort(failure)) return;
      setError(failure instanceof AuthApiError ? failure.message : "Đặt lại mật khẩu chưa thành công. Thử lại.");
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
              <h1>Đặt lại mật khẩu</h1>
              {!token ? (
                <>
                  <p className="auth-status is-error" role="alert" tabIndex={-1}>
                    Liên kết đặt lại mật khẩu không hợp lệ hoặc đã bị cắt ngắn.
                  </p>
                  <div className="auth-actions">
                    <Link className="auth-button is-primary" href="/quen-mat-khau">Yêu cầu liên kết mới</Link>
                  </div>
                </>
              ) : done ? (
                <p ref={doneRef} tabIndex={-1} className="auth-status is-info" role="status">
                  Đặt lại mật khẩu thành công. Mọi phiên đăng nhập cũ đã hết hiệu lực.{" "}
                  <Link className="auth-link" href="/dang-nhap">Đăng nhập bằng mật khẩu mới →</Link>
                </p>
              ) : (
                <>
                  <p className="auth-welcome">Tạo mật khẩu mới cho tài khoản của bạn.</p>
                  <div className="auth-field">
                    <label htmlFor="reset-new">Mật khẩu mới</label>
                    <div className="auth-password">
                      <input
                        id="reset-new"
                        className="auth-control"
                        type={show ? "text" : "password"}
                        value={next}
                        onChange={(e) => { setNext(e.target.value); if (error) setError(""); }}
                        autoComplete="new-password"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? "reset-error" : undefined}
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
                  <div className="auth-field">
                    <label htmlFor="reset-confirm">Nhập lại mật khẩu mới</label>
                    <input
                      id="reset-confirm"
                      className="auth-control"
                      type="password"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); if (error) setError(""); }}
                      autoComplete="new-password"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "reset-error" : undefined}
                      required
                    />
                  </div>
                  <p className="auth-note">Từ 6 đến 100 ký tự, giống quy tắc đổi mật khẩu trong tài khoản.</p>
                  {error ? (
                    <p ref={errorRef} id="reset-error" tabIndex={-1} className="auth-status is-error" role="alert">{error}</p>
                  ) : busy ? (
                    <p className="auth-status is-info" role="status">Đang đặt lại mật khẩu…</p>
                  ) : null}
                  <div className="auth-actions">
                    <button className="auth-button is-primary" type="submit" disabled={busy}>
                      {busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}
                    </button>
                  </div>
                </>
              )}
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
