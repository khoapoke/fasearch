"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { safeAccountReturnHref } from "@/lib/account-contract";
import { fetchCsrf, readOwnProfile } from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export function LoginForm({ next, registered, passwordChanged }: {
  next: string;
  registered: boolean;
  passwordChanged: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    readOwnProfile()
      .then((profile) => {
        if (profile && active) router.replace(safeAccountReturnHref(next));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [next, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!username.trim() || !password) {
      setError("Nhập tên đăng nhập và mật khẩu.");
      errorRef.current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const csrf = await fetchCsrf();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (response.status === 502) throw new Error("Không thể kết nối hệ thống. Hãy thử lại sau.");
      if (!response.ok) throw new Error("Tên đăng nhập hoặc mật khẩu chưa đúng.");
      setPassword("");
      router.replace(safeAccountReturnHref(next));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Đăng nhập không hoàn tất.");
      setPassword("");
      errorRef.current?.focus();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate method="post">
      {registered && (
        <p className={styles.notice} role="status">
          Tạo tài khoản thành công. Hãy đăng nhập bằng tên đăng nhập vừa tạo.
        </p>
      )}
      {passwordChanged && (
        <p className={styles.notice} role="status">
          Đổi mật khẩu thành công. Mọi phiên cũ đã hết hiệu lực — hãy đăng nhập lại.
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="login-username">Tên đăng nhập</label>
        <input
          id="login-username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Mật khẩu</label>
        <div className={styles.inputRow}>
          <input
            id="login-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
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
      </div>
      {error && (
        <p ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </div>
      <p className={styles.muted}>
        Chưa có tài khoản? <Link href="/dang-ky">Tạo tài khoản mới</Link>.
      </p>
    </form>
  );
}
