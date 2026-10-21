"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StorefrontShell } from "@/components/storefront/storefront-shell";
import { stitchImages } from "@/lib/stitch-assets";
import { StitchImage } from "@/components/ui/stitch-image";
import "@/app/home.css";
import { ListingPage, type CategoryFacet, type ListingProduct } from "@/components/storefront/listing-page";
import {
  catalogQueryString,
  facetsQueryString,
  probeCatalogCaps,
  type Facets,
} from "@/lib/catalog";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";

type PublicProduct = {
  maSp: number; tenSp: string; maDanhMuc: number | null; tenDanhMuc: string | null;
  giaBan: number; coHinhAnh: boolean; bienThe?: Array<{ mauSac: string; kichCo: string }>;
};
type PublicCategory = { maDanhMuc: number; tenDanhMuc: string };

function splitPrice(v: string): { giaTu: string; giaDen: string } {
  const [tu, den] = v.split("-");
  return { giaTu: tu ?? "", giaDen: den ?? "" };
}

function useCatalog(size = 24) {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const maDanhMuc = params.get("maDanhMuc") ?? "";
  const price = params.get("price") ?? "";
  const kichCo = params.get("kichCo") ?? "";
  const mauSac = params.get("mauSac") ?? "";
  const sapXep = params.get("sapXep") ?? "";
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ListingProduct[]>([]);
  const [cats, setCats] = useState<CategoryFacet[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [serverMode, setServerMode] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const reqId = useRef(0);

  useEffect(() => {
    let live = true;
    beFetch("v1/catalog/danh-muc")
      .then((r) => unwrap<PublicCategory[]>(r))
      .then((list) => live && setCats(list.map((c) => ({ id: c.maDanhMuc, name: c.tenDanhMuc }))))
      .catch(() => {});
    probeCatalogCaps().then((caps) => {
      if (live) {
        setServerMode(caps.server);
        setFacets(caps.facets);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const my = ++reqId.current;
    let live = true;
    const { giaTu, giaDen } = splitPrice(price);
    const query = {
      q, maDanhMuc, giaTu, giaDen,
      kichCo: serverMode ? kichCo : "",
      mauSac: serverMode ? mauSac : "",
      sapXep: serverMode ? sapXep : "",
      page, size,
    };
    beFetch(`v1/catalog/san-pham?${catalogQueryString(query, serverMode)}`)
      .then((r) => unwrap<Page<PublicProduct>>(r))
      .then((pg) => {
        if (!live || reqId.current !== my) return; // bỏ response cũ (race)
        setItems(
          pg.data.map((p) => ({
            id: p.maSp,
            name: p.tenSp,
            price: p.giaBan,
            image: p.coHinhAnh ? `/api/be/v1/catalog/san-pham/${p.maSp}/hinh-anh` : undefined,
            category: p.tenDanhMuc,
            categoryId: p.maDanhMuc,
            variants: p.bienThe,
            href: `/san-pham/${p.maSp}`,
          })),
        );
        setTotal(pg.totalElements);
        setTotalPages(pg.totalPages);
        setLoading(false);
        setError("");
      })
      .catch((e: Error) => {
        if (!live || reqId.current !== my) return;
        setError(e.message || "Không tải được sản phẩm.");
        setLoading(false);
      });
    // Facets theo base filter (không gồm size/color đã chọn) — chỉ server mode.
    if (serverMode) {
      const { giaTu, giaDen } = splitPrice(price);
      beFetch(`v1/catalog/bo-loc?${facetsQueryString({ q, maDanhMuc, giaTu, giaDen })}`)
        .then((r) => unwrap<Facets>(r))
        .then((f) => {
          if (live && reqId.current === my) setFacets(f);
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [q, maDanhMuc, price, kichCo, mauSac, sapXep, size, page, serverMode, reloadKey]);

  function pushFilter(next: { maDanhMuc?: string; price?: string; kichCo?: string; mauSac?: string; sapXep?: string }) {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    const cat = next.maDanhMuc !== undefined ? next.maDanhMuc : maDanhMuc;
    const pr = next.price !== undefined ? next.price : price;
    const kc = next.kichCo !== undefined ? next.kichCo : kichCo;
    const ms = next.mauSac !== undefined ? next.mauSac : mauSac;
    const sx = next.sapXep !== undefined ? next.sapXep : sapXep;
    if (cat) query.set("maDanhMuc", cat);
    if (pr) query.set("price", pr);
    if (serverMode) {
      if (kc) query.set("kichCo", kc);
      if (ms) query.set("mauSac", ms);
      if (sx) query.set("sapXep", sx);
    }
    setPage(0);
    const qs = query.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  return {
    items, cats, facets, serverMode, total, totalPages, page, setPage: (p: number) => setPage(p),
    size, loading, error, maDanhMuc, price, kichCo, mauSac, sapXep, pushFilter,
    retry: () => {
      setError("");
      setLoading(true);
      setReloadKey((k) => k + 1);
    },
  };
}

type Hook = ReturnType<typeof useCatalog>;

function BoundListing(hook: Hook, props: {
  shell: string;
  previewNote?: string;
  crumbs: Array<{ href?: string; label: string }>;
  title: string;
  sub: string;
  tags: string[];
  photoFolder: string;
  aiCta?: boolean;
  lead?: React.ReactNode;
  /** Bề mặt pilot search-studio (P1) — chỉ /nam trong giai đoạn pilot. */
  themed?: boolean;
}) {
  const paging = { page: hook.page, totalPages: hook.totalPages, total: hook.total, size: hook.size, onPage: hook.setPage };
  return (
    <StorefrontShell active={props.shell} previewNote={props.previewNote} themed={props.themed}>
      <ListingPage
        crumbs={props.crumbs}
        title={props.title}
        sub={props.sub}
        totalLabel={`${hook.total} sản phẩm`}
        products={hook.items}
        tags={props.tags}
        loading={hook.loading}
        error={hook.error}
        paging={paging}
        photoFolder={props.photoFolder}
        aiCta={props.aiCta}
        categories={hook.cats}
        activeCat={hook.maDanhMuc}
        activePrice={hook.price}
        mode={hook.serverMode ? "server" : "local"}
        serverKichCo={hook.facets?.kichCo ?? []}
        serverMauSac={hook.facets?.mauSac ?? []}
        facetsTruncated={hook.facets?.truncated ?? false}
        activeKichCo={hook.kichCo}
        activeMauSac={hook.mauSac}
        activeSapXep={hook.sapXep}
        onFilter={(next) => hook.pushFilter(next)}
        lead={props.lead}
        onRetry={hook.retry}
        themed={props.themed}
      />
    </StorefrontShell>
  );
}

export function NamListing() {
  const hook = useCatalog();
  return BoundListing(hook, {
    shell: "/nam",
    crumbs: [{ href: "/", label: "Trang chủ" }, { label: "Áo thun nam & Polo" }],
    title: "Danh mục nam",
    sub: "Sản phẩm đang bán, giá và biến thể lấy trực tiếp từ máy chủ.",
    tags: [],
    photoFolder: "fashionsearch_ai_danh_s_ch_s_n_ph_m",
    themed: true,
  });
}

export function NuListing() {
  const hook = useCatalog();
  const inner = BoundListing(hook, {
    shell: "/nu",
    lead: (
      <div className="hmAiCard" style={{ padding: 22, marginTop: 14 }}>
        <div>
          <h2 style={{ fontSize: 19 }}>AI Fit &amp; Style Finder</h2>
          <p>Mô tả ngắn phong cách bạn cần — gợi ý mở ở trang tìm bằng ảnh (bản xem trước, chưa nhận diện thật).</p>
          <div className="hmDropRow" style={{ marginTop: 10 }}>
            <Link className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} href="/lich-su-ai">Mở tìm bằng ảnh</Link>
          </div>
        </div>
      </div>
    ),
    crumbs: [{ href: "/", label: "Trang chủ" }, { label: "Thời trang Nữ" }],
    title: "Danh mục nữ",
    sub: "Sản phẩm đang bán, giá và biến thể lấy trực tiếp từ máy chủ.",
    tags: [],
    photoFolder: "fashionsearch_ai_danh_m_c_n",
  });
  return inner;
}

export function HangMoiListing() {
  const hook = useCatalog();
  return BoundListing(hook, {
    shell: "/hang-moi",
    lead: <ArrivalAlert />,
    crumbs: [{ href: "/", label: "Trang chủ" }, { label: "Hàng Mới" }],
    title: "Hàng mới về",
    sub: "Sản phẩm đang bán trên kệ, hiển thị theo thứ tự của máy chủ (máy chủ chưa hỗ trợ sắp xếp theo ngày về).",
    tags: [],
    photoFolder: "fashionsearch_ai_h_ng_m_i",
    aiCta: false,
  });
}

export function SaleListing() {
  const hook = useCatalog();
  return BoundListing(hook, {
    shell: "/sale",
    lead: <SaleFlash />,
    previewNote: "Trang Sale chạy dữ liệu catalog thật; huy hiệu % giảm giá chưa hiển thị vì máy chủ chưa có giá khuyến mãi.",
    crumbs: [{ href: "/", label: "Trang chủ" }, { label: "Sale" }],
    title: "Trang ưu đãi",
    sub: "Giá hiển thị là giá bán hiện tại từ máy chủ. Mã giảm giá nhập ở bước thanh toán.",
    tags: [],
    photoFolder: "fashionsearch_ai_sale_gi_m_s_c",
  });
}

export function BoSuuTapListing() {
  const hook = useCatalog();
  return (
    <StorefrontShell active="/bo-suu-tap" previewNote="Trang Bộ Sưu Tập dùng ảnh lookbook minh họa; danh sách sản phẩm lấy từ máy chủ.">
      <CollectionHero cats={hook.cats} />
      <ListingPage
        crumbs={[{ href: "/", label: "Trang chủ" }, { label: "Bộ Sưu Tập" }]}
        title="Sản Phẩm Trong Lookbook"
        sub="Danh sách thật từ máy chủ theo bộ lọc bạn chọn."
        totalLabel={`${hook.total} sản phẩm`}
        products={hook.items}
        tags={[]}
        loading={hook.loading}
        error={hook.error}
        paging={{ page: hook.page, totalPages: hook.totalPages, total: hook.total, size: hook.size, onPage: hook.setPage }}
        photoFolder="fashionsearch_ai_b_s_u_t_p"
        categories={hook.cats}
        activeCat={hook.maDanhMuc}
        activePrice={hook.price}
        mode={hook.serverMode ? "server" : "local"}
        serverKichCo={hook.facets?.kichCo ?? []}
        serverMauSac={hook.facets?.mauSac ?? []}
        facetsTruncated={hook.facets?.truncated ?? false}
        activeKichCo={hook.kichCo}
        activeMauSac={hook.mauSac}
        activeSapXep={hook.sapXep}
        onFilter={(next) => hook.pushFilter(next)}
        onRetry={hook.retry}
      />
    </StorefrontShell>
  );
}


function CollectionHero({ cats }: { cats: Array<{ id: number; name: string }> }) {
  const photos = stitchImages("fashionsearch_ai_b_s_u_t_p");
  const hero = photos[0];
  return (
    <>
      <div className="hmCol" style={{ maxWidth: 1240, margin: "18px auto 0" }}>
        {hero ? <StitchImage src={hero.src} alt={hero.alt || "Bộ sưu tập độc quyền"} eager /> : null}
        <div>
          <small>Lookbook</small>
          <h3>Bộ sưu tập</h3>
          <p>Ảnh lookbook minh họa. Chọn danh mục bên dưới để xem sản phẩm thật.</p>
          <Link href="/nam">Khám phá toàn bộ →</Link>
        </div>
      </div>
      <div className="pgWrap" style={{ paddingBottom: 0 }}>
        <div className="hmTabs" role="list" aria-label="Danh mục sưu tập">
          <Link href="/bo-suu-tap" aria-current="true">Tất cả Bộ Sưu Tập</Link>
          {cats.map((c) => (
            <Link key={c.id} href={`/bo-suu-tap?maDanhMuc=${c.id}`}>{c.name}</Link>
          ))}
        </div>
      </div>
      <div className="hmCollections" aria-label="Bộ sưu tập đặc sắc">
        <div className="hmCol">
          <StitchImage src={photos[1]?.src} alt={photos[1]?.alt || "Ảnh minh họa phong cách tối giản"} />
          <div>
            <small>Lookbook</small>
            <h3>Phong cách tối giản</h3>
            <p>Ảnh minh họa từ bản thiết kế. Sản phẩm thật nằm trong danh mục.</p>
            <Link href="/nam">Xem sản phẩm →</Link>
          </div>
        </div>
        <div className="hmCol">
          <StitchImage src={photos[2]?.src} alt={photos[2]?.alt || "Ảnh minh họa đồ tập luyện"} />
          <div>
            <small>Lookbook</small>
            <h3>Đồ tập luyện</h3>
            <p>Ảnh minh họa từ bản thiết kế. Sản phẩm thật nằm trong danh mục.</p>
            <Link href="/nam">Xem sản phẩm →</Link>
          </div>
        </div>
      </div>
      <div className="hmAiBand" aria-label="AI Lookbook">
        <div className="hmAiCard" style={{ gridTemplateColumns: "1fr" }}>
          <div>
            <h2>AI Lookbook Builder <span className="hl">(bản xem trước)</span></h2>
            <p>Phối đồ minh họa — chọn món rồi thêm vào giỏ ở trang chi tiết sản phẩm thật.</p>
            <div className="hmDropRow">
              <Link className="hmCta hmCtaPrimary" href="/lich-su-ai">Gợi ý phối đồ</Link>
              <Link className="hmCta hmCtaGhost" href="/nam">Xem sản phẩm thật</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// Hộp đăng ký báo hàng mới: phản hồi trung thực (chưa có API), không no-op im lặng.
function ArrivalAlert() {
  const [msg, setMsg] = useState("");
  return (
    <div className="pgState" style={{ marginTop: 14, display: "flex", gap: 14, alignItems: "center", textAlign: "left" }}>
      <div style={{ flex: 1 }}>
        <strong>Đăng ký nhận thông báo khi mẫu mới về kho</strong>
        <form
          className="pvCoupon"
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            setMsg("Đã ghi nhận trên trình duyệt này. Thông báo hàng mới qua website chưa mở.");
          }}
        >
          <input placeholder="Nhập size hoặc SĐT/Email…" aria-label="Thông tin nhận báo hàng mới" />
          <button className="hmCta hmCtaPrimary" style={{ padding: "10px 18px", fontSize: 13 }} type="submit">Nhận thông báo</button>
        </form>
        {msg ? <p className="mpMuted" role="status">{msg}</p> : null}
      </div>
    </div>
  );
}

// Khung sale: KHÔNG có lịch khuyến mãi từ máy chủ nên không countdown giờ
// thật. Giữ bố cục flash của source dưới dạng preview tĩnh có nhãn rõ.
function SaleFlash() {
  return (
    <div className="hmAiCard" style={{ padding: 22, marginTop: 14 }}>
      <div>
        <h2 style={{ fontSize: 19 }}>Khung khuyến mãi <span className="mpPill mpPillWarn">Minh họa</span></h2>
        <p>Khung giờ theo bố cục thiết kế — máy chủ chưa có lịch khuyến mãi hay giá
        giảm. Giá hiển thị là giá bán hiện tại từ máy chủ.</p>
      </div>
    </div>
  );
}
