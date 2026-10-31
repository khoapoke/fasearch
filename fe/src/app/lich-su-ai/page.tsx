"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StitchImage } from "@/components/ui/stitch-image";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { stitchImages } from "@/lib/stitch-assets";
import "@/components/storefront/preview.css";

const FOLDER = "fashionsearch_ai_l_ch_s_t_m_ki_m_ai_nh";

type LocalScan = { url: string; name: string; time: string };

type HistKind = "image" | "text";

const HIST: Array<{ id: string; group: string; kind: HistKind; title: string; sub: string; n: number }> = [
  { id: "h1", group: "Hôm nay", kind: "image", title: "Bộ đồ Streetwear Thu Đông", sub: "Tìm thấy 24 sản phẩm phù hợp (minh họa)", n: 24 },
  { id: "h2", group: "Hôm nay", kind: "text", title: "“Áo polo chất liệu cafe thoáng mát”", sub: "Tìm thấy 18 sản phẩm (minh họa)", n: 18 },
  { id: "h3", group: "Hôm qua", kind: "image", title: "Tìm áo tương tự màu be dáng rộng", sub: "Tìm thấy 12 sản phẩm (minh họa)", n: 12 },
  { id: "h4", group: "Hôm qua", kind: "text", title: "“Set đồ tập gym size L màu đen”", sub: "Tìm thấy 31 sản phẩm (minh họa)", n: 31 },
  { id: "h5", group: "Tuần trước", kind: "image", title: "Quần Tây Co Giãn 4 Chiều Xám", sub: "Tìm thấy 15 sản phẩm (minh họa)", n: 15 },
];

export default function AiHistoryPage() {
  const [scans, setScans] = useState<LocalScan[]>([]);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"all" | HistKind>("all");
  const [gone, setGone] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbs = stitchImages(FOLDER);
  const entries = HIST.filter((h) => !gone.includes(h.id) && (kind === "all" || h.kind === kind));
  const groups = ["Hôm nay", "Hôm qua", "Tuần trước"].map((g) => ({ name: g, rows: entries.filter((h) => h.group === g) })).filter((g) => g.rows.length > 0);

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError("Chỉ nhận ảnh JPEG/PNG thật (quy định máy chủ).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ảnh vượt quá 5MB.");
      return;
    }
    setError("");
    const url = URL.createObjectURL(file);
    setScans((prev) => [{ url, name: file.name, time: new Date().toLocaleString("vi-VN") }, ...prev].slice(0, 6));
  }

  return (
    <StorefrontShell
      active="/lich-su-ai"
      previewNote="Tìm bằng ảnh preview: ảnh chỉ hiển thị trên trình duyệt, chưa gửi đi nhận diện AI hay lưu máy chủ."
    >
      <div className="pvWrap">
        <nav className="pgCrumbs" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span>
          <span aria-current="page">Lịch Sử Tìm Kiếm AI &amp; Ảnh</span>
        </nav>
        <h1 className="pgTitle">Lịch Sử Tìm Kiếm AI &amp; Ảnh</h1>
        <p className="pgSub">Thả ảnh outfit để xem trước — kết quả gợi ý mẫu bên dưới là minh họa, không phải nhận diện AI thật.</p>

        <section className="pvCard" aria-label="Tải ảnh quét mới">
          <div
            className="pvDrop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFiles(e.dataTransfer.files);
            }}
          >
            {scans.length > 0 && scans[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={scans[0].url} alt={`Ảnh vừa tải: ${scans[0].name}`} />
            ) : (
              <p className="hmDropIco" style={{ margin: "0 auto" }}><Icon name="upload" size={24} /></p>
            )}
            <b>Kéo thả ảnh outfit vào đây hoặc chụp trực tiếp</b>
            <p className="mpMuted">JPG/PNG tới 5MB. Ảnh không rời khỏi trình duyệt của bạn.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
              <button className="hmCta hmCtaPrimary" type="button" onClick={() => inputRef.current?.click()}>Tải ảnh lên</button>
              <button className="hmCta hmCtaGhost" type="button" onClick={() => inputRef.current?.click()}>Mở camera</button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png"
              hidden
              aria-label="Chọn ảnh từ thiết bị"
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {error ? <p role="alert" style={{ color: "#ba1a1a", fontSize: 13, marginTop: 8 }}>{error}</p> : null}
          </div>
        </section>

        {scans.length > 0 ? (
          <section className="pvCard" aria-label="Lần quét trong phiên này">
            <h2>Đã quét trong phiên này ({scans.length})</h2>
            <p className="sub">Ảnh preview trên trình duyệt — chưa nhận diện.</p>
            {scans.map((s) => (
              <div className="pvRow" key={s.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt={s.name} className="pvThumb" />
                <div style={{ flex: 1 }}>
                  <b className="name">{s.name}</b>
                  <small>{s.time} · chờ kết nối AI (xem CONTRACT_GAPS)</small>
                </div>
                <button
                  className="hmCta hmCtaGhost"
                  style={{ padding: "8px 14px", fontSize: 12.5 }}
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(s.url);
                    setScans((prev) => prev.filter((x) => x.url !== s.url));
                  }}
                >
                  Xóa ảnh
                </button>
              </div>
            ))}
          </section>
        ) : null}

        <section className="pvCard" aria-label="Lịch sử minh họa">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ marginRight: "auto" }}>Lịch sử minh họa</h2>
            <div className="pvTabs" role="group" aria-label="Lọc loại">
              {(["all", "image", "text"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {k === "all" ? "Tất cả" : k === "image" ? "Bằng hình ảnh" : "Bằng văn bản AI"}
                </button>
              ))}
            </div>
            <button className="hmCta hmCtaGhost" style={{ padding: "8px 14px", fontSize: 12.5 }} type="button" onClick={() => setGone(HIST.map((h) => h.id))}>Xóa toàn bộ lịch sử</button>
          </div>
          <p className="sub">Các mục dưới là dữ liệu minh họa theo bố cục source, không phải lịch sử tìm kiếm thật.</p>
          {groups.length === 0 ? (
            <p className="pgState"><strong>Chưa có thêm lịch sử tìm kiếm nào</strong>Tải ảnh outfit hoặc đặt câu hỏi mô tả phong cách để AI phân tích.</p>
          ) : null}
          {groups.map((g) => (
            <div key={g.name}>
              <p className="hmKicker" style={{ margin: "14px 0 6px" }}>{g.name}</p>
              {g.rows.map((h, i) => (
                <div className="pvRow" key={h.id}>
                  <StitchImage src={thumbs[(i + g.name.length) % Math.max(thumbs.length, 1)]?.src} alt="" className="pvThumb" />
                  <div style={{ flex: 1 }}>
                    <b className="name">{h.kind === "image" ? "Tìm kiếm bằng hình ảnh: " : "Tìm kiếm ngôn ngữ tự nhiên: "}{h.title}</b>
                    <small>{h.sub}</small>
                  </div>
                  <Link className="hmCta hmCtaGhost" style={{ padding: "8px 14px", fontSize: 12.5 }} href="/nam">Tìm lại</Link>
                  <button className="hmCta hmCtaGhost" style={{ padding: "8px 14px", fontSize: 12.5 }} type="button" aria-label={`Xóa mục ${h.title}`} onClick={() => setGone((prev) => [...prev, h.id])}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </section>
      </div>
    </StorefrontShell>
  );
}
