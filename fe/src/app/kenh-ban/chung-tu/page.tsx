"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import {
  loaiPhieuLabel,
  trangThaiPhieuLabel,
  unwrap,
  whFetch,
  type Page,
  type PhieuKho,
  type WhError,
} from "@/lib/wh-client";

const LOAI = ["", "NHAP_NCC", "XUAT_HUY", "CHUYEN_KHO", "KIEM_KE", "CAN_BANG"];
const TRANG = ["", "BAN_NHAP", "DA_XAC_NHAN", "DA_HUY"];

export default function DocsPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [loai, setLoai] = useState("");
  const [trangThai, setTrangThai] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<PhieuKho> | null>(null);
  const [detail, setDetail] = useState<PhieuKho | null>(null);
  const [error, setError] = useState<WhError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const viewKey = `${loai}|${trangThai}|${page}|${reloadKey}`;

  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => live && setMe(identity))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({ page: String(page), size: "20" });
    if (loai) query.set("loai", loai);
    if (trangThai) query.set("trangThai", trangThai);
    whFetch(`v1/kho/phieu?${query.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          if (live) {
            setError(await toWhError(r));
            setData(null);
            setLoadedKey(viewKey);
          }
          return;
        }
        const pg = await unwrap<Page<PhieuKho>>(r);
        if (live) {
          setData(pg);
          setError(null);
          setLoadedKey(viewKey);
        }
      })
      .catch(() => {
        if (live) {
          setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
          setLoadedKey(viewKey);
        }
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  const loading = loadedKey !== viewKey;

  async function openDetail(id: number) {
    if (detailLoading !== null) return;
    setDetailLoading(id);
    try {
      const r = await whFetch(`v1/kho/phieu/${id}`);
      if (!r.ok) setError(await toWhError(r));
      else {
        setDetail(await unwrap<PhieuKho>(r));
        setError(null);
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho. Thử lại.", errors: [] });
    } finally {
      setDetailLoading(null);
    }
  }

  return (
    <MerchantShell active="docs">
      <div className="mpCard">
        <h2>Chứng từ kho &amp; lịch sử</h2>
        <p className="mpMuted">Mới nhất trước. Phiếu đã chốt/hủy bất biến; sai thì lập phiếu mới liên kết.</p>
        <WhAuthNote role={me?.role ?? null} />
        <form
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
          }}
        >
          <select value={loai} onChange={(e) => { setLoai(e.target.value); setPage(0); }} aria-label="Loại phiếu" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px" }}>
            <option value="">Mọi loại</option>
            {LOAI.slice(1).map((l) => <option key={l} value={l}>{loaiPhieuLabel(l as PhieuKho["loai"])}</option>)}
          </select>
          <select value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setPage(0); }} aria-label="Trạng thái" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px" }}>
            <option value="">Mọi trạng thái</option>
            {TRANG.slice(1).map((t) => <option key={t} value={t}>{trangThaiPhieuLabel(t as PhieuKho["trangThai"])}</option>)}
          </select>
        </form>
      </div>
      <div className="mpCard">
        <WhErrorBox error={error} />
        {error && !loading ? (
          <p style={{ marginTop: 8 }}>
            <button className="mpTopBtn primary" type="button" onClick={() => setReloadKey((k) => k + 1)}>Thử lại (giữ bộ lọc)</button>
          </p>
        ) : null}
        {loading ? (
          <p className="mpMuted" role="status">Đang tải chứng từ…</p>
        ) : data && data.data.length === 0 ? (
          <p className="mpMuted" role="status">Chưa có chứng từ nào khớp bộ lọc.</p>
        ) : data ? (
          <>
            <div className="mpTableWrap">
              <table className="mpTable">
                <thead><tr><th>Mã phiếu</th><th>Loại</th><th>Trạng thái</th><th>Kho nguồn → đích</th><th>Liên kết</th><th>Người tạo</th><th style={{ textAlign: "right" }}>Mở</th></tr></thead>
                <tbody>
                  {data.data.map((d) => (
                    <tr key={d.maPhieu}>
                      <td><b>#{d.maPhieu}</b></td>
                      <td>{loaiPhieuLabel(d.loai)}</td>
                      <td><span className="mpPill">{trangThaiPhieuLabel(d.trangThai)}</span></td>
                      <td>{d.maKhoNguon ?? "—"} → {d.maKhoDich ?? "—"}</td>
                      <td>{d.maPhieuLienKet ? `#${d.maPhieuLienKet}` : "—"}</td>
                      <td>{d.nguoiTao ?? "—"}</td>
                      <td style={{ textAlign: "right" }}><button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} disabled={detailLoading === d.maPhieu} onClick={() => openDetail(d.maPhieu)}>{detailLoading === d.maPhieu ? "Đang mở…" : "Chi tiết"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mpMuted" style={{ marginTop: 10 }}>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} phiếu
              {page > 0 ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page - 1)}>Trước</button> : null}
              {page + 1 < data.totalPages ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page + 1)}>Sau</button> : null}
            </p>
          </>
        ) : null}
      </div>
      {detail ? (
        <div className="mpCard rise-in" data-fresh aria-label={`Phiếu #${detail.maPhieu}`}>
          <h2>Phiếu #{detail.maPhieu} · {loaiPhieuLabel(detail.loai)} · {trangThaiPhieuLabel(detail.trangThai)}</h2>
          <p className="mpMuted">
            Lý do: {detail.lyDo ?? "—"} · NCC: {detail.nhaCungCap ?? "—"} ·
            Tạo: {detail.nguoiTao ?? "—"} {detail.ngayTao ?? ""} ·
            Chốt: {detail.nguoiXacNhan ?? "—"} {detail.ngayXacNhan ?? ""}
          </p>
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead><tr><th>SKU</th><th>Số lượng/đếm</th><th>Đơn giá chụp</th><th>Tồn cơ sở</th><th>Phiên bản cơ sở</th></tr></thead>
              <tbody>
                {detail.items.map((it) => (
                  <tr key={it.maSku}>
                    <td><b>#{it.maSku}</b></td>
                    <td>{it.soLuong}</td>
                    <td>{it.donGiaSnapshot ?? "—"}</td>
                    <td>{it.tonCoSo ?? "—"}</td>
                    <td>{it.phienBanCoSo ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.maPhieuLienKet ? (
            <p style={{ marginTop: 8 }}>
              <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => openDetail(detail.maPhieuLienKet as number)}>
                Mở phiếu liên kết #{detail.maPhieuLienKet} (CAN_BANG tự động)
              </button>
            </p>
          ) : null}
        </div>
      ) : null}
    </MerchantShell>
  );
}
