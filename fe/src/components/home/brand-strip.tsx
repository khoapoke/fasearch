"use client";

import { useEffect, useRef, useState } from "react";
import { probeLogoKind } from "@/lib/logo-alpha";

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
type Brand = { name: string; src: string; width: number; height: number; mono?: "ink" | "gray" };

type BrandItem = { slug: string; name: string; logo: string | null };

const BRANDS: Brand[] = [
  { name: "Nike", src: "/brands/nike.svg", width: 76, height: 26 },
  { name: "Puma", src: "/brands/puma.svg", width: 96, height: 22 },
  { name: "Adidas", src: "/brands/adidas.svg", width: 84, height: 26 },
  { name: "New Balance", src: "/brands/new-balance.svg", width: 104, height: 20 },
  { name: "Vans", src: "/brands/vans.svg", width: 80, height: 22 },
  { name: "ASICS", src: "/brands/asics.svg", width: 92, height: 26 },
  { name: "MLB", src: "/brands/mlb.svg", width: 58, height: 30, mono: "gray" },
  { name: "UNIQLO", src: "/brands/uniqlo.svg", width: 34, height: 34, mono: "gray" },
];

export function BrandStrip({ motionEnabled }: { motionEnabled: boolean }) {
  // R4-I: dải logo lấy theo bộ thương hiệu canonical của BE (cùng nguồn với filter),
  // không tự bịa mark. Hãng chưa có asset đã kiểm định → chỉ hiện chữ.
  const [beItems, setBeItems] = useState<BrandItem[] | null>(null);
  // R4-I fix: biết asset nào có alpha thật để chỉ mask đúng loại đó.
  // "alpha" chỉ sau khi phân loại dương tính; mọi trạng thái khác (unknown/opaque/lỗi)
  // dùng <img> trên plate sáng → không bao giờ có khối đặc do mask.
  const [logoSafeToMask, setLogoSafeToMask] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog/brands", { cache: "no-store", signal: controller.signal })
      .then((r) => r.json())
      .then((payload: { success?: boolean; result?: Array<{ slug?: unknown; name?: unknown; logoUrl?: unknown }> }) => {
        if (controller.signal.aborted || payload?.success !== true || !Array.isArray(payload.result)) return;
        const mapped = payload.result.flatMap((b) => {
          if (typeof b?.slug !== "string" || typeof b?.name !== "string") return [];
          const logo = typeof b.logoUrl === "string" && b.logoUrl
            ? `/api/catalog/brands/${b.slug}/logo`
            : null;
          // Nhãn hiển thị: phân biệt thời trang Hàn với tham chiếu "MLB League" rỗng,
          // dựa trên slug canonical (không tự đặt tên hãng mới).
          const label = b.slug === "mlb-korea" && !/korea/i.test(b.name) ? "MLB Korea" : b.name;
          return [{ slug: b.slug, name: label, logo }];
        });
        setBeItems(mapped);
        mapped.filter((b) => b.logo).forEach((b) => {
          void probeLogoKind(b.logo as string).then((kind) => {
            if (kind === "alpha") setLogoSafeToMask((prev) => ({ ...prev, [b.slug]: true }));
          });
        });
      })
      .catch(() => setBeItems(null));
    return () => controller.abort();
  }, []);
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

  // R4-I: hiển thị TOÀN BỘ bộ canonical (trừ "mlb" — tham chiếu MLB League rỗng,
  // không phải thời trang), xếp hãng có logo trước để dải mở đầu bằng artwork thật.
  // Không cắt bớt hãng VN/global mà người dùng yêu cầu.
  const canonical = (beItems && beItems.length >= 3 ? beItems : []).filter((b) => b.slug !== "mlb");
  const strip: BrandItem[] = canonical
    .slice()
    .sort((a, b) => Number(Boolean(b.logo)) - Number(Boolean(a.logo)));
  const usingBe = strip.length >= 3;
  const canLoop = motionEnabled && (usingBe ? strip.length >= 3 : BRANDS.length >= 3);
  const running = canLoop && !userPaused && !hoverPaused && !hidden && inView && !focusWithin;

  const rowFallback = (items: Brand[], clone: boolean) => (
    <ul className={`hmBrandTrack${clone ? " hmBrandClone" : ""}`} aria-hidden={clone ? "true" : undefined}>
      {items.map((brand) => (
        <li key={`${clone ? "dup-" : ""}${brand.name}`} className="hmBrandItem">
          {brand.mono === "gray" ? (
            // Mark có nền đặc + khoét trắng (MLB, UNIQLO): mask một màu sẽ thành
            // khối đặc, nên giữ asset gốc ở dạng grayscale.
            // eslint-disable-next-line @next/next/no-img-element -- asset thật, phục vụ cục bộ
            <img
              src={brand.src}
              alt={clone ? "" : brand.name}
              title={clone ? undefined : brand.name}
              loading="eager"
              width={brand.width}
              height={brand.height}
              data-mono="gray"
              style={{ width: `${brand.width}px`, height: `${brand.height}px` }}
            />
          ) : (
            <span
              className="hmBrandMark"
              role="img"
              aria-label={clone ? undefined : brand.name}
              aria-hidden={clone ? "true" : undefined}
              title={clone ? undefined : brand.name}
              style={{
                ["--brand-w" as string]: `${brand.width}px`,
                ["--brand-h" as string]: `${brand.height}px`,
                ["--brand-logo" as string]: `url("${brand.src}")`,
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );

  const rowBe = (items: BrandItem[], clone: boolean) => (
    <ul className={`hmBrandTrack${clone ? " hmBrandClone" : ""}`} aria-hidden={clone ? "true" : undefined}>
      {items.map((brand) => (
        <li key={`${clone ? "dup-" : ""}${brand.slug}`} className="hmBrandItem">
          {brand.logo && !logoSafeToMask[brand.slug] ? (
            // Ảnh nền đục (PNG trắng/JPEG): mask sẽ thành khối đặc, nên render <img>
            // trên nền sáng có viền để vẫn đọc được ở dark theme.
            <span className="hmBrandPlate">
              {/* eslint-disable-next-line @next/next/no-img-element -- asset thật từ BE */}
              <img
                src={brand.logo}
                alt={clone ? "" : brand.name}
                title={clone ? undefined : brand.name}
                loading="eager"
                className="hmBrandRaster"
              />
            </span>
          ) : brand.logo ? (
            <span
              className="hmBrandMark"
              role="img"
              aria-label={clone ? undefined : brand.name}
              aria-hidden={clone ? "true" : undefined}
              title={clone ? undefined : brand.name}
              style={{
                ["--brand-w" as string]: "104px",
                ["--brand-h" as string]: "26px",
                ["--brand-logo" as string]: `url("${brand.logo}")`,
              }}
            />
          ) : (
            <span className="hmBrandWord" title={clone ? undefined : brand.name} aria-hidden={clone ? "true" : undefined}>
              {brand.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <section className="hmBrands" id="thuong-hieu" aria-labelledby="hm-brands-title" ref={rootRef}>
      <div className="hmBrandsHead">
        <h2 className="hmBrandsTitle" id="hm-brands-title">Cảm hứng từ các thương hiệu thời trang</h2>
        {/* R3: bỏ nút "Tạm dừng" độc lập. Dải tự dừng khi hover/focus/ẩn tab/ngoài
            khung nhìn; tắt hẳn bằng "Giao diện → chuyển động" trong menu theme. */}
      </div>

      {canLoop ? (
        <div
          className="hmBrandsViewport"
          data-paused={running ? "false" : "true"}
          aria-label="Dải logo thương hiệu"
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
          }}
        >
          {usingBe ? rowBe(strip, false) : rowFallback(BRANDS, false)}
          {usingBe ? rowBe(strip, true) : rowFallback(BRANDS, true)}
        </div>
      ) : (
        <div className="hmBrandsStatic">{usingBe ? rowBe(strip, false) : rowFallback(BRANDS, false)}</div>
      )}

    </section>
  );
}
