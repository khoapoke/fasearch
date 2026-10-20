"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { StitchImage } from "@/components/ui/stitch-image";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";
import { stitchImages } from "@/lib/stitch-assets";
import "./home.css";
import "@/components/storefront/listing.css";

const HOME = "fashionsearch_ai_trang_ch_th_ng_m_i_i_n_t";
const CAT_NAMES = ["Áo Thun Daily", "Quần Short", "Sơ Mi Công Sở", "Quần Dài Casual", "Áo Khoác Gió", "Đồ Lót Kháng Khuẩn", "Phụ Kiện & Tất"];

type PublicCategory = { maDanhMuc: number; tenDanhMuc: string };
type PublicProduct = {
  maSp: number; tenSp: string; maDanhMuc: number | null; tenDanhMuc: string | null;
  giaBan: number; coHinhAnh: boolean;
};

function img(i: number) {
  const all = stitchImages(HOME);
  return all[i];
}

export function HomeSections() {
  const [cats, setCats] = useState<PublicCategory[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const hero = img(0);
  const catImgs = [1, 2, 3, 4, 5, 6, 7].map(img);
  const best = [8, 9, 10, 11].map(img);

  useEffect(() => {
    let live = true;
    beFetch("v1/catalog/danh-muc")
      .then((r) => unwrap<PublicCategory[]>(r))
      .then((list) => live && setCats(list))
      .catch(() => live && setError("Không tải được danh mục. Vui lòng thử lại."));
    beFetch("v1/catalog/san-pham?page=0&size=4")
      .then((r) => unwrap<Page<PublicProduct>>(r))
      .then((page) => {
        if (!live) return;
        setProducts(page.data);
        setTotal(page.totalElements);
      })
      .catch(() => live && setError("Không tải được sản phẩm. Vui lòng thử lại."));
    return () => {
      live = false;
    };
  }, []);

  const cards: CardProduct[] = products.map((p, i) => ({
    id: p.maSp,
    name: p.tenSp,
    price: p.giaBan,
    image: p.coHinhAnh ? `/api/be/v1/catalog/san-pham/${p.maSp}/hinh-anh` : best[i % best.length]?.src,
    href: `/san-pham/${p.maSp}`,
    sold: undefined,
  }));

  return (
    <>
      <section className="hmHero">
        <div>
          <span className="hmKicker">Tìm kiếm AI theo ảnh</span>
          <h1 className="hmTitle">
            Tìm món đồ bạn thích, <span className="hl">bằng ảnh</span> hoặc bằng chữ
          </h1>
          <p className="hmSub">
            Tải ảnh outfit bạn thích để AI gợi ý món đồ tương tự trong danh mục thật,
            hoặc tìm bằng từ khóa. Kết quả tìm kiếm AI là ảnh trong bộ dữ liệu, chưa
            phải mã sản phẩm bán được.
          </p>
          <div className="hmCtas">
            <Link className="hmCta hmCtaPrimary" href="/tim-kiem-ai">
              Tìm bằng AI <Icon name="arrowRight" size={17} />
            </Link>
            <Link className="hmCta hmCtaGhost" href="/nam">
              Khám phá danh mục
            </Link>
          </div>
          <div className="hmAiMini">
            <Icon name="spark" size={22} />
            <div style={{ flex: 1 }}>
              <small>Tìm kiếm AI gợi ý phong cách</small>
              <b>Áo thun oversize phối quần short kaki cho dịp cuối tuần</b>
              <Link className="hmAiBtn" href="/tim-kiem-ai">Tìm kiếm →</Link>
            </div>
          </div>
        </div>
        <div className="hmHeroMedia">
          <StitchImage src={hero?.src} alt={hero?.alt || "Người mẫu thời trang"} eager />
        </div>
      </section>

      <section className="hmCats" aria-label="Danh mục nổi bật">
        <div className="hmSecHead">
          <h2>Danh mục nổi bật</h2>
          <Link href="/nam">Được nhiều tìm kiếm nhất trong tuần này →</Link>
        </div>
        <div className="hmCatRow">
          {CAT_NAMES.map((name, i) => (
            <Link key={name} className="hmCat" href={cats[i] ? `/nam?maDanhMuc=${cats[i].maDanhMuc}` : "/nam"}>
              <span className="img">
                <StitchImage src={catImgs[i]?.src} alt={catImgs[i]?.alt || name} />
              </span>
              {cats[i]?.tenDanhMuc ?? name}
            </Link>
          ))}
        </div>
      </section>

      <section className="hmAiBand" aria-label="Tìm bằng ảnh">
        <div className="hmAiCard">
          <div>
            <h2>Bắt gặp outfit đẹp?<br /><span className="hl">Thả ảnh vào đây để tìm đồ tương tự.</span></h2>
            <p>AI tìm ảnh gần giống trong bộ dữ liệu đã duyệt. Kết quả là ảnh tập dữ liệu, chưa phải mã sản phẩm bán được.</p>
            <div className="hmAiStats">
              <div><b>Tìm bằng ảnh</b><small>Chụp là tìm</small></div>
              <div><b>Tìm ảnh gần giống</b><small>Theo độ tương đồng ảnh</small></div>
              <div><b>Kết quả từ tập dữ liệu</b><small>Chưa phải mã sản phẩm</small></div>
            </div>
            <div className="hmTags">
              <span>Tìm theo ảnh</span>
              <span>Kết quả là ảnh tập dữ liệu</span>
            </div>
          </div>
          <div className="hmDrop">
            <span className="hmDropIco"><Icon name="upload" size={24} /></span>
            <b>Kéo thả ảnh outfit vào đây hoặc chụp trực tiếp</b>
            <p>Hỗ trợ JPG/PNG tới 5MB. Ảnh chỉ xử lý preview trên trình duyệt.</p>
            <div className="hmDropRow">
              <Link className="hmCta hmCtaPrimary" href="/lich-su-ai">Tải ảnh lên ngay</Link>
              <Link className="hmCta hmCtaGhost" href="/lich-su-ai">Mở camera</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="hmBest" aria-label="Sản phẩm bán chạy nhất">
        <div className="hmSecHead">
          <h2 style={{ fontSize: 22, letterSpacing: "-0.02em", textTransform: "none" }}>Sản Phẩm Nổi Bật{typeof total === "number" ? ` (${total})` : ""}</h2>
        </div>
        <div className="hmTabs" role="list">
          {["Tất cả", "Áo Thun", "Quần Short", "Sơ Mi & Polo", "Đồ Thể Thao"].map((t, i) => (
            <Link key={t} href="/nam" aria-current={i === 0 ? "true" : undefined}>{t}</Link>
          ))}
        </div>
        {error ? (
          <p className="pgState" role="alert"><strong>Không tải được sản phẩm</strong>{error}</p>
        ) : (
          <div className="pgGrid">
            {cards.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        <div className="hmMore">
          <Link href="/nam">Xem tất cả{typeof total === "number" ? ` ${total}` : ""} sản phẩm <Icon name="arrowRight" size={16} /></Link>
        </div>
      </section>

      <section className="hmCollections" aria-label="Bộ sưu tập">
        <div className="hmCol">
          <StitchImage src={stitchImages(HOME)[8]?.src} alt="Ảnh minh họa đồ thể thao" />
          <div>
            <small>Lookbook</small>
            <h3>Đồ thể thao</h3>
            <p>Ảnh minh họa từ bản thiết kế. Sản phẩm thật nằm trong danh mục.</p>
            <Link href="/bo-suu-tap">Xem sản phẩm →</Link>
          </div>
        </div>
        <div className="hmCol">
          <StitchImage src={stitchImages(HOME)[10]?.src} alt="Ảnh minh họa phong cách tối giản" />
          <div>
            <small>Lookbook</small>
            <h3>Phong cách tối giản</h3>
            <p>Ảnh minh họa từ bản thiết kế. Sản phẩm thật nằm trong danh mục.</p>
            <Link href="/bo-suu-tap">Xem sản phẩm →</Link>
          </div>
        </div>
      </section>

      <section className="hmTrust" aria-label="Điều hệ thống thực thi">
        {[
          { icon: "check" as UiIcon, t: "Thanh toán khi nhận hàng", d: "Đơn COD, máy chủ ghi nhận khi khách nhận." },
          { icon: "box" as UiIcon, t: "Tồn kho theo kho phục vụ", d: "Số lượng hiển thị theo kho đang phục vụ đơn." },
          { icon: "truck" as UiIcon, t: "Phí vận chuyển do máy chủ tính", d: "Hiển thị ở bước thanh toán." },
          { icon: "ticket" as UiIcon, t: "Voucher tại trang ưu đãi", d: "Nhập mã giảm giá khi thanh toán." },
        ].map((b) => (
          <div key={b.t}>
            <span className="hmTrustIco"><Icon name={b.icon as UiIcon} size={20} /></span>
            <div><b>{b.t}</b><small>{b.d}</small></div>
          </div>
        ))}
      </section>
    </>
  );
}
