"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authRegister, AuthApiError, isAuthAbort } from "@/lib/customer-auth-client";
import { AccessFrameIcon, EyeIcon } from "./auth-icons";
import { AuthEditorial } from "./auth-editorial";
import "./auth.css";

type FieldKey = "username" | "password" | "email" | "lastName" | "phoneNumber";

export function RegisterPanel() {
  const router = useRouter();
  const [values, setValues] = useState({
    username: "", password: "", email: "", firstName: "", lastName: "", phoneNumber: "", gender: "",
  });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const busyRef = useRef(false);
  const liveRef = useRef(true);
  const submitRef = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      submitRef.current?.abort();
    };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  function set(key: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key in fieldErrors) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const local: Partial<Record<FieldKey, string>> = {};
    if (values.username.trim().length < 4 || values.username.trim().length > 50) local.username = "Tên đăng nhập phải từ 4 đến 50 ký tự.";
    if (values.password.length < 6 || values.password.length > 100) local.password = "Mật khẩu phải từ 6 đến 100 ký tự.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) local.email = "Email chưa đúng định dạng.";
    if (!values.lastName.trim()) local.lastName = "Nhập họ của bạn.";
    if (!values.phoneNumber.trim()) local.phoneNumber = "Nhập số điện thoại.";
    if (Object.keys(local).length) {
      setFieldErrors(local);
      setError("Kiểm tra lại các trường được đánh dấu.");
      return;
    }
    const controller = new AbortController();
    submitRef.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      await authRegister({ ...values, username: values.username.trim(), email: values.email.trim(), lastName: values.lastName.trim(), firstName: values.firstName.trim(), phoneNumber: values.phoneNumber.trim() }, controller.signal);
      if (!liveRef.current || controller.signal.aborted || submitRef.current !== controller) return;
      router.replace("/tai-khoan");
    } catch (failure) {
      if (!liveRef.current || controller.signal.aborted || isAuthAbort(failure)) return;
      if (failure instanceof AuthApiError) {
        setError(failure.message);
        const next: Partial<Record<FieldKey, string>> = {};
        for (const item of failure.errors ?? []) {
          if (item.field && ["username", "password", "email", "lastName", "phoneNumber"].includes(item.field)) {
            next[item.field as FieldKey] = item.reason ?? "Chưa hợp lệ.";
          }
        }
        setFieldErrors(next);
      } else {
        setError("Không thể tạo tài khoản lúc này. Thử lại.");
      }
    } finally {
      if (submitRef.current === controller) {
        submitRef.current = null;
        busyRef.current = false;
        if (liveRef.current) setBusy(false);
      }
    }
  }

  const field = (key: FieldKey) => ({
    id: `register-${key}`,
    className: "auth-control",
    "aria-invalid": fieldErrors[key] ? true : undefined,
    "aria-describedby": fieldErrors[key] ? `register-${key}-error` : undefined,
  });

  return (
    <div className="authPage">
      <div className="auth-content">
        <div className="auth-layout">
          <AuthEditorial />
          <div className="auth-form-wrap">
            <form className="auth-form" onSubmit={submit} noValidate aria-busy={busy}>
              <span className="auth-rule" aria-hidden="true" />
              <p className="auth-access"><AccessFrameIcon /><span>Tài khoản FaSearch</span></p>
              <h1>Tạo tài khoản</h1>
              <p className="auth-welcome">Một tài khoản để lưu gu và tiếp tục tìm kiếm.</p>

              <div className="auth-field">
                <label htmlFor="register-username">Tên đăng nhập</label>
                <input {...field("username")} type="text" value={values.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
                {fieldErrors.username ? <p className="auth-note" id="register-username-error" role="alert">{fieldErrors.username}</p> : null}
              </div>
              <div className="auth-field">
                <label htmlFor="register-password">Mật khẩu</label>
                <div className="auth-password">
                  <input {...field("password")} type={show ? "text" : "password"} value={values.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" required />
                  <button className="auth-eye" type="button" aria-pressed={show} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow((v) => !v)}>
                    <EyeIcon hidden={show} />
                  </button>
                </div>
                {fieldErrors.password ? <p className="auth-note" id="register-password-error" role="alert">{fieldErrors.password}</p> : <p className="auth-note">Từ 6 đến 100 ký tự.</p>}
              </div>
              <div className="auth-field">
                <label htmlFor="register-email">Email</label>
                <input {...field("email")} type="email" value={values.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
                {fieldErrors.email ? <p className="auth-note" id="register-email-error" role="alert">{fieldErrors.email}</p> : null}
              </div>
              <div className="auth-name-grid">
                <div className="auth-field">
                  <label htmlFor="register-firstName">Tên</label>
                  <input className="auth-control" id="register-firstName" type="text" value={values.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />
                </div>
                <div className="auth-field">
                  <label htmlFor="register-lastName">Họ</label>
                  <input {...field("lastName")} id="register-lastName" type="text" value={values.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" required />
                  {fieldErrors.lastName ? <p className="auth-note" id="register-lastName-error" role="alert">{fieldErrors.lastName}</p> : null}
                </div>
              </div>
              <div className="auth-field" style={{ marginTop: 22 }}>
                <label htmlFor="register-phoneNumber">Số điện thoại</label>
                <input {...field("phoneNumber")} id="register-phoneNumber" type="tel" value={values.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} autoComplete="tel" required />
                {fieldErrors.phoneNumber ? <p className="auth-note" id="register-phoneNumber-error" role="alert">{fieldErrors.phoneNumber}</p> : null}
              </div>
              <div className="auth-field">
                <label htmlFor="register-gender">Giới tính (không bắt buộc)</label>
                <select className="auth-control" id="register-gender" value={values.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Không tiết lộ</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>

              {error ? <p ref={errorRef} tabIndex={-1} className="auth-status is-error" role="alert">{error}</p> : busy ? <p className="auth-status is-info" role="status">Đang tạo tài khoản…</p> : null}
              <div className="auth-actions">
                <button className="auth-button is-primary" type="submit" disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</button>
              </div>
              <div className="auth-links">
                <span className="auth-secondary">Đã có tài khoản?</span>
                <Link className="auth-link" href="/dang-nhap">Đăng nhập</Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
