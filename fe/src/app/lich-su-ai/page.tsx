"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { fetchSearchHistory, deleteSearchHistory, type SearchHistoryEntry } from "@/lib/customer-account-client";
import "@/components/storefront/preview.css";

const MODE_LABEL: Record<SearchHistoryEntry["mode"], string> = {
  TEXT: "Tìm theo văn bản",
  IMAGE: "Tìm theo ảnh",
  MULTIMODAL: "Tìm đa phương thức",
};

export default function AiHistoryPage() {
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const pg = await fetchSearchHistory(0, 50);
      setEntries(pg.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được lịch sử tìm kiếm.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function remove(id: number) {
    setRemoving(id);
    try {
      await deleteSearchHistory(id);
      setEntries((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được mục lịch sử.");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <StorefrontShell active="/lich-su-ai">
      <div className="sfAccountWrap">
        <h1 className="pgTitle">Lịch sử tìm kiếm AI</h1>
        {loading ? <p className="sfIdentitySub" role="status">Đang tải lịch sử…</p> : null}
        {error ? <p className="sfIdentitySub" role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
        {!loading && !error && entries.length === 0 ? (
          <p className="sfIdentitySub">Chưa có lịch sử tìm kiếm. <Link href="/tim-kiem-ai">Tìm kiếm ngay →</Link></p>
        ) : null}
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {entries.map((e) => (
            <li key={e.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <div style={{ flex: 1 }}>
                <b>{MODE_LABEL[e.mode]}</b>
                {e.query ? <span> · “{e.query}”</span> : null}
                <div className="sfIdentitySub">{e.resultCount} kết quả · {e.status} · {e.occurredAt}</div>
              </div>
              <button type="button" disabled={removing === e.id} onClick={() => remove(e.id)}>
                {removing === e.id ? "Đang xóa…" : "Xóa"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </StorefrontShell>
  );
}
