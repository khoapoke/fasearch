"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { useAdminRole } from "@/components/admin-b/use-admin-role";
import "@/components/admin/admin.css";
import {
  createLoyaltyPolicy, fetchLoyaltyPolicy, fetchTierList, openLegacyBalance, policyId, updateLoyaltyPolicy,
  updateTierThreshold, type LoyaltyPolicyAdmin, type TierInfo,
} from "@/lib/benefits-client";
import { benefitErrorMessage, type PolicyState } from "@/lib/benefits";

export default function LoyaltyPolicyPage() {
  const role = useAdminRole();
  const [policy, setPolicy] = useState<LoyaltyPolicyAdmin | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [earnCurrencyPerPoint, setEarnCurrencyPerPoint] = useState("");
  const [redeemCurrencyPerPoint, setRedeemCurrencyPerPoint] = useState("");
  const [status, setStatus] = useState<PolicyState>("DISABLED");
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
      const current = list.find((p) => p.status === "ENABLED") ?? list[0] ?? null;
      if (!current) {
        setMissing(true);
        setPolicy(null);
        setStatus("DISABLED");
      } else {
        setPolicy(current);
        setStatus(current.status);
        setEarnCurrencyPerPoint(String(current.earnCurrencyPerPoint));
        setRedeemCurrencyPerPoint(String(current.redeemCurrencyPerPoint));
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

  function parseRates(): { earnCurrencyPerPoint: number; redeemCurrencyPerPoint: number } | null {
    const earn = Number(earnCurrencyPerPoint);
    const redeem = Number(redeemCurrencyPerPoint);
    const validMoney = (value: number, raw: string) => Number.isFinite(value) && value > 0 && value <= 1e17 && /^\d+(?:\.\d{1,2})?$/.test(raw.trim());
    if (!validMoney(earn, earnCurrencyPerPoint)) {
      setIssue("Mức chi tiêu để tích điểm phải là số dương, tối đa 2 chữ số thập phân.");
      return null;
    }
    if (!validMoney(redeem, redeemCurrencyPerPoint)) {
      setIssue("Giá trị đổi mỗi điểm phải là số dương, tối đa 2 chữ số thập phân.");
      return null;
    }
    return { earnCurrencyPerPoint: earn, redeemCurrencyPerPoint: redeem };
  }

  async function submitCreate() {
    const rates = parseRates();
    if (!rates || busy) return;
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      const p = await createLoyaltyPolicy({ ...rates, status });
      setPolicy(p);
      setMissing(false);
      setNotice(`Đã tạo chính sách #${policyId(p)} (${p.status}).`);
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
        version: policy.version, ...rates, status,
      });
      setPolicy(updated);
      setNotice(`Đã lưu phiên bản ${updated.version} (${updated.status}). Áp dụng cho quote/order mới; receipt cũ giữ nguyên.`);
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
    const selectedTier = tiers.find((tier) => tier.tierId === id);
    if (!selectedTier) {
      setIssue("Chọn hạng trong danh sách máy chủ — không đặt ngưỡng cho mã hạng ngoài danh sách.");
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      setIssue("Chọn hạng trong danh sách trước khi đặt ngưỡng.");
      return;
    }
    if (!Number.isFinite(n) || n < 0 || n > 1e17 || !/^\d+(?:\.\d{1,2})?$/.test(nguong.trim())) {
      setIssue("Ngưỡng doanh số tích lũy phải là số không âm, tối đa 2 chữ số thập phân (VNĐ).");
      return;
    }
    setBusy(true);
    setIssue("");
    setNotice("");
    try {
      await updateTierThreshold(id, selectedTier.version, n);
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
    <AdminShellB active="loyalty" title="Chính sách điểm & Hạng" eyebrow="Quản trị">
      <p className="adLede">Cấu hình mức chi tiêu tích điểm, giá trị đổi điểm và chính sách theo phiên bản. Chính sách mới mặc định DISABLED.</p>
      {loading ? <p className="adState" role="status">Đang tải chính sách…</p> : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="adCard" role="alert">
          <p className="adNote">{error}</p>
          <button className="adBtn" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {!loading && !error && (missing || policy?.status === "DISABLED") ? (
        <p className="adNote" role="note" style={{ borderLeft: "4px solid #ba1a1a", paddingLeft: 10 }}>
          {missing ? "Chưa có chính sách nào — chính sách mới mặc định DISABLED; cần bật rõ ràng sau khi kiểm tra." : "Chính sách đang DISABLED — số dư khách vẫn được giữ; điểm mới chưa được đổi."}
        </p>
      ) : null}
      {!loading && !error ? (
        <>
          <section className="adCard" aria-label="Cấu hình chính sách">
            {policy ? <p className="adNote">Phiên bản {policy.version} · trạng thái {policy.status} · #{policyId(policy)}.</p> : null}
            <div className="adFilters">
              <label>Chi tiêu để tích 1 điểm (VNĐ)
                <input value={earnCurrencyPerPoint} onChange={(e) => setEarnCurrencyPerPoint(e.target.value)} inputMode="decimal" style={{ width: 160, marginLeft: 6 }} />
              </label>
              <label>Giá trị đổi 1 điểm (VNĐ)
                <input value={redeemCurrencyPerPoint} onChange={(e) => setRedeemCurrencyPerPoint(e.target.value)} inputMode="decimal" style={{ width: 160, marginLeft: 6 }} />
              </label>
              <label>Trạng thái
                <select value={status} onChange={(e) => setStatus(e.target.value as PolicyState)} style={{ marginLeft: 6 }}>
                  <option value="DISABLED">DISABLED</option>
                  <option value="ENABLED">ENABLED</option>
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
          {role === "ADMIN" ? (
          <section className="adCard" aria-label="Ghi nhận số dư legacy">
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Ghi nhận số dư legacy (một lần/khách)</h2>
            <div className="adFilters">
              <input value={maKh} onChange={(e) => setMaKh(e.target.value)} placeholder="Mã khách hàng" aria-label="Mã khách hàng" inputMode="numeric" style={{ width: 160 }} />
              <button className="adBtn" type="button" disabled={busy} onClick={submitMoDau}>Ghi nhận mở đầu</button>
            </div>
          </section>
          ) : null}
          <section className="adCard" aria-label="Ngưỡng hạng">
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Ngưỡng hạng (chọn hạng + ngưỡng doanh số tích lũy VNĐ)</h2>
            <p className="adNote">Ngưỡng là doanh số đã thanh toán tích lũy, dùng phiên bản mới nhất của từng hạng; dữ liệu thiếu vẫn hiển thị là chưa xác định.</p>
            {tiersIssue ? <p className="adNote" role="alert">{tiersIssue} Không thể đặt ngưỡng khi chưa thấy danh sách hạng.</p> : null}
            <div className="adFilters">
              <select value={maHang} onChange={(e) => setMaHang(e.target.value)} aria-label="Hạng" style={{ maxWidth: 320 }}>
                <option value="">— Chọn hạng —</option>
                {tiers.map((t) => (
                  <option key={t.tierId} value={t.tierId}>
                    #{t.tierId} {t.name} · hiện tại: {t.minimumCumulativePaidSales === null ? "chưa cấu hình" : `${t.minimumCumulativePaidSales.toLocaleString("vi-VN")}₫`}
                  </option>
                ))}
              </select>
              <input value={nguong} onChange={(e) => setNguong(e.target.value)} placeholder="Ngưỡng mới (≥ 0; tối đa 2 số lẻ)" aria-label="Ngưỡng" inputMode="decimal" style={{ width: 230 }} />
              <button className="adBtn" type="button" disabled={busy || tiers.length === 0} onClick={submitTier}>Đặt ngưỡng</button>
            </div>
          </section>
        </>
      ) : null}
    </AdminShellB>
  );
}
