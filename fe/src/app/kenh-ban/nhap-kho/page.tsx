"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import {
  loaiPhieuLabel,
  newKhoaTam,
  trangThaiPhieuLabel,
  unwrap,
  whFetch,
  whWrite,
  type KhoDiaDiem,
  type Page,
  type PhieuKho,
  type WhError,
} from "@/lib/wh-client";

type DraftItem = { ref: string; qty: string; price: string };

function toItems(rows: DraftItem[]) {
  return rows
    .filter((r) => r.ref.trim() && Number(r.qty) > 0)
    .map((r) => {
      const ref = r.ref.trim();
      const base: Record<string, unknown> = /^\d+$/.test(ref)
        ? { maSku: Number(ref) }
        : { maVach: ref };
      base.soLuong = Number(r.qty);
      if (r.price.trim()) base.donGia = Number(r.price);
      return base;
    });
}

export default function ReceiptPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [tab, setTab] = useState<"nhap" | "xuat">("nhap");
  const [locs, setLocs] = useState<KhoDiaDiem[]>([]);
  const [docs, setDocs] = useState<PhieuKho[]>([]);
  const [detail, setDetail] = useState<PhieuKho | null>(null);
  const [error, setError] = useState<WhError | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [khoDich, setKhoDich] = useState("");
  const [khoNguon, setKhoNguon] = useState("");
  const [ncc, setNcc] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [rows, setRows] = useState<DraftItem[]>([{ ref: "", qty: "", price: "" }]);
  // Khóa thao tác gắn với vòng đời thao tác, không phải render: "" cho tới khi
  // người dùng bấm tạo (SSR/khách đầu render giống hệt nhau, không mismatch).
  // Giữ nguyên khóa qua rerender/retry/timeout; payload đổi → khóa mới.
  const [opKey, setOpKey] = useState("");
  const [opSig, setOpSig] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  function payloadSig(): string {
    const items = toItems(rows);
    return JSON.stringify({
      tab,
      kho: tab === "nhap" ? khoDich : khoNguon,
      ncc: ncc.trim(),
      lyDo: lyDo.trim(),
      items,
    });
  }

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
    whFetch("v1/kho/dia-diem")
      .then(async (r) => {
        if (!r.ok) return;
        const list = await unwrap<KhoDiaDiem[]>(r);
        if (live) {
          setLocs(list);
          const def = list.find((l) => l.laMacDinh) ?? list[0];
          if (def) {
            setKhoDich((v) => v || String(def.maKho));
            setKhoNguon((v) => v || String(def.maKho));
          }
        }
      })
      .catch(() => {});
    whFetch(`v1/kho/phieu?page=0&size=10&loai=${tab === "nhap" ? "NHAP_NCC" : "XUAT_HUY"}`)
      .then(async (r) => {
        if (!r.ok) {
          if (live) setError(await toWhError(r));
          return;
        }
        const pg = await unwrap<Page<PhieuKho>>(r);
        if (live) {
          setDocs(pg.data);
          setError(null);
        }
      })
      .catch(() => {
        if (live) setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
      });
    return () => {
      live = false;
    };
  }, [tab, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function create() {
    if (busy) return;
    const items = toItems(rows);
    if (items.length === 0) {
      setError({ status: 0, code: "LOCAL", message: "Nhập ít nhất một dòng SKU/mã vạch với số lượng > 0.", errors: [] });
      return;
    }
    if (tab === "xuat" && !lyDo.trim()) {
      setError({ status: 0, code: "LOCAL", message: "Xuất hủy bắt buộc ghi lý do hàng lỗi/hỏng thật.", errors: [] });
      return;
    }
    // Payload đổi so với lúc sinh khóa → sinh khóa mới (contract: cùng key +
    // canonical khác → 409). Bấm lại/timeout giữ nguyên khóa → replay an toàn.
    const sig = payloadSig();
    let key = opKey;
    if (!key || sig !== opSig) {
      key = newKhoaTam();
      setOpKey(key);
      setOpSig(sig);
    }
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const body: Record<string, unknown> =
        tab === "nhap"
          ? { maKhoDich: Number(khoDich), items, khoaTam: key, nhaCungCap: ncc.trim() || undefined, lyDo: lyDo.trim() || undefined }
          : { maKhoNguon: Number(khoNguon), items, khoaTam: key, lyDo: lyDo.trim() };
      const r = await whWrite(`v1/kho/phieu/${tab}`, "POST", body);
      if (!r.ok) {
        setError(await toWhError(r));
      } else {
        const doc = await unwrap<PhieuKho>(r);
        setDetail(doc);
        setNotice(
          r.status === 200
            ? `Khóa ${key} đã tồn tại — máy chủ trả lại phiếu #${doc.maPhieu} cũ, không tạo mới, không động tồn thêm.`
            : `Đã tạo bản nháp #${doc.maPhieu}. Tạo nháp không làm đổi tồn kho.`,
        );
        reload();
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  function newDraft() {
    setRows([{ ref: "", qty: "", price: "" }]);
    setNcc("");
    setLyDo("");
    setDetail(null);
    setNotice("");
    setError(null);
    // Phiếu mới = thao tác mới → khóa mới ở lần tạo tiếp theo.
    setOpKey("");
    setOpSig("");
  }

  async function openDetail(id: number) {
    setBusy(true);
    try {
      const r = await whFetch(`v1/kho/phieu/${id}`);
      if (!r.ok) setError(await toWhError(r));
      else {
        setDetail(await unwrap<PhieuKho>(r));
        setError(null);
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(id: number) {
    if (busy) return;
    if (!window.confirm(`Xác nhận phiếu #${id}? Tồn kho đổi ngay trong một transaction, không sửa được sau chốt.`)) return;
    setBusy(true);
    try {
      const r = await whWrite(`v1/kho/phieu/${id}/xac-nhan`, "POST");
      if (!r.ok) setError(await toWhError(r));
      else {
        const doc = await unwrap<PhieuKho>(r);
        setDetail(doc);
        setNotice(`Phiếu #${id} đã chốt. Gửi xác nhận lặp lại trả cùng kết quả, không hiệu ứng mới.`);
        reload();
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: number) {
    if (busy) return;
    if (!window.confirm(`Hủy bản nháp #${id}? Chỉ nháp mới hủy được.`)) return;
    setBusy(true);
    try {
      const r = await whWrite(`v1/kho/phieu/${id}/huy`, "POST");
      if (!r.ok) setError(await toWhError(r));
      else {
        setDetail(await unwrap<PhieuKho>(r));
        setNotice(`Đã hủy bản nháp #${id}.`);
        reload();
      }
    } catch {
      setError({ status: 0, code: "NETWORK", message: "Không kết nối được máy chủ kho.", errors: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <MerchantShell active="stock">
      <div className="mpCard">
        <h2>Nhập kho &amp; Xuất hủy (phiếu thật)</h2>
        <p className="mpMuted">STAFF/ADMIN. Tạo nháp không động tồn; chốt mới đổi tồn trong một transaction. Khóa thao tác hiện tại: <b style={{ fontFamily: "monospace" }}>{opKey || "— chưa có (sinh khi bấm Tạo bản nháp) —"}</b></p>
        <WhAuthNote role={me?.role ?? null} />
        <div className="pvTabs" role="tablist" aria-label="Loại phiếu" style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" role="tab" aria-selected={tab === "nhap"} className="mpTopBtn" style={tab === "nhap" ? { borderColor: "var(--accent)", color: "var(--brand)" } : undefined} onClick={() => { setTab("nhap"); setDetail(null); setNotice(""); }}>Nhập NCC</button>
          <button type="button" role="tab" aria-selected={tab === "xuat"} className="mpTopBtn" style={tab === "xuat" ? { borderColor: "var(--accent)", color: "var(--brand)" } : undefined} onClick={() => { setTab("xuat"); setDetail(null); setNotice(""); }}>Xuất hủy hàng lỗi</button>
        </div>
      </div>

      <WhErrorBox error={error} />
      {error && error.status === 409 ? (
        <p style={{ marginTop: 8 }}>
          <button className="mpTopBtn primary" type="button" disabled={busy} onClick={reload}>Tải lại danh sách rồi đếm lại</button>
        </p>
      ) : null}
      {notice ? <p className="mpPreviewBar" role="status">{notice}</p> : null}

      <div className="mpCard" aria-label="Tạo bản nháp">
        <h2>Tạo bản nháp {tab === "nhap" ? "nhập NCC" : "xuất hủy"}</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "10px 0" }}>
          {tab === "nhap" ? (
            <label>Kho đích
              <select value={khoDich} onChange={(e) => setKhoDich(e.target.value)} style={{ display: "block", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }}>
                {locs.map((l) => <option key={l.maKho} value={l.maKho}>{l.tenKho}{l.trangThai !== "HOAT_DONG" ? " (NGƯNG)" : ""}</option>)}
              </select>
            </label>
          ) : (
            <label>Kho nguồn
              <select value={khoNguon} onChange={(e) => setKhoNguon(e.target.value)} style={{ display: "block", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }}>
                {locs.map((l) => <option key={l.maKho} value={l.maKho}>{l.tenKho}{l.trangThai !== "HOAT_DONG" ? " (NGƯNG)" : ""}</option>)}
              </select>
            </label>
          )}
          {tab === "nhap" ? (
            <label>Nhà cung cấp (tên tóm tắt)
              <input value={ncc} onChange={(e) => setNcc(e.target.value)} maxLength={255} placeholder="May Mặc An Phước" style={{ display: "block", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }} />
            </label>
          ) : null}
          <label style={{ flex: 1, minWidth: 220 }}>Lý do{tab === "xuat" ? " (bắt buộc — mô tả hàng lỗi/hỏng thật)" : ""}
            <input value={lyDo} onChange={(e) => setLyDo(e.target.value)} maxLength={1000} placeholder={tab === "xuat" ? "Rách vai, ẩm mốc…" : "Nhập hàng mùa mới…"} style={{ display: "block", width: "100%", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", marginTop: 4 }} />
          </label>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <input value={r.ref} onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, ref: e.target.value } : x)))} placeholder="maSku hoặc mã vạch" aria-label={`Dòng ${i + 1} SKU/mã vạch`} style={{ flex: "2 1 160px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} />
            <input value={r.qty} onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="SL" aria-label={`Dòng ${i + 1} số lượng`} inputMode="numeric" style={{ flex: "1 1 80px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} />
            <input value={r.price} onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} placeholder="Đơn giá (tùy chọn)" aria-label={`Dòng ${i + 1} đơn giá`} inputMode="decimal" style={{ flex: "1 1 80px", minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px" }} />
            <button className="mpTopBtn" type="button" aria-label={`Xóa dòng ${i + 1}`} onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button className="mpTopBtn" type="button" onClick={() => setRows((prev) => [...prev, { ref: "", qty: "", price: "" }])}>+ Thêm dòng</button>
          <button className="mpTopBtn primary" type="button" disabled={busy} onClick={create}>{busy ? "Đang gửi…" : "Tạo bản nháp"}</button>
          <button className="mpTopBtn" type="button" onClick={newDraft}>Phiếu mới (khóa mới)</button>
        </div>
      </div>

      {detail ? (
        <div className="mpCard" aria-label={`Phiếu #${detail.maPhieu}`}>
          <h2>Phiếu #{detail.maPhieu} · {loaiPhieuLabel(detail.loai)} · {trangThaiPhieuLabel(detail.trangThai)}</h2>
          <p className="mpMuted">
            Nguồn: {detail.maKhoNguon ?? "—"} · Đích: {detail.maKhoDich ?? "—"} ·
            NCC: {detail.nhaCungCap ?? "—"} · Lý do: {detail.lyDo ?? "—"} ·
            Liên kết: {detail.maPhieuLienKet ?? "—"}
          </p>
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead><tr><th>SKU</th><th>Số lượng</th><th>Đơn giá chụp</th><th>Tồn cơ sở</th><th>Phiên bản cơ sở</th></tr></thead>
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
          {detail.trangThai === "BAN_NHAP" ? (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="mpTopBtn primary" type="button" disabled={busy} onClick={() => confirm(detail.maPhieu)}>Xác nhận (chốt tồn)</button>
              <button className="mpTopBtn" type="button" disabled={busy} onClick={() => cancel(detail.maPhieu)}>Hủy nháp</button>
            </div>
          ) : (
            <p className="mpMuted" style={{ marginTop: 10 }}>Phiếu đã chốt/hủy là bất biến — sai thì lập phiếu mới liên kết, không sửa.</p>
          )}
        </div>
      ) : null}

      <div className="mpCard">
        <h2>Phiếu gần đây ({tab === "nhap" ? "Nhập NCC" : "Xuất hủy"})</h2>
        <StatusTabs docs={docs} />
        {docs.length === 0 ? (
          <p className="mpMuted">Chưa có phiếu nào (hoặc chưa đăng nhập — lỗi 401/403 hiện ở trên).</p>
        ) : (
          <div className="mpTableWrap">
            <table className="mpTable">
              <thead><tr><th>Mã phiếu</th><th>Nhà cung cấp / Lý do</th><th>Trạng thái</th><th>Kho nguồn/đích</th><th>Dòng</th><th>Tổng chụp</th><th>Người tạo</th><th style={{ textAlign: "right" }}>Mở</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.maPhieu}>
                    <td><b>#{d.maPhieu}</b></td>
                    <td style={{ maxWidth: 220 }}>{d.nhaCungCap ?? d.lyDo ?? "—"}</td>
                    <td><span className="mpPill">{trangThaiPhieuLabel(d.trangThai)}</span></td>
                    <td>{d.maKhoNguon ?? "—"} → {d.maKhoDich ?? "—"}</td>
                    <td>{d.items.length}</td>
                    <td>{docValue(d)}</td>
                    <td>{d.nguoiTao ?? "—"}</td>
                    <td style={{ textAlign: "right" }}><button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => openDetail(d.maPhieu)}>Chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MerchantShell>
  );
}

function StatusTabs({ docs }: { docs: import("@/lib/wh-client").PhieuKho[] }) {
  const n = (t: string) => docs.filter((d) => d.trangThai === t).length;
  return (
    <div className="pvTabs" style={{ display: "flex", gap: 8, marginBottom: 10 }} aria-label="Đếm trạng thái trang này">
      <span className="pgChip">Tất cả ({docs.length})</span>
      <span className="pgChip">Bản nháp ({n("BAN_NHAP")})</span>
      <span className="pgChip">Đã xác nhận ({n("DA_XAC_NHAN")})</span>
      <span className="pgChip">Đã hủy ({n("DA_HUY")})</span>
      <span className="mpMuted" style={{ fontSize: 12 }}>— đếm trong danh sách đang hiện</span>
    </div>
  );
}

function docValue(d: import("@/lib/wh-client").PhieuKho): string {
  const sum = d.items.reduce((n, it) => n + (it.donGiaSnapshot ?? 0) * it.soLuong, 0);
  const any = d.items.some((it) => it.donGiaSnapshot != null);
  if (!any) return "—";
  return sum.toLocaleString("vi-VN") + "đ (tổng đơn giá chụp)";
}
