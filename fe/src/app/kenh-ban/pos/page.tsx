"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { posCancel, posCreateDraft, posFindCustomer, posGetDraft, posListDrafts, posPay, posQuote, posSearchProducts, type PosCustomer, type PosProduct } from "@/lib/pos-client";
import {
  commerceErrorMessage, formatVndContract, validateCancelReason,
  validateCashTender, validateQuantity, discountLines,
  type PosDraft, type PosQuote, type PosReceipt,
} from "@/lib/commerce";
import {
  benefitErrorMessage, canonicalVoucherCode, validatePointsInput,
} from "@/lib/benefits";
import { fetchStaffCustomerLoyalty } from "@/lib/benefits-client";

type Line = { maSku: number; ten: string; soLuong: number };

export default function PosPage() {
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
  const busyRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const loadBase = useCallback(async () => {
    setError("");
    try { setDrafts((await posListDrafts()).data); }
    catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được POS."));
      setTimeout(() => errRef.current?.focus(), 0);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadBase());
  }, [loadBase]);

  async function search() {
    const keyword = q.trim();
    if (!keyword) {
      setError("Nhập barcode/SKU/tên để tìm (Enter để chạy).");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const pg = await posSearchProducts(keyword);
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

  function addLine(p: PosProduct) {
    if (draft) { setError("Nháp đã tạo; hủy nháp trước khi đổi mặt hàng."); return; }
    const next = [...lines];
    const found = next.find((l) => l.maSku === p.maSku);
    if (found) found.soLuong = validateQuantity(found.soLuong + 1);
    else next.push({ maSku: p.maSku, ten: p.tenSp, soLuong: 1 });
    setLines(next);
    setQuote(null);
    setError("");
    setInfo("");
    searchRef.current?.focus();
  }

  async function lookupCustomer() {
    if (draft) { setError("Khách hàng đã được gắn vào nháp; hủy nháp để chọn khách khác."); return; }
    const digits = sdt.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 11) {
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
      try {
        const b = await fetchStaffCustomerLoyalty(c.maKh);
        setCustPoints(b.availablePoints);
        setCustTier(b.salesTierName ?? null);
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
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    let activeDraft = draft;
    try {
      const bound: Line[] = lines.length ? lines : (draft?.items ?? []).map((item) => ({ maSku: item.maSku, ten: item.tenSp ?? `SKU ${item.maSku}`, soLuong: item.soLuong }));
      if (!bound.length) { setError("Thêm ít nhất một món trước khi báo giá."); return; }
      let code: string | null;
      let pts: number;
      try {
        code = voucher.trim() ? canonicalVoucherCode(voucher) : null;
        pts = validatePointsInput(pointsRaw, custPoints ?? Number.MAX_SAFE_INTEGER);
      } catch (ve) { setBenefitIssue(ve instanceof Error ? ve.message : "Ưu đãi chưa hợp lệ."); return; }
      setBenefitIssue("");
      if (!activeDraft) {
        activeDraft = await posCreateDraft({ customerPhone: walkin ? null : customer?.sdt ?? null, items: bound.map((line) => ({ maSku: line.maSku, soLuong: line.soLuong })) });
        setDraft(activeDraft);
        setLines(bound);
      }
      const qq = await posQuote(activeDraft.maDonHang, { voucherCode: code, diemSuDung: pts });
      setQuote(qq);
      setAppliedVoucher(code);
      setAppliedPoints(pts);
      if ((code || pts > 0) && !qq.giamVoucher && !qq.giamDiem) setBenefitIssue("Máy chủ không áp dụng ưu đãi nào cho giỏ này. Tổng dưới đây là giá gốc.");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Lấy báo giá thất bại.";
      const code = (e as { code?: string })?.code ?? null;
      if (st === 400 || st === 404 || (st === 409 && code?.startsWith("42"))) setBenefitIssue(`${benefitErrorMessage(st, code, msg)} Mã/điểm giữ nguyên.`);
      else setError(`${commerceErrorMessage(st, msg)} Xem lại báo giá mới trước khi thu tiền.`);
      errRef.current?.focus();
      if (st === 409 && activeDraft) {
        try { setDraft(await posGetDraft(activeDraft.maDonHang)); setQuote(null); }
        catch { /* keep */ }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
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
        amountPaid: tenderV,
        quoteFingerprint: quote.quoteFingerprint,
        ...(appliedVoucher ? { voucherCode: appliedVoucher } : {}),
        ...(appliedPoints > 0 ? { redeemedPoints: appliedPoints } : {}),
      });
      setReceipt(paid);
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
      const message = e instanceof Error ? e.message : "Thu tiền thất bại.";
      const code = (e as { code?: string })?.code ?? null;
      setError(`${benefitErrorMessage(st, code, commerceErrorMessage(st, message))} Tiền/giỏ được giữ nguyên — xem báo giá mới rồi thu lại.`);
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
      await posCancel(draft.maDonHang, reason.trim());
      setInfo(`Đã hủy nháp #${draft.maDonHang} (chưa thu tiền nên không phát sinh doanh thu).`);
      setDraft(null);
      setLines([]);
      setQuote(null);
      setVoucher("");
      setPointsRaw("");
      setBenefitIssue("");
      setAppliedVoucher(null);
      setAppliedPoints(0);
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
      if (d.maKh && d.customerPhone) {
        setCustomer({ maKh: d.maKh, hoTen: d.customerName ?? `Khách #${d.maKh}`, sdt: d.customerPhone });
        setSdt(d.customerPhone);
        setWalkin(false);
        try {
          const balance = await fetchStaffCustomerLoyalty(d.maKh);
          setCustPoints(balance.availablePoints);
          setCustTier(balance.salesTierName ?? null);
        } catch { /* balance is optional display data; the quote remains authoritative */ }
      } else { setCustomer(null); setSdt(""); setWalkin(true); }
      setInfo(`Đã mở lại nháp #${id}. Nháp không giữ hàng.`);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Mở nháp thất bại."));
    }
  }

  function printReceipt() { if (receipt) window.print(); }

  return (
    <MerchantShell
      active="orders"
      themed
      previewNote="POS tiền mặt thật: nháp không giữ hàng, thu tiền trừ kho 1 lần, QR/thẻ hiển thị không khả dụng. In trình duyệt không phải kiểm phần cứng."
    >
      <div className="stPosGrid">
        <div className="stPosCol">
          <section className="stPosCard">
            <h2 className="stPosTitle">POS Thu Ngân Tiền Mặt</h2>
            <p className="stPosHint">
              Nháp tạo khi báo giá, không giữ hàng · Enter để tìm · tiền thối tính thật
            </p>
            {error ? <div ref={errRef} tabIndex={-1} role="alert" className="stAlert">{error}</div> : null}
            {info ? <p role="status" className="stPosStatus">{info}</p> : null}
            <p className="stPosHint">Nháp hiện tại: {draft ? `#${draft.maDonHang}` : "chưa tạo — mặt hàng đang ở trình duyệt"}</p>
          </section>

          <section className="stPosCard">
            <h3 className="stPosTitle">Tìm hàng (barcode/SKU/tên chính xác)</h3>
            <form
              role="search"
              className="stPosRow"
              onSubmit={(e) => { e.preventDefault(); search(); }}
            >
              <input
                ref={searchRef}
                className="stPosInput stFlex1"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Quét barcode hoặc gõ SKU/tên… (Enter)"
                aria-label="Tìm hàng POS"
              />
              <button className="stPosBtn" type="submit" disabled={searching}>{searching ? "Đang tìm…" : "Tìm"}</button>
            </form>
            {results.map((p) => (
              <div key={p.maSku} className="stPosRow">
                <div className="stFlex1">
                  <b>{p.tenSp}</b>
                  <p className="stPosHint">
                    SKU {p.maSku} · SP {p.maSp} · {[p.mauSac, p.kichCo].filter(Boolean).join(" · ")} · {formatVndContract(p.donGia)}{p.soLuongKhaDung !== null && p.soLuongKhaDung !== undefined ? ` · khả dụng ${p.soLuongKhaDung}` : ""}
                  </p>
                </div>
                <button className="stPosBtn" disabled={busy || Boolean(draft)} onClick={() => addLine(p)}>+ Thêm</button>
              </div>
            ))}
            <h3 className="stPosTitle">Khách hàng</h3>
            <div className="stPosRow">
              <input
                className="stPosInput"
                value={sdt}
                disabled={Boolean(draft)}
                onChange={(e) => setSdt(e.target.value)}
                placeholder="SĐT khách…"
                aria-label="SĐT khách"
                inputMode="tel"
              />
              <button className="stPosBtn" type="button" disabled={Boolean(draft)} onClick={lookupCustomer}>Tìm SĐT</button>
              <button className="stPosBtn" type="button" disabled={Boolean(draft)} aria-pressed={walkin} onClick={() => { setWalkin(true); setCustomer(null); setVoucher(""); setPointsRaw(""); setAppliedVoucher(null); setAppliedPoints(0); setCustPoints(null); setCustTier(null); }}>Khách lẻ walk-in</button>
              {customer && !walkin ? <span className="stPosHint">{customer.hoTen} · {customer.sdt}</span> : <span className="stPosHint">Đang: khách lẻ</span>}
              {customer && !walkin && custPoints !== null ? (
                <span className="stPosHint">Điểm khả dụng: {custPoints.toLocaleString("vi-VN")} · Hạng: {custTier ?? "—"}</span>
              ) : null}
            </div>
            <p className="stPosHint">QR/thẻ: <b>không khả dụng</b> — chỉ thu tiền mặt, không giả lập thành công.</p>
          </section>

          <section className="stPosCard">
            <h3 className="stPosTitle">Nháp đang giữ ({drafts.length})</h3>
            {drafts.length === 0 ? <p className="stPosHint">Chưa có nháp giữ. Mỗi nháp độc lập, không giữ hàng.</p> : null}
            {drafts.map((d) => (
              <p key={d.maDonHang} className="stPosRow">
                <b>#{d.maDonHang}</b><span className="stPosHint">{d.items.length} dòng · {d.trangThai}</span>
                <button className="stPosBtn" onClick={() => resume(d.maDonHang)}>Mở lại</button>
              </p>
            ))}
          </section>
        </div>

        <div className="stPosCol">
          <section className="stPosCard">
            <h3 className="stPosTitle">Giỏ POS {draft ? `#${draft.maDonHang}` : "(chưa tạo nháp)"}</h3>
            {lines.length === 0 && !draft ? <p className="stPosHint">Thêm món; nháp chỉ được tạo sau khi bấm báo giá. Nháp không giữ hàng.</p> : null}
            {(lines.length ? lines : (draft?.items ?? []).map((i) => ({ maSku: i.maSku, ten: i.tenSp ?? `SKU ${i.maSku}`, soLuong: i.soLuong }))).map((l) => (
              <div key={l.maSku} className="stPosRow">
                <div className="stFlex1"><b>{l.ten}</b><p className="stPosHint">SKU {l.maSku} · SL {l.soLuong}</p></div>
              </div>
            ))}
            <div className="stPosRow">
              <button className="stPosBtn" disabled={busy || (!draft && !lines.length)} onClick={runQuote}>Lấy báo giá hiện tại</button>
              <button className="stPosBtn" disabled={busy || !draft} onClick={cancelDraft}>Hủy nháp chưa trả tiền</button>
            </div>
            <label className="stStudioField" htmlFor="pos-voucher">
              <span>Mã voucher (1 mã)</span>
              <input
                id="pos-voucher"
                className="stPosInput"
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                placeholder="VD WELCOME2026"
                autoComplete="off"
              />
            </label>
            <label className="stStudioField" htmlFor="pos-points">
              <span>Điểm sử dụng{walkin ? " (walk-in không dùng điểm)" : ""}</span>
              <input
                id="pos-points"
                className="stPosInput"
                value={pointsRaw}
                onChange={(e) => setPointsRaw(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                disabled={walkin}
              />
            </label>
            {benefitIssue ? <p role="status" className="stPosStatus">{benefitIssue}</p> : null}
            {quote ? (
              <div className="stMoney">
                <div className="stMoneyRow"><span>Tạm tính</span><span>{formatVndContract(quote.tongTienHang)}</span></div>
                {(quote.giamVoucher ?? 0) > 0 || (quote.giamDiem ?? 0) > 0 ? (
                  <>
                    {(quote.giamVoucher ?? 0) > 0 ? (
                      <div className="stMoneyRow"><span>Voucher {appliedVoucher ?? ""}</span><span>−{formatVndContract(quote.giamVoucher)}</span></div>
                    ) : null}
                    {(quote.giamDiem ?? 0) > 0 ? (
                      <div className="stMoneyRow"><span>Điểm đã dùng ({appliedPoints})</span><span>−{formatVndContract(quote.giamDiem)}</span></div>
                    ) : null}
                  </>
                ) : (quote.giamGia ?? 0) > 0 ? (
                  <div className="stMoneyRow"><span>Giảm giá</span><span>−{formatVndContract(quote.giamGia)}</span></div>
                ) : null}
                <div className="stMoneyRow stMoneyRowTotal"><span>Phải thu</span><span>{formatVndContract(quote.tongThanhToan)}</span></div>
              </div>
            ) : null}
            <div className="stPosRow">
              <label className="stStudioField" style={{ minWidth: 200 }}>
                <span>Tiền khách đưa</span>
                <input
                  className="stPosInput"
                  value={tender}
                  onChange={(e) => setTender(e.target.value)}
                  placeholder="VD 200000"
                  inputMode="numeric"
                />
              </label>
              <button className="stPosBtn stPosBtnPrimary" disabled={busy || !quote} onClick={pay}>Thu tiền mặt &amp; in hóa đơn</button>
              {quote && tender ? (
                <span className="stPosHint">
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
            {!quote ? <p className="stPosHint">Phải lấy báo giá hiện tại trước khi thu tiền.</p> : null}
          </section>

          {receipt ? (
            <section className="stPosCard" aria-label="Hóa đơn POS">
              <h3 className="stPosTitle">Hóa đơn #{String(receipt.maHoaDon)} <span className="mpPill mpPillLive">Đã thu tiền mặt</span></h3>
              <p className="stPosHint">
                Đơn #{receipt.maDonHang} · {formatVndContract(receipt.tongThanhToan)} · thối {formatVndContract(receipt.tienThua)}
              </p>
              {discountLines(receipt).map((line) => (
                <p className="stPosHint" key={line.label}>
                  {line.label}: {line.amount === null ? "—" : `−${formatVndContract(line.amount)}`}
                </p>
              ))}
              {receipt.earnedPoints !== null ? <p className="stPosHint">Điểm tích lũy: {receipt.earnedPoints.toLocaleString("vi-VN")}</p> : null}
              {(receipt.items ?? []).map((l) => (
                <div key={l.maSku} className="stPosRow">
                  <div className="stFlex1"><b>{l.tenSpSnapshot}</b><p className="stPosHint">SKU {l.maSku} · SL {l.soLuong}{(l.tienGiamGia ?? 0) > 0 ? ` · voucher −${formatVndContract(l.tienGiamGia)}` : ""}{(l.diemGiam ?? 0) > 0 ? ` · điểm −${formatVndContract(l.diemGiam)}` : ""}</p></div>
                  <b>{formatVndContract(l.tongDong)}</b>
                </div>
              ))}
              <div className="stPosRow">
                <button className="stPosBtn" onClick={printReceipt}>In / xem bản in trình duyệt</button>
                <Link className="stPosBtn" href={`/kenh-ban/don-hang`}>Sang fulfillment →</Link>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </MerchantShell>
  );
}
