"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  validateRegisterInput,
  type RegisterIssues,
} from "@/lib/account-contract";
import { fetchCsrf, readOwnProfile } from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [issues, setIssues] = useState<RegisterIssues>({});
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    readOwnProfile()
      .then((profile) => {
        if (profile && active) router.replace("/tai-khoan");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    const found = validateRegisterInput({
      username,
      email,
      password,
      displayName: displayName ? displayName : undefined,
    });
    setIssues(found);
    if (Object.keys(found).length > 0) {
      setError("Kiểm tra lại các trường tô đỏ.");
      errorRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const csrf = await fetchCsrf();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
        }),
      });
      if (response.status === 409) {
        throw new Error("Tên đăng nhập hoặc email đã được dùng. Hãy chọn giá trị khác.");
      }
      if (response.status === 502) throw new Error("Không thể kết nối hệ thống. Hãy thử lại sau.");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Tạo tài khoản chưa thành công. Kiểm tra lại.");
      }
      router.replace("/dang-nhap?registered=1");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Tạo tài khoản không hoàn tất.");
      setPassword("");
      errorRef.current?.focus();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate method="post">
      <div className={styles.field}>
        <label htmlFor="reg-username">Tên đăng nhập</label>
        <input
          id="reg-username"
          name="username"
          autoComplete="username"
          required
          aria-invalid={issues.username ? true : undefined}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <p className={styles.hint}>3–100 ký tự: chữ, số, gạch dưới, chấm hoặc gạch ngang.</p>
        {issues.username && <p className={styles.fieldError} role="alert">{issues.username}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={issues.email ? true : undefined}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {issues.email && <p className={styles.fieldError} role="alert">{issues.email}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-password">Mật khẩu</label>
        <div className={styles.inputRow}>
          <input
            id="reg-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            aria-invalid={issues.password ? true : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-pressed={show}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShow(!show)}
          >
            {show ? "Ẩn" : "Hiện"}
          </button>
        </div>
        <p className={styles.hint}>15–64 ký tự, tối đa 72 byte UTF-8. Hệ thống không tự cắt ngắn.</p>
        {issues.password && <p className={styles.fieldError} role="alert">{issues.password}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="reg-display">Tên hiển thị (tùy chọn)</label>
        <input
          id="reg-display"
          name="displayName"
          autoComplete="nickname"
          aria-invalid={issues.displayName ? true : undefined}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        {issues.displayName && <p className={styles.fieldError} role="alert">{issues.displayName}</p>}
      </div>
      {error && (
        <p ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </button>
      </div>
      <p className={styles.muted}>
        Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link>.
      </p>
    </form>
  );
}
