"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { unwrap, whFetch, type Page, type TonKho, type WhError } from "@/lib/wh-client";

export default function TonKhoPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [q, setQ] = useState("");
  const [maSku, setMaSku] = useState("");
  const [maKho, setMaKho] = useState("");
  const [tonThap, setTonThap] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<TonKho> | null>(null);
  const [error, setError] = useState<WhError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const viewKey = `${q}|${maSku}|${maKho}|${tonThap}|${page}|${reloadKey}`;
  const loading = loadedKey !== viewKey;

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
    if (q.trim()) query.set("q", q.trim());
    if (maSku.trim()) query.set("maSku", maSku.trim());
    if (maKho.trim()) query.set("maKho", maKho.trim());
    if (tonThap) query.set("tonThap", "true");
    whFetch(`v1/kho/ton?${query.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          if (live) {
            setError(await toWhError(r));
            setData(null);
            setLoadedKey(viewKey);
          }
          return;
        }
        const result = await unwrap<Page<TonKho>>(r);
        if (live) {
          setData(result);
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
  }, [q, maSku, maKho, tonThap, page, reloadKey, viewKey]);

  return (
    <MerchantShell active="inventory">
      <div className="mpCard">
        <h2>Tồn kho theo SKU × địa điểm</h2>
        <p className="mpMuted">Khả dụng = tồn thực − giữ chỗ. Ô chưa phát sinh dòng hiện 200 số 0; SKU/kho lạ báo 404.</p>
        <WhAuthNote role={me?.role ?? null} />
        <form
          style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setReloadKey((k) => k + 1);
          }}
        >
          <div className="mpSearch" style={{ maxWidth: 220 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã vạch/màu/cỡ…" aria-label="Tìm theo mã vạch, màu, cỡ" />
          </div>
          <div className="mpSearch" style={{ maxWidth: 130 }}>
            <input value={maSku} onChange={(e) => setMaSku(e.target.value)} placeholder="maSku" aria-label="Mã SKU" inputMode="numeric" />
          </div>
          <div className="mpSearch" style={{ maxWidth: 130 }}>
            <input value={maKho} onChange={(e) => setMaKho(e.target.value)} placeholder="maKho" aria-label="Mã kho" inputMode="numeric" />
          </div>
          <label className="mpTopBtn" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={tonThap} onChange={(e) => setTonThap(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Tồn thấp
          </label>
          <button className="mpTopBtn primary" type="submit">Tìm</button>
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
          <p className="mpMuted" role="status">Đang tải tồn kho…</p>
        ) : data && data.data.length === 0 ? (
          <p className="mpMuted" role="status">Không có dòng tồn nào khớp — thử nới điều kiện tìm.</p>
        ) : data ? (
          <>
            <div className="mpTableWrap">
              <table className="mpTable">
                <thead>
                  <tr><th>SKU</th><th>Biến thể / Mã vạch</th><th>Kho</th><th>Thực</th><th>Giữ chỗ</th><th>Khả dụng</th><th>Ngưỡng</th><th>Phiên bản</th></tr>
                </thead>
                <tbody>
                  {data.data.map((t) => (
                    <tr key={`${t.maSku}-${t.maKho}`}>
                      <td><b>#{t.maSku}</b></td>
                      <td>{t.mauSac} / {t.kichCo}<p className="mpMuted" style={{ fontFamily: "monospace", fontSize: 11.5 }}>{t.maVach}</p></td>
                      <td>{t.tenKho} <span className="mpMuted">#{t.maKho}</span></td>
                      <td><b>{t.soLuongThuc}</b></td>
                      <td>{t.soLuongGiuCho}</td>
                      <td><b>{t.soLuongKhaDung}</b></td>
                      <td>{t.nguongToiThieu ?? "—"}</td>
                      <td className="adMono">v{t.phienBan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mpMuted" style={{ marginTop: 10 }}>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} dòng
              {page > 0 ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page - 1)}>Trước</button> : null}
              {page + 1 < data.totalPages ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page + 1)}>Sau</button> : null}
            </p>
          </>
        ) : null}
      </div>
    </MerchantShell>
  );
}
