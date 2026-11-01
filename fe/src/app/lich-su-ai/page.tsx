"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchSearchHistory, deleteSearchHistory, type SearchHistoryEntry } from "@/lib/customer-account-client";
import "@/components/storefront/storefront.css";

const MODE_LABEL: Record<SearchHistoryEntry["mode"], string> = {
  TEXT: "Tìm bằng văn bản",
  IMAGE: "Tìm bằng ảnh",
  MULTIMODAL: "Tìm kết hợp văn bản + ảnh",
};

function formatOccurredAt(dateStr: string): string {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function AiHistoryPage() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pg = await fetchSearchHistory(0, 50);
      setEntries(pg.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử tìm kiếm.");
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    setRemoving(id);
    try {
      await deleteSearchHistory(id);
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được mục lịch sử.");
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <AccountCenterShell active="/lich-su-ai" title="Lịch sử tìm kiếm AI">
      {loading ? (
        <section className="sfSideCard" aria-label="Trạng thái tải">
          <p className="sfIdentitySub" role="status">Đang tải lịch sử tìm kiếm AI…</p>
        </section>
      ) : null}

      {error ? (
        <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert" style={{ borderLeft: "3px solid #b42318" }}>
          <b>Lỗi tải dữ liệu</b>
          <p className="sfIdentitySub" style={{ color: "#b42318", marginTop: 4 }}>{error}</p>
          <button className="hmCta hmCtaGhost" type="button" onClick={load} style={{ marginTop: 10 }}>
            Thử lại
          </button>
        </div>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <section className="sfSideCard" aria-label="Lịch sử trống">
          <b>Chưa có lịch sử tìm kiếm</b>
          <p className="sfIdentitySub" style={{ marginTop: 6, marginBottom: 16 }}>
            Các lượt tìm kiếm bằng mô tả văn bản, hình ảnh hoặc đa phương thức trên máy chủ AI sẽ được lưu trữ tại đây.
          </p>
          <Link className="hmCta hmCtaPrimary" href="/tim-kiem-ai" style={{ display: "inline-block" }}>
            Trải nghiệm tìm kiếm AI →
          </Link>
        </section>
      ) : null}

      {!loading && entries.length > 0 ? (
        <section className="sfSideCard" aria-label="Danh sách lịch sử tìm kiếm">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <b>{entries.length} lượt tìm kiếm gần nhất</b>
            <span className="sfIdentitySub">Lưu trên tài khoản</span>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--st-line, #eee)",
                  backgroundColor: "var(--st-card, #ffffff)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 4,
                        backgroundColor: "var(--st-citron, #d6ef72)",
                        color: "#20211f",
                      }}
                    >
                      {MODE_LABEL[e.mode] ?? e.mode}
                    </span>
                    {e.query ? (
                      <span style={{ fontWeight: 600, fontSize: 14 }}>“{e.query}”</span>
                    ) : (
                      <span className="sfIdentitySub" style={{ fontSize: 13 }}>(Tìm bằng tệp ảnh)</span>
                    )}
                  </div>
                  <div className="sfIdentitySub" style={{ marginTop: 4, fontSize: 12 }}>
                    {e.resultCount} kết quả · {formatOccurredAt(e.occurredAt)}
                  </div>
                </div>

                <button
                  type="button"
                  className="hmCta hmCtaGhost"
                  disabled={removing === e.id}
                  onClick={() => remove(e.id)}
                  style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }}
                  aria-label={`Xóa mục lịch sử ${e.query || e.mode}`}
                >
                  {removing === e.id ? "Đang xóa…" : "Xóa"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AccountCenterShell>
  );
}
