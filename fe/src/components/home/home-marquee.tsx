"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MarqueeItem = {
  id: number;
  name: string;
  image: string;
  href: string;
};

/**
 * Dải ảnh khám phá (marquee) — chỉ ảnh thật từ catalog, không ảnh thay thế.
 *
 * Quy tắc truy cập:
 * - Bản lặp lại của vòng chạy được aria-hidden và không có liên kết bấm được.
 * - Có nút Tạm dừng/Tiếp tục; tự dừng khi hover/focus, khi tab bị ẩn hoặc khi
 *   dải ảnh ra khỏi khung nhìn.
 * - Giảm chuyển động hoặc "Tắt chuyển động" → lưới tĩnh, vẫn bấm được.
 * - Không đặt số liệu, form hay hành động quan trọng bên trong dải chạy.
 */
export function HomeMarquee({ items, motionEnabled }: { items: MarqueeItem[]; motionEnabled: boolean }) {
  // Tạm dừng do người dùng (nút) tách khỏi tạm dừng tạm thời khi hover/focus,
  // đúng như MOTION-SPEC: hover pause là tạm thời, nút là ý định bền.
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

  // Ít hơn 3 ảnh thật thì không đủ để chạy vòng lặp có ý nghĩa → lưới tĩnh.
  const canLoop = motionEnabled && items.length >= 3;
  const running = canLoop && !userPaused && !hoverPaused && !hidden && inView && !focusWithin;

  if (items.length === 0) return null;

  if (!canLoop) {
    return (
      <div className="hmMarqStatic" ref={rootRef} aria-label="Ảnh sản phẩm để khám phá">
        {items.map((item) => (
          <Link key={item.id} className="hmMarqTile" href={item.href}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ catalog BFF */}
            <img src={item.image} alt={item.name} loading="eager" />
            <span>{item.name}</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      className="hmMarq"
      ref={rootRef}
      data-paused={running ? "false" : "true"}
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div className="hmMarqHead">
        <p className="hmMarqKicker">Khám phá theo ảnh thật</p>
        <button
          className="hmMarqToggle"
          type="button"
          aria-pressed={userPaused}
          onClick={() => setUserPaused((value) => !value)}
        >
          {userPaused ? "Tiếp tục" : "Tạm dừng"}
        </button>
      </div>
      <div className="hmMarqViewport">
        <ul className="hmMarqTrack" aria-label="Ảnh sản phẩm để khám phá">
          {items.map((item) => (
            <li key={item.id} className="hmMarqItem">
              <Link href={item.href} aria-label={item.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ catalog BFF */}
                <img src={item.image} alt="" loading="eager" />
              </Link>
            </li>
          ))}
        </ul>
        {/* Vòng lặp lặp lại: chỉ để tạo cảm giác liền mạch, không đọc và không bấm được. */}
        <ul className="hmMarqTrack hmMarqClone" aria-hidden="true">
          {items.map((item) => (
            <li key={`dup-${item.id}`} className="hmMarqItem">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh thật từ catalog BFF */}
              <img src={item.image} alt="" loading="eager" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
