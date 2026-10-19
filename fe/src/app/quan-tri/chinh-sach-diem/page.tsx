"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  createLoyaltyPolicy, fetchLoyaltyPolicy, fetchTierList, openLegacyBalance, policyId, updateLoyaltyPolicy,
  updateTierThreshold, type LoyaltyPolicyAdmin, type TierInfo,
} from "@/lib/benefits-client";
import { benefitErrorMessage, type PolicyState } from "@/lib/benefits";

export default function LoyaltyPolicyPage() {
  const [policy, setPolicy] = useState<LoyaltyPolicyAdmin | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tyLeTich, setTyLeTich] = useState("");
  const [giaTriDiem, setGiaTriDiem] = useState("");
  const [trangThai, setTrangThai] = useState<PolicyState>("TAT");
  const [maKh, setMaKh] = useState("");
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [maHang, setMaHang] = useState("");
  const [tiersIssue, setTiersIssue] = useState("");
  const [nguong, setNguong] = useState("");
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setMissing(false);
    try {
      const list = await fetchLoyaltyPolicy();
      const current = list.find((p) => p.trangThai === "BAT") ?? list[0] ?? null;
      if (!current) {
        setMissing(true);
        setPolicy(null);
        setTrangThai("TAT");
      } else {
        setPolicy(current);
        setTrangThai((current.trangThai as PolicyState) ?? "TAT");
        setTyLeTich(current.tyLeTich?.toString() ?? "");
        setGiaTriDiem(current.giaTriDiem?.toString() ?? "");
      }
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được chính sách."));
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
    try {
      const hangs = await fetchTierList();
      setTiers(hangs);
      setTiersIssue("");
    } catch (e) {
      // Danh sách hạng là discovery bắt buộc (Q2) — lỗi thì chặn đặt ngưỡng mù.
      setTiers([]);
      const st = (e as { status?: number })?.status ?? 0;
      setTiersIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Không tải được danh sách hạng."));
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function parseRates(): { tyLeTich: number; giaTriDiem: number } | null {
    const tyLe = Number(tyLeTich);
    const giaTri = Number(giaTriDiem);
    if (!Number.isFinite(tyLe) || tyLe <= 0) {
      setIssue("Tỉ lệ tích phải là số dương (VNĐ cho 1 điểm).");
      return null;
    }
    if (!Number.isFinite(giaTri) || giaTri <= 0) {
      setIssue("Giá trị điểm phải là số dương (VNĐ cho 1 điểm).");
      return null;
    }
    return { tyLeTich: tyLe, giaTriDiem: giaTri };
  }

  async function submitCreate() {
    const rates = parseRates();
    if (!rates || busy) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      const p = await createLoyaltyPolicy({ ...rates, trangThai });
      setPolicy(p);
      setMissing(false);
      setNotice(`Đã tạo chính sách #${policyId(p)} (${p.trangThai}).`);
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Tạo thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate() {
    if (!policy || busy) return;
    const rates = parseRates();
    if (!rates) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      const updated = await updateLoyaltyPolicy(policyId(policy), {
        phienBan: policy.phienBan, ...rates, trangThai,
      });
      setPolicy(updated);
      setNotice(`Đã lưu phiên bản ${updated.phienBan} (${updated.trangThai}). Áp dụng cho quote/order mới; receipt cũ giữ nguyên.`);
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(st === 409
        ? "Chính sách đã đổi (409) — tải lại rồi sửa tiếp với phiên bản mới."
        : benefitErrorMessage(st, null, e instanceof Error ? e.message : "Lưu thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function submitMoDau() {
    if (busy) return;
    const id = Number(maKh);
    if (!Number.isInteger(id) || id <= 0) {
      setIssue("Nhập mã khách hàng (số nguyên dương). Ghi nhận một lần, lặp lại bị từ chối. Tổng chi tiêu/số dư hiện tại được giữ nguyên.");
      return;
    }
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await openLegacyBalance(id);
      setNotice(`Đã ghi nhận mở đầu cho khách #${id} (một lần, không trùng).`);
      setMaKh("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Ghi nhận thất bại."));
    } finally {
      setBusy(false);
    }
  }

  async function submitTier() {
    if (busy) return;
    const id = Number(maHang);
    const n = Number(nguong);
    if (tiers.length > 0 && !tiers.some((t) => t.maHang === id)) {
      setIssue("Chọn hạng trong danh sách máy chủ — không đặt ngưỡng cho mã hạng ngoài danh sách.");
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setIssue("Chọn hạng trong danh sách trước khi đặt ngưỡng.");
      return;
    }
    if (!Number.isInteger(n) || n < 0) {
      setIssue("Ngưỡng doanh số tích lũy phải là số nguyên ≥ 0 (VNĐ).");
      return;
    }
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await updateTierThreshold(id, n);
      setNotice(`Đã đặt ngưỡng doanh số tích lũy hạng #${id} = ${n.toLocaleString("vi-VN")}₫.`);
      setMaHang("");
      setNguong("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setIssue(benefitErrorMessage(st, null, e instanceof Error ? e.message : "Đặt ngưỡng thất bại."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      active="loyalty"
      crumbs={[{ label: "Quản trị", href: "/quan-tri/tai-khoan" }, { label: "Chính sách điểm" }]}
      title="Chính sách điểm & Hạng"
      lede="Tỉ lệ tích/đổi và công tắc BAT/TAT theo phiên bản. Mặc định TAT khi chưa hợp lệ."
    >
      {loading ? <p className="adState" role="status">Đang tải chính sách…</p> : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="adCard" role="alert">
          <p className="adNote">{error}</p>
          <button className="adBtn" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {!loading && !error && (missing || policy?.trangThai === "TAT") ? (
        <p className="adNote" role="note" style={{ borderLeft: "4px solid #ba1a1a", paddingLeft: 10 }}>
          {missing ? "Chưa có chính sách nào — tạo mới ở trạng thái TAT rồi kiểm tra trước khi bật." : "Chính sách đang TẮT — số dư khách chỉ để xem, chưa tích/đổi điểm mới."}
        </p>
      ) : null}
      {!loading && !error ? (
        <>
          <section className="adCard" aria-label="Cấu hình chính sách">
            {policy ? <p className="adNote">Phiên bản {policy.phienBan} · trạng thái {policy.trangThai}{policy.maChinhSach ? ` · #${policyId(policy)}` : ""}.</p> : null}
            <div className="adFilters">
              <label>Tỉ lệ tích (VNĐ/điểm)
                <input value={tyLeTich} onChange={(e) => setTyLeTich(e.target.value)} inputMode="numeric" style={{ width: 140, marginLeft: 6 }} />
              </label>
              <label>Giá trị điểm (VNĐ/điểm)
                <input value={giaTriDiem} onChange={(e) => setGiaTriDiem(e.target.value)} inputMode="numeric" style={{ width: 140, marginLeft: 6 }} />
              </label>
              <label>Trạng thái
                <select value={trangThai} onChange={(e) => setTrangThai(e.target.value as PolicyState)} style={{ marginLeft: 6 }}>
                  <option value="TAT">TAT (mặc định)</option>
                  <option value="BAT">BAT</option>
                </select>
              </label>
              {policy ? (
                <button className="adBtn adBtnPrimary" type="button" disabled={busy} onClick={submitUpdate}>{busy ? "Đang lưu…" : "Lưu phiên bản mới"}</button>
              ) : (
                <button className="adBtn adBtnPrimary" type="button" disabled={busy} onClick={submitCreate}>{busy ? "Đang tạo…" : "Tạo chính sách"}</button>
              )}
            </div>
            {issue ? <p className="adNote" role="alert">{issue}</p> : null}
            {notice ? <p className="adNote" role="status">{notice}</p> : null}
          </section>
          <section className="adCard" aria-label="Ghi nhận số dư legacy">
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Ghi nhận số dư legacy (một lần/khách)</h2>
            <div className="adFilters">
              <input value={maKh} onChange={(e) => setMaKh(e.target.value)} placeholder="Mã khách hàng" aria-label="Mã khách hàng" inputMode="numeric" style={{ width: 160 }} />
              <button className="adBtn" type="button" disabled={busy} onClick={submitMoDau}>Ghi nhận mở đầu</button>
            </div>
          </section>
          <section className="adCard" aria-label="Ngưỡng hạng">
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Ngưỡng hạng (chọn hạng + ngưỡng doanh số tích lũy VNĐ)</h2>
            <p className="adNote">PUT đặt <b>nguongDoanhSo</b> (tiền tệ tích lũy, theo OpenAPI BE v2). Danh sách hạng tải trực tiếp từ máy chủ — không nhập mã mù.</p>
            {tiersIssue ? <p className="adNote" role="alert">{tiersIssue} Không thể đặt ngưỡng khi chưa thấy danh sách hạng.</p> : null}
            <div className="adFilters">
              <select value={maHang} onChange={(e) => setMaHang(e.target.value)} aria-label="Hạng" style={{ maxWidth: 320 }}>
                <option value="">— Chọn hạng —</option>
                {tiers.map((t) => (
                  <option key={t.maHang} value={t.maHang}>
                    #{t.maHang} {t.tenHang} · hiện tại: {t.nguongDoanhSo === null || t.nguongDoanhSo === undefined ? "chưa cấu hình" : `${Number(t.nguongDoanhSo).toLocaleString("vi-VN")}₫`}
                  </option>
                ))}
              </select>
              <input value={nguong} onChange={(e) => setNguong(e.target.value)} placeholder="Ngưỡng mới (số nguyên ≥ 0)" aria-label="Ngưỡng" inputMode="numeric" style={{ width: 200 }} />
              <button className="adBtn" type="button" disabled={busy || tiers.length === 0} onClick={submitTier}>Đặt ngưỡng</button>
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
