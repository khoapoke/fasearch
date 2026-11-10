"use client";

import { useEffect, useRef } from "react";

const PATH = "M108,332 C240,350 390,260 500,220 C610,180 728,230 714,292 C700,354 570,347 522,318 C474,289 475,223 486,178";
const BOUNDS = { left: 108, top: 155, right: 728, bottom: 363 };

// Static login-only B2 threadline. It is deliberately measured from the real
// layout: no space below the login surface means no line, never overflow.
export function AuthThreadline() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    let frame = 0;
    const position = () => {
      layer.dataset.fit = "none";
      layer.dataset.reason = "off";
      if (window.innerWidth <= 760) {
        layer.dataset.reason = "compact-login";
        return;
      }
      const layout = document.querySelector(".authPage .auth-layout");
      const form = document.querySelector(".authPage .auth-form-wrap");
      if (!layout || !form) return;
      const layoutRect = layout.getBoundingClientRect();
      const formRect = form.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      // The layer is nested in the auth page, unlike the native body layer;
      // keep all measurements relative to its top-left before painting.
      const top = layoutRect.bottom - layerRect.top + 10;
      const bottom = layerRect.height - 10;
      const left = formRect.left - layerRect.left + 8;
      const right = formRect.right - layerRect.left - 8;
      const center = formRect.left - layerRect.left + formRect.width * 0.54;
      const inkWidth = BOUNDS.right - BOUNDS.left;
      const inkHeight = BOUNDS.bottom - BOUNDS.top;
      const scale = Math.min(360 / 800, (bottom - top) / inkHeight, (right - left) / inkWidth);
      if (!Number.isFinite(scale) || scale * 800 < 168) {
        layer.dataset.reason = "insufficient-space";
        return;
      }
      const paintLeft = Math.min(Math.max(center - inkWidth * scale / 2, left), right - inkWidth * scale);
      layer.style.setProperty("--thread-left", `${(paintLeft - BOUNDS.left * scale).toFixed(2)}px`);
      layer.style.setProperty("--thread-top", `${(top + (bottom - top - inkHeight * scale) / 2 - BOUNDS.top * scale).toFixed(2)}px`);
      layer.style.setProperty("--thread-width", `${(800 * scale).toFixed(2)}px`);
      layer.style.setProperty("--thread-height", `${(500 * scale).toFixed(2)}px`);
      layer.dataset.fit = "visible";
      layer.dataset.reason = "below-login";
    };
    const queue = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; position(); });
    };
    queue();
    window.addEventListener("resize", queue);
    const observer = new ResizeObserver(queue);
    const layout = document.querySelector(".authPage .auth-layout");
    const form = document.querySelector(".authPage .auth-form-wrap");
    if (layout) observer.observe(layout);
    if (form) observer.observe(form);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", queue);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={layerRef} className="authThreadline" aria-hidden="true" data-fit="none">
      <svg className="threadline" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
        <path d={PATH} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
