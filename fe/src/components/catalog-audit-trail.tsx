"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./catalog-audit-trail.module.css";

type AuditEntry = {
  event_id: string;
  action: string;
  created_at: string;
  product_id: string;
  previous_version_id: string | null;
  new_version_id: string | null;
  previous_version_no: number | null;
  new_version_no: number | null;
  trace_id: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  CATALOG_DRAFT_CREATED: "Tạo sản phẩm nháp",
  CATALOG_DRAFT_REVISED: "Sửa thông tin",
  CATALOG_PRIMARY_IMAGE_REPLACED: "Thay ảnh chính",
};

export function CatalogAuditTrail({
  productId,
  currentVersion,
}: {
  productId: string;
  currentVersion: number;
}) {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchAudit = useCallback(
    async (signal?: AbortSignal): Promise<AuditEntry[]> => {
      const response = await fetch(
        `/api/catalog/drafts/${encodeURIComponent(productId)}/audit?limit=100`,
        { cache: "no-store", signal },
      );
      if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
      if (response.status === 403) throw new Error("Tài khoản này không có quyền xem nhật ký thay đổi.");
      if (response.status === 404) throw new Error("Sản phẩm nháp không tồn tại.");
      if (!response.ok) throw new Error("Không thể tải nhật ký thay đổi. Hãy thử lại.");
      const value = (await response.json()) as { items: AuditEntry[] };
      return value.items;
    },
    [productId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchAudit());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải nhật ký thay đổi.");
    } finally {
      setLoading(false);
    }
  }, [fetchAudit]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAudit(controller.signal)
      .then((value) => setItems(value))
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(failure instanceof Error ? failure.message : "Không thể tải nhật ký thay đổi.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // currentVersion intentionally refetches after each new saved version.
  }, [fetchAudit, currentVersion]);

  function lineage(entry: AuditEntry): string {
    if (entry.previous_version_no != null && entry.new_version_no != null) {
      return `Bản ${entry.previous_version_no} → bản ${entry.new_version_no}`;
    }
    if (entry.new_version_no != null) {
      return `Tạo bản ${entry.new_version_no}`;
    }
    return "";
  }

  return (
    <section aria-label="Nhật ký thay đổi">
      <h2 className={styles.heading}>Nhật ký thay đổi</h2>
      {loading ? (
        <p className={styles.status} role="status">Đang tải nhật ký…</p>
      ) : error && items.length === 0 ? (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => load()}>
            Thử lại
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className={styles.status}>Chưa có thay đổi nào được ghi nhận.</p>
      ) : (
        <>
          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
            </div>
          )}
          <ol className={styles.list}>
            {items.map((entry) => (
              <li key={entry.event_id} className={styles.item}>
                <div className={styles.row}>
                  <div>
                    <strong>{ACTION_LABELS[entry.action] ?? entry.action}</strong>
                    {lineage(entry) && <span className={styles.lineage}> · {lineage(entry)}</span>}
                    <br />
                    <time className={styles.time} dateTime={entry.created_at}>
                      {new Date(entry.created_at).toLocaleString("vi-VN")}
                    </time>
                  </div>
                  <button
                    type="button"
                    className={styles.toggle}
                    aria-expanded={expanded === entry.event_id}
                    onClick={() =>
                      setExpanded((current) => (current === entry.event_id ? null : entry.event_id))
                    }
                  >
                    {expanded === entry.event_id ? "Ẩn chi tiết" : "Chi tiết"}
                  </button>
                </div>
                {expanded === entry.event_id && (
                  <dl className={styles.detail}>
                    <dt>Mã sự kiện</dt>
                    <dd>{entry.event_id}</dd>
                    {entry.trace_id && (
                      <>
                        <dt>Mã theo dõi</dt>
                        <dd>{entry.trace_id}</dd>
                      </>
                    )}
                  </dl>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.refresh}
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? "Đang làm mới…" : "Làm mới nhật ký"}
          </button>
        </>
      )}
    </section>
  );
}
