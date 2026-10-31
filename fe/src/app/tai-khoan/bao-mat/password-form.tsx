"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateNewPasswordInput } from "@/lib/account-contract";
import { authChangePassword } from "@/lib/customer-account-client";
import { readOwnProfile } from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export function PasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [currentIssue, setCurrentIssue] = useState("");
  const [nextIssue, setNextIssue] = useState("");
  const [confirmIssue, setConfirmIssue] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    readOwnProfile()
      .then((result) => {
        if (!active) return;
        if (!result) {
          router.replace("/dang-nhap?next=/tai-khoan/bao-mat");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (active) setError("Không thể kiểm tra phiên. Hãy thử lại.");
      });
    return () => {
      active = false;
    };
  }, [router]);

  // Tiêu điểm về thông báo lỗi sau khi React đã gắn node: gọi focus() ngay sau
  // setError sẽ là no-op vì node lỗi còn chưa tồn tại.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const nextFound = validateNewPasswordInput(next);
    setNextIssue(nextFound ?? "");
    setConfirmIssue(next !== confirm ? "Mật khẩu nhập lại chưa khớp." : "");
    setCurrentIssue(current ? "" : "Nhập mật khẩu hiện tại.");
    if (nextFound || next !== confirm || !current) {

      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await authChangePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      router.replace("/dang-nhap?password=changed");
    } catch (failure) {
      const status = (failure as { status?: number })?.status ?? 0;
      if (status === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/bao-mat");
        return;
      }
      if (status === 400) {
        setCurrentIssue("Mật khẩu hiện tại chưa đúng hoặc mật khẩu mới chưa đạt yêu cầu.");
        return;
      }
      setError(failure instanceof Error ? failure.message : "Đổi mật khẩu chưa thành công. Hãy thử lại.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (!ready && !error) {
    return (
      <div aria-label="Đang kiểm tra phiên">
        <div className={styles.skeleton} style={{ height: 40 }} />
        <div className={styles.skeleton} style={{ height: 40, marginTop: 12 }} />
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate method="post">
      <div className={styles.field}>
        <label htmlFor="pw-current">Mật khẩu hiện tại</label>
        <div className={styles.inputRow}>
          <input
            id="pw-current"
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={currentIssue ? true : undefined}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-pressed={showCurrent}
            aria-label={showCurrent ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
            onClick={() => setShowCurrent(!showCurrent)}
          >
            {showCurrent ? "Ẩn" : "Hiện"}
          </button>
        </div>
        {currentIssue && <p className={styles.fieldError} role="alert">{currentIssue}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-next">Mật khẩu mới</label>
        <div className={styles.inputRow}>
          <input
            id="pw-next"
            type={showNext ? "text" : "password"}
            autoComplete="new-password"
            required
            aria-invalid={nextIssue ? true : undefined}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <button
            type="button"
            className={styles.reveal}
            aria-pressed={showNext}
            aria-label={showNext ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
            onClick={() => setShowNext(!showNext)}
          >
            {showNext ? "Ẩn" : "Hiện"}
          </button>
        </div>
        <p className={styles.hint}>15–64 ký tự, tối đa 72 byte UTF-8. Không có thang điểm mạnh yếu.</p>
        {nextIssue && <p className={styles.fieldError} role="alert">{nextIssue}</p>}
      </div>
      <div className={styles.field}>
        <label htmlFor="pw-confirm">Nhập lại mật khẩu mới</label>
        <input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={confirmIssue ? true : undefined}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {confirmIssue && <p className={styles.fieldError} role="alert">{confirmIssue}</p>}
      </div>
      {error && (
        <p ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
        </button>
      </div>
      <p className={styles.muted}>
        Đổi xong, mọi phiên đăng nhập (kể cả thiết bị này) hết hiệu lực.{" "}
        <Link href="/tai-khoan">Về trung tâm tài khoản</Link>
      </p>
    </form>
  );
}
