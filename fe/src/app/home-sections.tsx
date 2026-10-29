"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import { beFetch, unwrap, type Page } from "@/lib/mgmt-client";
import {
  HOME_DEMO,
  HOME_DEMO_STEPS,
  HOME_PHOTOS,
  homeDiscoveryState,
  type HomeCategory,
  type HomeDemoStep,
  type HomePhoto,
  type HomeProduct,
} from "./home-data";
import "./home.css";
import "@/components/storefront/listing.css";

type PublicCategory = { maDanhMuc: number; tenDanhMuc: string };
type PublicProduct = {
  maSp: number; tenSp: string; maDanhMuc: number | null; tenDanhMuc: string | null;
  giaBan: number; coHinhAnh: boolean;
};

const DISCOVERY_ERROR = "Không tải được sản phẩm. Vui lòng thử lại.";

/**
 * Ảnh Home có khung tỉ lệ cố định (không nhảy layout) và báo LỖI TẢI rõ ràng
 * thay vì im lặng bỏ ảnh (A2: "stable image dimensions and explicit image failure").
 */
function HomePhotoFrame({
  photo,
  className,
  eager = false,
}: {
  photo: HomePhoto;
  className: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={className}>
      {failed ? (
        <span className="hmImgFail" role="img" aria-label={`Không tải được ảnh: ${photo.alt}`}>
          Không tải được ảnh minh họa
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài (Unsplash), không dùng Image optimizer
        <img
          src={photo.src}
          alt={photo.alt}
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          // Ảnh có thể LỖI TRƯỚC khi React hydrate (chặn mạng, offline, ảnh 404):
          // khi đó onError đã xảy ra rồi và sẽ không bắn lại, nên kiểm ngay lúc gắn ref.
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setFailed(true);
          }}
        />
      )}
    </span>
  );
}

function PhotoCredit({ photo }: { photo: HomePhoto }) {
  return (
    <span className="hmCredit">
      Ảnh minh họa:{" "}
      <a href={photo.page} target="_blank" rel="noopener noreferrer">
        {photo.sourceLabel} · {photo.author}
      </a>
    </span>
  );
}

export function HomeSections() {
  const [categories, setCategories] = useState<HomeCategory[] | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [products, setProducts] = useState<HomeProduct[] | null>(null);
  const [productsTotal, setProductsTotal] = useState<number | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Bản tĩnh hoàn chỉnh là mặc định: mở Home là thấy ngay kết quả của cả ba bước.
  const [step, setStep] = useState<HomeDemoStep>("explore");
  const stepRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let live = true;
    beFetch("v1/catalog/danh-muc")
      .then((r) => unwrap<PublicCategory[]>(r))
      .then((list) => {
        if (!live) return;
        setCategories(list.map((c) => ({ id: c.maDanhMuc, name: c.tenDanhMuc })));
      })
      .catch(() => {
        if (live) setCategoryError("Không tải được danh mục.");
      });
    beFetch("v1/catalog/san-pham?page=0&size=4")
      .then((r) => unwrap<Page<PublicProduct>>(r))
      .then((page) => {
        if (!live) return;
        setProducts(
          page.data.map((p) => ({
            id: p.maSp,
            name: p.tenSp,
            price: p.giaBan,
            image: p.coHinhAnh ? `/api/be/v1/catalog/san-pham/${p.maSp}/hinh-anh` : undefined,
            href: `/san-pham/${p.maSp}`,
          })),
        );
        setProductsTotal(page.totalElements);
      })
      .catch(() => {
        if (live) setProductError(DISCOVERY_ERROR);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const retry = useCallback(() => {
    // Đặt lại trạng thái ở đây (không trong effect) để effect chỉ còn tác dụng phụ mạng.
    setProducts(null);
    setProductsTotal(null);
    setCategoryError(null);
    setProductError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const discovery = homeDiscoveryState({
    categories,
    categoriesError: categoryError,
    products,
    productsTotal,
    productsError: productError,
  });

  const cards: CardProduct[] = (discovery.status === "ready" ? discovery.products : []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    image: p.image,
    href: p.href,
  }));

  function selectStep(next: HomeDemoStep) {
    setStep(next);
    // Trả tiêu điểm về nút vừa chọn để người dùng bàn phím biết trạng thái đã đổi.
    stepRefs.current[next]?.focus();
  }

  const stepIndex = HOME_DEMO_STEPS.findIndex((s) => s.id === step);
  const showTags = stepIndex >= 1;
  const statusText =
    step === "describe"
      ? "Mô tả món đồ bạn muốn tìm."
      : step === "suggest"
        ? `Đối chiếu mô tả với danh mục: ${HOME_DEMO.tags.map((t) => t.value).join(" · ")}.`
        : "Một gợi ý phù hợp trong danh mục mẫu.";

  return (
    <div className="hmHome">
      <section className="hmHero" aria-labelledby="hm-hero-title">
        <div className="hmHeroCopy">
          <h1 className="hmHeroTitle" id="hm-hero-title">Tìm đồ theo ảnh</h1>
          <p className="hmHeroLede">Tìm món đồ hợp gu từ ảnh hoặc vài dòng mô tả.</p>
          <div className="hmHeroActions">
            <Link className="hmCta hmCtaBrand" href="/tim-kiem-ai">
              <Icon name="search" size={17} /> Tìm bằng AI
            </Link>
            <Link className="hmCta hmCtaOutline" href="/nam">
              Xem danh mục <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
        <figure className="hmHeroFigure">
          <HomePhotoFrame photo={HOME_PHOTOS.hero} className="hmHeroMedia" eager />
          <figcaption>
            <PhotoCredit photo={HOME_PHOTOS.hero} />
          </figcaption>
        </figure>
      </section>

      <section className="hmModes" aria-labelledby="hm-modes-title">
        <h2 className="hmSectionTitle" id="hm-modes-title">Tìm theo cách của bạn</h2>
        <ul className="hmModeList">
          {[
            { id: "text", icon: "search" as UiIcon, label: "Mô tả" },
            { id: "image", icon: "upload" as UiIcon, label: "Ảnh" },
            { id: "composed", icon: "spark" as UiIcon, label: "Kết hợp" },
          ].map((m) => (
            <li key={m.id}>
              <Link className="hmMode" href="/tim-kiem-ai">
                <span className="hmModeIcon" aria-hidden="true"><Icon name={m.icon} size={19} /></span>
                <span className="hmModeCopy"><strong>{m.label}</strong></span>
                <span className="hmModeGo" aria-hidden="true"><Icon name="arrowRight" size={16} /></span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="hmNote">Chọn cách tìm ở trang tìm kiếm — Home không tự chọn hay tự gửi thay bạn.</p>
      </section>

      <section
        className="hmDemo"
        aria-labelledby="hm-demo-title"
        aria-describedby="hm-demo-note"
        data-step={step}
      >
        <header className="hmDemoHead">
          <div>
            <p className="hmKicker">01 · Tìm bằng AI</p>
            <h2 className="hmSectionTitle" id="hm-demo-title">Tìm món đồ hợp gu.</h2>
          </div>
          <p className="hmDemoNote" id="hm-demo-note">Ví dụ minh họa</p>
        </header>

        <div className="hmDemoSteps" role="group" aria-label="Các bước của ví dụ minh họa">
          {HOME_DEMO_STEPS.map((s) => (
            <button
              key={s.id}
              ref={(el) => { stepRefs.current[s.id] = el; }}
              className="hmDemoStep"
              type="button"
              aria-pressed={step === s.id}
              onClick={() => selectStep(s.id)}
            >
              <span aria-hidden="true">{s.index}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="hmDemoLayout">
          <div className="hmDemoPrompt">
            <div className="hmDemoPromptTop">
              <span>Bạn mô tả</span>
              <span className="hmDemoPromptMark" aria-hidden="true">Aa</span>
            </div>
            <div className="hmQuery">
              <span className="hmQueryIcon" aria-hidden="true">↳</span>
              <p className="hmQueryCopy">{HOME_DEMO.query}</p>
            </div>
            {showTags ? (
              <dl className="hmTags">
                {HOME_DEMO.tags.map((t) => (
                  <div key={t.label}>
                    <dt>{t.label}</dt>
                    <dd>{t.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="hmDemoStatus" role="status">{statusText}</p>
          </div>

          <div className="hmDemoOutcome">
            {step === "describe" ? (
              <p className="hmOutcomeIdle">Gợi ý từ mô tả của bạn</p>
            ) : null}

            {step === "suggest" ? (
              <div className="hmSuggestion">
                <svg
                  className="hmSuggestionIcon"
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="13" cy="13" r="8" />
                  <path d="m19 19 8 8M9 13l3 3 5-6" />
                </svg>
                <p>Minh họa tìm gợi ý</p>
                <span>Đối chiếu mô tả với danh mục.</span>
              </div>
            ) : null}

            {step === "explore" ? (
              <div className="hmResult">
                <p className="hmMiniLabel">1 gợi ý</p>
                <div className="hmResultCard">
                  <HomePhotoFrame photo={HOME_DEMO.product.photo} className="hmResultMedia" />
                  <div className="hmResultCopy">
                    <span className="hmResultOverline">{HOME_DEMO.product.overline}</span>
                    <strong>{HOME_DEMO.product.name}</strong>
                    <span>{HOME_DEMO.product.subtitle}</span>
                    <span className="hmResultPrice">{HOME_DEMO.product.priceLabel}</span>
                  </div>
                </div>
                <p className="hmResultCredit"><PhotoCredit photo={HOME_DEMO.product.photo} /></p>
                <Link className="hmTry" href="/tim-kiem-ai">
                  Thử tìm kiếm <span aria-hidden="true">↗</span>
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <p className="hmDisclosure">{HOME_DEMO.disclosure}</p>
      </section>

      {discovery.status === "ready" || discovery.status === "partial" || discovery.status === "empty" ? (
        discovery.categories.length > 0 ? (
          <section className="hmCats" aria-labelledby="hm-cats-title">
            <div className="hmSecHead">
              <h2 className="hmSectionTitle" id="hm-cats-title">Danh mục nổi bật</h2>
              <Link href="/nam">Xem tất cả sản phẩm →</Link>
            </div>
            <div className="hmCatRow">
              {discovery.categories.slice(0, 7).map((c) => (
                <Link key={c.id} className="hmCat" href={`/nam?maDanhMuc=${c.id}`}>
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null
      ) : null}

      <section className="hmBest" aria-labelledby="hm-best-title">
        <div className="hmSecHead">
          <h2 className="hmSectionTitle" id="hm-best-title">
            Sản phẩm nổi bật{discovery.status === "ready" ? ` (${discovery.total})` : ""}
          </h2>
          <Link href="/nam">Xem cả danh mục →</Link>
        </div>

        {discovery.status === "loading" ? (
          <p className="hmState" role="status">
            <strong>Đang tải sản phẩm…</strong>
            Đang lấy danh mục thật từ máy chủ.
          </p>
        ) : null}

        {discovery.status === "error" ? (
          <div className="hmState hmStateError" role="alert">
            <strong>Không tải được sản phẩm</strong>
            <span>{discovery.message} Không hiển thị dữ liệu thay thế.</span>
            <button className="hmCta hmCtaBrand hmRetry" type="button" onClick={retry}>Thử lại</button>
          </div>
        ) : null}

        {discovery.status === "partial" ? (
          <div className="hmState hmStateError" role="alert">
            <strong>Danh mục có, sản phẩm chưa tải được</strong>
            <span>{discovery.productError} Danh mục bên trên vẫn là dữ liệu thật từ máy chủ.</span>
            <button className="hmCta hmCtaBrand hmRetry" type="button" onClick={retry}>Thử lại</button>
          </div>
        ) : null}

        {discovery.status === "empty" ? (
          <p className="hmState" role="status">
            <strong>Danh mục đang trống</strong>
            Máy chủ trả về 0 sản phẩm. <Link href="/nam">Xem trang danh mục →</Link>
          </p>
        ) : null}

        {discovery.status === "ready" ? (
          <>
            <div className="pgGrid">
              {cards.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <div className="hmMore">
              <Link href="/nam">
                Xem tất cả {discovery.total} sản phẩm <Icon name="arrowRight" size={16} />
              </Link>
            </div>
          </>
        ) : null}
      </section>

      <section className="hmTrust" aria-label="Điều hệ thống thực thi">
        {[
          { icon: "check" as UiIcon, t: "Thanh toán khi nhận hàng", d: "Đơn COD, máy chủ ghi nhận khi khách nhận." },
          { icon: "box" as UiIcon, t: "Tồn kho theo kho phục vụ", d: "Số lượng hiển thị theo kho đang phục vụ đơn." },
          { icon: "truck" as UiIcon, t: "Phí vận chuyển do máy chủ tính", d: "Hiển thị ở bước thanh toán." },
          { icon: "ticket" as UiIcon, t: "Voucher tại trang ưu đãi", d: "Nhập mã giảm giá khi thanh toán." },
        ].map((b) => (
          <div key={b.t}>
            <span className="hmTrustIco"><Icon name={b.icon} size={20} /></span>
            <div><b>{b.t}</b><small>{b.d}</small></div>
          </div>
        ))}
      </section>
    </div>
  );
}
