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
import {
  EMPTY_DRAFT,
  draftFromCustomer,
  type ProfileDraft,
} from "@/lib/profile-draft";
import styles from "@/components/account/account.module.css";

export function ProfileEditor() {
  const router = useRouter();
  const [settled, setSettled] = useState<OwnProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
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
        setDraft(draftFromCustomer(result.customer));
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

  // Tiêu điểm về thông báo lỗi sau khi React đã gắn node: gọi focus() ngay sau
  // setError sẽ là no-op vì node lỗi còn chưa tồn tại.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function set(field: keyof ProfileDraft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function cancel() {
    setDraft(draftFromCustomer(settled?.customer ?? null));
    setIssue("");
    setError("");
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const isCreate = !settled?.hasCustomerProfile;
    const ten = draft.ten.trim();
    if (!ten) {
      setIssue("Tên khách hàng không được để trống.");
      setSaved(false);

      return;
    }
    const sdt = (draft as ProfileDraft & { sdt?: string }).sdt?.trim() ?? "";
    if (isCreate) {
      const digits = sdt.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 11) {
        setIssue("Số điện thoại 9–11 chữ số để tạo hồ sơ.");
        setSaved(false);

        return;
      }
    }
    if (draft.email.trim()) {
      const emailIssue = validateEmailInput(draft.email);
      if (emailIssue) {
        setIssue(emailIssue);
        setSaved(false);

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
      const isCreate = !settled?.hasCustomerProfile;
      const payload: Record<string, string> = {
        ho: draft.ho.trim(),
        ten,
        gioiTinh: draft.gioiTinh.trim(),
        ngaySinh: draft.ngaySinh.trim(),
        diaChi: draft.diaChi.trim(),
      };
      if (isCreate) {
        const sdtV = ((draft as ProfileDraft & { sdt?: string }).sdt ?? "").trim();
        if (sdtV) payload.sdt = sdtV;
      }
      if (draft.email.trim()) payload.email = draft.email.trim();
      const response = await fetch("/api/auth/profile", {
        method: isCreate ? "POST" : "PATCH",
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
      if (response.status === 403) {
        setError("Tài khoản của bạn không có quyền sửa hồ sơ này. Đăng nhập đúng tài khoản rồi thử lại — bản nháp được giữ lại.");

        return;
      }
      if (response.status === 409) {
        setIssue("Email đã được sử dụng cho tài khoản khác.");

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
      setDraft(draftFromCustomer(updated.result));
      setSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Lưu không hoàn tất. Bản nháp được giữ lại.");

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
      <form className={styles.form} onSubmit={submit} noValidate method="post">
        <p className={styles.greeting}>Tài khoản: {settled.account.username} — tạo hồ sơ để đặt hàng</p>
        <p className={styles.muted}>
          Tài khoản này chưa có hồ sơ khách hàng. Tạo hồ sơ của chính bạn để dùng giỏ/thanh toán thật.
          Bạn vẫn xem catalog/AI mà không bị chặn vĩnh viễn.
        </p>
        <div className={styles.field}>
          <label htmlFor="profile-ho">Họ và tên đệm</label>
          <input id="profile-ho" autoComplete="family-name" value={draft.ho} onChange={(event) => set("ho", event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-ten">Tên *</label>
          <input id="profile-ten" autoComplete="given-name" value={draft.ten} onChange={(event) => set("ten", event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-sdt">Số điện thoại *</label>
          <input
            id="profile-sdt"
            inputMode="tel"
            autoComplete="tel"
            value={(draft as ProfileDraft & { sdt?: string }).sdt ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, sdt: event.target.value }) as ProfileDraft)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-gioitinh">Giới tính</label>
          <input id="profile-gioitinh" value={draft.gioiTinh} onChange={(event) => set("gioiTinh", event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-ngaysinh">Ngày sinh</label>
          <input id="profile-ngaysinh" type="date" value={draft.ngaySinh} onChange={(event) => set("ngaySinh", event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-diachi">Địa chỉ</label>
          <input id="profile-diachi" autoComplete="street-address" value={draft.diaChi} onChange={(event) => set("diaChi", event.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" type="email" autoComplete="email" value={draft.email} onChange={(event) => set("email", event.target.value)} />
        </div>
        {issue && <p className={styles.fieldError} role="alert">{issue}</p>}
        {error && (
          <p ref={errorRef} tabIndex={-1} className={styles.alert} role="alert">{error}</p>
        )}
        {saved && <p className={styles.notice} role="status">Đã tạo hồ sơ — giờ bạn đặt hàng được.</p>}
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo hồ sơ của tôi"}</button>
        </div>
      </form>
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
