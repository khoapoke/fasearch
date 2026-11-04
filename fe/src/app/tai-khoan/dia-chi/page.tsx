"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { getSelfProfile, type CustomerProfile } from "@/lib/customer-profile-client";
import "@/components/storefront/preview.css";

type View = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; profile: CustomerProfile };

export default function AddressesPage() {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getSelfProfile(controller.signal)
      .then((profile) => setView({ kind: "ready", profile }))
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setView({ kind: "error", message: failure instanceof Error && failure.message ? failure.message : "Không tải được hồ sơ khách hàng." });
      });
    return () => controller.abort();
  }, []);

  const profile = view.kind === "ready" ? view.profile : null;
  const receiver = profile ? [profile.lastName, profile.firstName].filter(Boolean).join(" ") : "";
  const address = profile?.address?.trim() ?? "";

  return (
    <AccountCenterShell active="/tai-khoan/dia-chi" title="Địa chỉ nhận hàng">
      <p className="mpMuted" style={{ marginBottom: 14 }}>
        Hiện FaSearch chưa hỗ trợ sổ nhiều địa chỉ. Khi thanh toán, hệ thống dùng địa chỉ trong hồ sơ của bạn dưới đây (bạn vẫn có thể chỉnh lại ngay tại bước thanh toán).
      </p>
      {view.kind === "loading" ? <p className="mpMuted" role="status">Đang tải địa chỉ…</p> : null}
      {view.kind === "error" ? <p className="mpMuted" role="alert">{view.message}</p> : null}
      {profile ? (
        <section className="pvAddr" aria-label="Địa chỉ trong hồ sơ">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>{receiver || "Chưa có họ tên"}</b>
            <span className="pMatch">Địa chỉ trong hồ sơ</span>
          </div>
          <p>{profile.phoneNumber || "Chưa có số điện thoại"} · {address || "Chưa có địa chỉ"}</p>
          {!address ? <p>Hãy thêm địa chỉ trong hồ sơ để bước thanh toán điền sẵn cho bạn.</p> : null}
          <p style={{ marginTop: 10 }}>
            <Link className="auth-button is-primary" href="/tai-khoan/thong-tin">{address ? "Sửa trong hồ sơ" : "Thêm địa chỉ trong hồ sơ"}</Link>
          </p>
        </section>
      ) : null}
    </AccountCenterShell>
  );
}
