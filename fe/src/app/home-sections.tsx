"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type UiIcon } from "@/components/ui/icon";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import { fetchCatalogCategories, fetchCatalogProducts } from "@/lib/customer-catalog";
import {
  HOME_DEMO,
  HOME_DEMO_STEPS,
  HOME_PHOTOS,
  homeDiscoveryState,
  type HomeCategory,
  type HomeDemoStep,
  type HomePhoto,
  type HomeProduct,
  type DemoStage,
} from "./home-data";
import "./home.css";
import "@/components/storefront/listing.css";
import { BrandStrip } from "@/components/home/brand-strip";
import { useHomeMotion } from "@/lib/home-motion";

const DISCOVERY_ERROR = "Không tải được sản phẩm. Vui lòng thử lại.";

// CONTROL-CANVAS-03 — B2 “draped thread” lấy nguyên văn từ 6fdbcee
// (assets/draped-thread-b2.svg, THREADLINE_PATHS.b2) + union bounds của fitter.
const HOME_THREAD_PATH_B2 =
  "M108,332 C240,350 390,260 500,220 C610,180 728,230 714,292 C700,354 570,347 522,318 C474,289 475,223 486,178";
const HOME_THREAD_BOUNDS = { left: 108, top: 155, right: 728, bottom: 363 } as const;

/**
 * Canvas B2 tĩnh, Home-only: port trung thành `positionThreadline()` của bản đã
 * duyệt. Đo theo landmark Home hiện có và ẩn khi thiếu chỗ — KHÔNG thêm
 * padding/gap để ép hiển thị, không motion. Chỉ là hình học tĩnh.
 */
function HomeCanvasB2() {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const home = layer?.closest<HTMLElement>(".hmHome");
    if (!layer || !home) return;

    let queued = false;

    const position = () => {
      if (!layer.isConnected) return;
      layer.dataset.fit = "none";
      layer.dataset.reason = "off";

      const homeRect = home.getBoundingClientRect();
      const at = (selector: string) => {
        const el = home.querySelector<HTMLElement>(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          top: r.top - homeRect.top,
          bottom: r.bottom - homeRect.top,
          left: r.left - homeRect.left,
          right: r.right - homeRect.left,
          width: r.width,
        };
      };

      const copy = at(".hmHeroCopy");
      const figure = at(".hmHeroFigure");
      const explain = at(".hmModes");
      if (!copy || !figure || !explain) {
        layer.dataset.reason = "landmarks-missing";
        return;
      }

      // Slot gốc: ngay dưới hero, ngay trên “Tìm theo cách của bạn”.
      const top = Math.max(copy.bottom, figure.bottom) + 10;
      const bottom = explain.top - 10;
      const left = figure.left + 8;
      const right = figure.right - 8;
      const center = figure.left + figure.width * 0.62;

      const inkWidth = HOME_THREAD_BOUNDS.right - HOME_THREAD_BOUNDS.left;
      const inkHeight = HOME_THREAD_BOUNDS.bottom - HOME_THREAD_BOUNDS.top;
      const scale = Math.min(360 / 800, (bottom - top) / inkHeight, (right - left) / inkWidth);
      if (!Number.isFinite(scale) || scale * 800 < 168) {
        layer.dataset.reason = "insufficient-space";
        return;
      }

      const paintLeft = Math.min(Math.max(center - (inkWidth * scale) / 2, left), right - inkWidth * scale);
      layer.style.setProperty("--hm-thread-left", `${(paintLeft - HOME_THREAD_BOUNDS.left * scale).toFixed(2)}px`);
      layer.style.setProperty("--hm-thread-top", `${(top + (bottom - top - inkHeight * scale) / 2 - HOME_THREAD_BOUNDS.top * scale).toFixed(2)}px`);
      layer.style.setProperty("--hm-thread-width", `${(800 * scale).toFixed(2)}px`);
      layer.style.setProperty("--hm-thread-height", `${(500 * scale).toFixed(2)}px`);
      layer.dataset.fit = "visible";
      layer.dataset.reason = "after-hero";
    };

    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        position();
      });
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(queue);
    for (const selector of [".hmHeroCopy", ".hmHeroFigure", ".hmModes"]) {
      const el = home.querySelector(selector);
      if (el) observer?.observe(el);
    }
    queue();
    window.addEventListener("resize", queue);
    document.fonts?.ready.then(queue).catch(() => {});

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", queue);
    };
  }, []);

  return (
    <div className="hmCanvas" aria-hidden="true" data-fit="none" data-reason="off" ref={layerRef}>
      <svg
        className="hmThreadline"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
        aria-hidden="true"
      >
        <path
          d={HOME_THREAD_PATH_B2}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}


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
  const { enabled: motionOn, preference, setPreference } = useHomeMotion();
  // Trạng thái minh họa bám theo MOTION-SPEC p23-r5: dormant → typing → tags →
  // processing → result → complete. Chọn tay thì dừng tự chạy và hiện tĩnh ngay.
  const [stage, setStage] = useState<DemoStage>("dormant");
  const [manual, setManual] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [demoInView, setDemoInView] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [typed, setTyped] = useState(0);
  const [attention, setAttention] = useState(0);
  const demoTimers = useRef<number[]>([]);
  const demoRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const heroAnimations = useRef<Animation[]>([]);
  const stepRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let live = true;
    fetchCatalogCategories()
      .then((list) => {
        if (!live) return;
        setCategories(list);
      })
      .catch(() => {
        if (live) setCategoryError("Không tải được danh mục.");
      });
    fetchCatalogProducts({ page: 0, size: 4, sort: "id,desc" })
      .then((page) => {
        if (!live) return;
        setProducts(page.items.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.imageUrl ?? undefined,
          href: `/san-pham/${p.id}`,
        })));
        setProductsTotal(page.totalElements);
      })
      .catch(() => {
        if (live) setProductError(DISCOVERY_ERROR);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  const clearDemoTimers = useCallback(() => {
    demoTimers.current.forEach((id) => window.clearTimeout(id));
    demoTimers.current = [];
  }, []);

  const schedule = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      demoTimers.current = demoTimers.current.filter((value) => value !== id);
      run();
    }, ms);
    demoTimers.current.push(id);
  }, []);

  useEffect(() => () => clearDemoTimers(), [clearDemoTimers]);

  useEffect(() => {
    const onVisibility = () => setDocHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const node = demoRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setDemoInView(entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25));
    }, { threshold: [0, 0.25] });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Hero entrance: chạy một lần mỗi vòng đời, đúng chuỗi 650ms của bản đã duyệt.
  useEffect(() => {
    const root = heroRef.current;
    if (!root || !motionOn) return;
    const parts: Array<[string, Keyframe[], number, number]> = [
      [".hmHeroTitle", [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], 650, 0],
      [".hmHeroLede", [{ opacity: 0.72, transform: "translate3d(0,7px,0)" }, { opacity: 1, transform: "translate3d(0,0,0)" }], 420, 140],
      [".hmHeroActions, .hmHeroSearch", [{ opacity: 0.9, transform: "translate3d(0,5px,0)" }, { opacity: 1, transform: "translate3d(0,0,0)" }], 240, 340],
      [".hmHeroMedia, .hmHeroFigure", [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], 700, 80],
    ];
    const animations: Animation[] = [];
    for (const [selector, frames, duration, delay] of parts) {
      const el = root.querySelector(selector);
      if (el) animations.push(el.animate(frames, { duration, delay, easing: "cubic-bezier(0.23,1,0.32,1)", fill: "backwards" }));
    }
    heroAnimations.current = animations;
    const settle = window.setTimeout(() => { animations.forEach((a) => a.finish()); heroAnimations.current = []; }, 840);
    return () => {
      window.clearTimeout(settle);
      animations.forEach((a) => a.cancel());
      heroAnimations.current = [];
    };
  }, [motionOn]);

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
    clearDemoTimers();
    setManual(true);
    setUserPaused(false);
    setStage(next === "describe" ? "dormant" : next === "suggest" ? "suggest" : "complete");
    stepRefs.current[next]?.focus();
  }

  const stepIndex = stage === "complete" || stage === "result" ? 2 : ["dormant", "describe", "typing"].includes(stage) ? 0 : 1;
  const showTags = stepIndex >= 1;
  const showResult = stage === "result" || stage === "complete";
  const autoPaused = userPaused || focusPaused || docHidden || !demoInView || !motionOn;
  const pauseUnavailable = manual || stage === "complete" || stage === "result" || !motionOn;

  const statusText =
    manual
      ? stage === "complete" || stage === "result"
        ? "Đã chọn bước. Gợi ý hiển thị tĩnh, không tự chạy tiếp."
        : "Đã chọn bước. Nội dung tĩnh, không có hiệu ứng chờ."
      : stage === "dormant"
        ? "Mô tả món đồ bạn muốn tìm."
        : stage === "typing"
          ? "Đang nhập mô tả…"
          : stage === "tags"
            ? `Đối chiếu mô tả với danh mục: ${HOME_DEMO.tags.map((t) => t.value).join(" · ")}.`
            : stage === "processing"
              ? "Đang tìm gợi ý…"
              : "Một gợi ý phù hợp trong danh mục mẫu.";

  // Vòng tự chạy hữu hạn; dừng hẳn khi tay chọn, khi tạm dừng, khi ẩn tab,
  // khi ngoài khung nhìn hoặc khi tắt/giảm chuyển động. Không bù nhịp khi quay lại.
  useEffect(() => {
    if (!motionOn || manual || autoPaused || stage === "complete" || stage === "result") return;
    const run: Record<string, number> = { dormant: 1200, tags: 3400, processing: 3800 };
    const delay = run[stage];
    if (delay === undefined) return;
    schedule(delay, () => {
      if (stage === "dormant") { setStage("typing"); setTyped(0); return; }
      if (stage === "tags") { setStage("processing"); return; }
      if (stage === "processing") { setStage("result"); setAttention((n) => n + 1); }
    });
    return () => clearDemoTimers();
  }, [stage, motionOn, manual, autoPaused, schedule, clearDemoTimers]);

  // Gõ chữ theo nhịp đọc được (55ms/ký tự) rồi giữ 400ms trước khi sang bước kế.
  useEffect(() => {
    if (stage !== "typing") return;
    if (!motionOn || manual || autoPaused) return;
    const total = HOME_DEMO.query.length;
    if (typed >= total) {
      const done = window.setTimeout(() => setStage("tags"), 400);
      return () => window.clearTimeout(done);
    }
    const tick = window.setTimeout(() => setTyped((n) => Math.min(total, n + 1)), 55);
    return () => window.clearTimeout(tick);
  }, [stage, typed, motionOn, manual, autoPaused]);

  // Tắt/giảm chuyển động: về trạng thái đã an tĩnh, không tự chạy lại sau đó.
  useEffect(() => {
    if (motionOn) return;
    clearDemoTimers();
    setStage("complete");
    setTyped(HOME_DEMO.query.length);
  }, [motionOn, clearDemoTimers]);

  const replay = () => {
    clearDemoTimers();
    setManual(false);
    setUserPaused(false);
    setFocusPaused(false);
    setStage(motionOn ? "dormant" : "complete");
    setTyped(motionOn ? 0 : HOME_DEMO.query.length);
  };

  const typedQuery = manual && stage !== "typing" && stage !== "dormant" ? HOME_DEMO.query : HOME_DEMO.query.slice(0, typed);

  return (
    <div className="hmHome" data-attention={attention > 0 && motionOn && !manual ? "on" : "off"} data-motion-on={motionOn ? "true" : "false"}>
      <HomeCanvasB2 />
      <section
        className="hmHero"
        aria-labelledby="hm-hero-title"
        ref={heroRef}
        onFocusCapture={() => { heroAnimations.current.forEach((a) => a.finish()); heroAnimations.current = []; }}
      >
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
          <span className="hmMotif hmMotifSignature" aria-hidden="true">
            <svg
              viewBox="0 0 160 160"
              focusable="false"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M148 32V148H64" />
              <path d="M64 148H32" strokeDasharray="7 6" />
            </svg>
          </span>
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
        data-step={stepIndex === 2 ? "explore" : stepIndex === 1 ? "suggest" : "describe"}
        data-stage={stage}
        data-manual={manual ? "true" : "false"}
        data-paused={autoPaused ? "true" : "false"}
        aria-busy={!manual && motionOn && ["typing", "tags", "processing"].includes(stage) ? true : undefined}
        ref={demoRef}
        onFocusCapture={() => setFocusPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusPaused(false); }}
      >
        <header className="hmDemoHead">
          <div>
            <p className="hmKicker">01 · Tìm bằng AI</p>
            <h2 className="hmSectionTitle" id="hm-demo-title">Tìm món đồ hợp gu.</h2>
          </div>
          <div className="hmDemoTools">
            <p className="hmDemoNote" id="hm-demo-note">Ví dụ minh họa</p>
            <button className="hmDemoReplay" type="button" onClick={replay}>Xem lại</button>
            <button
              className="hmDemoReplay"
              type="button"
              aria-pressed={!pauseUnavailable && userPaused}
              aria-disabled={pauseUnavailable}
              onClick={() => { if (!pauseUnavailable) setUserPaused((value) => !value); }}
            >
              {pauseUnavailable ? (manual ? "Đã chọn bước" : "Đã xong") : userPaused ? "Tiếp tục" : "Tạm dừng"}
            </button>
          </div>
        </header>

        <div className="hmDemoSteps" role="group" aria-label="Các bước của ví dụ minh họa">
          {HOME_DEMO_STEPS.map((s) => (
            <button
              key={s.id}
              ref={(el) => { stepRefs.current[s.id] = el; }}
              className="hmDemoStep"
              type="button"
              aria-pressed={HOME_DEMO_STEPS[stepIndex]?.id === s.id}
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
              <p className="hmQueryCopy">{typedQuery}<span className="hmQueryCaret" aria-hidden="true" /></p>
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
            {stage === "dormant" || stage === "typing" ? (
              <p className="hmOutcomeIdle">Gợi ý từ mô tả của bạn</p>
            ) : null}

            {stage === "processing" ? (
              <div className="hmProcessing" aria-hidden="true">
                <span className="hmSkeleton" />
                <span className="hmSkeletonLine" />
                <span className="hmSkeletonLine hmSkeletonShort" />
              </div>
            ) : null}

            {stage === "tags" || stage === "suggest" ? (
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

            {showResult ? (
              <div className="hmResult">
                <p className="hmMiniLabel">1 gợi ý</p>
                <div className="hmResultCard" data-attention={attention} data-manual={manual ? "true" : "false"}>
                  <span className="hmResultMediaWrap">
                    <span className="hmResultMotion">
                      <HomePhotoFrame photo={HOME_DEMO.product.photo} className="hmResultMedia" />
                    </span>
                    <span className="hmResultHalo" aria-hidden="true" />
                  </span>
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
      </section>

      <BrandStrip motionEnabled={motionOn} />

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

      <section className="hmHow" aria-labelledby="hm-how-title">
        <div className="hmSecHead">
          <h2 className="hmSectionTitle" id="hm-how-title">Tìm và mua trong ba bước</h2>
          <Link href="/tim-kiem-ai">Bắt đầu tìm →</Link>
        </div>
        <ol className="hmHowSteps">
          <li>
            <span aria-hidden="true">01</span>
            <b>Mô tả hoặc chọn ảnh</b>
            <p>Gõ vài từ về món đồ bạn cần, hoặc dùng ảnh làm mẫu tham chiếu.</p>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <b>So kết quả với nhu cầu</b>
            <p>Mỗi kết quả mở trang sản phẩm với màu, cỡ và giá hiện có.</p>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <b>Thêm vào giỏ và đặt hàng</b>
            <p>Chọn biến thể, kiểm tra phí giao hàng rồi xác nhận thanh toán khi nhận.</p>
          </li>
        </ol>
        <div className="hmBenefits">
          <article>
            <h3>Điểm thưởng theo tài khoản</h3>
            <p>Số điểm và hạng hiển thị đúng theo tài khoản đang đăng nhập; điểm dùng được ở bước thanh toán khi đủ điều kiện.</p>
            <Link href="/tai-khoan/diem-thuong">Xem điểm và hạng →</Link>
          </article>
          <article>
            <h3>Voucher kiểm tra lại khi đặt</h3>
            <p>Mã hợp lệ được xác nhận tại bước thanh toán; điều kiện và mức giảm hiển thị theo báo giá của đơn.</p>
            <Link href="/voucher">Xem ưu đãi đang mở →</Link>
          </article>
        </div>
      </section>

      <section className="hmTrust" aria-label="Điều hệ thống thực thi">
        {[
          { icon: "check" as UiIcon, t: "Thanh toán khi nhận hàng", d: "Trả tiền mặt cho người giao khi đơn tới." },
          { icon: "box" as UiIcon, t: "Tồn kho theo kho phục vụ", d: "Số lượng cập nhật theo kho đang giao đơn." },
          { icon: "truck" as UiIcon, t: "Phí vận chuyển rõ ràng", d: "Tính và hiển thị trước khi bạn đặt đơn." },
          { icon: "ticket" as UiIcon, t: "Voucher áp dụng khi thanh toán", d: "Mã hợp lệ được kiểm tra lại trên đơn." },
        ].map((b) => (
          <div key={b.t}>
            <span className="hmTrustIco"><Icon name={b.icon} size={20} /></span>
            <div><b>{b.t}</b><small>{b.d}</small></div>
          </div>
        ))}
      </section>

      <section className="hmFaq" aria-labelledby="hm-faq-title">
        <div className="hmSecHead">
          <h2 className="hmSectionTitle" id="hm-faq-title">Câu hỏi thường gặp</h2>
        </div>
        <dl className="hmFaqList">
          <div>
            <dt>Tìm bằng ảnh khác gì tìm bằng chữ?</dt>
            <dd>Ảnh cho hệ thống biết dáng, màu và kiểu bạn đang nhìn; chữ diễn tả điều bạn muốn thay đổi. Chế độ kết hợp dùng cả hai.</dd>
          </div>
          <div>
            <dt>Kết quả lấy từ đâu?</dt>
            <dd>Từ danh mục sản phẩm đang mở trên hệ thống, kèm ảnh và giá hiện có. Kết quả minh họa của AI là ảnh tham chiếu, không phải sản phẩm đang bán.</dd>
          </div>
          <div>
            <dt>Voucher và điểm dùng thế nào?</dt>
            <dd>Chọn ưu đãi ở trang voucher hoặc nhập mã tại bước thanh toán; điểm thưởng áp dụng theo tài khoản nếu đơn đủ điều kiện.</dd>
          </div>
          <div>
            <dt>Theo dõi đơn ở đâu?</dt>
            <dd>Mục Đơn hàng trong tài khoản hiển thị trạng thái và chi tiết từng đơn của bạn.</dd>
          </div>
        </dl>
      </section>

      <section className="hmClose" aria-labelledby="hm-close-title">
        <div className="hmCloseCopy">
          <p className="hmKicker">Sẵn sàng</p>
          <h2 id="hm-close-title">Tìm món đồ bạn đang nghĩ tới.</h2>
          <p>Một tấm ảnh hay vài dòng mô tả là đủ để bắt đầu.</p>
        </div>
        <div className="hmCloseActions">
          <Link className="hmCta hmCtaBrand" href="/tim-kiem-ai">Tìm bằng AI <span aria-hidden="true">↗</span></Link>
          <Link className="hmCta hmCtaGhost" href="/nam">Xem sản phẩm</Link>
        </div>
      </section>
    </div>
  );
}
