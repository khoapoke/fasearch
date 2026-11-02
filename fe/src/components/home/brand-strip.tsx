"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dải logo thương hiệu thời trang (monochrome) — thay cho dải ảnh sản phẩm ở rev1.
 *
 * Nguồn: SVG thật tải từ Wikimedia Commons, phục vụ cục bộ tại `/brands/*.svg`
 * (xem `public/brands/PROVENANCE.json`). Đây là tham chiếu cảm hứng, KHÔNG phải
 * quan hệ đối tác/đại diện và không phải bộ lọc thương hiệu của catalog.
 *
 * Truy cập: bản lặp lại aria-hidden và không có phần tử bấm được; nút Tạm dừng
 * là điều khiển thật; hover/focus/tab ẩn/ngoài khung nhìn đều dừng; giảm chuyển
 * động hoặc "Tắt chuyển động" → hàng tĩnh.
 */

// Kích thước quang học: mỗi mark có tỉ lệ khác nhau, nên chuẩn hoá theo
// "trọng lượng thị giác" (diện tích) thay vì cùng một chiều cao thô.
type Brand = { name: string; src: string; width: number; height: number };

const BRANDS: Brand[] = [
  { name: "Nike", src: "/brands/nike.svg", width: 76, height: 26 },
  { name: "Puma", src: "/brands/puma.svg", width: 96, height: 22 },
  { name: "Adidas", src: "/brands/adidas.svg", width: 84, height: 26 },
  { name: "New Balance", src: "/brands/new-balance.svg", width: 104, height: 20 },
  { name: "Vans", src: "/brands/vans.svg", width: 80, height: 22 },
];

export function BrandStrip({ motionEnabled }: { motionEnabled: boolean }) {
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [inView, setInView] = useState(true);
  const [focusWithin, setFocusWithin] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setInView(entries.some((entry) => entry.isIntersecting));
    }, { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const canLoop = motionEnabled && BRANDS.length >= 3;
  const running = canLoop && !userPaused && !hoverPaused && !hidden && inView && !focusWithin;

  const row = (items: Brand[], clone: boolean) => (
    <ul className={`hmBrandTrack${clone ? " hmBrandClone" : ""}`} aria-hidden={clone ? "true" : undefined}>
      {items.map((brand) => (
        <li key={`${clone ? "dup-" : ""}${brand.name}`} className="hmBrandItem">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG thật, phục vụ cục bộ */}
          <img
            src={brand.src}
            alt={clone ? "" : brand.name}
            title={clone ? undefined : brand.name}
            loading="eager"
            width={brand.width}
            height={brand.height}
            style={{ width: `${brand.width}px`, height: `${brand.height}px` }}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <section className="hmBrands" aria-labelledby="hm-brands-title" ref={rootRef}>
      <div className="hmBrandsHead">
        <h2 className="hmBrandsTitle" id="hm-brands-title">Cảm hứng từ các thương hiệu thời trang</h2>
        {canLoop ? (
          <button
            className="hmBrandsToggle"
            type="button"
            aria-pressed={userPaused}
            onClick={() => setUserPaused((value) => !value)}
          >
            {userPaused ? "Tiếp tục" : "Tạm dừng"}
          </button>
        ) : null}
      </div>

      {canLoop ? (
        <div
          className="hmBrandsViewport"
          data-paused={running ? "false" : "true"}
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
          }}
        >
          {row(BRANDS, false)}
          {row(BRANDS, true)}
        </div>
      ) : (
        <div className="hmBrandsStatic">{row(BRANDS, false)}</div>
      )}

      <p className="hmBrandsNote">Logo thương hiệu dùng làm tham chiếu thời trang; không hàm ý hợp tác hay bán sản phẩm của các hãng.</p>
    </section>
  );
}
