"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "@/components/customer-auth/auth.css";
import {
  getSelfProfile,
  updateSelfProfile,
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
      reportError("Vui lòng nhập tên.");
      return;
    }
    if (!/^(0|\+84)[0-9]{9}$/.test(values.phoneNumber.trim())) {
      reportError("Số điện thoại không đúng định dạng Việt Nam (10 chữ số, ví dụ 0922222222).");
      return;
    }
    if (values.dob && !/^\d{4}-\d{2}-\d{2}$/.test(values.dob)) {
      reportError("Ngày sinh phải có định dạng YYYY-MM-DD.");
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
      <div className="acct-state" role="alert">
        <h2>Không tải được hồ sơ</h2>
        <p ref={errorRef} tabIndex={-1} className="auth-status is-error">{error}</p>
        <button
          className="auth-button is-primary"
          type="button"
          onClick={() => {
            setError("");
            setRetryCount((c) => c + 1);
          }}
          style={{ width: "auto", marginTop: 8 }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!profile || !values) {
    return (
      <div className="acct-loading-wrap" role="status">
        <p className="acct-note">Đang tải hồ sơ khách hàng…</p>
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="acct-profile-view">
        {notice ? (
          <p ref={noticeRef} tabIndex={-1} className="auth-status is-info" role="status">
            {notice}
          </p>
        ) : null}
        <dl className="acct-profile">
          <div className="acct-row">
            <dt>Họ và tên</dt>
            <dd>
              {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "—"}
            </dd>
          </div>
          <div className="acct-row">
            <dt>Số điện thoại</dt>
            <dd>{profile.phoneNumber || "—"}</dd>
          </div>
          <div className="acct-row">
            <dt>Giới tính</dt>
            <dd>{profileGenderLabel(profile.gender)}</dd>
          </div>
          <div className="acct-row">
            <dt>Ngày sinh</dt>
            <dd>{profile.dob || "—"}</dd>
          </div>
          <div className="acct-row">
            <dt>Địa chỉ hiện tại</dt>
            <dd className="acct-prose">{profile.address || "—"}</dd>
          </div>
          <div className="acct-row">
            <dt>Hạng thành viên</dt>
            <dd>
              <strong>{loyalty ? loyaltyTierDisplayName(loyalty.balance) : (profile.tierName ?? "Thành viên")}</strong>
              {loyalty?.balance.availablePoints != null
                ? ` · ${loyalty.balance.availablePoints.toLocaleString("vi-VN")} điểm khả dụng`
                : (typeof profile.accumulatePoint === "number" ? ` · ${profile.accumulatePoint} điểm tích lũy` : "")}
            </dd>
          </div>
        </dl>
        <div className="acct-actions" style={{ marginTop: 20 }}>
          <button
            className="auth-button is-primary"
            type="button"
            onClick={() => {
              setEditing(true);
              setNotice("");
              setError("");
            }}
            style={{ width: "auto" }}
          >
            Chỉnh sửa hồ sơ
          </button>
        </div>
        <p className="acct-note">
          Thông tin liên hệ và địa chỉ nhận hàng của tài khoản.
        </p>
      </div>
    );
  }

  return (
    <form className="acct-edit-form" onSubmit={save} aria-busy={busy} noValidate>
      {error ? (
        <p ref={errorRef} tabIndex={-1} className="auth-status is-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="acct-form-grid">
        <div className="acct-field">
          <label htmlFor="acct-first">Họ đệm</label>
          <input
            id="acct-first"
            className="auth-control"
            maxLength={50}
            value={values.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div className="acct-field">
          <label htmlFor="acct-last">Tên *</label>
          <input
            id="acct-last"
            className="auth-control"
            maxLength={50}
            value={values.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="acct-form-grid">
        <div className="acct-field">
          <label htmlFor="acct-phone">Số điện thoại *</label>
          <input
            id="acct-phone"
            className="auth-control"
            inputMode="tel"
            maxLength={12}
            value={values.phoneNumber}
            onChange={(e) => set("phoneNumber", e.target.value)}
            required
            autoComplete="tel"
          />
        </div>
        <div className="acct-field">
          <label htmlFor="acct-gender">Giới tính</label>
          <select
            id="acct-gender"
            className="auth-control"
            value={values.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            <option value="">Không chỉ định</option>
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
      </div>

      <div className="acct-field">
        <label htmlFor="acct-dob">Ngày sinh</label>
        <input
          id="acct-dob"
          className="auth-control"
          type="date"
          value={values.dob}
          onChange={(e) => set("dob", e.target.value)}
          autoComplete="bday"
        />
      </div>

      <div className="acct-field">
        <label htmlFor="acct-address">Địa chỉ hiện tại</label>
        <textarea
          id="acct-address"
          className="auth-control"
          rows={3}
          maxLength={255}
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          autoComplete="street-address"
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
        />
      </div>

      <div className="acct-actions" style={{ marginTop: 8 }}>
        <button className="auth-button is-primary" type="submit" disabled={busy} style={{ width: "auto" }}>
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
        <button
          className="auth-button"
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing(false);
            setError("");
            setValues(valuesOf(profile));
          }}
          style={{ width: "auto" }}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}
