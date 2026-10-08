"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import styles from "./operations-dashboard.module.css";

type Summary = {
  total: number;
  with_primary_image: number;
  without_primary_image: number;
  top: number;
  bottom: number;
  one_piece: number;
};

export function OperationsDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async (signal?: AbortSignal): Promise<Summary> => {
    const response = await fetch("/api/catalog/drafts/summary", {
      cache: "no-store",
      signal,
    });
    if (response.status === 401) {
      throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    }
    if (response.status === 403) {
      throw new Error("Tài khoản này không có quyền xem số liệu vận hành.");
    }
    if (!response.ok) {
      throw new Error("Không thể tải số liệu. Hãy thử lại.");
    }
    return (await response.json()) as Summary;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchSummary());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không thể tải số liệu.");
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    const controller = new AbortController();
    fetchSummary(controller.signal)
      .then((value) => setData(value))
      .catch((failure: unknown) => {
        if (failure instanceof DOMException && failure.name === "AbortError") return;
        setError(failure instanceof Error ? failure.message : "Không thể tải số liệu.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [fetchSummary]);

  if (loading && !data) {
    return (
      <section aria-label="Số liệu vận hành" aria-busy="true">
        <div className={styles.grid} aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.skeleton} />
          ))}
        </div>
        <p className={styles.status} role="status">Đang tải số liệu…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section aria-label="Số liệu vận hành">
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => load()}>
            Thử lại
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const cards: Array<{ label: string; value: number; href: string }> = [
    { label: "Sản phẩm nháp đang quản lý", value: data.total, href: "/catalog/drafts" },
    { label: "Đã có ảnh chính", value: data.with_primary_image, href: "/catalog/drafts?has_primary_image=true" },
    { label: "Chưa có ảnh chính", value: data.without_primary_image, href: "/catalog/drafts?has_primary_image=false" },
    { label: "Nhóm áo", value: data.top, href: "/catalog/drafts?category=TOP" },
    { label: "Nhóm quần / váy rời", value: data.bottom, href: "/catalog/drafts?category=BOTTOM" },
    { label: "Nhóm trang phục liền", value: data.one_piece, href: "/catalog/drafts?category=ONE_PIECE" },
  ];

  return (
    <section aria-label="Số liệu vận hành">
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
        </div>
      )}
      <div className={styles.grid}>
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={styles.card}>
            <span className={styles.value}>{card.value}</span>
            <span className={styles.label}>{card.label}</span>
          </Link>
        ))}
      </div>
      <div className={styles.actions}>
        <Link className={styles.primary} href="/catalog/drafts/new">
          Tạo sản phẩm nháp
        </Link>
        <Link className={styles.secondary} href="/catalog/drafts">
          Mở danh sách nháp
        </Link>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? "Đang làm mới…" : "Làm mới số liệu"}
        </button>
      </div>
      <p className={styles.note}>
        Sản phẩm nháp chưa xuất hiện trong catalog công khai. Mỗi lần lưu tạo
        một phiên bản mới không thể thay đổi.
      </p>
    </section>
  );
}
