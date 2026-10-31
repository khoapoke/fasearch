"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import {
  fetchStaffOrder, fetchStaffOrders, staffCancel, staffCompleteCod, staffTransition,
} from "@/lib/commerce-client";
import {
  buildStaffOrderQuery, commerceErrorMessage, formatVndContract, newOperationKey,
  nextOnlineState, orderStatusLabel, paymentStatusLabel, validateCancelReason,
  type OrderDetail,
} from "@/lib/commerce";

const PAGE_SIZE = 10;

export default function MerchantOrders() {
  const [filters, setFilters] = useState({ maDonHang: "", sdt: "", trangThai: "", kenhBan: "", tuNgay: "", denNgay: "" });
  const [applied, setApplied] = useState({ ...filters });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<OrderDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [cash, setCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [opKey, setOpKey] = useState(() => newOperationKey());
  const busyRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = buildStaffOrderQuery({
        page, size: PAGE_SIZE,
        ...(applied.maDonHang.trim() ? { maDonHang: applied.maDonHang.trim() } : {}),
        ...(applied.sdt.trim() ? { sdt: applied.sdt.trim() } : {}),
        ...(applied.trangThai ? { trangThai: applied.trangThai } : {}),
        ...(applied.kenhBan ? { kenhBan: applied.kenhBan } : {}),
        ...(applied.tuNgay ? { tuNgay: applied.tuNgay } : {}),
        ...(applied.denNgay ? { denNgay: applied.denNgay } : {}),
      });
      const pg = await fetchStaffOrders(q);
      setRows(pg.data);
      setTotal(pg.totalElements);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được đơn."));
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function open(id: number) {
    setOpenId(id);
    setDetail(null);
    setActionError("");
    setDetailLoading(true);
    try {
      const d = await fetchStaffOrder(id);
      setDetail(d);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setActionError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được chi tiết."));
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (openId === null) return;
    try {
      const d = await fetchStaffOrder(openId);
      setDetail(d);
      setActionError("");
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setActionError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải lại được."));
    }
  }

  async function act(kind: "next" | "cancel" | "cod") {
    if (!detail || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (kind === "next") {
        const next = nextOnlineState(detail.trangThai);
        if (!next) throw new Error("Trạng thái hiện tại không có bước tiếp theo.");
        if (detail.trangThai === "DANG_DONG_GOI") {
          // Handoff: giải thích tiêu thụ tồn (giữ chỗ → trừ thực) trong confirm.
          if (!window.confirm("Bàn giao vận chuyển sẽ trừ tồn thực 1 lần (giữ chỗ đã tạo lúc đặt). Tiếp tục?")) {
            busyRef.current = false;
            setBusy(false);
            return;
          }
        }
        const updated = await staffTransition(detail.maDonHang, {
          khoaTam: opKey, phienBan: detail.phienBan, trangThaiDich: next,
          ...(note.trim() ? { ghiChu: note.trim() } : {}),
        });
        setDetail(updated);
      } else if (kind === "cancel") {
        const r = validateCancelReason(reason);
        const updated = await staffCancel(detail.maDonHang, { khoaTam: opKey, phienBan: detail.phienBan, lyDo: r });
        setDetail(updated);
        setReason("");
      } else {
        const due = detail.tongThanhToan;
        const got = Number(cash.replace(/[.\s]/g, ""));
        if (!Number.isInteger(got) || got !== due) {
          throw new Error(`COD phải thu đúng ${formatVndContract(due)}. Nhập đúng số tiền đã thu.`);
        }
        if (!window.confirm(`Xác nhận đã giao hàng và đã thu đúng ${formatVndContract(due)} tiền mặt?`)) {
          busyRef.current = false;
          setBusy(false);
          return;
        }
        const updated = await staffCompleteCod(detail.maDonHang, {
          khoaTam: opKey, phienBan: detail.phienBan, soTienDaThu: got, xacNhanDaGiao: true,
        });
        setDetail(updated);
        setCash("");
      }
      setOpKey(newOperationKey());
      setNote("");
      load();
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      const msg = e instanceof Error ? e.message : "Thao tác thất bại.";
      if (st === 409) {
        setActionError(`${commerceErrorMessage(st, msg)} Ngữ cảnh được giữ — tải lại chi tiết rồi làm tiếp với khóa mới.`);
        setOpKey(newOperationKey());
        await refreshDetail();
      } else {
        setActionError(st ? commerceErrorMessage(st, msg) : msg);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function setF(k: keyof typeof filters, v: string) {
    setFilters((f) => ({ ...f, [k]: v }));
  }

  return (
    <MerchantShell
      active="orders"
      previewNote="Đơn thật từ máy chủ: lọc/phân trang, đúng hành động cho phép, hủy cần lý do, COD cần xác nhận giao + thu tiền."
    >
      <div className="mpCard">
        <h2>Quản Lý Đơn Hàng</h2>
        <p className="mpMuted">FashionSearch AI · lọc thật, phân trang ổn định</p>
        <form
          role="search"
          aria-label="Lọc đơn"
          onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied({ ...filters }); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
        >
          <input value={filters.maDonHang} onChange={(e) => setF("maDonHang", e.target.value)} placeholder="Mã đơn…" aria-label="Mã đơn" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }} />
          <input value={filters.sdt} onChange={(e) => setF("sdt", e.target.value)} placeholder="SĐT…" aria-label="SĐT" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }} />
          <select value={filters.trangThai} onChange={(e) => setF("trangThai", e.target.value)} aria-label="Trạng thái" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}>
            <option value="">Mọi trạng thái</option>
            {["MOI_TAO", "DA_XAC_NHAN", "DANG_DONG_GOI", "DA_GIAO_VAN_CHUYEN", "HOAN_THANH", "DA_HUY"].map((s) => (
              <option key={s} value={s}>{orderStatusLabel(s)}</option>
            ))}
          </select>
          <select value={filters.kenhBan} onChange={(e) => setF("kenhBan", e.target.value)} aria-label="Kênh" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }}>
            <option value="">Mọi kênh</option>
            <option value="ONLINE">Online</option>
            <option value="POS">POS</option>
          </select>
          <input type="date" value={filters.tuNgay} onChange={(e) => setF("tuNgay", e.target.value)} aria-label="Từ ngày" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }} />
          <input type="date" value={filters.denNgay} onChange={(e) => setF("denNgay", e.target.value)} aria-label="Đến ngày" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px" }} />
          <button className="mpTopBtn" type="submit">Lọc (giữ điều kiện)</button>
        </form>
      </div>

      <div className="mpCard">
        {loading ? <p className="mpMuted" role="status">Đang tải đơn…</p> : null}
        {error ? (
          <div ref={errorRef} tabIndex={-1} role="alert">
            <p className="mpMuted">{error}</p>
            <button className="mpTopBtn" type="button" onClick={load}>Thử lại (giữ lọc)</button>
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead>
                <tr><th>Mã đơn</th><th>Kênh</th><th>Tổng (VNĐ)</th><th>Trạng thái</th><th>Thanh toán</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.maDonHang}>
                    <td><b>#{o.maDonHang}</b></td>
                    <td><span className="mpPill">{o.kenhBan}</span></td>
                    <td><b>{formatVndContract(o.tongThanhToan)}</b></td>
                    <td><span className="mpPill mpPillLive">{orderStatusLabel(o.trangThai)}</span></td>
                    <td>{paymentStatusLabel(o.trangThaiThanhToan)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => open(o.maDonHang)}>Chi tiết thật</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? <p className="mpMuted">Không có đơn với lọc hiện tại.</p> : null}
        <p className="mpMuted" style={{ marginTop: 10 }}>
          <button className="mpTopBtn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Trước</button>{" "}
          Trang {page + 1} · {total} đơn{" "}
          <button className="mpTopBtn" onClick={() => setPage((p) => p + 1)}>Sau</button>
        </p>
      </div>

      {openId !== null ? (
        <div className="mpCard rise-in" role="dialog" aria-label={`Chi tiết đơn #${openId}`}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <h2>Đơn #{openId}</h2>
            <button className="mpTopBtn" style={{ marginLeft: "auto" }} onClick={() => { setOpenId(null); setDetail(null); }}>Đóng</button>
          </div>
          {detailLoading ? <p className="mpMuted" role="status">Đang tải chi tiết…</p> : null}
          {actionError ? <p role="alert" style={{ color: "#b42318", fontSize: 13 }}>{actionError}</p> : null}
          {detail ? (
            <>
              <p className="mpMuted">
                {orderStatusLabel(detail.trangThai)} · {detail.kenhBan} · Kho {detail.maKho} · {paymentStatusLabel(detail.trangThaiThanhToan)} · v{detail.phienBan}
              </p>
              <p className="mpMuted">Nhận: {detail.nguoiNhan ?? "—"} · {detail.sdtNhan ?? "—"} · {detail.diaChiGiao ?? "—"}</p>
              {detail.items.map((l) => (
                <div className="pvRow" key={l.maSku} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}>
                  <div style={{ flex: 1 }}>
                    <b>{l.tenSpSnapshot}</b>
                    <p className="mpMuted">SKU {l.maSku} · {[l.mauSacSnapshot, l.kichCoSnapshot].filter(Boolean).join(" · ")} · SL {l.soLuong} · {formatVndContract(l.donGia)}</p>
                  </div>
                  <b>{formatVndContract(l.tongDong)}</b>
                </div>
              ))}
              <div className="pvLine total" style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 8 }}>
                <span>Tổng thanh toán</span><span style={{ color: "var(--accent)" }}>{formatVndContract(detail.tongThanhToan)}</span>
              </div>
              <h3 style={{ marginTop: 12 }}>Lịch sử</h3>
              <ul style={{ fontSize: 13 }}>
                {detail.lichSu.map((h, k) => (
                  <li key={k}>{orderStatusLabel(h.trangThai)} · {h.thoiGian}{h.nguoiThucHien ? ` · ${h.nguoiThucHien}` : ""}</li>
                ))}
              </ul>
              <p className="mpMuted">Cho phép: {detail.hanhDongChoPhep.length ? detail.hanhDongChoPhep.join(", ") : "—"} (chỉ hiện nút được phép)</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {nextOnlineState(detail.trangThai) ? (
                  <button className="mpTopBtn" disabled={busy} onClick={() => act("next")}>
                    {detail.trangThai === "DANG_DONG_GOI" ? "Bàn giao vận chuyển (trừ tồn thực)" : `Chuyển → ${orderStatusLabel(nextOnlineState(detail.trangThai) as string)}`}
                  </button>
                ) : null}
                <button className="mpTopBtn" disabled={busy} onClick={refreshDetail}>Tải lại chi tiết</button>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div className="pvField">
                  <label htmlFor="staff-note">Ghi chú chuyển trạng thái (tùy chọn)</label>
                  <input id="staff-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú…" />
                </div>
                <div className="pvField">
                  <label htmlFor="staff-cancel">Hủy trước bàn giao (cần lý do)</label>
                  <input id="staff-cancel" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do hủy…" />
                  <button className="mpTopBtn" style={{ marginTop: 6 }} disabled={busy} onClick={() => act("cancel")}>Hủy đơn có lý do</button>
                </div>
                <div className="pvField">
                  <label htmlFor="staff-cash">Hoàn thành COD (thu đúng số tiền, xác nhận đã giao)</label>
                  <input id="staff-cash" value={cash} onChange={(e) => setCash(e.target.value)} placeholder={String(detail.tongThanhToan)} inputMode="numeric" />
                  <button className="mpTopBtn" style={{ marginTop: 6 }} disabled={busy} onClick={() => act("cod")}>Xác nhận giao + thu tiền</button>
                </div>
                <p className="mpMuted">Hoàn/trả sau bàn giao là luồng riêng chưa mở — không tự cộng kho/hoàn tiền.</p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </MerchantShell>
  );
}
