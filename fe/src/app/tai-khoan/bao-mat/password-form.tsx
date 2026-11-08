"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { validateNewPasswordInput } from "@/lib/account-contract";
import { authChangePassword } from "@/lib/customer-account-client";
import { authMe } from "@/lib/customer-auth-client";

import ac from "@/components/account/account-cards.module.css";

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
    authMe()
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) router.replace("/dang-nhap?next=/tai-khoan/bao-mat");
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
      const code = (failure as { code?: string })?.code;
      // BE trả 401 cho "sai mật khẩu hiện tại" (INVALID_OLD_PASSWORD); 401 không kèm code
      // mới là phiên hết hạn. Không đăng xuất người dùng chỉ vì gõ sai mật khẩu cũ.
      if (status === 401 && code !== "INVALID_OLD_PASSWORD") {
        router.replace("/dang-nhap?next=/tai-khoan/bao-mat");
        return;
      }
      if (status === 401 && code === "INVALID_OLD_PASSWORD") {
        setCurrentIssue("Mật khẩu hiện tại chưa đúng.");
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
      <div className={ac.group} aria-label="Đang kiểm tra phiên">
        <div className={ac.skeleton} />
        <div className={ac.skeleton} />
      </div>
    );
  }

  return (
    <form className={ac.form} onSubmit={submit} noValidate method="post">
      <div className={ac.field}>
        <label className={ac.label} htmlFor="pw-current">Mật khẩu hiện tại</label>
        <div className={ac.inputWrap}>
          <input
            id="pw-current"
            className={ac.input}
            type={showCurrent ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={currentIssue ? true : undefined}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
          <button
            type="button"
            className={ac.reveal}
            aria-pressed={showCurrent}
            aria-label={showCurrent ? "Ẩn mật khẩu hiện tại" : "Hiện mật khẩu hiện tại"}
            onClick={() => setShowCurrent(!showCurrent)}
          >
            {showCurrent ? "Ẩn" : "Hiện"}
          </button>
        </div>
        {currentIssue && <p className={ac.error} role="alert">{currentIssue}</p>}
      </div>

      <hr className={ac.divider} />

      <div className={ac.group}>
        <div className={ac.field}>
          <label className={ac.label} htmlFor="pw-next">Mật khẩu mới</label>
          <div className={ac.inputWrap}>
            <input
              id="pw-next"
              className={ac.input}
              type={showNext ? "text" : "password"}
              autoComplete="new-password"
              required
              aria-invalid={nextIssue ? true : undefined}
              aria-describedby="pw-next-hint"
              value={next}
              onChange={(event) => setNext(event.target.value)}
            />
            <button
              type="button"
              className={ac.reveal}
              aria-pressed={showNext}
              aria-label={showNext ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
              onClick={() => setShowNext(!showNext)}
            >
              {showNext ? "Ẩn" : "Hiện"}
            </button>
          </div>
          <p className={ac.hint} id="pw-next-hint">Từ 15 đến 64 ký tự. Một câu ngắn dễ nhớ cũng là mật khẩu tốt.</p>
          {nextIssue && <p className={ac.error} role="alert">{nextIssue}</p>}
        </div>
        <div className={ac.field}>
          <label className={ac.label} htmlFor="pw-confirm">Nhập lại mật khẩu mới</label>
          <input
            id="pw-confirm"
            className={ac.input}
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={confirmIssue ? true : undefined}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {confirmIssue && <p className={ac.error} role="alert">{confirmIssue}</p>}
        </div>
      </div>

      {error && (
        <p ref={errorRef} tabIndex={-1} className={ac.alert} role="alert">
          {error}
        </p>
      )}

      <div className={ac.actions}>
        <button className={ac.primary} type="submit" disabled={busy}>
          {busy ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
        </button>
        <p className={ac.footnote}>Đổi xong, mọi thiết bị (kể cả máy này) sẽ được đăng xuất để bạn đăng nhập lại bằng mật khẩu mới.</p>
      </div>
    </form>
  );
}
