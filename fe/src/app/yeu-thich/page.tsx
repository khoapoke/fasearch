"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { StitchImage } from "@/components/ui/stitch-image";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { readCart, toggleFav, useFavs, writeCart } from "@/components/storefront/storefront-client";
import { formatVnd } from "@/components/storefront/product-card";
import { beFetch, unwrap } from "@/lib/mgmt-client";
import { stitchImages } from "@/lib/stitch-assets";
import "@/components/storefront/preview.css";
import "@/components/storefront/listing.css";

const FOLDER = "fashionsearch_ai_s_n_ph_m_y_u_th_ch";

type SavedProduct = { id: number; name: string; price: number; image?: string; gone: boolean };

export default function FavoritesPage() {
  const favs = useFavs();
  const photos = stitchImages(FOLDER);
  const [saved, setSaved] = useState<SavedProduct[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const spIds = favs.filter((f) => f.startsWith("sp:")).map((f) => Number(f.slice(3))).filter((n) => Number.isFinite(n));
  const spKey = spIds.join(",");
  const lookOn = new Set(favs.filter((f) => f.startsWith("look:")).map((f) => Number(f.slice(5))));
  const loadingSaved = spIds.length > 0 && loadedKey !== spKey;
  const [cartMsg, setCartMsg] = useState("");
  const visible = saved.filter((x) => spIds.includes(x.id) && !x.gone);

  function addAll() {
    const cart = readCart();
    for (const v of visible) {
      const found = cart.find((i) => i.id === v.id && i.meta === undefined);
      if (found) found.qty += 1;
      else cart.push({ id: v.id, name: v.name, price: v.price, image: v.image, qty: 1 });
    }
    writeCart(cart);
    setCartMsg(`Đã thêm ${visible.length} sản phẩm vào giỏ hàng.`);
  }

  function addOne(v: SavedProduct) {
    const cart = readCart();
    const found = cart.find((i) => i.id === v.id && i.meta === undefined);
    if (found) found.qty += 1;
    else cart.push({ id: v.id, name: v.name, price: v.price, image: v.image, qty: 1 });
    writeCart(cart);
    setCartMsg(`Đã thêm “${v.name}” vào giỏ hàng.`);
  }

  useEffect(() => {
    if (spIds.length === 0) return;
    let live = true;
    Promise.all(
      spIds.map(async (id): Promise<SavedProduct> => {
        try {
          const r = await beFetch(`v1/catalog/san-pham/${id}`);
          if (r.status === 404) return { id, name: `Sản phẩm #${id}`, price: 0, gone: true };
          const d = await unwrap<{ maSp: number; tenSp: string; giaBan: number; coHinhAnh: boolean }>(r);
          return {
            id: d.maSp,
            name: d.tenSp,
            price: d.giaBan,
            image: d.coHinhAnh ? `/api/be/v1/catalog/san-pham/${d.maSp}/hinh-anh` : undefined,
            gone: false,
          };
        } catch {
          return { id, name: `Sản phẩm #${id}`, price: 0, gone: true };
        }
      }),
    ).then((rows) => {
      if (live) {
        setSaved(rows);
        setLoadedKey(spKey);
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spKey]);

  return (
    <StorefrontShell
      active="/yeu-thich"
      previewNote="Trang yêu thích: danh sách tim lưu trên trình duyệt; sản phẩm lấy từ máy chủ, ảnh lookbook là minh họa."
    >
      <div className="pvWrap">
        <nav className="pgCrumbs" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span>
          <span aria-current="page">Sản Phẩm Yêu Thích</span>
        </nav>
        <h1 className="pgTitle">Sản Phẩm Yêu Thích <span className="pgCount">{favs.length} đã tim</span></h1>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
          <h2 className="pgSub" style={{ fontSize: 15, color: "var(--ink)", fontWeight: 800, margin: 0 }}>Đã tim từ cửa hàng</h2>
          {visible.length > 0 ? (
            <button className="hmCta hmCtaPrimary" style={{ padding: "9px 16px", fontSize: 13, marginLeft: "auto" }} type="button" onClick={addAll}>
              Thêm tất cả vào giỏ hàng
            </button>
          ) : null}
        </div>
        {cartMsg ? <p className="mpMuted" role="status" style={{ marginTop: 8 }}>{cartMsg}</p> : null}
        {loadingSaved ? (
          <p className="mpMuted" role="status">Đang tải sản phẩm đã tim…</p>
        ) : spIds.length === 0 ? (
          <p className="pgState">
            <strong>Chưa tim sản phẩm nào</strong>
            Nhấn biểu tượng tim ở <Link href="/nam">danh sách Nam</Link> hoặc trang chi tiết để lưu tại đây.
          </p>
        ) : (
          <div className="pgGrid" style={{ marginTop: 12 }}>
            {saved.filter((p) => spIds.includes(p.id)).map((p) => (
              <article className="pCard" key={p.id}>
                <Link className="pCardMedia" href={`/san-pham/${p.id}`}>
                  <StitchImage src={p.image} alt={p.name} />
                </Link>
                <button className="pFav" type="button" aria-pressed aria-label={`Bỏ tim ${p.name}`} onClick={() => toggleFav(`sp:${p.id}`)}>
                  <Icon name="heart" size={17} filled />
                </button>
                <div className="pCardBody">
                  {p.gone ? (
                    <p className="sfIdentitySub">Sản phẩm đã ngừng bán — <button type="button" onClick={() => toggleFav(`sp:${p.id}`)} style={{ border: 0, background: "none", color: "var(--brand)", cursor: "pointer", fontWeight: 700 }}>gỡ khỏi danh sách</button></p>
                  ) : (
                    <>
                      <Link className="pCardName" href={`/san-pham/${p.id}`}>{p.name}</Link>
                      <span className="pPrice">{formatVnd(p.price)}</span>
                      <button className="pgApply" style={{ marginTop: 6 }} type="button" onClick={() => addOne(p)}>Thêm vào giỏ</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <h2 className="pgSub" style={{ fontSize: 15, color: "var(--ink)", fontWeight: 800, marginTop: 26 }}>Lookbook gợi ý (ảnh minh họa)</h2>
        <div className="pgGrid" style={{ marginTop: 12 }}>
          {photos.map((w, i) => {
            const on = lookOn.has(i);
            return (
              <article className="pCard" key={w.src}>
                <span className="pCardMedia">
                  <StitchImage src={w.src} alt={w.alt || `Lookbook ${i + 1}`} />
                </span>
                <button
                  className="pFav"
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? "Bỏ tim ảnh minh họa" : "Tim ảnh minh họa"}
                  onClick={() => toggleFav(`look:${i}`)}
                >
                  <Icon name="heart" size={17} filled={on} />
                </button>
                <div className="pCardBody">
                  <span className="sfIdentitySub">Ảnh minh họa từ BST · <Link href="/nam" style={{ fontWeight: 700, color: "var(--brand)" }}>tìm đồ tương tự →</Link></span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </StorefrontShell>
  );
}
