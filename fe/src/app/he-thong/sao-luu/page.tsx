"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminShell } from "@/components/admin/admin-shell";
import "./backup-modal.css";

type Snap = { id: string; time: string; kind: string; size: string };

const SEED: Snap[] = [
  { id: "SNAP-20261013-0200", time: "13/10/2026 02:00", kind: "Toàn phần", size: "4,2 GB" },
  { id: "SNAP-20261012-0200", time: "12/10/2026 02:00", kind: "Toàn phần", size: "4,1 GB" },
  { id: "SNAP-20261011-0200", time: "11/10/2026 02:00", kind: "Gia tăng", size: "312 MB" },
];

export default function BackupPage() {
  const [rows, setRows] = useState<Snap[]>(SEED);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [dangerId, setDangerId] = useState<string | null>(null);

  function backupNow() {
    if (busy) return;
    setBusy(true);
    window.setTimeout(() => {
      setRows((prev) => [
        { id: `SNAP-PREVIEW-${Date.now().toString().slice(-6)}`, time: new Date().toLocaleString("vi-VN"), kind: "Thủ công (preview)", size: "—" },
        ...prev,
      ]);
      setMsg("Đã thêm bản snapshot minh họa vào danh sách preview — KHÔNG có sao lưu thật nào được tạo trên máy chủ.");
      setBusy(false);
    }, 900);
  }

  return (
    <AdminShell
      active="backup"
      crumbs={[{ label: "Hệ thống" }, { label: "Sao lưu & Phục hồi" }]}
      title="Sao lưu & Phục hồi dữ liệu hệ thống"
      tag="SNAPSHOT VAULT"
      lede="Kho bản sao lưu đã lưu trữ. Bản xem trước: nút sao lưu chỉ thêm dòng minh họa, phục hồi/tải về không chạm dữ liệu thật."
      actions={
        <button className="adBtn adBtnPrimary" type="button" onClick={backupNow} disabled={busy}>
          <Icon name="box" size={16} /> {busy ? "Đang tạo preview…" : "Sao lưu ngay (preview)"}
        </button>
      }
      previewNote="Máy chủ chưa có API sao lưu/phục hồi. Mọi bản snapshot dưới đây là minh họa — không tải về, không phục hồi dữ liệu thật."
    >
      <section className="adStats" aria-label="Tổng quan kho lưu trữ">
        <div className="adStat"><div><p>Kho lưu trữ phân tán</p><b>An toàn</b><small className="adStatOk">Minh họa</small></div><span className="adStatIco"><Icon name="shield" size={22} /></span></div>
        <div className="adStat"><div><p>Tất cả snapshot</p><b>{rows.length}</b><small>Minh họa</small></div><span className="adStatIco"><Icon name="box" size={22} /></span></div>
        <div className="adStat"><div><p>Toàn phần</p><b>{rows.filter((r) => r.kind === "Toàn phần").length}</b><small>Minh họa</small></div><span className="adStatIco"><Icon name="check" size={22} /></span></div>
        <div className="adStat"><div><p>Thủ công</p><b>{rows.filter((r) => r.kind.startsWith("Thủ công")).length}</b><small>Preview phiên này</small></div><span className="adStatIco"><Icon name="history" size={22} /></span></div>
      </section>
      {msg ? <p className="adPreviewBar" role="status">{msg}</p> : null}
      <div className="adCard">
        <div className="adTableWrap">
          <table className="adTable">
            <thead>
              <tr><th>Bản sao lưu</th><th>Thời gian tạo</th><th>Loại</th><th>Dung lượng</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><b className="adMono">{r.id}</b></td>
                  <td className="adMono">{r.time}</td>
                  <td><span className="adRole">{r.kind}</span></td>
                  <td className="adMono">{r.size}</td>
                  <td>
                    <div className="adRowBtns">
                      <button className="adBtn" type="button" onClick={() => setMsg(`“Tải về ${r.id}” chỉ là nút minh họa — không có file sao lưu thật để tải.`)}>Tải về</button>
                      <button className="adBtn" type="button" onClick={() => setDangerId(r.id)}>Phục hồi</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {dangerId ? (
        <div className="bkOverlay" data-fresh role="dialog" aria-modal="true" aria-label="Xác nhận phục hồi dữ liệu" onClick={() => setDangerId(null)}>
          <div className="bkModal" data-fresh onClick={(e) => e.stopPropagation()}>
            <div className="bkHead">
              <b>⚠ CẢNH BÁO NGUY HIỂM: Xác nhận phục hồi dữ liệu hệ thống</b>
              <button className="bkX" type="button" aria-label="Đóng" onClick={() => setDangerId(null)}>✕</button>
            </div>
            <div className="bkBody">
              <p>Bạn sắp phục hồi toàn bộ hệ thống từ bản snapshot <b className="adMono">{dangerId}</b>.</p>
              <p className="mpMuted">Đây là bản xem trước — <b>không có phục hồi thật nào xảy ra</b>. Phục hồi dữ liệu thật cần API, phê duyệt và cửa sổ bảo trì (xem CONTRACT_GAPS).</p>
            </div>
            <div className="bkFoot">
              <button className="adBtn" type="button" onClick={() => setDangerId(null)}>Hủy bỏ / Quay lại an toàn</button>
              <button
                className="adBtn"
                type="button"
                style={{ background: "#f3b4b4", borderColor: "#f3b4b4", color: "#7f1d1d" }}
                onClick={() => {
                  setMsg(`“Phục hồi ${dangerId}” bị chặn trong preview — không chạm dữ liệu thật.`);
                  setDangerId(null);
                }}
              >
                Tôi hiểu rủi ro, Phục hồi (bị chặn)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
