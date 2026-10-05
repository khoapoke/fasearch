"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateDisplayNameInput } from "@/lib/account-contract";
import {
  fetchCsrf,
  readOwnProfile,
  type AccountProfile,
} from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

export function ProfileEditor() {
  const router = useRouter();
  const [settled, setSettled] = useState<AccountProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    readOwnProfile()
      .then((result) => {
        if (!active) return;
        if (!result) {
          router.replace("/dang-nhap?next=/tai-khoan/thong-tin");
          return;
        }
        setSettled(result);
        setDraft(result.display_name ?? "");
      })
      .catch(() => {
        if (active) setError("Không thể tải thông tin. Hãy thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  function cancel() {
    // Cancel restores settled data; drafts survive validation/backend errors.
    setDraft(settled?.display_name ?? "");
    setIssue("");
    setError("");
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validateDisplayNameInput(draft);
    setIssue(found ?? "");
    if (found) {
      setSaved(false);
      errorRef.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const csrf = await fetchCsrf();
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify({ display_name: draft.trim() }),
      });
      if (response.status === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/thong-tin");
        return;
      }
      if (response.status === 502) throw new Error("Không thể kết nối hệ thống. Bản nháp được giữ lại.");
      if (!response.ok) throw new Error("Lưu chưa thành công. Bản nháp được giữ lại.");
      const updated = (await response.json()) as AccountProfile;
      setSettled(updated);
      setDraft(updated.display_name ?? "");
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Lưu không hoàn tất. Bản nháp được giữ lại.");
      errorRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className={styles.card} aria-label="Đang tải thông tin">
        <div className={styles.skeleton} style={{ height: 24, width: "45%" }} />
        <div className={styles.skeleton} style={{ height: 40, marginTop: 16 }} />
        <div className={styles.skeleton} style={{ height: 40, marginTop: 12 }} />
        <div className={styles.skeleton} style={{ height: 40, marginTop: 12 }} />
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate method="post">
      {saved && (
        <p className={styles.notice} role="status">
          Đã lưu tên hiển thị.
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="profile-username">Tên đăng nhập</label>
        <input id="profile-username" value={settled?.username ?? ""} readOnly autoComplete="username" />
        <p className={styles.hint}>Tên đăng nhập không thay đổi được.</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" value={settled?.email ?? ""} readOnly autoComplete="email" />
        <p className={styles.hint}>Email không thay đổi được.</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-display">Tên hiển thị</label>
        <input
          id="profile-display"
          autoComplete="nickname"
          aria-invalid={issue ? true : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {issue && <p className={styles.fieldError} role="alert">{issue}</p>}
      </div>
      {error && (
        <p ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
        <button className={styles.secondary} type="button" onClick={cancel} disabled={busy}>
          Hủy
        </button>
      </div>
      <p className={styles.muted}>
        <Link href="/tai-khoan">Về trung tâm tài khoản</Link>
      </p>
    </form>
  );
}
