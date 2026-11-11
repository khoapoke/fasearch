"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import ac from "@/components/account/account-cards.module.css";
import { PriceTag } from "@/components/storefront/price-tag";
import { fetchCatalogProduct } from "@/lib/customer-catalog";
import { fetchFavorites, removeFavorite } from "@/lib/customer-account-client";

import { FavoriteAlertToggles } from "@/components/customer-notifications/favorite-alerts";
import { notificationApi, type FavoriteAlert } from "@/lib/notification-client";

type SavedProduct = {
  id: number;
  name: string;
  price: number;
  image?: string;
  categoryName?: string;
  gone: boolean;
};

export default function FavoritesPage() {
  const [saved, setSaved] = useState<SavedProduct[]>([]);
  const [alerts, setAlerts] = useState<FavoriteAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pg, preferences] = await Promise.all([fetchFavorites(0, 50), notificationApi<{ items: FavoriteAlert[] }>("/api/customer-account/notifications/favorites")]);
      setAlerts(preferences.items);
      const ids = pg.data.map((f) => f.productId);
      const results = await Promise.all(
        ids.map(async (id): Promise<SavedProduct> => {
          try {
            const d = await fetchCatalogProduct(String(id));
            return {
              id: d.id,
              name: d.name,
              price: d.price,
              image: d.imageUrl ?? undefined,
              categoryName: d.categoryName ?? undefined,
              gone: false,
            };
          } catch {
            return {
              id,
              name: `Sản phẩm #${id}`,
              price: 0,
              gone: true,
            };
          }
        })
      );
      setSaved(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách yêu thích.");
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
    void load();
  }, [load]);

  async function removeOne(id: number) {
    setRemoving(id);
    try {
      await removeFavorite(id);
      setSaved((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được mục yêu thích.");
      setTimeout(() => errorRef.current?.focus(), 0);
    } finally {
      setRemoving(null);
    }
  }

  const visible = saved.filter((x) => !x.gone);

  return (
    <AccountCenterShell active="/yeu-thich" title="Sản phẩm yêu thích">
      <div className={ac.pageWide}>
        {loading ? (
          <section className={ac.card} aria-label="Trạng thái tải">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Yêu thích</p>
              <h2 className={ac.title}>Đang tải danh sách</h2>
            </div>
            <div className={ac.group} role="status">
              <div className={ac.skeleton} />
              <p className={ac.meta}>Đang tải danh sách sản phẩm yêu thích…</p>
            </div>
          </section>
        ) : null}

        {error ? (
          <div ref={errorRef} tabIndex={-1} className={ac.card} role="alert">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Yêu thích</p>
              <h2 className={ac.title}>Không tải được danh sách</h2>
            </div>
            <p className={ac.alert}>{error}</p>
            <div className={ac.actions}>
              <button className={ac.secondary} type="button" onClick={load}>
                Thử lại
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !error && visible.length === 0 ? (
          <section className={`${ac.card} ${ac.empty}`} aria-label="Danh sách trống">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Yêu thích</p>
              <h2 className={ac.title}>Chưa có gì ở đây</h2>
            </div>
            <p className={ac.meta}>Chưa có sản phẩm yêu thích.</p>
            <div className={ac.actions}>
              <Link className={ac.primary} href="/nam">
                Khám phá sản phẩm
              </Link>
            </div>
          </section>
        ) : null}

        {!loading && visible.length > 0 ? (
          <section className={ac.card} aria-label="Danh sách sản phẩm yêu thích">
            <div className={ac.head}>
              <p className={ac.eyebrow}>01 · Yêu thích</p>
              <h2 className={ac.title}>Sản phẩm đã lưu</h2>
              <p className={ac.lead}>{visible.length} sản phẩm · Đồng bộ theo tài khoản của bạn</p>
            </div>

            <div className={ac.productGrid}>
              {visible.map((v) => (
                <div
                  key={v.id}
                  style={{
                    border: "1px solid var(--st-line, #e5e5e5)",
                    borderRadius: 4,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "var(--st-surface, #ffffff)",
                  }}
                >
                  <Link
                    href={`/san-pham/${v.id}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div style={{ width: "100%", height: 180, backgroundColor: "var(--st-select)", overflow: "hidden" }}>
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.image}
                          alt={v.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--st-ink-soft)",
                            fontSize: 13,
                          }}
                        >
                          Không có ảnh
                        </div>
                      )}
                    </div>
                    <div style={{ padding: 14 }}>
                      {v.categoryName ? (
                        <span className={ac.chip}>{v.categoryName}</span>
                      ) : null}
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          marginTop: 8,
                          lineHeight: 1.4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--st-ink)",
                        }}
                        title={v.name}
                      >
                        {v.name}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <PriceTag value={v.price} />
                      </div>
                    </div>
                  </Link>
                  {alerts.find((a) => a.productId === v.id) ? <FavoriteAlertToggles value={alerts.find((a) => a.productId === v.id)!} onChange={(next) => setAlerts((prev) => prev.map((a) => a.productId === next.productId ? next : a))} /> : null}
                  <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
                    <button
                      type="button"
                      className={ac.secondary}
                      disabled={removing === v.id}
                      onClick={() => removeOne(v.id)}
                      style={{ width: "100%" }}
                    >
                      {removing === v.id ? "Đang xóa…" : "Bỏ lưu"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AccountCenterShell>
  );
}
