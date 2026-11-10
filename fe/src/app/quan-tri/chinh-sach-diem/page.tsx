"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminShellB } from "@/components/admin-b/admin-shell";
import { AdminModal } from "@/components/admin-b/modal";
import { InfoHint } from "@/components/admin-b/info-hint";
import { PageHeader } from "@/components/admin-b/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/admin-b/skeleton";
import { TierBadge } from "@/components/admin-b/tier";
import { useToast } from "@/components/admin-b/toast";
import { useAdminRole, useAdminCan } from "@/components/admin-b/use-admin-role";
import {
  createLoyaltyPolicy, fetchLoyaltyPolicy, fetchTierList, openLegacyBalance, policyId, updateLoyaltyPolicy,
  updateTierThreshold, type LoyaltyPolicyAdmin, type TierInfo,
} from "@/lib/benefits-client";
function policyStatusLabel(s: string): string {
  if (s === "ENABLED") return "Đang bật";
  if (s === "DISABLED") return "Đang tắt";
  return s;
}
import { benefitErrorMessage, type PolicyState } from "@/lib/benefits";
import { formatMoney, formatNumber } from "@/lib/admin-format";
import { Num, StatusBadge } from "@/components/admin-b/status-badge";

const moneyVnd = formatMoney;

export default function LoyaltyPolicyPage() {
  const role = useAdminRole(); const can = useAdminCan(); const canPolicy = can("LOYALTY_POLICY_MANAGE");
  const toast = useToast();
  const [modal, setModal] = useState<"policy" | "legacy" | "tier" | null>(null);
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
  const [issueAt, setIssueAt] = useState<"policy" | "legacy" | "tier" | "">("");
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
      setError(benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Không tải được chính sách."));
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
      setTiersIssue(benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Không tải được danh sách hạng."));
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  function showIssue(message: string, at: "policy" | "legacy" | "tier") {
    setIssue(message);
    setIssueAt(at);
  }
  function showNotice(message: string, _at: "policy" | "legacy" | "tier") {
    void _at;
    toast.success(message);
    setModal(null);
  }
  function openModal(which: "policy" | "legacy" | "tier", tierId = "") {
    setIssue(""); setIssueAt("");
    if (which === "policy" && policy) {
      setEarnCurrencyPerPoint(String(policy.earnCurrencyPerPoint));
      setRedeemCurrencyPerPoint(String(policy.redeemCurrencyPerPoint));
      setStatus(policy.status);
    }
    if (which === "tier") { setMaHang(tierId); setNguong(""); }
    if (which === "legacy") setMaKh("");
    setModal(which);
  }
  function closeModal() { if (!busy) { setModal(null); setIssue(""); setIssueAt(""); } }

  function parseRates(): { earnCurrencyPerPoint: number; redeemCurrencyPerPoint: number } | null {
    const earn = Number(earnCurrencyPerPoint);
    const redeem = Number(redeemCurrencyPerPoint);
    const validMoney = (value: number, raw: string) => Number.isFinite(value) && value > 0 && value <= 1e17 && /^\d+(?:\.\d{1,2})?$/.test(raw.trim());
    if (!validMoney(earn, earnCurrencyPerPoint)) {
      showIssue("Mức chi tiêu để tích điểm phải là số dương, tối đa 2 chữ số thập phân.", "policy");
      return null;
    }
    if (!validMoney(redeem, redeemCurrencyPerPoint)) {
      showIssue("Giá trị đổi mỗi điểm phải là số dương, tối đa 2 chữ số thập phân.", "policy");
      return null;
    }
    return { earnCurrencyPerPoint: earn, redeemCurrencyPerPoint: redeem };
  }

  async function submitCreate() {
    const rates = parseRates();
    if (!rates || busy) return;
    setBusy(true);
    setIssue("");
    try {
      const p = await createLoyaltyPolicy({ ...rates, status });
      setPolicy(p);
      setMissing(false);
      showNotice(`Đã tạo chính sách mới (${policyStatusLabel(p.status)}).`, "policy");
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      showIssue(benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Tạo thất bại."), "policy");
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
    try {
      const updated = await updateLoyaltyPolicy(policyId(policy), {
        version: policy.version, ...rates, status,
      });
      setPolicy(updated);
      showNotice(`Đã lưu phiên bản ${updated.version} (${policyStatusLabel(updated.status)}). Áp dụng cho đơn mới; đơn cũ giữ nguyên.`, "policy");
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      showIssue(st === 409
        ? "Chính sách đã thay đổi ở phiên khác. Tải lại rồi sửa tiếp."
        : benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Lưu thất bại."), "policy");
    } finally {
      setBusy(false);
    }
  }

  async function submitMoDau() {
    if (busy) return;
    const id = Number(maKh);
    if (!Number.isInteger(id) || id <= 0) {
      showIssue("Nhập mã khách hàng (số nguyên dương). Ghi nhận một lần, lặp lại bị từ chối. Tổng chi tiêu/số dư hiện tại được giữ nguyên.", "legacy");
      return;
    }
    setBusy(true);
    setIssue("");
    try {
      await openLegacyBalance(id);
      showNotice(`Đã ghi nhận số dư ban đầu cho khách ${id}.`, "legacy");
      setMaKh("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      showIssue(benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Ghi nhận thất bại."), "legacy");
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
      showIssue("Chọn hạng trong danh sách máy chủ — không đặt ngưỡng cho mã hạng ngoài danh sách.", "tier");
      return;
    }
    if (!Number.isInteger(id) || id <= 0) {
      showIssue("Chọn hạng trong danh sách trước khi đặt ngưỡng.", "tier");
      return;
    }
    if (!Number.isFinite(n) || n < 0 || n > 1e17 || !/^\d+(?:\.\d{1,2})?$/.test(nguong.trim())) {
      showIssue("Ngưỡng doanh số tích lũy phải là số không âm, tối đa 2 chữ số thập phân (VNĐ).", "tier");
      return;
    }
    setBusy(true);
    setIssue("");
    try {
      const saved = await updateTierThreshold(id, selectedTier.version, n);
      setTiers((prev) => prev.map((row) => (row.tierId === id ? saved : row)));
      showNotice(`Đã đặt ngưỡng doanh số tích lũy cho hạng ${selectedTier.name} = ${moneyVnd(n)}.`, "tier");
      setMaHang("");
      setNguong("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      showIssue(benefitErrorMessage(st, (e as { code?: string })?.code ?? null, e instanceof Error ? e.message : "Đặt ngưỡng thất bại."), "tier");
    } finally {
      setBusy(false);
    }
  }

  const mutedWarn = !loading && !error && (missing || policy?.status === "DISABLED");
  return (
    <AdminShellB active="loyalty" title="Chính sách điểm">
      <PageHeader
        title="Chính sách điểm"
        hint="Mỗi lần lưu tạo một phiên bản mới, áp dụng cho đơn mới; đơn cũ giữ nguyên. Chính sách mới mặc định ở trạng thái tắt."
        actions={!loading && !error ? <>
          {role === "ADMIN" ? <button className="secondary" type="button" onClick={() => openModal("legacy")}>Ghi nhận số dư ban đầu</button> : null}
          {canPolicy ? <button className="primary" type="button" onClick={() => openModal("policy")}>{policy ? "Sửa chính sách" : "Tạo chính sách"}</button> : null}
        </> : null}
      />
      {loading ? <><div className="kpi-row l3-kpi3"><CardSkeleton height={96} /><CardSkeleton height={96} /><CardSkeleton height={96} /></div><TableSkeleton rows={4} columns={3} /></> : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="order-empty" role="alert">
          <strong>Không tải được chính sách</strong>
          <p>{error}</p>
          <button className="secondary" type="button" onClick={load}>Thử lại</button>
        </div>
      ) : null}
      {mutedWarn ? (
        <p className="catalog-warning" role="note">
          {missing ? "Chưa có chính sách nào — chính sách mới mặc định tắt; cần bật rõ ràng sau khi kiểm tra." : "Chính sách đang tắt — số dư khách vẫn được giữ; điểm mới chưa được đổi."}
        </p>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="kpi-row l3-kpi3" aria-label="Chính sách hiện tại">
            <div className="kpi-card kpi-blue"><span className="kpi-label">Tích điểm</span><span className="kpi-value">{policy ? <span className="t-blue">{formatNumber(policy.earnCurrencyPerPoint)} đ <span className="l3-eq">=</span> 1 điểm</span> : <span className="empty-value">—</span>}</span></div>
            <div className="kpi-card kpi-amber"><span className="kpi-label">Đổi điểm</span><span className="kpi-value">{policy ? <span className="t-amber">1 điểm <span className="l3-eq">=</span> {formatNumber(policy.redeemCurrencyPerPoint)} đ</span> : <span className="empty-value">—</span>}</span></div>
            <div className="kpi-card"><span className="kpi-label">Trạng thái</span><span className="kpi-value">{policy ? <span className="l3-status-row"><StatusBadge status={policy.status} label={policyStatusLabel(policy.status)} /><span className="l3-version">Phiên bản {policy.version}</span></span> : <span className="empty-value">Chưa có chính sách</span>}</span></div>
          </div>
          <section className="l3-section" aria-label="Ngưỡng hạng">
            <div className="l3-section-head">
              <h2>Ngưỡng hạng <InfoHint label="Giải thích ngưỡng hạng">Ngưỡng tính theo doanh số đã thanh toán tích lũy; hạng chưa có ngưỡng hiển thị là chưa cấu hình. Ngưỡng mới áp dụng cho lần xếp hạng tiếp theo, không đổi số dư điểm.</InfoHint></h2>
              {canPolicy ? <button className="secondary" type="button" disabled={tiers.length === 0} onClick={() => openModal("tier")}>Đặt ngưỡng</button> : null}
            </div>
            {tiersIssue ? <p className="catalog-error" role="alert">{tiersIssue} Không thể đặt ngưỡng khi chưa thấy danh sách hạng.</p> : null}
            {tiers.length > 0 ? (
              <div className="table-scroll sticky-head review-table-scroll" tabIndex={0} aria-label="Ngưỡng hạng">
                <table className="review-orders-table l3-table">
                  <caption className="sr-only">Ngưỡng doanh số tích lũy theo hạng</caption>
                  <thead><tr><th>Hạng</th><th className="num">Doanh số tích lũy tối thiểu</th><th className="num">Thao tác</th></tr></thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t.tierId}>
                        <td data-label="Hạng"><TierBadge name={t.name} /></td>
                        <td data-label="Ngưỡng" className="num">{t.minimumCumulativePaidSales === null ? <span className="empty-value">Chưa cấu hình</span> : <Num value={t.minimumCumulativePaidSales} tone="green" money bold />}</td>
                        <td data-label="Thao tác" className="num"><div className="row-actions end">{canPolicy ? <button className="secondary btn-sm" type="button" onClick={() => openModal("tier", String(t.tierId))}>Đặt ngưỡng</button> : null}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !tiersIssue ? <div className="order-empty"><strong>Chưa có hạng nào</strong></div> : null}
          </section>
        </>
      ) : null}

      <AdminModal open={modal === "policy"} title={policy ? "Sửa chính sách điểm" : "Tạo chính sách điểm"} size="md" busy={busy} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={closeModal}>Hủy</button><button className="primary" type="submit" form="lp-policy-form" disabled={busy}>{busy ? "Đang lưu…" : policy ? "Lưu phiên bản mới" : "Tạo chính sách"}</button></>}>
        <form id="lp-policy-form" className="catalog-form" noValidate onSubmit={(e) => { e.preventDefault(); void (policy ? submitUpdate() : submitCreate()); }}>
          <div className="l3-grid2">
            <div className="catalog-field">
              <label htmlFor="lp-earn">Chi tiêu để tích 1 điểm (VNĐ)</label>
              <input id="lp-earn" className="catalog-input" value={earnCurrencyPerPoint} onChange={(e) => setEarnCurrencyPerPoint(e.target.value)} inputMode="decimal" placeholder="Ví dụ: 25000" />
            </div>
            <div className="catalog-field">
              <label htmlFor="lp-redeem">Giá trị đổi 1 điểm (VNĐ)</label>
              <input id="lp-redeem" className="catalog-input" value={redeemCurrencyPerPoint} onChange={(e) => setRedeemCurrencyPerPoint(e.target.value)} inputMode="decimal" placeholder="Ví dụ: 1000" />
            </div>
          </div>
          <div className="catalog-field">
            <label htmlFor="lp-status">Trạng thái <InfoHint label="Giải thích quy đổi">Mức chi tiêu là số tiền đã thanh toán để nhận 1 điểm; giá trị đổi là số tiền được trừ khi dùng 1 điểm. Tối đa 2 chữ số thập phân.</InfoHint></label>
            <select id="lp-status" className="catalog-input" value={status} onChange={(e) => setStatus(e.target.value as PolicyState)}>
              <option value="DISABLED">Đang tắt</option>
              <option value="ENABLED">Đang bật</option>
            </select>
          </div>
          {issue && issueAt === "policy" ? <p className="catalog-error" role="alert">{issue}</p> : null}
        </form>
      </AdminModal>

      <AdminModal open={modal === "legacy"} title="Ghi nhận số dư ban đầu" size="sm" busy={busy} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={closeModal}>Hủy</button><button className="primary" type="submit" form="lp-legacy-form" disabled={busy}>{busy ? "Đang ghi nhận…" : "Ghi nhận"}</button></>}>
        <form id="lp-legacy-form" className="catalog-form" noValidate onSubmit={(e) => { e.preventDefault(); void submitMoDau(); }}>
          <div className="catalog-field">
            <label htmlFor="lp-customer">Mã khách hàng <InfoHint label="Giải thích số dư ban đầu">Khi khách dùng điểm lần đầu, hệ thống tự ghi nhận số dư ban đầu. Chức năng này chỉ để ghi nhận trước; mỗi khách một lần, lặp lại bị từ chối. Tổng chi tiêu và số dư hiện tại được giữ nguyên.</InfoHint></label>
            <input id="lp-customer" className="catalog-input" value={maKh} onChange={(e) => setMaKh(e.target.value)} placeholder="Ví dụ: 123" inputMode="numeric" />
          </div>
          {issue && issueAt === "legacy" ? <p className="catalog-error" role="alert">{issue}</p> : null}
        </form>
      </AdminModal>

      <AdminModal open={modal === "tier"} title="Đặt ngưỡng hạng" size="sm" busy={busy} onClose={closeModal}
        footer={<><button className="secondary" type="button" disabled={busy} onClick={closeModal}>Hủy</button><button className="primary" type="submit" form="lp-tier-form" disabled={busy || tiers.length === 0}>{busy ? "Đang đặt…" : "Đặt ngưỡng"}</button></>}>
        <form id="lp-tier-form" className="catalog-form" noValidate onSubmit={(e) => { e.preventDefault(); void submitTier(); }}>
          <div className="catalog-field">
            <label htmlFor="lp-tier">Hạng</label>
            <select id="lp-tier" className="catalog-input" value={maHang} onChange={(e) => setMaHang(e.target.value)}>
              <option value="">— Chọn hạng —</option>
              {tiers.map((t) => (
                <option key={t.tierId} value={t.tierId}>
                  {t.name} · hiện tại: {t.minimumCumulativePaidSales === null ? "chưa cấu hình" : moneyVnd(t.minimumCumulativePaidSales)}
                </option>
              ))}
            </select>
          </div>
          <div className="catalog-field">
            <label htmlFor="lp-threshold">Ngưỡng doanh số tích lũy mới (VNĐ)</label>
            <input id="lp-threshold" className="catalog-input" value={nguong} onChange={(e) => setNguong(e.target.value)} placeholder="Ví dụ: 2500000" inputMode="decimal" />
          </div>
          {issue && issueAt === "tier" ? <p className="catalog-error" role="alert">{issue}</p> : null}
        </form>
      </AdminModal>
    </AdminShellB>
  );
}
