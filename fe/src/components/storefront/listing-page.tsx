"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import { stitchImages } from "@/lib/stitch-assets";
import { dedupeFacetValues } from "@/lib/catalog";
import "@/components/storefront/listing.css";

export type ListingProduct = {
  id: number;
  name: string;
  price: number;
  image?: string;
  category?: string | null;
  categoryId?: number | null;
  variants?: Array<{ mauSac: string; kichCo: string }>;
  href: string;
};

export type CategoryFacet = { id: number; name: string };

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const COLORS: Array<{ hex: string; label: string; keys: string[] }> = [
  { hex: "#1c1c1e", label: "Đen", keys: ["đen", "den", "black"] },
  { hex: "#f5f5f4", label: "Trắng", keys: ["trắng", "trang", "white"] },
  { hex: "#22364f", label: "Xanh navy", keys: ["navy", "xanh", "blue", "dương"] },
  { hex: "#5b6b5c", label: "Xanh rêu", keys: ["rêu", "reu", "green", "olive"] },
  { hex: "#c9bfae", label: "Be", keys: ["be", "beige", "kem", "nude", "khaki", "kaki"] },
  { hex: "#8a2b1d", label: "Đỏ đất", keys: ["đỏ", "do", "red", "đất", "dat", "terracotta", "cam"] },
];
const PRICES = [
  { v: "", label: "Mọi mức giá" },
  { v: "0-200000", label: "Dưới 200.000đ" },
  { v: "200000-350000", label: "200.000đ – 350.000đ" },
  { v: "350000-500000", label: "350.000đ – 500.000đ" },
  { v: "500000-", label: "Trên 500.000đ" },
];

function priceLabel(v: string): string {
  return PRICES.find((p) => p.v === v)?.label ?? v;
}

export function ListingPage({
  crumbs,
  title,
  sub,
  totalLabel,
  products,
  tags,
  loading,
  error,
  photoFolder,
  photoOffset = 0,
  aiCta = true,
  categories = [],
  activeCat = "",
  activePrice = "",
  mode = "local",
  serverKichCo = [],
  serverMauSac = [],
  facetsTruncated = false,
  activeKichCo = "",
  activeMauSac = "",
  activeSapXep = "",
  onFilter,
  lead,
  paging,
  onRetry,
  themed = false,
}: {
  crumbs: Array<{ href?: string; label: string }>;
  title: string;
  sub: string;
  totalLabel: string;
  products: ListingProduct[];
  tags: string[];
  loading: boolean;
  error: string;
  photoFolder: string;
  photoOffset?: number;
  aiCta?: boolean;
  categories?: CategoryFacet[];
  activeCat?: string;
  activePrice?: string;
  mode?: "server" | "local";
  serverKichCo?: string[];
  serverMauSac?: string[];
  facetsTruncated?: boolean;
  activeKichCo?: string;
  activeMauSac?: string;
  activeSapXep?: string;
  onFilter?: (next: { maDanhMuc?: string; price?: string; kichCo?: string; mauSac?: string; sapXep?: string }) => void;
  lead?: React.ReactNode;
  paging?: { page: number; totalPages: number; total: number; size: number; onPage: (p: number) => void };
  onRetry?: () => void;
  /** Bề mặt pilot search-studio: bộ lọc thu gọn trên điện thoại (P1). */
  themed?: boolean;
}) {
  const [sort, setSort] = useState("match");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [cat, setCat] = useState(activeCat);
  const [price, setPrice] = useState(activePrice);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const photos = useMemo(() => stitchImages(photoFolder), [photoFolder]);

  const filtered = useMemo(() => {
    if (mode === "server") return products;
    const colorKeys = COLORS.find((c) => c.hex === color)?.keys ?? [];
    return products.filter((p) => {
      if (size && !(p.variants ?? []).some((v) => v.kichCo.toLowerCase() === size.toLowerCase())) return false;
      if (colorKeys.length > 0) {
        const all = (p.variants ?? []).map((v) => v.mauSac.toLowerCase()).join(" ");
        if (!colorKeys.some((k) => all.includes(k))) return false;
      }
      return true;
    });
  }, [products, size, color, mode]);

  const sorted = useMemo(() => {
    if (mode === "server") return filtered;
    const list = [...filtered];
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return list;
  }, [filtered, sort, mode]);

  const cards: CardProduct[] = sorted.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image ?? photos[(photoOffset + p.id) % Math.max(photos.length, 1)]?.src,
    href: p.href,
  }));

  const catName = categories.find((c) => String(c.id) === cat)?.name;

  const activeFilterSummary = (() => {
    const parts: string[] = [];
    if (catName) parts.push(catName);
    if (price) parts.push(priceLabel(price));
    if (activeKichCo) parts.push(`Size ${activeKichCo}`);
    if (activeMauSac) parts.push(`Màu ${activeMauSac}`);
    if (!activeKichCo && size) parts.push(`Size ${size}`);
    if (!activeMauSac && color) parts.push(`Màu ${COLORS.find((c) => c.hex === color)?.label ?? ""}`);
    return parts.length > 0 ? parts.join(" · ") : "Chưa lọc";
  })();

  function apply() {
    onFilter?.({ maDanhMuc: cat, price });
  }

  function clearAll() {
    setSize("");
    setColor("");
    setCat("");
    setPrice("");
    onFilter?.({ maDanhMuc: "", price: "" });
  }

  return (
    <div className="pgWrap">
      <nav className="pgCrumbs" aria-label="Đường dẫn">
        {crumbs.map((c, i) => (
          <span key={c.label} style={{ display: "contents" }}>
            {i > 0 ? <span aria-hidden="true">›</span> : null}
            {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
          </span>
        ))}
      </nav>
      <h1 className="pgTitle">
        {title} <span className="pgCount">{totalLabel}</span>
      </h1>
      <p className="pgSub">{sub}</p>
      {lead}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {tags.map((t) => (
          <span key={t} className="pgChip" style={{ padding: "6px 13px" }}>{t}</span>
        ))}
        {aiCta ? (
          <Link href="/tim-kiem-ai" className="pgChip" style={{ borderColor: "var(--accent-border)", color: "var(--brand-text)" }}>
            <Icon name="camera" size={15} /> Tìm mẫu bằng ảnh chụp
          </Link>
        ) : null}
      </div>

      <div className="pgLayout">
        {themed ? (
          <button
            type="button"
            className="stFiltersToggle"
            aria-expanded={filtersOpen}
            aria-controls="studio-listing-filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <span>Bộ lọc</span>
            <span className="stFiltersSummary">{activeFilterSummary}</span>
          </button>
        ) : null}
        <aside
          id={themed ? "studio-listing-filters" : undefined}
          className={themed ? "pgSide stFiltersPanel" : "pgSide"}
          data-open={themed ? String(filtersOpen) : undefined}
          aria-label="Bộ lọc"
        >
          <h3>Danh mục sản phẩm</h3>
          {categories.length === 0 ? (
            <p className="mpMuted">Đang tải danh mục…</p>
          ) : (
            categories.map((c) => (
              <label className="pgCheck" key={c.id}>
                <input type="radio" name="cat" checked={cat === String(c.id)} onChange={() => setCat(String(c.id))} />
                {c.name}
              </label>
            ))
          )}
          {cat ? (
            <button type="button" className="pgChip" style={{ marginTop: 6 }} onClick={() => setCat("")}>
              Bỏ chọn danh mục <Icon name="x" size={13} />
            </button>
          ) : null}
          <h3>Khoảng giá</h3>
          {PRICES.map((p) => (
            <label className="pgCheck" key={p.v}>
              <input type="radio" name="gia" checked={price === p.v} onChange={() => setPrice(p.v)} />
              {p.label}
            </label>
          ))}
          <h3>Kích thước (Size)</h3>
          {mode === "server" ? (
            <>
              <div className="pgSizes" role="group" aria-label="Kích thước từ máy chủ">
                {serverKichCo.length === 0 ? <span className="mpMuted">Không có lựa chọn nào.</span> : null}
                {serverKichCo.map((v) => (
                  <button key={v} type="button" className="pgSize" aria-pressed={activeKichCo === v} onClick={() => onFilter?.({ kichCo: activeKichCo === v ? "" : v })}>
                    {v}
                  </button>
                ))}
              </div>
              <h3>Màu sắc</h3>
              <div className="pgSizes" role="group" aria-label="Màu sắc từ máy chủ">
                {dedupeFacetValues(serverMauSac).length === 0 ? <span className="mpMuted">Không có lựa chọn nào.</span> : null}
                {dedupeFacetValues(serverMauSac).map((v) => (
                  <button key={v} type="button" className="pgSize" style={{ minWidth: 0 }} aria-pressed={activeMauSac === v} onClick={() => onFilter?.({ mauSac: activeMauSac === v ? "" : v })}>
                    {v}
                  </button>
                ))}
              </div>
              {facetsTruncated ? <p className="mpMuted" style={{ fontSize: 12 }}>Danh sách lựa chọn đã rút gọn (quá 200 giá trị).</p> : null}
              <p className="mpMuted" style={{ fontSize: 12, marginTop: 8 }}>Size/màu/danh mục/giá lọc toàn shop qua máy chủ.</p>
            </>
          ) : (
            <>
              <div className="pgSizes" role="group" aria-label="Kích thước">
                {SIZES.map((s) => (
                  <button key={s} type="button" className="pgSize" aria-pressed={size === s} onClick={() => setSize(size === s ? "" : s)}>
                    {s}
                  </button>
                ))}
              </div>
              <h3>Màu sắc</h3>
              <div className="pgSizes" role="group" aria-label="Màu sắc">
                {COLORS.map((c) => (
                  <button key={c.hex} type="button" className="pgSwatch" style={{ background: c.hex }} aria-label={`Màu ${c.label}`} aria-pressed={color === c.hex} onClick={() => setColor(color === c.hex ? "" : c.hex)} />
                ))}
              </div>
              <p className="mpMuted" style={{ fontSize: 12, marginTop: 8 }}>Danh mục/giá lọc toàn shop qua máy chủ. Size/màu lọc trong trang đang hiện theo biến thể shop khai báo (chưa có tham số máy chủ — xem CONTRACT_GAPS).</p>
            </>
          )}
          <button className="pgApply" type="button" onClick={apply}>Áp dụng bộ lọc</button>
          <button type="button" className="pgChip" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={clearAll}>
            Xóa tất cả bộ lọc
          </button>
        </aside>

        <div>
          <div className="pgToolbar">
            <div className="pgChips" aria-label="Đang lọc">
              {catName ? <span className="pgChip">{catName} <button type="button" aria-label="Xóa lọc danh mục" onClick={() => { setCat(""); onFilter?.({ maDanhMuc: "", price }); }}><Icon name="x" size={13} /></button></span> : null}
              {price ? <span className="pgChip">{priceLabel(price)} <button type="button" aria-label="Xóa lọc giá" onClick={() => { setPrice(""); onFilter?.({ maDanhMuc: cat, price: "" }); }}><Icon name="x" size={13} /></button></span> : null}
              {mode === "server" ? (
                <>
                  {activeKichCo ? <span className="pgChip">Size: {activeKichCo} <button type="button" aria-label="Xóa lọc size" onClick={() => onFilter?.({ kichCo: "" })}><Icon name="x" size={13} /></button></span> : null}
                  {activeMauSac ? <span className="pgChip">Màu: {activeMauSac} <button type="button" aria-label="Xóa lọc màu" onClick={() => onFilter?.({ mauSac: "" })}><Icon name="x" size={13} /></button></span> : null}
                </>
              ) : (
                <>
                  {size ? <span className="pgChip">Size: {size} <button type="button" aria-label="Xóa lọc size" onClick={() => setSize("")}><Icon name="x" size={13} /></button></span> : null}
                  {color ? <span className="pgChip">Màu: {COLORS.find((c) => c.hex === color)?.label} <button type="button" aria-label="Xóa lọc màu" onClick={() => setColor("")}><Icon name="x" size={13} /></button></span> : null}
                </>
              )}
              {!catName && !price && !size && !color ? <span className="mpMuted">Chưa lọc — đang hiện toàn bộ.</span> : null}
            </div>
            <label className="pgSort">
              Sắp xếp:
              {mode === "server" ? (
                <select value={activeSapXep || "id-asc"} onChange={(e) => onFilter?.({ sapXep: e.target.value })} aria-label="Sắp xếp toàn shop">
                  <option value="id-asc">Thứ tự mặc định</option>
                  <option value="price-asc">Giá tăng dần</option>
                  <option value="price-desc">Giá giảm dần</option>
                  <option value="name-asc">Tên A–Z</option>
                </select>
              ) : (
                <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp trong trang">
                  <option value="match">Thứ tự mặc định</option>
                  <option value="price-asc">Giá tăng dần</option>
                  <option value="price-desc">Giá giảm dần</option>
                  <option value="name">Tên A–Z</option>
                </select>
              )}
            </label>
          </div>
          {loading ? (
            <p className="pgState" role="status"><strong>Đang tải sản phẩm…</strong>Vui lòng chờ trong giây lát.</p>
          ) : error ? (
            <div className="pgState" role="alert">
              <strong>Không tải được sản phẩm</strong>
              <span>{error} Bộ lọc giữ nguyên — bấm thử lại.</span>
              {onRetry ? (
                <button type="button" className="pgApply" style={{ width: "auto", padding: "8px 16px", marginTop: 8 }} onClick={onRetry}>Thử lại</button>
              ) : null}
            </div>
          ) : cards.length === 0 ? (
            <p className="pgState"><strong>Không có sản phẩm phù hợp</strong>Thử nới bộ lọc hoặc xem toàn bộ danh sách.</p>
          ) : (
            <div className="pgGrid">
              {cards.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          {paging && paging.total > 0 ? (
            <div>
              <p className="mpMuted" style={{ textAlign: "center", marginTop: 18 }}>
                Đang hiển thị {products.length} trên {paging.total} sản phẩm
              </p>
              {paging.totalPages > 1 ? (
                <nav className="pgPager" aria-label="Phân trang">
                  <button type="button" className="pgApply" style={{ width: "auto", padding: "8px 16px" }} disabled={paging.page === 0} onClick={() => paging.onPage(paging.page - 1)}>‹ Trang trước</button>
                  <span aria-current="page" style={{ fontWeight: 800 }}>Trang {paging.page + 1}/{paging.totalPages}</span>
                  <button type="button" className="pgApply" style={{ width: "auto", padding: "8px 16px" }} disabled={paging.page + 1 >= paging.totalPages} onClick={() => paging.onPage(paging.page + 1)}>Trang tiếp ›</button>
                </nav>
              ) : null}
            </div>
          ) : null}
          <div className="pgState" style={{ marginTop: 18, display: "flex", gap: 14, alignItems: "center", textAlign: "left" }}>
            <Icon name="camera" size={30} />
            <div style={{ flex: 1 }}>
              <strong>Chưa tìm thấy mẫu áo ưng ý?</strong>
              <p style={{ fontSize: 13 }}>Tải ảnh mẫu bạn chụp — AI tìm ảnh gần giống trong bộ dữ liệu đã duyệt (kết quả là ảnh tập dữ liệu, chưa phải mã sản phẩm bán được).</p>
            </div>
            <Link href="/tim-kiem-ai" className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }}>Tải ảnh lên ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
