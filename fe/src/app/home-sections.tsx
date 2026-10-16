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
          <span className="hmKicker">✦ Công Nghệ Tìm Kiếm Đa Phương Thức</span>
          <h1 className="hmTitle">
            THỜI TRANG CÔNG NGHỆ <span className="hl">MỚI</span> • TÌM MỌI <span className="hl">OUTFIT BẰNG AI</span>
          </h1>
          <p className="hmSub">
            Chụp ảnh hoặc tải lên bất kỳ outfit nào để nhận gợi ý phối đồ. AI thời trang
            phân tích phom dáng, chất liệu và phối màu trong tích tắc.
          </p>
          <div className="hmCtas">
            <Link className="hmCta hmCtaPrimary" href="/nam">
              Khám Phá Ngay <Icon name="arrowRight" size={17} />
            </Link>
            <Link className="hmCta hmCtaGhost" href="/lich-su-ai">
              Thử Tìm Bằng Ảnh
            </Link>
          </div>
          <div className="hmAiMini">
            <Icon name="spark" size={22} />
            <div style={{ flex: 1 }}>
              <small>TÌM KIẾM AI GỢI Ý PHONG CÁCH</small>
              <b>Áo thun oversize phối quần short kaki cho dịp cuối tuần</b>
              <Link className="hmAiBtn" href="/lich-su-ai">Tìm Kiếm →</Link>
            </div>
          </div>
        </div>
        <div className="hmHeroMedia">
          <StitchImage src={hero?.src} alt={hero?.alt || "Người mẫu thời trang"} eager />
          <p className="hmDetect">
            <Icon name="camera" size={20} />
            <span>
              <b>AI OBJECT DETECTION: 2 ITEMS</b>
              <span>Áo Cotton Compact 220gsm · Quần Short 7 inch</span>
            </span>
            <span className="ok">Preview</span>
          </p>
        </div>
      </section>

      <section className="hmCats" aria-label="Danh mục nổi bật">
        <div className="hmSecHead">
          <h2>DANH MỤC NỔI BẬT <span className="dot">•</span></h2>
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
            <p>Công nghệ AI nhận diện phom dáng, chất liệu và màu sắc từ ảnh chụp đường phố, tạp chí hay mạng xã hội.</p>
            <div className="hmAiStats">
              <div><b>Tìm bằng ảnh</b><small>Chụp là tìm</small></div>
              <div><b>Gợi ý phối đồ</b><small>Theo dáng &amp; màu</small></div>
              <div><b>So sánh tương tự</b><small>Trong catalog thật</small></div>
            </div>
            <div className="hmTags">
              <span>#Outfit-Hè-Quốc-Dân</span>
              <span>#Gym-Activewear</span>
              <span>#Mẫu-Mới-Chống-Nhăn</span>
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
          <StitchImage src={stitchImages(HOME)[8]?.src} alt="BST Activewear" />
          <div>
            <small>PERFORMANCE TECH</small>
            <h3>Activewear &amp; Gym Collection</h3>
            <p>Chất liệu Quick-Dry siêu thoáng, co giãn 4 chiều cho buổi tập bùng nổ.</p>
            <Link href="/bo-suu-tap">Khám Phá Dòng Active →</Link>
          </div>
        </div>
        <div className="hmCol">
          <StitchImage src={stitchImages(HOME)[10]?.src} alt="BST Clean Fit" />
          <div>
            <small>URBAN MINIMALISM</small>
            <h3>Everyday Clean Fit</h3>
            <p>Phom dáng tinh giản, màu trung tính — mặc đẹp mỗi ngày.</p>
            <Link href="/bo-suu-tap">Xem Lookbook Clean Fit →</Link>
          </div>
        </div>
      </section>

      <section className="hmTrust" aria-label="Cam kết">
        {[
          { icon: "refresh", t: "Đổi trả 7 ngày miễn phí", d: "Đổi size/mẫu trong 7 ngày kể từ ngày nhận hàng." },
          { icon: "shield", t: "Tự hào Sản xuất tại VN", d: "Xưởng may đạt chuẩn, kiểm soát từng đường kim." },
          { icon: "phone", t: "Dịch vụ tư vấn 24/7", d: "Hotline 1900 6868, hỗ trợ chọn size mỗi ngày." },
          { icon: "truck" as UiIcon, t: "Giao hàng tốc 24h", d: "Nội thành TP.HCM & Hà Nội nhận trong 24 giờ." },
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
