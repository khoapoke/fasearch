"use client";

import { useEffect, useState } from "react";
import { MerchantShell } from "@/components/merchant/merchant-shell";
import { WhAuthNote, WhErrorBox, toWhError } from "@/components/merchant/wh";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { unwrap, whFetch, whWrite, type CanhBao, type Page, type WhError } from "@/lib/wh-client";

export default function AlertsPage() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [active, setActive] = useState("");
  const [read, setRead] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<CanhBao> | null>(null);
  const [error, setError] = useState<WhError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [acked, setAcked] = useState<number[]>([]);
  const viewKey = `${active}|${read}|${page}`;

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
    if (active) query.set("dangHoatDong", active);
    if (read) query.set("daDoc", read);
    whFetch(`v1/kho/canh-bao?${query.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          if (live) {
            setError(await toWhError(r));
            setData(null);
            setLoadedKey(viewKey);
          }
          return;
        }
        const pg = await unwrap<Page<CanhBao>>(r);
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

  async function ack(id: number) {
    const r = await whWrite(`v1/kho/canh-bao/${id}/da-doc`, "POST");
    if (!r.ok) {
      setError(await toWhError(r));
      return;
    }
    await unwrap(r);
    // Đọc là trạng thái riêng — không đóng episode, không mở lại.
    setAcked((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setData((prev) =>
      prev ? { ...prev, data: prev.data.map((a) => (a.maTb === id ? { ...a, daDoc: true } : a)) } : prev,
    );
  }

  return (
    <MerchantShell active="alerts">
      <div className="mpCard">
        <h2>Cảnh báo tồn thấp</h2>
        <p className="mpMuted">
          Mỗi ô SKU×kho chỉ có một episode hoạt động. Đánh dấu đã đọc không đóng
          episode; tồn vượt ngưỡng mới đóng (phục hồi).
        </p>
        <WhAuthNote role={me?.role ?? null} />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <select value={active} onChange={(e) => { setActive(e.target.value); setPage(0); }} aria-label="Episode hoạt động" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px" }}>
            <option value="">Mọi episode</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã phục hồi</option>
          </select>
          <select value={read} onChange={(e) => { setRead(e.target.value); setPage(0); }} aria-label="Trạng thái đọc" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "9px 12px" }}>
            <option value="">Đã đọc + chưa đọc</option>
            <option value="false">Chưa đọc</option>
            <option value="true">Đã đọc</option>
          </select>
        </div>
      </div>
      <div className="mpCard">
        <WhErrorBox error={error} />
        {loading ? (
          <p className="mpMuted" role="status">Đang tải cảnh báo…</p>
        ) : data && data.data.length === 0 ? (
          <p className="mpMuted" role="status">Không có cảnh báo nào khớp bộ lọc.</p>
        ) : data ? (
          <>
            <div className="mpTableWrap">
              <table className="mpTable">
                <thead><tr><th>Mã TB</th><th>SKU × Kho</th><th>Ngưỡng</th><th>Tồn kích hoạt</th><th>Phục hồi</th><th>Episode</th><th>Đọc</th><th style={{ textAlign: "right" }}>Ack</th></tr></thead>
                <tbody>
                  {data.data.map((a) => (
                    <tr key={a.maTb}>
                      <td><b>#{a.maTb}</b></td>
                      <td>#{a.maSku} × #{a.maKho}</td>
                      <td>{a.nguong}</td>
                      <td><b>{a.tonKichHoat}</b></td>
                      <td>{a.tonPhucHoi ?? "—"}</td>
                      <td>
                        {a.dangHoatDong ? <span className="mpPill mpPillWarn">Đang hoạt động</span> : <span className="mpPill">Đã phục hồi</span>}
                      </td>
                      <td>{a.daDoc ? "Đã đọc" : "Chưa đọc"}</td>
                      <td style={{ textAlign: "right" }}>
                        {!a.daDoc ? (
                          <button className="mpTopBtn" style={{ padding: "7px 12px", fontSize: 12.5 }} onClick={() => ack(a.maTb)}>
                            {acked.includes(a.maTb) ? "Đã đọc ✓" : "Đánh dấu đã đọc"}
                          </button>
                        ) : (
                          <span className="mpMuted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mpMuted" style={{ marginTop: 10 }}>
              Trang {data.page + 1}/{Math.max(data.totalPages, 1)} — {data.totalElements} cảnh báo
              {page > 0 ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page - 1)}>Trước</button> : null}
              {page + 1 < data.totalPages ? <button className="mpTopBtn" style={{ marginLeft: 8 }} onClick={() => setPage(page + 1)}>Sau</button> : null}
            </p>
          </>
        ) : null}
      </div>
    </MerchantShell>
  );
}
