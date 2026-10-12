"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validateEmailInput } from "@/lib/account-contract";
import {
  fetchCsrf,
  readOwnProfile,
  type CustomerProfile,
  type OwnProfile,
} from "@/components/account/account-session";
import styles from "@/components/account/account.module.css";

type Draft = {
  ho: string;
  ten: string;
  gioiTinh: string;
  ngaySinh: string;
  diaChi: string;
  email: string;
};

const EMPTY: Draft = { ho: "", ten: "", gioiTinh: "", ngaySinh: "", diaChi: "", email: "" };

function toDraft(customer: CustomerProfile | null): Draft {
  if (!customer) return EMPTY;
  const parts = (customer.hoTen || "").split(" ");
  // Họ là mọi phần trừ từ cuối; tên là từ cuối (khớp cách BE gộp hoTen).
  const ten = parts.length > 1 ? (parts.pop() as string) : (parts[0] ?? "");
  const ho = parts.join(" ");
  return {
    ho,
    ten,
    gioiTinh: customer.gioiTinh ?? "",
    ngaySinh: customer.ngaySinh ?? "",
    diaChi: customer.diaChi ?? "",
    email: customer.email ?? "",
  };
}

export function ProfileEditor() {
  const router = useRouter();
  const [settled, setSettled] = useState<OwnProfile | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
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
        setDraft(toDraft(result.customer));
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

  function set(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cancel() {
    setDraft(toDraft(settled?.customer ?? null));
    setIssue("");
    setError("");
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    if (!settled?.hasCustomerProfile) return;
    const ten = draft.ten.trim();
    if (!ten) {
      setIssue("Tên khách hàng không được để trống.");
      setSaved(false);
      errorRef.current?.focus();
      return;
    }
    if (draft.email.trim()) {
      const emailIssue = validateEmailInput(draft.email);
      if (emailIssue) {
        setIssue(emailIssue);
        setSaved(false);
        errorRef.current?.focus();
        return;
      }
    }
    setIssue("");
    busyRef.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const csrf = await fetchCsrf();
      const payload: Record<string, string> = {
        ho: draft.ho.trim(),
        ten,
        gioiTinh: draft.gioiTinh.trim(),
        ngaySinh: draft.ngaySinh.trim(),
        diaChi: draft.diaChi.trim(),
      };
      if (draft.email.trim()) payload.email = draft.email.trim();
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          [csrf.header]: csrf.token,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.replace("/dang-nhap?next=/tai-khoan/thong-tin");
        return;
      }
      if (response.status === 409) {
        setIssue("Email đã được sử dụng cho tài khoản khác.");
        errorRef.current?.focus();
        return;
      }
      if (response.status === 502) throw new Error("Không thể kết nối hệ thống. Bản nháp được giữ lại.");
      if (!response.ok) throw new Error("Lưu chưa thành công. Bản nháp được giữ lại.");
      const updated = (await response.json()) as {
        result: CustomerProfile;
      };
      setSettled((prev) =>
        prev ? { ...prev, customer: updated.result, hasCustomerProfile: true } : prev,
      );
      setDraft(toDraft(updated.result));
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Lưu không hoàn tất. Bản nháp được giữ lại.");
      errorRef.current?.focus();
    } finally {
      busyRef.current = false;
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

  if (settled && !settled.hasCustomerProfile) {
    return (
      <section className={styles.card} aria-label="Chưa có hồ sơ khách hàng">
        <p className={styles.greeting}>Tài khoản: {settled.account.username}</p>
        <p className={styles.muted}>Email: {settled.account.email}</p>
        <p className={styles.alert} role="status" style={{ marginTop: 12 }}>
          Tài khoản này chưa có hồ sơ khách hàng nên chưa sửa thông tin cá nhân được.
        </p>
        <p className={styles.muted}>
          <Link href="/tai-khoan">Về trung tâm tài khoản</Link>
        </p>
      </section>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate method="post">
      {saved && (
        <p className={styles.notice} role="status">
          Đã lưu thông tin.
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="profile-username">Tên đăng nhập</label>
        <input id="profile-username" value={settled?.account.username ?? ""} readOnly autoComplete="username" />
        <p className={styles.hint}>Tên đăng nhập không thay đổi được.</p>
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-ho">Họ và tên đệm</label>
        <input
          id="profile-ho"
          autoComplete="family-name"
          value={draft.ho}
          onChange={(event) => set("ho", event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-ten">Tên</label>
        <input
          id="profile-ten"
          autoComplete="given-name"
          aria-invalid={issue ? true : undefined}
          value={draft.ten}
          onChange={(event) => set("ten", event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-gioitinh">Giới tính</label>
        <input
          id="profile-gioitinh"
          value={draft.gioiTinh}
          onChange={(event) => set("gioiTinh", event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-ngaysinh">Ngày sinh</label>
        <input
          id="profile-ngaysinh"
          type="date"
          value={draft.ngaySinh}
          onChange={(event) => set("ngaySinh", event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-diachi">Địa chỉ</label>
        <input
          id="profile-diachi"
          autoComplete="street-address"
          value={draft.diaChi}
          onChange={(event) => set("diaChi", event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="profile-email">Email</label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          value={draft.email}
          onChange={(event) => set("email", event.target.value)}
        />
        <p className={styles.hint}>Để trống để giữ nguyên email hiện tại.</p>
      </div>
      {issue && <p className={styles.fieldError} role="alert">{issue}</p>}
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
        Số điện thoại, điểm tích lũy và hạng thành viên không sửa tại đây.
      </p>
      <p className={styles.muted}>
        <Link href="/tai-khoan">Về trung tâm tài khoản</Link>
      </p>
    </form>
  );
}
