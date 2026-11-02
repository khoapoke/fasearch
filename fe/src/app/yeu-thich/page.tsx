"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccountCenterShell } from "@/components/storefront/account-center-shell";
import { fetchCatalogProduct, formatVnd } from "@/lib/customer-catalog";
import { fetchFavorites, removeFavorite } from "@/lib/customer-account-client";
import "@/components/storefront/storefront.css";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const pg = await fetchFavorites(0, 50);
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
      {loading ? (
        <section className="sfSideCard" aria-label="Trạng thái tải">
          <p className="sfIdentitySub" role="status">Đang tải danh sách sản phẩm yêu thích…</p>
        </section>
      ) : null}

      {error ? (
        <div ref={errorRef} tabIndex={-1} className="sfSideCard" role="alert" style={{ borderLeft: "3px solid #b42318" }}>
          <b>Lỗi tải dữ liệu</b>
          <p className="sfIdentitySub" style={{ color: "#b42318", marginTop: 4 }}>{error}</p>
          <button className="auth-button" type="button" onClick={load} style={{ marginTop: 10 }}>
            Thử lại
          </button>
        </div>
      ) : null}

      {!loading && !error && visible.length === 0 ? (
        <section className="sfSideCard" aria-label="Danh sách trống">
          <b>Chưa có sản phẩm yêu thích</b>
          <p className="sfIdentitySub" style={{ marginTop: 6, marginBottom: 16 }}>
            Lưu lại những món đồ bạn quan tâm khi duyệt danh mục để xem lại và mua sắm sau.
          </p>
          <Link className="auth-button is-primary" href="/nam" style={{ display: "inline-block" }}>
            Khám phá sản phẩm →
          </Link>
        </section>
      ) : null}

      {!loading && visible.length > 0 ? (
        <section className="sfSideCard" aria-label="Danh sách sản phẩm yêu thích">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <b>{visible.length} sản phẩm đã lưu</b>
            <span className="sfIdentitySub">Đồng bộ theo tài khoản của bạn</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {visible.map((v) => (
              <div
                key={v.id}
                style={{
                  border: "1px solid var(--st-line, #e5e5e5)",
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "var(--st-card, #ffffff)",
                }}
              >
                <Link
                  href={`/san-pham/${v.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div style={{ width: "100%", height: 180, backgroundColor: "#f3f3f3", overflow: "hidden" }}>
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
                          color: "#888",
                          fontSize: 13,
                        }}
                      >
                        Không có ảnh
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    {v.categoryName ? (
                      <span className="sfIdentitySub" style={{ fontSize: 12 }}>
                        {v.categoryName}
                      </span>
                    ) : null}
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginTop: 4,
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={v.name}
                    >
                      {v.name}
                    </div>
                    <div style={{ marginTop: 6, fontWeight: 700, fontSize: 14 }}>
                      {formatVnd(v.price)}
                    </div>
                  </div>
                </Link>
                <div style={{ padding: "0 12px 12px", marginTop: "auto" }}>
                  <button
                    type="button"
                    className="auth-button"
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
    </AccountCenterShell>
  );
}
