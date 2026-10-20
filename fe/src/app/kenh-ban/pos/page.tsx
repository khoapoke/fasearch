"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import {
  fetchReceipt, fetchWarehouses, posCancel, posCreateDraft, posFindCustomer, posGetDraft,
  posListDrafts, posPay, posPutItems, posQuote, posSearchProducts, posSetCustomer,
  type PosCustomer, type PosProduct,
} from "@/lib/commerce-client";
import {
  commerceErrorMessage, formatVndContract, newOperationKey, validateCancelReason,
  validateCashTender, validateQuantity, discountLines,
  type PosDraft, type PosQuote, type PosReceipt, type Warehouse,
} from "@/lib/commerce";
import {
  benefitErrorMessage, canonicalVoucherCode, validatePointsInput,
} from "@/lib/benefits";
import { fetchStaffCustomerLoyalty } from "@/lib/benefits-client";

type Line = { maSku: number; ten: string; soLuong: number };

export default function PosPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [maKho, setMaKho] = useState<number | null>(null);
  const [draft, setDraft] = useState<PosDraft | null>(null);
  const [drafts, setDrafts] = useState<PosDraft[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [sdt, setSdt] = useState("");
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [walkin, setWalkin] = useState(true);
  const [quote, setQuote] = useState<PosQuote | null>(null);
  const [tender, setTender] = useState("");
  const [voucher, setVoucher] = useState("");
  const [pointsRaw, setPointsRaw] = useState("");
  const [benefitIssue, setBenefitIssue] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [appliedPoints, setAppliedPoints] = useState(0);
  const [custPoints, setCustPoints] = useState<number | null>(null);
  const [custTier, setCustTier] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PosReceipt | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [opKey, setOpKey] = useState(() => newOperationKey());
  const busyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const loadBase = useCallback(async () => {
    setError("");
    try {
      const wh = await fetchWarehouses();
      setWarehouses(wh);
      const def = wh.find((w) => w.laMacDinh) ?? wh[0] ?? null;
      setMaKho(def ? def.maKho : null);
      try {
        const held = await posListDrafts();
        setDrafts(held.data);
      } catch {
        setDrafts([]);
      }
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được POS."));
      setTimeout(() => errRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadBase());
  }, [loadBase]);

  async function search() {
    if (maKho === null) {
      setError("Chọn kho trước khi tìm hàng.");
      return;
    }
    const keyword = q.trim();
    if (!keyword) {
      setError("Nhập barcode/SKU/tên để tìm (Enter để chạy).");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const pg = await posSearchProducts({ q: keyword, maKho, page: 0, size: 20 });
      setResults(pg.data);
      if (pg.data.length === 0) setInfo(`Không thấy “${keyword}” trong kho đã chọn.`);
      else setInfo("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Tìm hàng thất bại."));
      errRef.current?.focus();
    } finally {
      setSearching(false);
    }
  }

  async function ensureDraft(): Promise<PosDraft> {
    if (draft) return draft;
    if (maKho === null) throw new Error("Chọn kho trước khi tạo nháp.");
    const d = await posCreateDraft({ khoaTam: opKey, maKho, maKh: walkin ? null : (customer?.maKh ?? null) });
    setOpKey(newOperationKey());
    setDraft(d);
    return d;
  }

  async function addLine(p: PosProduct) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const d = await ensureDraft();
      const next: Line[] = [...lines];
      const found = next.find((l) => l.maSku === p.maSku);
      if (found) found.soLuong = validateQuantity(found.soLuong + 1);
      else next.push({ maSku: p.maSku, ten: p.tenSp, soLuong: 1 });
      const updated = await posPutItems(d.maDonHang, {
        phienBan: d.phienBan,
        items: next.map((l) => ({ maSku: l.maSku, soLuong: l.soLuong })),
      });
      setDraft(updated);
      setLines(next);
      setQuote(null);
      searchRef.current?.focus();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(`${commerceErrorMessage(st, e instanceof Error ? e.message : "Thêm món thất bại.")} Giỏ POS/ô nhập được giữ nguyên.`);
      errRef.current?.focus();
      if (st === 409 && draft) {
        try {
          const fresh = await posGetDraft(draft.maDonHang);
          setDraft(fresh);
        } catch {
          /* keep */
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function lookupCustomer() {
    const digits = sdt.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Nhập SĐT 9–11 số để tìm khách.");
      return;
    }
    setError("");
    try {
      const c = await posFindCustomer(digits);
      if (!c) {
        setInfo("Không thấy khách với SĐT này — dùng khách lẻ (walk-in).");
        setCustomer(null);
        setWalkin(true);
        return;
      }
      setCustomer(c);
      setWalkin(false);
      setInfo(`Đã gắn khách ${c.hoTen} (${c.sdt}).`);
      if (draft) {
        const updated = await posSetCustomer(draft.maDonHang, { phienBan: draft.phienBan, maKh: c.maKh });
        setDraft(updated);
      }
      try {
        const b = await fetchStaffCustomerLoyalty(c.maKh);
        setCustPoints(b.khaDung);
        setCustTier(b.tierName ?? null);
      } catch (be) {
        const bst = (be as { status?: number })?.status ?? 0;
        if (bst === 404) {
          setCustPoints(null);
          setInfo((prev) => `${prev} Chưa có thông tin điểm — vẫn bán cash bình thường.`);
        } else {
          setError(benefitErrorMessage(bst, null, be instanceof Error ? be.message : "Không tải được điểm khách."));
        }
      }
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Tìm khách thất bại."));
    }
  }

  async function runQuote() {
    if (!draft) {
      setError("Chưa có nháp POS — thêm món trước.");
      return;
    }
    setError("");
    try {
      const bound: Line[] = lines.length
        ? lines
        : draft.items.map((i) => ({ maSku: i.maSku, ten: `SKU ${i.maSku}`, soLuong: i.soLuong }));
      if (!bound.length) {
        setError("Nháp chưa có món.");
        return;
      }
      // Đồng bộ lines lên server trước khi quote để version khớp.
      let working = draft;
      try {
        working = await posPutItems(draft.maDonHang, {
          phienBan: draft.phienBan,
          items: bound.map((l) => ({ maSku: l.maSku, soLuong: l.soLuong })),
        });
        setDraft(working);
      } catch {
        /* quote sẽ báo 409 trung thực */
      }
      let code: string | null = null;
      let pts = 0;
      try {
        code = voucher.trim() ? canonicalVoucherCode(voucher) : null;
        pts = validatePointsInput(pointsRaw, Number.MAX_SAFE_INTEGER);
      } catch (ve) {
        setBenefitIssue(ve instanceof Error ? ve.message : "Ưu đãi chưa hợp lệ.");
        return;
      }
      setBenefitIssue("");
      const qq = await posQuote(working.maDonHang, working.phienBan, { voucherCode: code, diemSuDung: pts > 0 ? pts : null });
      setQuote(qq);
      setAppliedVoucher(code);
      setAppliedPoints(pts > 0 ? pts : 0);
      if ((code || pts > 0) && !qq.giamVoucher && !qq.giamDiem) {
        setBenefitIssue("Máy chủ không áp dụng ưu đãi nào cho giỏ này. Tổng dưới đây là giá gốc.");
      }
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Lấy báo giá thất bại.";
      if (st === 400 || st === 404) {
        setBenefitIssue(`${benefitErrorMessage(st, null, msg)} Mã/điểm giữ nguyên.`);
      } else {
        setError(`${commerceErrorMessage(st, msg)} Xem lại báo giá mới trước khi thu tiền.`);
      }
      errRef.current?.focus();
      if (st === 409 && draft) {
        try {
          const fresh = await posGetDraft(draft.maDonHang);
          setDraft(fresh);
          setQuote(null);
        } catch {
          /* keep */
        }
      }
    }
  }

  async function pay() {
    if (!draft || !quote) {
      setError("Cần báo giá mới trước khi thu tiền.");
      return;
    }
    const voucherNow = voucher.trim() ? voucher.trim().toUpperCase() : null;
    const pointsNow = pointsRaw.trim() ? Number(pointsRaw) : 0;
    if (voucherNow !== appliedVoucher || pointsNow !== appliedPoints) {
      setError("Ưu đãi đã thay đổi sau báo giá — bấm “Lấy báo giá hiện tại” rồi mới thu tiền.");
      errRef.current?.focus();
      return;
    }
    let tenderV: number;
    try {
      tenderV = validateCashTender(tender, quote.tongThanhToan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tiền khách đưa chưa hợp lệ.");
      errRef.current?.focus();
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const paid = await posPay(draft.maDonHang, {
        khoaTam: opKey,
        phienBan: draft.phienBan,
        tongThanhToanDuKien: quote.tongThanhToan,
        tienKhachDua: tenderV,
        ...(appliedVoucher ? { voucherCode: appliedVoucher } : {}),
        ...(quote.maChinhSach !== undefined && quote.maChinhSach !== null ? { maChinhSach: quote.maChinhSach } : {}),
        ...(quote.phienBanChinhSach !== undefined && quote.phienBanChinhSach !== null ? { phienBanChinhSach: quote.phienBanChinhSach } : {}),
        ...(appliedPoints > 0 ? { diemSuDung: appliedPoints } : {}),
      });
      setReceipt(paid);
      setOpKey(newOperationKey());
      setDraft(null);
      setLines([]);
      setQuote(null);
      setTender("");
      setVoucher("");
      setPointsRaw("");
      setBenefitIssue("");
      setAppliedVoucher(null);
      setAppliedPoints(0);
      const held = await posListDrafts().catch(() => null);
      if (held) setDrafts(held.data);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(`${commerceErrorMessage(st, e instanceof Error ? e.message : "Thu tiền thất bại.")} Tiền/giỏ được giữ nguyên — xem báo giá mới rồi thu lại.`);
      errRef.current?.focus();
      if (st === 409 && draft) {
        try {
          const fresh = await posGetDraft(draft.maDonHang);
          setDraft(fresh);
          setQuote(null);
          setOpKey(newOperationKey());
        } catch {
          /* keep */
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancelDraft() {
    if (!draft) return;
    const reason = window.prompt("Lý do hủy nháp chưa thanh toán:");
    if (reason === null) return;
    try {
      validateCancelReason(reason);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lý do chưa hợp lệ.");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await posCancel(draft.maDonHang, { khoaTam: opKey, phienBan: draft.phienBan, lyDo: reason.trim() });
      setInfo(`Đã hủy nháp #${draft.maDonHang} (chưa thu tiền nên không phát sinh doanh thu).`);
      setDraft(null);
      setLines([]);
      setQuote(null);
      setVoucher("");
      setPointsRaw("");
      setBenefitIssue("");
      setAppliedVoucher(null);
      setAppliedPoints(0);
      setOpKey(newOperationKey());
      const held = await posListDrafts().catch(() => null);
      if (held) setDrafts(held.data);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Hủy nháp thất bại."));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function resume(id: number) {
    setError("");
    try {
      const d = await posGetDraft(id);
      setDraft(d);
      setLines(d.items.map((i) => ({ maSku: i.maSku, ten: i.tenSp ?? `SKU ${i.maSku}`, soLuong: i.soLuong })));
      setQuote(null);
      setReceipt(null);
      setVoucher("");
      setPointsRaw("");
      setBenefitIssue("");
      setAppliedVoucher(null);
      setAppliedPoints(0);
      setCustPoints(null);
      setCustTier(null);
      setInfo(`Đã mở lại nháp #${id}. Nháp không giữ hàng.`);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Mở nháp thất bại."));
    }
  }

  async function printReceipt() {
    if (!receipt) return;
    try {
      const full = await fetchReceipt(receipt.maHoaDon);
      setReceipt(full as PosReceipt);
    } catch {
      /* giữ receipt hiện tại */
    }
    window.print();
  }

  return (
    <MerchantShell
      active="orders"
      previewNote="POS tiền mặt thật: nháp không giữ hàng, thu tiền trừ kho 1 lần, QR/thẻ hiển thị không khả dụng. In trình duyệt không phải kiểm phần cứng."
    >
      <div className="mpCard">
        <h2>POS Thu Ngân Tiền Mặt</h2>
        <p className="mpMuted">Kho + nháp giữ độc lập (held drafts) · Enter để tìm · tiền thối tính thật</p>
        {error ? <div ref={errRef} tabIndex={-1} role="alert" style={{ color: "#b42318", fontSize: 13, marginTop: 8 }}>{error}</div> : null}
        {info ? <p role="status" className="mpMuted" style={{ marginTop: 8 }}>{info}</p> : null}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <label>Kho
            <select
              value={maKho ?? ""}
              onChange={(e) => setMaKho(Number(e.target.value))}
              style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", marginLeft: 6 }}
            >
              <option value="">— Chọn kho —</option>
              {warehouses.map((w) => (
                <option key={w.maKho} value={w.maKho}>{w.tenKho}{w.laMacDinh ? " (mặc định)" : ""}</option>
              ))}
            </select>
          </label>
          <span className="mpMuted">Nháp hiện tại: {draft ? `#${draft.maDonHang} v${draft.phienBan}` : "chưa có"}</span>
        </div>
      </div>

      <div className="mpCard">
        <h3>Tìm hàng (barcode/SKU/tên chính xác)</h3>
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); search(); }}
          style={{ display: "flex", gap: 8, marginTop: 8 }}
        >
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Quét barcode hoặc gõ SKU/tên… (Enter)"
            aria-label="Tìm hàng POS"
            style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}
          />
          <button className="mpTopBtn" type="submit" disabled={searching}>{searching ? "Đang tìm…" : "Tìm"}</button>
        </form>
        {results.map((p) => (
          <div key={p.maSku} className="pvRow" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <b>{p.tenSp}</b>
              <p className="mpMuted">SKU {p.maSku} · SP {p.maSp} · {[p.mauSac, p.kichCo].filter(Boolean).join(" · ")} · {formatVndContract(p.donGia)}{p.soLuongKhaDung !== null && p.soLuongKhaDung !== undefined ? ` · khả dụng ${p.soLuongKhaDung}` : ""}</p>
            </div>
            <button className="mpTopBtn" disabled={busy} onClick={() => addLine(p)}>+ Thêm</button>
          </div>
        ))}
        <h3 style={{ marginTop: 14 }}>Khách hàng</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <input value={sdt} onChange={(e) => setSdt(e.target.value)} placeholder="SĐT khách…" aria-label="SĐT khách" inputMode="tel" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }} />
          <button className="mpTopBtn" type="button" onClick={lookupCustomer}>Tìm SĐT</button>
          <button className="mpTopBtn" type="button" aria-pressed={walkin} onClick={() => { setWalkin(true); setCustomer(null); setVoucher(""); setPointsRaw(""); setAppliedVoucher(null); setAppliedPoints(0); setCustPoints(null); setCustTier(null); }}>Khách lẻ walk-in</button>
          {customer && !walkin ? <span className="mpMuted">{customer.hoTen} · {customer.sdt}</span> : <span className="mpMuted">Đang: khách lẻ</span>}
          {customer && !walkin && custPoints !== null ? (
            <span className="mpMuted">Điểm khả dụng: {custPoints.toLocaleString("vi-VN")} · Hạng: {custTier ?? "—"}</span>
          ) : null}
        </div>
        <p className="mpMuted" style={{ marginTop: 8 }}>QR/thẻ: <b>không khả dụng</b> — chỉ thu tiền mặt, không giả lập thành công.</p>
      </div>

      <div className="mpCard">
        <h3>Giỏ POS {draft ? `#${draft.maDonHang}` : "(chưa tạo nháp)"}</h3>
        {lines.length === 0 && !draft ? <p className="mpMuted">Thêm món để tạo nháp TAM_LUU. Nháp không giữ hàng.</p> : null}
        {(lines.length ? lines : (draft?.items ?? []).map((i) => ({ maSku: i.maSku, ten: i.tenSp ?? `SKU ${i.maSku}`, soLuong: i.soLuong }))).map((l) => (
          <div key={l.maSku} className="pvRow" style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><b>{l.ten}</b><p className="mpMuted">SKU {l.maSku} · SL {l.soLuong}</p></div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="mpTopBtn" disabled={busy} onClick={runQuote}>Lấy báo giá hiện tại</button>
          <button className="mpTopBtn" disabled={busy || !draft} onClick={cancelDraft}>Hủy nháp chưa trả tiền</button>
        </div>
        <div className="pvField" style={{ marginTop: 10 }}>
          <label htmlFor="pos-voucher">Mã voucher (1 mã)</label>
          <input id="pos-voucher" value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="VD WELCOME2026" autoComplete="off" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", width: "100%" }} />
        </div>
        <div className="pvField">
          <label htmlFor="pos-points">Điểm sử dụng{walkin ? " (walk-in không dùng điểm)" : ""}</label>
          <input id="pos-points" value={pointsRaw} onChange={(e) => setPointsRaw(e.target.value)} placeholder="0" inputMode="numeric" disabled={walkin} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", width: "100%" }} />
        </div>
        {benefitIssue ? <p className="mpMuted" role="status">{benefitIssue}</p> : null}
        {quote ? (
          <div style={{ marginTop: 10 }}>
            <div className="pvLine"><span>Tạm tính</span><span>{formatVndContract(quote.tongTienHang)}</span></div>
            {(quote.giamVoucher ?? 0) > 0 || (quote.giamDiem ?? 0) > 0 ? (
              <>
                {(quote.giamVoucher ?? 0) > 0 ? (
                  <div className="pvLine"><span>Voucher {appliedVoucher ?? ""}</span><span>−{formatVndContract(quote.giamVoucher)}</span></div>
                ) : null}
                {(quote.giamDiem ?? 0) > 0 ? (
                  <div className="pvLine"><span>Điểm đã dùng ({appliedPoints})</span><span>−{formatVndContract(quote.giamDiem)}</span></div>
                ) : null}
              </>
            ) : (quote.giamGia ?? 0) > 0 ? (
              <div className="pvLine"><span>Giảm giá</span><span>−{formatVndContract(quote.giamGia)}</span></div>
            ) : null}
            <div className="pvLine total"><span>Phải thu</span><span>{formatVndContract(quote.tongThanhToan)}</span></div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <label>Tiền khách đưa
            <input value={tender} onChange={(e) => setTender(e.target.value)} placeholder="VD 200000" inputMode="numeric" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px", marginLeft: 6 }} />
          </label>
          <button className="mpTopBtn" disabled={busy || !quote} onClick={pay}>Thu tiền mặt &amp; in hóa đơn</button>
          {quote && tender ? (
            <span className="mpMuted">
              {(() => {
                try {
                  const t = validateCashTender(tender, quote.tongThanhToan);
                  return `Thối: ${formatVndContract(t - quote.tongThanhToan)}`;
                } catch {
                  return "Nhập đủ tiền để thấy tiền thối.";
                }
              })()}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mpCard">
        <h3>Nháp đang giữ ({drafts.length})</h3>
        {drafts.length === 0 ? <p className="mpMuted">Chưa có nháp giữ. Mỗi nháp độc lập, không giữ hàng.</p> : null}
        {drafts.map((d) => (
          <p key={d.maDonHang} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>#{d.maDonHang}</b><span className="mpMuted">v{d.phienBan} · {d.items.length} dòng</span>
            <button className="mpTopBtn" onClick={() => resume(d.maDonHang)}>Mở lại</button>
          </p>
        ))}
      </div>

      {receipt ? (
        <div className="mpCard" aria-label="Hóa đơn POS">
          <h3>Hóa đơn #{String(receipt.maHoaDon)} <span className="mpPill mpPillLive">Đã thu tiền mặt</span></h3>
          <p className="mpMuted">Đơn #{receipt.maDonHang} · kho {receipt.maKho} · {formatVndContract(receipt.tongThanhToan)} · thối {formatVndContract(receipt.tienThua)}</p>
          {discountLines(receipt).map((line) => (
            <p className="mpMuted" key={line.label}>
              {line.label}: {line.amount === null ? "—" : `−${formatVndContract(line.amount)}`}
            </p>
          ))}
          {(receipt.items ?? []).map((l) => (
            <div key={l.maSku} className="pvRow" style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><b>{l.tenSpSnapshot}</b><p className="mpMuted">SKU {l.maSku} · SL {l.soLuong}{(l.tienGiamGia ?? 0) > 0 ? ` · giảm ${formatVndContract(l.tienGiamGia)}` : ""}</p></div>
              <b>{formatVndContract(l.tongDong)}</b>
            </div>
          ))}
          <p style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="mpTopBtn" onClick={printReceipt}>In / xem bản in trình duyệt</button>
            <Link className="mpTopBtn" href={`/kenh-ban/don-hang`}>Sang fulfillment →</Link>
          </p>
        </div>
      ) : null}
    </MerchantShell>
  );
}
