"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { verifyEmail, AuthApiError, isAuthAbort, invalidateAuthMemory } from "@/lib/customer-auth-client";
import { AccessFrameIcon } from "./auth-icons";
import { AuthEditorial } from "./auth-editorial";
import "./auth.css";

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function VerifyEmailPanel({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const startedRef = useRef(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (startedRef.current || !token) return;
    startedRef.current = true;
    const controller = new AbortController();
    setState({ kind: "busy" });
    verifyEmail(token, controller.signal)
      .then((message) => {
        invalidateAuthMemory();
        if (!controller.signal.aborted) setState({ kind: "done", message });
      })
      .catch((failure) => {
        if (controller.signal.aborted || isAuthAbort(failure)) return;
        setState({
          kind: "error",
          message: failure instanceof AuthApiError ? failure.message : "Xác thực email chưa thành công. Thử lại.",
        });
      });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (state.kind === "done" || state.kind === "error") statusRef.current?.focus();
  }, [state]);

  return (
    <div className="authPage">
      <div className="auth-content">
        <div className="auth-layout">
          <AuthEditorial />
          <div className="auth-form-wrap">
            <div className="auth-form" aria-busy={state.kind === "busy"}>
              <span className="auth-rule" aria-hidden="true" />
              <p className="auth-access"><AccessFrameIcon /><span>Tài khoản FaSearch</span></p>
              <h1>Xác thực email</h1>
              {!token ? (
                <p className="auth-status is-error" role="alert" tabIndex={-1}>
                  Liên kết xác thực không hợp lệ hoặc đã bị cắt ngắn.
                </p>
              ) : state.kind === "busy" || state.kind === "idle" ? (
                <p className="auth-status is-info" role="status">Đang xác thực email…</p>
              ) : state.kind === "done" ? (
                <p ref={statusRef} tabIndex={-1} className="auth-status is-info" role="status">
                  {state.message} Email của bạn đã được xác thực.{" "}
                  <Link className="auth-link" href="/tai-khoan">Mở tài khoản của tôi →</Link>
                </p>
              ) : (
                <p ref={statusRef} tabIndex={-1} className="auth-status is-error" role="alert">
                  {state.message} Liên kết có thể đã hết hạn hoặc đã dùng rồi.
                </p>
              )}
              {state.kind === "error" ? (
                <p className="auth-note">
                  Đã đăng nhập? Mở <Link className="auth-link" href="/tai-khoan">tài khoản của tôi</Link> để gửi lại email xác thực.
                  Chưa có liên kết mới? <Link className="auth-link" href="/dang-nhap">Đăng nhập</Link> rồi gửi lại từ trang tài khoản.
                </p>
              ) : null}
              <div className="auth-links">
                <span className="auth-secondary">Về trang chủ?</span>
                <Link className="auth-link" href="/">FaSearch</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
