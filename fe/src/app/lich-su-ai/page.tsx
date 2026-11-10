"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import ac from "@/components/account/account-cards.module.css";
import { fetchSearchHistory, deleteSearchHistory, type SearchHistoryEntry } from "@/lib/customer-account-client";

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
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
      <div className={ac.pageWide}>
        {loading ? (
          <section className={ac.card} aria-label="Trạng thái tải">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Lịch sử AI</p>
              <h2 className={ac.title}>Đang tải lịch sử</h2>
            </div>
            <div className={ac.group} role="status">
              <div className={ac.skeleton} />
              <p className={ac.meta}>Đang tải lịch sử tìm kiếm AI…</p>
            </div>
          </section>
        ) : null}

        {error ? (
          <div ref={errorRef} tabIndex={-1} className={ac.card} role="alert">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Lịch sử AI</p>
              <h2 className={ac.title}>Không tải được lịch sử</h2>
            </div>
            <p className={ac.alert}>{error}</p>
            <div className={ac.actions}>
              <button className={ac.secondary} type="button" onClick={load}>
                Thử lại
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && entries.length === 0 ? (
          <section className={`${ac.card} ${ac.empty}`} aria-label="Lịch sử trống">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Lịch sử AI</p>
              <h2 className={ac.title}>Chưa có gì ở đây</h2>
            </div>
            <p className={ac.meta}>Bạn chưa tìm kiếm bằng AI lần nào.</p>
            <div className={ac.actions}>
              <Link className={ac.primary} href="/tim-kiem-ai">
                Trải nghiệm tìm kiếm AI
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && entries.length > 0 ? (
          <section className={ac.card} aria-label="Danh sách lịch sử tìm kiếm">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Lịch sử AI</p>
              <h2 className={ac.title}>Lượt tìm kiếm gần nhất</h2>
              <p className={ac.lead}>{entries.length} lượt · Lưu trên tài khoản</p>
            </div>

            <ul className={ac.list}>
              {entries.map((e) => (
                <li key={e.id}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={ac.chip}>{MODE_LABEL[e.mode] ?? e.mode}</span>
                      {e.query ? (
                        <span style={{ fontWeight: 600, fontSize: 14 }}>“{e.query}”</span>
                      ) : (
                        <span className={ac.meta}>(Tìm bằng tệp ảnh)</span>
                      )}
                    </span>
                    <span className={ac.meta} style={{ display: "block", marginTop: 4 }}>
                      {e.resultCount} kết quả · {formatOccurredAt(e.occurredAt)}
                    </span>
                  </span>

                  <button
                    type="button"
                    className={ac.secondary}
                    disabled={removing === e.id}
                    onClick={() => remove(e.id)}
                    aria-label={`Xóa mục lịch sử ${e.query || e.mode}`}
                  >
                    {removing === e.id ? "Đang xóa…" : "Xóa"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AccountCenterShell>
  );
}
