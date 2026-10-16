"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchOwnOrders } from "@/lib/commerce-client";
import {
  buildOrderQuery, commerceErrorMessage, formatVndContract, orderStatusLabel,
  paymentMethodLabel, paymentStatusLabel, type OrderDetail,
} from "@/lib/commerce";
import "@/components/storefront/preview.css";

const TABS: Array<{ v: string; label: string }> = [
  { v: "", label: "Tất cả" },
  { v: "MOI_TAO", label: "Mới tạo" },
  { v: "DA_XAC_NHAN", label: "Đã xác nhận" },
  { v: "DANG_DONG_GOI", label: "Đang đóng gói" },
  { v: "DA_GIAO_VAN_CHUYEN", label: "Đang giao" },
  { v: "HOAN_THANH", label: "Hoàn thành" },
  { v: "DA_HUY", label: "Đã hủy" },
];

export default function OrdersPage() {
  const [tab, setTab] = useState("");
  const [find, setFind] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<OrderDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const size = 10;

  const load = useCallback(async (t: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const q = buildOrderQuery({ page: p, size, ...(t ? { trangThai: t } : {}) });
      const pg = await fetchOwnOrders(q);
      let data = pg.data;
      const f = find.trim();
      if (f) data = data.filter((o) => String(o.maDonHang).includes(f));
      setRows(data);
      setTotal(pg.totalElements);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      setStatus(st);
      setError(commerceErrorMessage(st, e instanceof Error ? e.message : "Không tải được đơn hàng."));
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }, [find]);

  useEffect(() => {
    void Promise.resolve().then(() => load(tab, page));
  }, [tab, page, load]);

  return (
    <AccountCenterShell active="/tai-khoan" kicker="FASHION AI PROFILE HUB" title="Đơn Hàng Của Tôi">
      <p className="sfPreviewBar" role="note" style={{ borderRadius: 12, marginBottom: 14 }}>
        <span>Đơn thật từ máy chủ — chỉ đơn của bạn. Hủy chỉ khi còn Mới tạo và được cho phép.</span>
      </p>
      <form className="mpSearch" style={{ maxWidth: 320 }} role="search" onSubmit={(e) => {
        e.preventDefault();
        setPage(0);
        load(tab, 0);
      }}>
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Tìm mã đơn…" aria-label="Tìm mã đơn" />
      </form>
      <div className="pvTabs" role="group" aria-label="Lọc trạng thái">
        {TABS.map((t) => (
          <button key={t.v || "all"} type="button" aria-pressed={tab === t.v} onClick={() => { setTab(t.v); setPage(0); }}>
            {t.label}
          </button>
        ))}
      </div>
      {loading ? <p className="pgState" role="status"><strong>Đang tải đơn…</strong></p> : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="pvCard" role="alert">
          <p className="sub">{error} {status === 401 ? <Link href="/dang-nhap?next=/don-hang">Đăng nhập →</Link> : null}</p>
          <button className="hmCta hmCtaGhost" type="button" onClick={() => load(tab, page)}>Thử lại (giữ lọc)</button>
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="pgState"><strong>Không có đơn ở trạng thái này</strong>Thử trạng thái khác hoặc <Link href="/nam">mua sắm →</Link></p>
      ) : null}
      {!loading && !error ? rows.map((o) => (
        <section className="sfSideCard" key={o.maDonHang} aria-label={`Đơn ${o.maDonHang}`}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <b>Mã đơn: #{o.maDonHang}</b>
            <span className="pMatch">{orderStatusLabel(o.trangThai)}</span>
            <span className="pPrice" style={{ marginLeft: "auto" }}>{formatVndContract(o.tongThanhToan)}</span>
          </div>
          <p className="sfIdentitySub">
            Đặt ngày: {o.ngayDat} · {o.items.reduce((n, l) => n + l.soLuong, 0)} món · {paymentMethodLabel(o.phuongThucThanhToan)} · {paymentStatusLabel(o.trangThaiThanhToan)}
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <Link className="hmCta hmCtaGhost" style={{ padding: "9px 16px", fontSize: 13 }} href={`/don-hang/${o.maDonHang}`}>Xem chi tiết thật</Link>
          </div>
        </section>
      )) : null}
      {!loading && !error && total > size ? (
        <p style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="hmCta hmCtaGhost" type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Trước</button>
          <span className="mpMuted">Trang {page + 1} · {total} đơn</span>
          <button className="hmCta hmCtaGhost" type="button" onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </p>
      ) : null}
      <p className="sfIdentitySub">Không có tiến trình giao hàng giả hay trạng thái đã trả tiền giả — mọi thứ từ máy chủ.</p>
    </AccountCenterShell>
  );
}
