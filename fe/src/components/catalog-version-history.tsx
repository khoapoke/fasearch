"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./catalog-version-history.module.css";

type Category = "TOP" | "BOTTOM" | "ONE_PIECE";

type VersionEntry = {
  product_version_id: string;
  version_no: number;
  status: string;
  title: string;
  category: Category;
  created_at: string;
  has_primary_image: boolean;
};

type VersionDetail = VersionEntry & {
  description: string | null;
  media_type: string | null;
  byte_size: number | null;
  quality_state: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

export function CatalogVersionHistory({
  productId,
  currentVersion,
}: {
  productId: string;
  currentVersion: number;
}) {
  const [entries, setEntries] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, VersionDetail>>({});
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");

  const fetchVersions = useCallback(
    async (signal?: AbortSignal): Promise<VersionEntry[]> => {
      const response = await fetch(
        `/api/catalog/drafts/${encodeURIComponent(productId)}/versions?limit=100`,
        { cache: "no-store", signal },
      );
      if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
      if (response.status === 403) throw new Error("Tài khoản này không có quyền xem lịch sử phiên bản.");
      if (response.status === 404) throw new Error("Sản phẩm nháp không tồn tại.");
      if (!response.ok) throw new Error("Không thể tải lịch sử phiên bản. Hãy thử lại.");
      const value = (await response.json()) as { items: VersionEntry[] };
      return value.items;
    },
    [productId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await fetchVersions());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải lịch sử phiên bản.");
    } finally {
      setLoading(false);
    }
  }, [fetchVersions]);

  useEffect(() => {
    const controller = new AbortController();
    fetchVersions(controller.signal)
      .then((value) => setEntries(value))
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(failure instanceof Error ? failure.message : "Không thể tải lịch sử phiên bản.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // currentVersion intentionally refetches after each new saved version.
  }, [fetchVersions, currentVersion]);

  async function openDetail(versionId: string) {
    if (selected[versionId]) {
      setSelected((current) => {
        const next = { ...current };
        delete next[versionId];
        return next;
      });
      return;
    }
    setImageError("");
    try {
      const response = await fetch(
        `/api/catalog/drafts/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Không thể đọc chi tiết phiên bản.");
      const detail = (await response.json()) as VersionDetail;
      setSelected((current) => ({ ...current, [versionId]: detail }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể đọc chi tiết phiên bản.");
    }
  }

  const detailA = compareA ? selected[compareA] : undefined;
  const detailB = compareB ? selected[compareB] : undefined;

  async function ensureDetail(versionId: string) {
    if (selected[versionId]) return;
    await openDetail(versionId);
  }

  if (loading) {
    return (
      <section aria-label="Lịch sử phiên bản" aria-busy="true">
        <h2 className={styles.heading}>Lịch sử phiên bản</h2>
        <p className={styles.status} role="status">Đang tải lịch sử phiên bản…</p>
      </section>
    );
  }

  if (error && entries.length === 0) {
    return (
      <section aria-label="Lịch sử phiên bản">
        <h2 className={styles.heading}>Lịch sử phiên bản</h2>
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => load()}>
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Lịch sử phiên bản">
      <h2 className={styles.heading}>Lịch sử phiên bản</h2>
      <p className={styles.note}>
        Chỉ đọc. Mỗi phiên bản được giữ nguyên sau khi lưu; không thể sửa hay
        xóa phiên bản cũ tại đây.
      </p>
      {entries.length === 0 ? (
        <p className={styles.status}>Chưa có phiên bản nào.</p>
      ) : (
        <ol className={styles.timeline}>
          {entries.map((entry, index) => {
            const detail = selected[entry.product_version_id];
            return (
              <li key={entry.product_version_id} className={styles.item}>
                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => openDetail(entry.product_version_id)}
                    aria-expanded={detail != null}
                  >
                    Bản {entry.version_no} · {entry.title}
                  </button>
                  <span className={styles.badges}>
                    {index === 0 && <span className={styles.current}>Mới nhất</span>}
                    <span>{CATEGORY_LABELS[entry.category] ?? entry.category}</span>
                    <span>{entry.has_primary_image ? "Có ảnh" : "Chưa có ảnh"}</span>
                  </span>
                </div>
                {detail && (
                  <div className={styles.detail}>
                    <p>
                      <strong>Mô tả:</strong> {detail.description || "—"}
                    </p>
                    <p>
                      <strong>Thời gian:</strong>{" "}
                      {new Date(detail.created_at).toLocaleString("vi-VN")}
                    </p>
                    {detail.has_primary_image ? (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className={styles.thumb}
                          src={`/api/catalog/drafts/${encodeURIComponent(productId)}/versions/${encodeURIComponent(entry.product_version_id)}/image`}
                          alt={`Ảnh của bản ${entry.version_no}`}
                          onError={() =>
                            setImageError(
                              `Không đọc được ảnh của bản ${entry.version_no}. Hãy thử lại.`,
                            )
                          }
                        />
                        <p className={styles.meta}>
                          {detail.media_type ?? ""} ·{" "}
                          {detail.byte_size != null
                            ? `${Math.max(1, Math.round(detail.byte_size / 1024))} KB`
                            : ""}
                        </p>
                      </div>
                    ) : (
                      <p className={styles.meta}>Phiên bản này chưa có ảnh chính.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {imageError && (
        <div className={styles.error} role="alert">
          <p>{imageError}</p>
          <button type="button" onClick={() => setImageError("")}>
            Đóng
          </button>
        </div>
      )}
      {entries.length >= 2 && (
        <div className={styles.compare}>
          <h3>So sánh hai phiên bản</h3>
          <div className={styles.comparePickers}>
            <label>
              Bản thứ nhất
              <select
                value={compareA ?? ""}
                onChange={(event) => {
                  setCompareA(event.target.value || null);
                  if (event.target.value) void ensureDetail(event.target.value);
                }}
              >
                <option value="">Chọn bản</option>
                {entries.map((entry) => (
                  <option key={entry.product_version_id} value={entry.product_version_id}>
                    Bản {entry.version_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bản thứ hai
              <select
                value={compareB ?? ""}
                onChange={(event) => {
                  setCompareB(event.target.value || null);
                  if (event.target.value) void ensureDetail(event.target.value);
                }}
              >
                <option value="">Chọn bản</option>
                {entries.map((entry) => (
                  <option key={entry.product_version_id} value={entry.product_version_id}>
                    Bản {entry.version_no}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {detailA && detailB && (
            <table className={styles.compareTable}>
              <caption>
                So sánh bản {detailA.version_no} và bản {detailB.version_no}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Trường</th>
                  <th scope="col">Bản {detailA.version_no}</th>
                  <th scope="col">Bản {detailB.version_no}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Tên</th>
                  <td>{detailA.title}</td>
                  <td>{detailB.title}</td>
                </tr>
                <tr>
                  <th scope="row">Danh mục</th>
                  <td>{CATEGORY_LABELS[detailA.category] ?? detailA.category}</td>
                  <td>{CATEGORY_LABELS[detailB.category] ?? detailB.category}</td>
                </tr>
                <tr>
                  <th scope="row">Mô tả</th>
                  <td>{detailA.description || "—"}</td>
                  <td>{detailB.description || "—"}</td>
                </tr>
                <tr>
                  <th scope="row">Ảnh chính</th>
                  <td>{detailA.has_primary_image ? "Có ảnh" : "Chưa có ảnh"}</td>
                  <td>{detailB.has_primary_image ? "Có ảnh" : "Chưa có ảnh"}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
