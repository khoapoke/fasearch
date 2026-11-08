"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import ac from "@/components/account/account-cards.module.css";
import {
  getSelfProfile,
  updateSelfProfile,
  customerFullName,
  ProfileError,
  profileGenderLabel,
  type CustomerProfile,
} from "@/lib/customer-profile-client";
import { fetchOwnLoyalty, type OwnLoyalty } from "@/lib/benefits-client";
import { loyaltyTierDisplayName } from "@/lib/benefits";

type Values = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  gender: string;
  dob: string;
  address: string;
};

function valuesOf(p: CustomerProfile): Values {
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    phoneNumber: p.phoneNumber ?? "",
    gender: p.gender ?? "",
    dob: p.dob ?? "",
    address: p.address ?? "",
  };
}

/** Ngày sinh khách nhập dạng YYYY-MM-DD; hiển thị một kiểu dd/MM/yyyy cho dễ đọc. */
function formatDob(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Chưa cập nhật";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function ProfileEditor() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  // Hạng/điểm hiển thị lấy từ loyalty summary (cùng nguồn với trang điểm
  // thưởng); hồ sơ BE chỉ là dự phòng khi loyalty chưa tải được.
  const [loyalty, setLoyalty] = useState<OwnLoyalty | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [errorVersion, setErrorVersion] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const busyRef = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const reportError = useCallback((message: string) => {
    setError(message);
    setErrorVersion((v) => v + 1);
    if (errorRef.current) {
      errorRef.current.focus();
    }
  }, []);

  const load = useCallback(() => {
    setError("");
    const controller = new AbortController();
    getSelfProfile(controller.signal)
      .then((p) => {
        setProfile(p);
        setValues(valuesOf(p));
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          reportError(e instanceof Error ? e.message : "Không tải được hồ sơ khách hàng.");
        }
      });
    return () => controller.abort();
  }, [reportError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
    return load();
  }, [load, retryCount]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error, errorVersion]);

  useEffect(() => {
    if (notice && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [notice]);

  useEffect(() => {
    if (editing || !profile) return;
    let live = true;
    fetchOwnLoyalty()
      .then((data) => { if (live) setLoyalty(data); })
      .catch(() => { if (live) setLoyalty(null); });
    return () => { live = false; };
  }, [editing, profile]);

  function set(key: keyof Values, value: string) {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!values || busyRef.current) return;

    if (!values.lastName.trim()) {
      reportError("Nhập tên của bạn.");
      return;
    }
    if (!/^(0|\+84)[0-9]{9}$/.test(values.phoneNumber.trim())) {
      reportError("Số điện thoại không đúng định dạng Việt Nam (10 chữ số, ví dụ 0922222222).");
      return;
    }
    if (values.dob && !/^\d{4}-\d{2}-\d{2}$/.test(values.dob)) {
      reportError("Ngày sinh chưa hợp lệ.");
      return;
    }
    if (values.address.trim().length > 255) {
      reportError("Địa chỉ tối đa 255 ký tự.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const saved = await updateSelfProfile({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        ...(values.gender ? { gender: values.gender } : {}),
        ...(values.dob ? { dob: values.dob } : {}),
        address: values.address.trim(),
      });
      setProfile(saved);
      setValues(valuesOf(saved));
      setEditing(false);
      setNotice("Đã lưu thông tin hồ sơ thành công.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fasearch-auth-change"));
      }
    } catch (failure) {
      reportError(failure instanceof ProfileError ? failure.message : "Không lưu được thông tin hồ sơ.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (error && !profile) {
    return (
      <div className={ac.page}>
        <section className={`${ac.card} ${ac.empty}`} aria-label="Không tải được hồ sơ">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Hồ sơ</p>
            <h2 className={ac.title}>Không tải được hồ sơ</h2>
          </div>
          <p ref={errorRef} tabIndex={-1} className={ac.alert} role="alert">{error}</p>
          <div className={ac.actions}>
            <button
              className={ac.secondary}
              type="button"
              onClick={() => {
                setError("");
                setRetryCount((c) => c + 1);
              }}
            >
              Thử lại
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!profile || !values) {
    return (
      <div className={ac.page} aria-label="Đang tải hồ sơ">
        <section className={ac.card} aria-labelledby="profile-loading">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Hồ sơ</p>
            <h2 id="profile-loading" className={ac.title}>Đang tải hồ sơ</h2>
          </div>
          <div className={ac.group} role="status">
            <div className={ac.skeleton} />
            <div className={ac.skeleton} />
          </div>
          <p className={ac.meta}>Đang tải hồ sơ khách hàng…</p>
        </section>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className={ac.page}>
        {notice ? (
          <p ref={noticeRef} tabIndex={-1} className={ac.notice} role="status">
            {notice}
          </p>
        ) : null}
        <section className={ac.card} aria-labelledby="profile-basic">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Hồ sơ</p>
            <h2 id="profile-basic" className={ac.title}>Thông tin cơ bản</h2>
          </div>
          <dl className={ac.kv}>
            <div className={ac.kvRow}>
              <dt>Họ và tên</dt>
              <dd>{customerFullName(profile) || "Chưa cập nhật"}</dd>
            </div>
            <div className={ac.kvRow}>
              <dt>Giới tính</dt>
              <dd>{profileGenderLabel(profile.gender)}</dd>
            </div>
            <div className={ac.kvRow}>
              <dt>Ngày sinh</dt>
              <dd>{formatDob(profile.dob)}</dd>
            </div>
          </dl>
        </section>

        <section className={ac.card} aria-labelledby="profile-contact">
          <div className={ac.head}>
            <p className={ac.eyebrow}>02 · Liên hệ</p>
            <h2 id="profile-contact" className={ac.title}>Liên hệ và nhận hàng</h2>
          </div>
          <dl className={ac.kv}>
            <div className={ac.kvRow}>
              <dt>Số điện thoại</dt>
              <dd>{profile.phoneNumber || "Chưa cập nhật"}</dd>
            </div>
            <div className={ac.kvRow}>
              <dt>Địa chỉ hiện tại</dt>
              <dd className={ac.prose}>{profile.address || "Chưa cập nhật"}</dd>
            </div>
            <div className={ac.kvRow}>
              <dt>Hạng thành viên</dt>
              <dd>
                <strong>{loyalty ? loyaltyTierDisplayName(loyalty.balance) : (profile.tierName ?? "Thành viên")}</strong>
                {loyalty?.balance.availablePoints != null
                  ? ` · ${loyalty.balance.availablePoints.toLocaleString("vi-VN")} điểm khả dụng`
                  : (typeof profile.accumulatePoint === "number" ? ` · ${profile.accumulatePoint} điểm tích lũy` : "")}
              </dd>
            </div>
          </dl>
          <div className={ac.actions}>
            <button
              className={ac.primary}
              type="button"
              onClick={() => {
                setEditing(true);
                setNotice("");
                setError("");
              }}
            >
              Chỉnh sửa hồ sơ
            </button>
            <p className={ac.footnote}>Thông tin liên hệ và địa chỉ nhận hàng của tài khoản.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={ac.page}>
      <form className={ac.form} onSubmit={save} aria-busy={busy} noValidate>
        {error ? (
          <p ref={errorRef} tabIndex={-1} className={ac.alert} role="alert">
            {error}
          </p>
        ) : null}

        <section className={ac.card} aria-labelledby="profile-edit-basic">
          <div className={ac.head}>
            <p className={ac.eyebrow}>01 · Thông tin cơ bản</p>
            <h2 id="profile-edit-basic" className={ac.title}>Sửa thông tin cơ bản</h2>
          </div>
          <div className={ac.grid2}>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="acct-first">Họ</label>
              <input
                id="acct-first"
                className={ac.input}
                maxLength={50}
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="acct-last">Tên *</label>
              <input
                id="acct-last"
                className={ac.input}
                maxLength={50}
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
          </div>
          <div className={ac.grid2}>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="acct-gender">Giới tính</label>
              <select
                id="acct-gender"
                className={ac.input}
                value={values.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">Không chỉ định</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
            <div className={ac.field}>
              <label className={ac.label} htmlFor="acct-dob">Ngày sinh</label>
              <DateInput
                id="acct-dob"
                className={ac.input}
                value={values.dob}
                onChange={(v) => set("dob", v)}
                autoComplete="bday"
              />
            </div>
          </div>
        </section>

        <section className={ac.card} aria-labelledby="profile-edit-contact">
          <div className={ac.head}>
            <p className={ac.eyebrow}>02 · Liên hệ</p>
            <h2 id="profile-edit-contact" className={ac.title}>Sửa liên hệ</h2>
          </div>
          <div className={ac.field}>
            <label className={ac.label} htmlFor="acct-phone">Số điện thoại *</label>
            <input
              id="acct-phone"
              className={ac.input}
              inputMode="tel"
              maxLength={12}
              value={values.phoneNumber}
              onChange={(e) => set("phoneNumber", e.target.value)}
              required
              autoComplete="tel"
            />
          </div>
          <div className={ac.field}>
            <label className={ac.label} htmlFor="acct-address">Địa chỉ hiện tại</label>
            <textarea
              id="acct-address"
              className={ac.input}
              rows={3}
              maxLength={255}
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              autoComplete="street-address"
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
            />
          </div>
          <div className={ac.actions}>
            <button className={ac.primary} type="submit" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
            <button
              className={ac.secondary}
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError("");
                setValues(valuesOf(profile));
              }}
            >
              Hủy
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
