"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { StitchImage } from "@/components/ui/stitch-image";
import { ProductCard, formatVnd, type CardProduct } from "@/components/storefront/product-card";
import { readOwnIdentity } from "@/components/account/account-session";
import { readCart, writeCart } from "@/components/storefront/storefront-client";
import { fetchCart, putCartItem } from "@/lib/commerce-client";
import { validateQuantity } from "@/lib/commerce";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";
import { stitchImages } from "@/lib/stitch-assets";
import "./detail.css";
import "@/components/storefront/listing.css";

const FOLDER = "fashionsearch_ai_chi_ti_t_s_n_ph_m";

type Variant = { mauSac: string; kichCo: string; maSku?: number | null; maVach?: string | null };
type Detail = {
  maSp: number; tenSp: string; maDanhMuc: number | null; tenDanhMuc: string | null;
  chatLieu: string | null; kieuDang: string | null; moTa: string | null;
  giaBan: number; coHinhAnh: boolean; bienThe?: Variant[];
};

function missingInfo(): string {
  return "Chưa có thông tin từ máy chủ";
}

export function DetailView({ id }: { id: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const viewKey = `${id}|${reloadKey}`;
  const [settled, setSettled] = useState<{ key: string; data?: Detail; error?: string; notFound?: boolean }>({ key: "" });
  const [reco, setReco] = useState<Detail[]>([]);
  const data = settled.key === viewKey ? settled.data : undefined;
  const error = settled.key === viewKey ? settled.error ?? "" : "";
  const notFound = settled.key === viewKey ? settled.notFound ?? false : false;
  const loading = settled.key !== viewKey;
  const [photo, setPhoto] = useState(0);
  // P4 crossfade ngắt được: mờ dần (transition) → đổi ảnh → hiện dần.
  // Timer ref clear khi bấm liên tục nên retarget mượt, không restart keyframe.
  const [dim, setDim] = useState(false);
  const dimTimer = useRef<number | null>(null);

  function showPhoto(i: number) {
    if (i === photo && !dim) return;
    if (dimTimer.current) window.clearTimeout(dimTimer.current);
    setDim(true);
    dimTimer.current = window.setTimeout(() => {
      setPhoto(i);
      setDim(false);
    }, 140);
  }
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [tab, setTab] = useState(0);
  const photos = useMemo(() => stitchImages(FOLDER), []);

  useEffect(() => {
    let live = true;
    beFetch(`v1/catalog/san-pham/${encodeURIComponent(id)}`)
      .then((r) => {
        if (r.status === 404) {
          if (live) setSettled({ key: viewKey, notFound: true });
          return null;
        }
        return unwrap<Detail>(r);
      })
      .then((d) => {
        if (!live || !d) return;
        setSettled({ key: viewKey, data: d });
        setColor("");
        setSize("");
        setPhoto(0);
        beFetch("v1/catalog/san-pham?size=4")
          .then((rr) => unwrap<Page<Detail>>(rr))
          .then((pg) => live && setReco(pg.data.filter((p) => p.maSp !== d.maSp).slice(0, 4)))
          .catch(() => {});
      })
      .catch((e: Error) => {
        if (!live) return;
        setSettled({ key: viewKey, error: e.message || "Không tải được sản phẩm." });
      });
    return () => {
      live = false;
    };
  }, [id, reloadKey, viewKey]);

  const colors = useMemo(() => {
    const list = data?.bienThe?.map((v) => v.mauSac) ?? [];
    return [...new Set(list)];
  }, [data]);
  const sizes = useMemo(() => {
    const list = data?.bienThe?.map((v) => v.kichCo) ?? [];
    return [...new Set(list)];
  }, [data]);
  const sizesForColor = useMemo(() => {
    if (!color) return sizes;
    return [...new Set((data?.bienThe ?? []).filter((v) => v.mauSac === color).map((v) => v.kichCo))];
  }, [data, color, sizes]);
  const comboValid =
    colors.length === 0 || (color !== "" && size !== "" && sizesForColor.includes(size));
  const selectedVariant = useMemo(() => {
    if (!color || !size) return null;
    return (data?.bienThe ?? []).find((v) => v.mauSac === color && v.kichCo === size) ?? null;
  }, [data, color, size]);
  const selectedSku = selectedVariant?.maSku ?? null;
  const skuUnknown = colors.length > 0 && comboValid && (selectedSku === null || selectedSku === undefined);

  if (loading) return <div className="pdWrap"><p className="pgState" role="status"><strong>Đang tải sản phẩm…</strong></p></div>;
  if (notFound)
    return (
      <div className="pdWrap">
        <p className="pgState" role="alert"><strong>Không tìm thấy sản phẩm</strong>Sản phẩm không tồn tại hoặc đã ngừng bán.</p>
        <p style={{ textAlign: "center", marginTop: 12 }}><Link href="/nam" className="hmCta hmCtaGhost">← Về danh sách</Link></p>
      </div>
    );
  if (error || !data)
    return (
      <div className="pdWrap">
        <p className="pgState" role="alert"><strong>Không tải được sản phẩm</strong>{error || "Hãy kiểm tra kết nối rồi thử lại."} Lựa chọn màu/size giữ nguyên sau khi tải lại.</p>
        <p style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 12 }}>
          <button type="button" className="hmCta hmCtaPrimary" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</button>
          <Link href="/nam" className="hmCta hmCtaGhost">← Về danh sách</Link>
        </p>
      </div>
    );

  const realImg = data.coHinhAnh ? `/api/be/v1/catalog/san-pham/${data.maSp}/hinh-anh` : undefined;
  const gallery = realImg
    ? [{ src: realImg, alt: `Ảnh thật: ${data.tenSp}`, real: true }]
    : photos.slice(0, 5).map((p) => ({ src: p.src, alt: p.alt || data.tenSp, real: false }));
  const main = gallery[Math.min(photo, gallery.length - 1)];

  const recoCards: CardProduct[] = reco.map((p, i) => ({
    id: p.maSp,
    name: p.tenSp,
    price: p.giaBan,
    image: p.coHinhAnh ? `/api/be/v1/catalog/san-pham/${p.maSp}/hinh-anh` : photos[(7 + i) % photos.length]?.src,
    href: `/san-pham/${p.maSp}`,
  }));

  async function addToCart() {
    const item = data;
    if (!item || adding) return;
    if (colors.length > 0 && !comboValid) return;
    let n: number;
    try {
      n = validateQuantity(qty);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Số lượng chưa hợp lệ.");
      return;
    }
    // SKU thật từ biến thể đã chọn (BE mở rộng public detail với maSku/maVach).
    // Thiếu SKU → honesty, không đoán variant.
    if (skuUnknown || (colors.length > 0 && selectedSku === null)) {
      setAddError("Biến thể này chưa có mã SKU từ máy chủ nên chưa thêm vào giỏ thật được. Thử lại sau khi catalog bổ sung SKU.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const me = await readOwnIdentity().catch(() => null);
      if (me && selectedSku !== null) {
        const cart = await fetchCart();
        await putCartItem(selectedSku, n, cart.phienBan);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
        return;
      }
      // Khách: lưu SKU thật để import đúng 1 lần sau đăng nhập; legacy product-only giữ honesty ở /gio-hang.
      const meta = colors.length > 0 ? `Màu ${color} · Size ${size}` : undefined;
      const guest = readCart();
      const entry = {
        id: item.maSp, name: item.tenSp, price: item.giaBan, image: realImg, qty: n, meta,
        ...(selectedSku !== null ? { maSku: selectedSku } : {}),
      };
      const found = guest.find((i) => i.id === item.maSp && i.meta === meta);
      if (found) {
        found.qty = Math.min(999, found.qty + n);
        if (selectedSku !== null) (found as typeof found & { maSku?: number }).maSku = selectedSku;
      } else guest.push(entry);
      writeCart(guest);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1800);
    } catch (e) {
      const st = (e as { status?: number })?.status ?? 0;
      if (st === 401) {
        // Hết phiên giữa chừng → rớt về guest với SKU thật.
        const meta = colors.length > 0 ? `Màu ${color} · Size ${size}` : undefined;
        const guest = readCart();
        guest.push({
          id: item!.maSp, name: item!.tenSp, price: item!.giaBan, image: realImg, qty: n, meta,
          ...(selectedSku !== null ? { maSku: selectedSku } : {}),
        });
        writeCart(guest);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
        return;
      }
      setAddError(e instanceof Error ? e.message : "Thêm vào giỏ thất bại. Số lượng giữ nguyên.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="pdWrap">
      <nav className="pgCrumbs" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link><span aria-hidden="true">›</span>
        {data.maDanhMuc ? (
          <>
            <Link href={`/nam?maDanhMuc=${data.maDanhMuc}`}>{data.tenDanhMuc ?? "Danh mục"}</Link>
            <span aria-hidden="true">›</span>
          </>
        ) : null}
        <span aria-current="page">{data.tenSp}</span>
      </nav>
      <div className="pdGrid">
        <div className="pdGallery">
          <div className="pdMain stDetailMedia" style={{ position: "relative" }}>
            <StitchImage src={main.src} alt={main.alt} eager className={dim ? "pdDim" : undefined} />
          </div>
          <div className="pdThumbs" role="listbox" aria-label="Ảnh sản phẩm">
            {gallery.map((g, i) => (
              <button key={i} type="button" aria-current={i === Math.min(photo, gallery.length - 1)} onClick={() => showPhoto(i)} aria-label={`Xem ảnh ${i + 1}`}>
                <StitchImage src={g.src} alt="" />
              </button>
            ))}
          </div>
          <p className="pgSub" style={{ fontSize: 12 }}>
            {realImg ? "Ảnh thật của sản phẩm từ máy chủ." : "Shop chưa đăng ảnh thật — ảnh minh họa từ bộ sưu tập."}
          </p>
        </div>

        <div className="stDetailPanel">
          <p className="pdSku">Mã sản phẩm: #{data.maSp} · {data.tenDanhMuc ?? "FashionSearch AI"}</p>
          <h1 className="pdTitle">{data.tenSp}</h1>
          <p className="pdRate">
            <span>Hàng đang bán · giá từ máy chủ · chưa có đánh giá tổng hợp</span>
          </p>
          <p className="pdPriceRow">
            <span className="pdPrice stDetailPrice">{formatVnd(data.giaBan)}</span>
          </p>

          {colors.length > 0 ? (
            <>
              <p className="pdOptLabel">Màu sắc: <span>{color || "— chọn màu —"}</span></p>
              <div className="pgSizes" role="group" aria-label="Màu sắc có thật">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="pgSize"
                    style={{ minWidth: 0 }}
                    aria-pressed={color === c}
                    onClick={() => {
                      setColor(c);
                      setSize((prev) => {
                        const ok = (data.bienThe ?? []).filter((v) => v.mauSac === c).map((v) => v.kichCo);
                        return ok.includes(prev) ? prev : "";
                      });
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="pdOptLabel">Kích thước: <span>{size || color ? (size || "— chọn size —") : "chọn màu trước"}</span></p>
              <div className="pgSizes" role="group" aria-label="Kích thước có thật">
                {(color ? sizesForColor : sizes).map((s) => (
                  <button key={s} type="button" className="pgSize" aria-pressed={size === s} disabled={!color} onClick={() => setSize(s)}>{s}</button>
                ))}
              </div>
              {color && size ? (
                <p className="pdAiTip" role="status">
                  Tổ hợp đã chọn: {color} / {size} — đúng biến thể shop khai báo.
                  {selectedSku !== null ? ` SKU ${selectedSku}.` : " Chưa có SKU từ máy chủ — chưa thêm giỏ thật được."}
                </p>
              ) : (
                <p className="pdAiTip">Chọn đúng tổ hợp màu × size shop khai báo để thêm vào giỏ.</p>
              )}
            </>
          ) : (
            <p className="pdAiTip">Shop chưa khai báo biến thể màu/size cho sản phẩm này.</p>
          )}

          <div className="pdQtyRow">
            <span className="pdQty">
              <button type="button" aria-label="Giảm số lượng" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
              <b aria-live="polite">{qty}</b>
              <button type="button" aria-label="Tăng số lượng" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
            </span>
            <span className="pdStock">Đang bán · số lượng theo kho phục vụ</span>
          </div>
          <div className="pdBuyRow">
            <button
              type="button"
              className="hmCta hmCtaGhost"
              onClick={addToCart}
              disabled={(colors.length > 0 && !comboValid) || adding || skuUnknown}
              title={colors.length > 0 && !comboValid ? "Chọn màu và size trước" : skuUnknown ? "Thiếu SKU từ máy chủ" : undefined}
            >
              {adding ? "Đang thêm…" : added ? "Đã thêm vào giỏ ✓" : "Thêm vào giỏ hàng (SKU thật)"}
            </button>
            <Link className="hmCta hmCtaPrimary" href="/thanh-toan">MUA NGAY (COD)</Link>
          </div>
          {addError ? <p role="alert" className="stAlert">{addError}</p> : null}
          <div className="pdPerks">
            <div><b>Thanh toán COD</b>Thu tiền khi nhận hàng</div>
            <div><b>Tồn kho thật</b>Số lượng theo kho đang phục vụ</div>
            <div><b>Phí vận chuyển</b>Hiển thị ở bước thanh toán</div>
          </div>
        </div>
      </div>

      <div className="pdTabs" role="tablist" aria-label="Thông tin sản phẩm">
        {["Đặc điểm & thông số", "Chất liệu & mô tả", "Hướng dẫn bảo quản"].map((t, i) => (
          <button key={t} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>
      {tab === 0 ? (
        <div className="pdSpec">
          <dl>
            <dt>Kiểu dáng:</dt><dd>{data.kieuDang || missingInfo()}</dd>
            <dt>Chất liệu:</dt><dd>{data.chatLieu || missingInfo()}</dd>
            <dt>Danh mục:</dt><dd>{data.tenDanhMuc || missingInfo()}</dd>
            <dt>Biến thể:</dt>
            <dd>
              {(data.bienThe ?? []).length > 0
                ? (data.bienThe ?? []).map((v) => `${v.mauSac}/${v.kichCo}`).join(" · ")
                : "Shop chưa khai báo"}
            </dd>
          </dl>
          <div className="pdLife">
            <StitchImage src={photos[6]?.src} alt={photos[6]?.alt || "Ảnh minh họa phối đồ"} />
            <div>
              <small>Ảnh minh họa</small>
              <b>Dễ phối đồ cho mọi hoàn cảnh</b>
              <p>Ảnh minh họa từ bộ sưu tập, không phải ảnh thật sản phẩm.</p>
            </div>
          </div>
        </div>
      ) : null}
      {tab === 1 ? (
        <div className="pdSpec">
          <div>
            <p className="pgSub"><b>Chất liệu:</b> {data.chatLieu || missingInfo()}</p>
            <p className="pgSub"><b>Kiểu dáng:</b> {data.kieuDang || missingInfo()}</p>
            <p className="pgSub"><b>Mô tả từ shop:</b> {data.moTa || "Shop chưa đăng mô tả cho sản phẩm này."}</p>
          </div>
        </div>
      ) : null}
      {tab === 2 ? (
        <div className="pdSpec">
          <p className="pgSub">Shop chưa đăng hướng dẫn bảo quản cho sản phẩm này.</p>
        </div>
      ) : null}

      <section className="pdReco" aria-label="Sản phẩm khác">
        <div className="pdRecoHead">
          <h2>Sản phẩm khác trong catalog</h2>
          <Link href="/nam">Xem tất cả →</Link>
        </div>
        <p>Danh sách thật từ máy chủ — không phải gợi ý AI.</p>
        <div className="pgGrid">
          {recoCards.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
