"use client";

import { useLayoutEffect, useRef } from "react";
import { useHomeMotion } from "@/lib/home-motion";

/**
 * Nền trượt báo mục đang chọn (danh mục / thương hiệu).
 * - Chỉ transform + opacity; chữ đứng yên.
 * - Chỉ trượt khi người dùng bấm/chạm và động chuyển động đang bật
 *   (prefers-reduced-motion + nút Motion Off đều tôn trọng). Bàn phím,
 *   reduced-motion, Off, danh sách đổi (lọc/mở rộng) ⇒ đặt ngay, không ma.
 * - `fingerprint` nhận diện danh sách: cùng số mục nhưng khác thành viên
 *   vẫn là danh sách khác (không trượt vào mục không liên quan).
 */
export function SlideOptions({
  label,
  activeKey,
  fingerprint,
  className,
  children,
}: {
  label: string;
  activeKey: string;
  fingerprint: string;
  className?: string;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLSpanElement>(null);
  const prevKey = useRef<string | null>(null);
  const prevFp = useRef<string | null>(null);
  const lastW = useRef(0);
  const pointerMode = useRef(false);
  // Một nguồn chuyển động dùng chung toàn site: đổi Motion Off/On ở menu giao diện
  // cập nhật underlay ngay trong cùng tab (prefers-reduced-motion cũng gộp trong `enabled`).
  const { enabled: motionOK } = useHomeMotion();

  useLayoutEffect(() => {
    const box = boxRef.current;
    const bg = bgRef.current;
    if (!box || !bg) return;
    const place = (animate: boolean) => {
      const el = box.querySelector<HTMLElement>("[data-active='true']");
      const active = el && el.offsetParent !== null ? el : null;
      if (!active) {
        bg.style.transition = "none";
        bg.style.opacity = "0";
        return;
      }
      if (!animate) bg.style.transition = "none";
      bg.style.opacity = "1";
      bg.style.height = `${active.offsetHeight}px`;
      bg.style.transform = `translateY(${active.offsetTop}px)`;
      if (!animate) {
        void bg.offsetWidth;
        bg.style.transition = "";
      }
    };
    const listChanged = prevFp.current !== null && prevFp.current !== fingerprint;
    const moved = prevKey.current !== null && prevKey.current !== activeKey;
    place(pointerMode.current && motionOK && moved && !listChanged);
    prevKey.current = activeKey;
    prevFp.current = fingerprint;
    lastW.current = box.offsetWidth;
    // Bộ lọc mobile nằm trong <details> đóng: khi mở ra chiều rộng đổi 0 → n ⇒ đặt lại.
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (Math.abs(box.offsetWidth - lastW.current) < 1) return;
          lastW.current = box.offsetWidth;
          place(false);
        })
      : null;
    ro?.observe(box);
    return () => ro?.disconnect();
  }, [activeKey, fingerprint, motionOK]);

  return (
    <div
      className={`cat-slide-opts${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={label}
      ref={boxRef}
      data-motion={motionOK ? "on" : "off"}
      onPointerDown={() => { pointerMode.current = true; }}
      onKeyDown={() => { pointerMode.current = false; }}
    >
      <span className="cat-selbg" aria-hidden="true" ref={bgRef} />
      {children}
    </div>
  );
}
