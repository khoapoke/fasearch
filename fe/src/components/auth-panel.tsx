"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./auth-panel.module.css";

type CurrentUser = { username: string; authorities: string[] };
type CsrfResponse = { header_name: string; token: string };

export function AuthPanel() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (response.ok && active) setUser((await response.json()) as CurrentUser);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function csrfToken(): Promise<CsrfResponse> {
    const response = await fetch("/api/auth/csrf", { cache: "no-store" });
    if (!response.ok) throw new Error("Không thể bắt đầu phiên đăng nhập.");
    return (await response.json()) as CsrfResponse;
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const csrf = await csrfToken();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [csrf.header_name]: csrf.token,
        },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Thông tin đăng nhập không hợp lệ.");
      const profile = await fetch("/api/auth/me", { cache: "no-store" });
      if (!profile.ok) throw new Error("Không thể đọc phiên đăng nhập.");
      setUser((await profile.json()) as CurrentUser);
      setPassword("");
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Đăng nhập không hoàn tất.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const csrf = await csrfToken();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { [csrf.header_name]: csrf.token },
      });
      if (!response.ok) throw new Error("Không thể đăng xuất. Hãy thử lại.");
      setUser(null);
      setUsername("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Đăng xuất không hoàn tất.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.auth}>
      {user ? (
        <div className={styles.signedIn}>
          {user.authorities.includes("CATALOG_DRAFT_WRITE") && (
            <Link href="/catalog/drafts">Danh sách nháp</Link>
          )}
          {user.authorities.includes("CATALOG_DRAFT_WRITE") && (
            <Link href="/catalog/drafts/new">Tạo sản phẩm</Link>
          )}
          <span title={user.authorities.join(", ")}>{user.username}</span>
          <button type="button" onClick={logout} disabled={busy}>
            Đăng xuất
          </button>
        </div>
      ) : (
        <button
          className={styles.openButton}
          type="button"
          onClick={() => {
            setOpen(!open);
            setError("");
          }}
        >
          Đăng nhập
        </button>
      )}
      {open && !user && (
        <form className={styles.form} onSubmit={login}>
          <label>
            Tên đăng nhập
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            Mật khẩu
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? "Đang đăng nhập" : "Đăng nhập"}
          </button>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
      )}
      {user && error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
