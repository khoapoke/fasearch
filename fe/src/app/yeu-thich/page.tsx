"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StitchImage } from "@/components/ui/stitch-image";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { formatVnd } from "@/components/storefront/product-card";
import { fetchCatalogProduct, CatalogError } from "@/lib/customer-catalog";
import { stitchImages } from "@/lib/stitch-assets";
import { fetchFavorites, removeFavorite, type FavoriteEntry } from "@/lib/customer-account-client";
import "@/components/storefront/preview.css";
import "@/components/storefront/listing.css";

type SavedProduct = { id: number; name: string; price: number; image?: string; gone: boolean };

export default function FavoritesPage() {
  const [saved, setSaved] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const photos = stitchImages("fashionsearch_ai_s_n_ph_m_y_u_th_ch");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const pg = await fetchFavorites(0, 50);
      const ids = pg.data.map((f) => f.productId);
      const results = await Promise.all(ids.map(async (id): Promise<SavedProduct> => {
        try {
          const d = await fetchCatalogProduct(String(id));
          return { id: d.id, name: d.name, price: d.price, image: d.imageUrl ?? undefined, gone: false };
        } catch {
          return { id, name: `Sản phẩm #${id}`, price: 0, gone: true };
        }
      }));
      setSaved(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách yêu thích.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function removeOne(id: number) {
    setRemoving(id);
    try {
      await removeFavorite(id);
      setSaved((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được mục yêu thích.");
    } finally {
      setRemoving(null);
    }
  }

  const visible = saved.filter((x) => !x.gone);

  function addAll() {
    // cart write unchanged (local cart is separate concern)
  }

  return (
    <StorefrontShell active="/yeu-thich">
      <div className="sfAccountWrap">
        <h1 className="pgTitle">Sản phẩm yêu thích</h1>
        {loading ? <p className="sfIdentitySub" role="status">Đang tải yêu thích…</p> : null}
        {error ? <p className="sfIdentitySub" role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
        {!loading && !error && saved.length === 0 ? (
          <p className="sfIdentitySub">Chưa có sản phẩm yêu thích. <Link href="/hang-moi">Xem hàng mới →</Link></p>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginTop: 12 }}>
          {visible.map((v) => (
            <div key={v.id} style={{ border: "1px solid #eee", padding: 8 }}>
              {v.image ? <img src={v.image} alt={v.name} style={{ width: "100%", height: 160, objectFit: "cover" }} /> : null}
              <div><b>{v.name}</b></div>
              <div>{formatVnd(v.price)}</div>
              <button type="button" disabled={removing === v.id} onClick={() => removeOne(v.id)}>
                {removing === v.id ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </StorefrontShell>
  );
}
