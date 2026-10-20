"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { readOwnIdentity, type AccountIdentity } from "@/components/account/account-session";
import { beFetch, beWrite } from "@/lib/mgmt-client";
import { parseAiResults, validateLimit, validateQuery, type AiHit } from "@/lib/ai-search";
import {
  AI_MAX_BYTES, checkImageDimensions, describeAiStatus, isPurchasable,
  validateComposed, validateImageFile, type AiMode, type AiStatus,
} from "@/lib/ai-full";
import account from "@/components/account/account.module.css";
import mgmt from "@/components/mgmt/mgmt.module.css";

function AiThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={mgmt.noImg}>Chưa có ảnh AI</span>;
  return (
    <span className={mgmt.cardImg}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; hits: AiHit[]; label: string }
  | { kind: "error"; message: string; status: number };

function statusMessage(status: number, fallback: string): string {
  if (status === 400) return "Yêu cầu chưa hợp lệ (từ khóa 1–200 ký tự, ảnh JPEG/PNG ≤5MiB ≤4000px, số kết quả 1–5). Sửa lại rồi thử tiếp.";
  if (status === 401) return "Phiên đăng nhập đã hết. Đăng nhập lại rồi tìm tiếp.";
  if (status === 403) return "Tài khoản của bạn không có quyền tìm bằng AI (cần CUSTOMER/STAFF/ADMIN).";
  if (status === 502) return "Máy chủ AI trả về không đúng định dạng. Thử lại sau ít phút.";
  if (status === 503) return "AI chưa sẵn sàng (thiếu publication/timeout Qdrant). Giao dịch vẫn chạy độc lập — thử lại sau.";
  return fallback;
}

export function AiTextSearchView() {
  const [me, setMe] = useState<AccountIdentity | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<AiMode>("text");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("5");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<Status>({ kind: "idle" });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const busyRef = useRef(false);
  const reqId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    readOwnIdentity()
      .then((identity) => {
        if (live) {
          setMe(identity);
          setChecking(false);
        }
      })
      .catch(() => {
        if (live) setChecking(false);
      });
    beFetch("v1/ai/status")
      .then(async (r) => {
        if (!r.ok || !live) return;
        try {
          const payload = (await r.json()) as { result?: AiStatus };
          if (payload?.result) setAiStatus(payload.result);
        } catch {
          /* keep null */
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Object URL cleanup: revoke khi file đổi/unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    try {
      validateImageFile(f);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Ảnh chưa hợp lệ.", status: 400 });
      errorRef.current?.focus();
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setState({ kind: "idle" });
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setQuery("");
    setState({ kind: "idle" });
  }

  async function decodeCheck(f: File): Promise<void> {
    const url = URL.createObjectURL(f);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Không đọc được ảnh. Chọn JPEG/PNG khác."));
        img.src = url;
      });
      checkImageDimensions(img.naturalWidth, img.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function run(event?: FormEvent) {
    event?.preventDefault();
    if (busyRef.current) return;
    let n: number;
    try {
      n = validateLimit(limit);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Số kết quả chưa hợp lệ.", status: 400 });
      errorRef.current?.focus();
      return;
    }
    let label = "";
    let path = "";
    let body: unknown = undefined;
    try {
      if (mode === "text") {
        const q = validateQuery(query);
        label = `chữ “${q}”`;
        path = "v1/ai/search/text";
        body = { query: q, limit: n };
      } else if (mode === "image") {
        if (!file) throw new Error("Chọn 1 ảnh JPEG/PNG ≤5MiB để tìm bằng ảnh.");
        validateImageFile(file);
        await decodeCheck(file);
        label = `ảnh “${file.name}”`;
        path = "v1/ai/search/image";
        const fd = new FormData();
        fd.append("file", file);
        fd.append("limit", String(n));
        body = fd;
      } else {
        const { q } = validateComposed(query, file);
        if (!file) throw new Error("Thiếu ảnh.");
        await decodeCheck(file);
        label = `kết hợp ảnh + “${q}”`;
        path = "v1/ai/search/composed";
        const fd = new FormData();
        fd.append("file", file);
        fd.append("query", q);
        fd.append("limit", String(n));
        body = fd;
      }
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Yêu cầu chưa hợp lệ.", status: 400 });
      errorRef.current?.focus();
      return;
    }
    const my = ++reqId.current;
    busyRef.current = true;
    setState({ kind: "loading" });
    try {
      // beWrite giữ CSRF/session; FormData không ép JSON Content-Type.
      const response = await beWrite(path, "POST", body);
      if (reqId.current !== my) return;
      if (response.status === 401 || response.status === 403) {
        setState({
          kind: "error",
          message: response.status === 401
            ? "Phiên đăng nhập đã hết. Đăng nhập lại rồi tìm tiếp."
            : "Tài khoản của bạn không có quyền tìm bằng AI (cần CUSTOMER/STAFF/ADMIN).",
          status: response.status,
        });
        errorRef.current?.focus();
        return;
      }
      if (!response.ok) {
        let fallback = "Tìm kiếm chưa hoàn tất. Giữ nguyên đầu vào rồi thử lại.";
        try {
          const payload = (await response.json()) as { message?: string };
          if (payload.message) fallback = payload.message;
        } catch {
          /* non-JSON */
        }
        setState({ kind: "error", message: statusMessage(response.status, fallback), status: response.status });
        errorRef.current?.focus();
        return;
      }
      const hits = parseAiResults(await response.json());
      setState({ kind: "done", hits, label });
    } catch {
      if (reqId.current !== my) return;
      setState({ kind: "error", message: "Không kết nối được máy chủ. Giữ nguyên đầu vào rồi thử lại.", status: 0 });
      errorRef.current?.focus();
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <StorefrontShell active="/tim-kiem-ai" previewNote="Tìm AI thật qua BE → Python → Qdrant; kết quả thuộc tập dữ liệu AI, chưa phải danh mục giao dịch. Ảnh 16 fixtures cũ là minh họa tổng hợp — đã dán nhãn provenance.">
      <main className={account.layout}>
        <p className={account.kicker}>FaSearch AI</p>
        <h1>Tìm kiếm AI (chữ / ảnh / kết hợp)</h1>
        <p className={account.lede}>
          Chữ giữ nguyên, <b>không tự dịch</b>; mức liên quan tiếng Việt <b>chưa được đánh giá</b>.
          Điểm là tương đồng thô, không phải % chính xác. Mua hàng chỉ khi có liên kết catalog thật.
        </p>
        <p className={account.muted} role="status">{describeAiStatus(aiStatus)}</p>
        {checking ? (
          <p className={account.muted}>Đang kiểm tra phiên đăng nhập…</p>
        ) : !me ? (
          <section className={account.card} aria-label="Cần đăng nhập">
            <p className={account.greeting}>Cần đăng nhập để tìm bằng AI</p>
            <p className={account.muted}>AI chỉ mở cho CUSTOMER/STAFF/ADMIN đã đăng nhập.</p>
            <p>
              <Link className={account.primary} href="/dang-nhap?next=/tim-kiem-ai">
                Đăng nhập →
              </Link>
            </p>
          </section>
        ) : (
          <>
            <div className="pvTabs" role="group" aria-label="Chế độ tìm">
              {(["text", "image", "composed"] as AiMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setState({ kind: "idle" }); }}>
                  {m === "text" ? "Chữ" : m === "image" ? "Ảnh" : "Kết hợp"}
                </button>
              ))}
            </div>
            <form method="post" className={mgmt.toolbar} aria-label="Tìm bằng AI" onSubmit={run}>
              {mode !== "image" ? (
                <label style={{ flex: 2, minWidth: 220 }}>
                  Từ khóa {mode === "composed" ? "(bắt buộc kèm ảnh)" : ""}
                  <input
                    name="q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="black shirt"
                    maxLength={200}
                    autoComplete="off"
                  />
                </label>
              ) : null}
              {mode !== "text" ? (
                <label>
                  Ảnh JPEG/PNG ≤{Math.round(AI_MAX_BYTES / 1024 / 1024)}MiB
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png" onChange={(e) => onFile(e.target.files)} aria-label="Ảnh tìm kiếm" />
                </label>
              ) : null}
              <label>
                Số kết quả (1–5)
                <input name="limit" value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" maxLength={1} style={{ width: 72 }} />
              </label>
              <button className={account.primary} type="submit" disabled={state.kind === "loading"}>
                {state.kind === "loading" ? "Đang tìm…" : "Tìm"}
              </button>
              {(file || query) ? (
                <button className={account.primary} type="button" onClick={reset} style={{ background: "#fff", color: "var(--ink)", border: "1px solid var(--line)" }}>
                  Xóa/Hủy
                </button>
              ) : null}
            </form>
            {previewUrl ? (
              <p className={account.muted}>
                Xem trước:{" "}
                {/* eslint-disable-next-line @next/next/no-img-element -- object URL preview, không qua Image optimizer */}
                <img src={previewUrl} alt={`Xem trước ${file?.name ?? ""}`} style={{ maxHeight: 120, borderRadius: 8, verticalAlign: "middle" }} />{" "}
                {file?.name} · {(file ? (file.size / 1024).toFixed(0) : 0)}KB
              </p>
            ) : null}
            {state.kind === "loading" && <p className={account.muted} role="status">Đang tìm trong tập dữ liệu AI… (giao dịch vẫn chạy độc lập)</p>}
            {state.kind === "error" && (
              <section ref={errorRef} tabIndex={-1} className={account.card} aria-label="Lỗi tìm kiếm">
                <p className={account.greeting}>{state.status === 401 ? "Hết phiên đăng nhập" : "Không tìm được lúc này"}</p>
                <p className={account.muted}>{state.message}</p>
                <p style={{ display: "flex", gap: 8 }}>
                  {state.status === 401 ? (
                    <Link className={account.primary} href="/dang-nhap?next=/tim-kiem-ai">Đăng nhập lại →</Link>
                  ) : (
                    <button className={account.primary} type="button" onClick={() => run()}>Thử lại (giữ đầu vào)</button>
                  )}
                </p>
              </section>
            )}
            {state.kind === "done" && state.hits.length === 0 && (
              <p className={account.muted} role="status">
                Không có kết quả AI nào cho {state.label} — đây là tập rỗng hợp lệ, khác với index chưa build (503).
              </p>
            )}
            {state.kind === "done" && state.hits.length > 0 && (
              <>
                <p className={account.muted} role="status">
                  {state.hits.length} kết quả AI cho {state.label} — giữ đúng thứ tự máy chủ.
                </p>
                <div className={mgmt.cards}>
                  {state.hits.map((h, i) => (
                    <article
                      key={h.sourceId}
                      className={`${mgmt.card} stagger-item`}
                      style={{ "--stagger-index": Math.min(i, 7) } as React.CSSProperties}
                      aria-label={`Kết quả AI ${h.sourceId}`}
                    >
                      <AiThumb src={h.imageUrl} alt={`Ảnh AI: ${h.fileName}`} />
                      <div className={mgmt.cardBody}>
                        <span className={mgmt.cardTitle}>Mã AI: {h.sourceId}</span>
                        <span className={mgmt.cardPrice}>Điểm tương đồng: {h.score}</span>
                        <span className={mgmt.cardMeta}>Tệp: {h.fileName}</span>
                        <span className={mgmt.cardMeta}>Danh mục AI: {h.catalog ?? "—"}</span>
                        <span className={mgmt.cardMeta}>Nguồn: {h.nguonDuLieu ?? "tập dữ liệu AI"} · bản {h.phienBanDuLieu ?? "—"}</span>
                        {isPurchasable({ maSpLienKet: h.maSpLienKet } as never) ? (
                          <Link className={account.primary} href={`/san-pham/${h.maSpLienKet}`}>Xem catalog liên kết →</Link>
                        ) : (
                          <span className={mgmt.cardMeta}>Chưa liên kết catalog — không mua được (không tự suy giá/kho).</span>
                        )}
                        <button
                          className={account.primary}
                          type="button"
                          aria-expanded={openId === h.sourceId}
                          onClick={() => setOpenId(openId === h.sourceId ? null : h.sourceId)}
                          style={{ background: "#fff", color: "var(--ink)", border: "1px solid var(--line)", marginTop: 6 }}
                        >
                          {openId === h.sourceId ? "Thu gọn nguồn" : "Chi tiết nguồn (read-only)"}
                        </button>
                        {openId === h.sourceId ? (
                          <span className={mgmt.cardMeta}>
                            Hiển thị: {h.tenHienThi ?? "—"} · thuộc tính: {typeof h.thuocTinh === "string" ? h.thuocTinh : JSON.stringify(h.thuocTinh ?? null)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
            <p className={account.muted} style={{ marginTop: 12 }}>
              Kết quả thuộc tập dữ liệu AI (phân biệt với danh mục bán) — ảnh thật qua proxy xác thực,
              thiếu/hỏng hiện chữ giữ chỗ. 16 ảnh demo cũ là hình tổng hợp, không dùng để claim ảnh thật.
            </p>
            <p className={account.muted}>
              Lịch sử minh họa vẫn ở <Link href="/lich-su-ai">Lịch sử tìm kiếm AI &amp; Ảnh →</Link>
            </p>
          </>
        )}
      </main>
    </StorefrontShell>
  );
}
