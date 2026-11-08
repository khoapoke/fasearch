"use client";

import Link from "next/link";
import { PriceTag } from "@/components/storefront/price-tag";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { BackIcon, ZoomIcon } from "@/components/customer-catalog/catalog-icons";
import { useHomeMotion } from "@/lib/home-motion";
import {
  CatalogError,
  fetchCatalogProduct,
  formatVnd,
  type CatalogProductDetail,
} from "@/lib/customer-catalog";
import { axisLabel, resolveSelection } from "@/lib/variant-select";
import { useCustomerCart } from "@/components/customer-commerce/customer-cart-provider";
import { addCustomerCartItem } from "@/lib/customer-commerce-client";
import { CommerceError } from "@/lib/customer-commerce";
import { readCart, useCart, writeCart, type CartItem as GuestItem } from "@/components/storefront/storefront-client";
import { cartStockAlertText, cartUnitForCategory, isStockShortageFailure, remainingForSku } from "@/lib/pdp-cart-stock.ts";
import { FavoriteHeart } from "@/components/storefront/favorite-heart";
import { recordRecent } from "@/lib/recently-viewed";
import { RatingLink } from "./rating-link";
import { ShareButton } from "./share-button";
import { ReviewsSection } from "./reviews-section";
import { RecentlyViewedRail } from "./recently-viewed-rail";
import { RelatedRail } from "./related-rail";
import "@/components/customer-catalog/catalog.css";
import "./engage.css";

// Trần số lượng mỗi dòng — khớp mức kẹp 999 khi đồng bộ giỏ (gio-hang/page.tsx).
const MAX_LINE_QTY = 999;

type Viewer = { images: string[]; index: number; alt: string; caption: string; trigger: HTMLButtonElement };

/** Gallery: mảng ảnh BE trả về sau này, hiện tại chỉ có imageUrl đơn. */
function galleryImages(product: CatalogProductDetail | null): string[] {
  if (!product) return [];
  const extra = (product as { images?: unknown }).images;
  if (Array.isArray(extra)) {
    const list = extra.filter((u): u is string => typeof u === "string" && u.length > 0);
    if (list.length > 0) return list;
  }
  return product.imageUrl ? [product.imageUrl] : [];
}

/** Tồn theo size cho màu hiệu dụng hiện tại; null = chưa rõ. */
function sizeStocks(
  variants: CatalogProductDetail["variants"],
  effColor: string,
  colors: string[],
): Map<string, (number | null)[]> {
  const map = new Map<string, (number | null)[]>();
  for (const v of variants) {
    if (v.size == null) continue;
    if (colors.length > 0 && effColor !== "" && v.color !== effColor) continue;
    const list = map.get(v.size) ?? [];
    list.push(v.availableStock ?? null);
    map.set(v.size, list);
  }
  return map;
}

function sizeState(stocks: (number | null)[] | undefined): "out" | "low" | "ok" {
  if (!stocks || stocks.length === 0) return "ok";
  if (stocks.every((s) => s === 0)) return "out";
  if (stocks.every((s) => s !== null && s >= 1 && s <= 3)) return "low";
  return "ok";
}

// R5: isPlaceholder + resolveSelection sống trong lib/variant-select để kiểm thử
// biên trực tiếp (tests/variant-select.test.mjs) — component chỉ tiêu thụ.

function swatchColor(color: string): string | null {
  const value = color.toLowerCase();
  if (value.includes("đen")) return "#222";
  if (value.includes("trắng")) return "#fafafa";
  if (value.includes("xám")) return "#8a8a8a";
  if (value.includes("kem")) return "#e8ddc4";
  if (value.includes("xanh")) return "#41627a";
  return null;
}

/* ---- Ảnh phóng to: shared-element morph (ghost) + deep zoom ---- */
// Không dùng rAF đo rect sau showModal (gây flash frame đầu): mọi phép đo +
// tạo ghost chạy đồng bộ trong useLayoutEffect, trước lần vẽ đầu tiên.
const MORPH_OPEN_MS = 520;
const MORPH_CLOSE_MS = 380;
const MORPH_EASE_OPEN = "cubic-bezier(0.22, 1, 0.36, 1)";
const MORPH_EASE_CLOSE = "cubic-bezier(0.4, 0, 0.2, 1)";
const MORPH_FALLBACK_MS = 600;
const VIEWER_FADE_MS = 150;
const OFFSCREEN_FADE_MS = 200;
const ZOOM_SCALE = 2.5;
const ZOOM_MS = 260;
const ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

// SSR: useLayoutEffect cảnh báo khi render máy chủ — dùng useEffect thay thế.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Hệ số làm chậm morph khi dev gắn ?morphSlow (chỉ development, phục vụ ảnh kiểm chứng). */
function morphSlowFactor(): number {
  if (process.env.NODE_ENV !== "development") return 1;
  try {
    return new URLSearchParams(window.location.search).has("morphSlow") ? 8 : 1;
  } catch {
    return 1;
  }
}

/** Hộp vừa trong min(92vw, 1100px) × (100dvh − head − foot − 48px), giữ đúng tỉ lệ ảnh. */
function fitStageSize(aspect: number): { w: number; h: number } | null {
  if (typeof window === "undefined" || !(aspect > 0)) return null;
  const maxW = Math.min(window.innerWidth * 0.92, 1100);
  // Không gian trống thực: viewport trừ chrome head/foot trừ khoảng thở 48px.
  const headH = document.querySelector(".catPage .cat-dialog-head")?.getBoundingClientRect().height ?? 76;
  const footH = document.querySelector(".catPage .cat-dialog-foot")?.getBoundingClientRect().height ?? 110;
  const maxH = Math.max(200, window.innerHeight - headH - footH - 48);
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

function ghostFrame(rect: DOMRect): Record<string, string> {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

function ImageDialog({
  viewer,
  motionOK,
  fromRect,
  onIndex,
  onClose,
}: {
  viewer: Viewer | null;
  motionOK: boolean;
  fromRect: MutableRefObject<DOMRect | null>;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [failedMap, setFailedMap] = useState<Record<string, true>>({});
  const [closing, setClosing] = useState(false);
  const [zoom, setZoom] = useState({ on: false, x: 50, y: 50 });
  const [panning, setPanning] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const fallbackRef = useRef<number | null>(null);
  const closeRef = useRef<() => void>(() => {});
  const slowRef = useRef(1);
  const touchInfo = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const panTouch = useRef<{ x: number; y: number } | null>(null);
  const lastTouchEnd = useRef(0);
  const panTimer = useRef<number | null>(null);
  const scrollLock = useRef({ locked: false, overflow: "", paddingRight: "" });
  const images = viewer?.images ?? [];
  const idx = viewer ? Math.min(viewer.index, Math.max(0, images.length - 1)) : 0;
  const multi = images.length > 1;
  const activeDialogSrc = images[idx];
  // Ảnh lỗi theo từng URL (suy ra lúc render, không setState trong effect):
  // chuyển sang ảnh khác thì cho thử lại thay vì kẹt chữ lỗi.
  const failed = activeDialogSrc != null && failedMap[activeDialogSrc] === true;
  // Mở lại khi trigger đổi; đổi ảnh trong viewer (cùng trigger) không morph lại.
  const dialogKey = viewer?.trigger ?? null;
  const zoomMs = motionOK ? ZOOM_MS : 0;
  const zoomLabel = zoom.on
    ? `Đã phóng to ${ZOOM_SCALE} lần. Bấm vào ảnh để thu nhỏ.`
    : "Bấm vào ảnh để phóng to.";

  function clearFallback() {
    if (fallbackRef.current !== null) { window.clearTimeout(fallbackRef.current); fallbackRef.current = null; }
  }
  function removeGhost() {
    ghostRef.current?.remove();
    ghostRef.current = null;
  }
  function lockScroll() {
    if (scrollLock.current.locked || typeof document === "undefined") return;
    const body = document.body;
    scrollLock.current = { locked: true, overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    // Khóa cuộn nhưng bù đúng bề rộng thanh cuộn để trang không giật ngang.
    const room = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (room > 0) body.style.paddingRight = `${(parseFloat(getComputedStyle(body).paddingRight) || 0) + room}px`;
  }
  function unlockScroll() {
    if (!scrollLock.current.locked || typeof document === "undefined") return;
    document.body.style.overflow = scrollLock.current.overflow;
    document.body.style.paddingRight = scrollLock.current.paddingRight;
    scrollLock.current.locked = false;
  }
  function hideSource() {
    const img = triggerRef.current?.querySelector("img");
    if (img) {
      img.style.visibility = "hidden";
      img.setAttribute("data-morph-hidden", "true");
    }
  }
  function restoreSource() {
    const trigger = triggerRef.current;
    if (trigger && trigger.isConnected) {
      const img = trigger.querySelector("img");
      img?.removeAttribute("data-morph-hidden");
      if (img) img.style.visibility = "";
    }
  }
  // Rect nguồn đo tại thời điểm gọi (đóng đo lại, không dùng rect lúc mở).
  // Giao với khung nút để chỉ lấy phần ảnh thật sự thấy được; ngoài màn hình ⇒ null.
  function measureSource(): DOMRect | null {
    const trigger = viewer?.trigger;
    if (!trigger || !trigger.isConnected || typeof window === "undefined") return null;
    const box = trigger.querySelector("img")?.getBoundingClientRect() ?? trigger.getBoundingClientRect();
    const frame = trigger.getBoundingClientRect();
    const left = Math.max(box.left, frame.left);
    const top = Math.max(box.top, frame.top);
    const right = Math.min(box.right, frame.right);
    const bottom = Math.min(box.bottom, frame.bottom);
    if (right - left < 2 || bottom - top < 2) return null;
    if (right < 0 || bottom < 0 || left > window.innerWidth || top > window.innerHeight) return null;
    return new DOMRect(left, top, right - left, bottom - top);
  }
  function spawnGhost(dialog: HTMLDialogElement, from: DOMRect, src: string): HTMLDivElement {
    const ghost = document.createElement("div");
    ghost.className = "cat-ghost";
    ghost.setAttribute("data-testid", "cat-ghost");
    const gimg = document.createElement("img");
    gimg.src = src;
    gimg.alt = "";
    gimg.draggable = false;
    ghost.appendChild(gimg);
    // Ghost là phần tử nhỏ position:fixed — nội suy left/top/width/height trực
    // tiếp, ảnh trong contain nên không bao giờ giãn (chỉ uniform, không scale x/y).
    Object.assign(ghost.style, ghostFrame(from));
    dialog.appendChild(ghost);
    ghostRef.current = ghost;
    return ghost;
  }
  function markPanning() {
    setPanning(true);
    if (panTimer.current !== null) window.clearTimeout(panTimer.current);
    panTimer.current = window.setTimeout(() => setPanning(false), 160);
  }
  // Dọn timer/ghost/khóa cuộn/ảnh nguồn khi unmount để không chạm dialog đã tháo.
  useEffect(() => () => {
    if (fallbackRef.current !== null) window.clearTimeout(fallbackRef.current);
    if (panTimer.current !== null) window.clearTimeout(panTimer.current);
    ghostRef.current?.remove();
    ghostRef.current = null;
    unlockScroll();
    restoreSource();
  }, []);

  // Mở: showModal với chrome ẩn (data-phase="opening"), đo rect đích và tạo
  // ghost đồng bộ trong cùng task — khung hình đầu tiên đã là ghost ở rect
  // nguồn, không có frame nào vẽ ảnh ở kích thước cuối rồi mới nhảy về.
  useIsoLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || !viewer) return;
    if (dialog.open) return; // StrictMode gắn lại: giữ morph đang bay.
    const slow = morphSlowFactor();
    slowRef.current = slow;
    triggerRef.current = viewer.trigger;
    // Dev-only: ?morphSlow cũng làm chậm transition CSS để ảnh kiểm chứng đúng nhịp.
    if (slow > 1) dialog.setAttribute("data-slow", "1");
    else dialog.removeAttribute("data-slow");
    setFailedMap({});
    setClosing(false);
    setZoom({ on: false, x: 50, y: 50 });
    setPanning(false);
    dialog.setAttribute("data-phase", "opening");
    lockScroll();
    if (typeof (dialog as HTMLDialogElement).showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // Không morph (giảm chuyển động / Motion Off / thiếu rect nguồn):
    // fade 150ms toàn dialog, không ghost.
    if (!motionOK || !fromRect.current) {
      dialog.setAttribute("data-phase", "open");
      dialog.animate([{ opacity: "0" }, { opacity: "1" }], { duration: VIEWER_FADE_MS, easing: "ease-out" });
      return;
    }
    // Cỡ stage suy từ ảnh trang (cùng src ⇒ cùng kích thước tự nhiên) để rect
    // đích ổn định trước khi đo, không chờ ảnh dialog tải xong.
    const pageImg = viewer.trigger.querySelector("img");
    const pw = pageImg?.naturalWidth ?? 0;
    const ph = pageImg?.naturalHeight ?? 0;
    const fit = fitStageSize(pw > 0 && ph > 0 ? pw / ph : 4 / 5);
    const stage = stageRef.current;
    if (stage && fit) {
      stage.style.width = `${fit.w}px`;
      stage.style.height = `${fit.h}px`;
    }
    let target = stage?.getBoundingClientRect();
    if (stage && target) {
      // Khóa stage vào pixel nguyên (stage căn giữa hay rơi vào x.5px): ghost đáp đúng pixel,
      // không giật nửa pixel khi bàn giao từ ghost sang ảnh thật.
      stage.style.translate = "";
      target = stage.getBoundingClientRect();
      // Snap theo pixel THIẾT BỊ (màn 125%/150% thì 1px CSS ≠ 1px thật), không chỉ pixel CSS.
      const dpr = window.devicePixelRatio || 1;
      const nx = Math.round(target.left * dpr) / dpr - target.left;
      const ny = Math.round(target.top * dpr) / dpr - target.top;
      if (nx !== 0 || ny !== 0) {
        stage.style.translate = `${nx}px ${ny}px`;
        target = stage.getBoundingClientRect();
      }
    }
    const from = fromRect.current;
    const src = activeDialogSrc;
    if (!target || !from || !src || target.width < 2 || target.height < 2) {
      dialog.setAttribute("data-phase", "open");
      return;
    }
    const ghost = spawnGhost(dialog, from, src);
    hideSource();
    let done = false;
    const finishOpen = () => {
      if (done) return;
      done = true;
      clearFallback();
      // Bàn giao mềm: ghost mờ đi 120ms trên ảnh thật đã nằm đúng chỗ, không cắt cụt 1 khung hình.
      const g = ghostRef.current;
      if (g && g.isConnected) {
        const drop = () => { g.remove(); if (ghostRef.current === g) ghostRef.current = null; };
        const fade = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "forwards" });
        fade.onfinish = drop;
        fade.oncancel = drop;
      } else {
        removeGhost();
      }
      if (dialog.isConnected) dialog.setAttribute("data-phase", "open");
    };
    const anim = ghost.animate([ghostFrame(from), ghostFrame(target)], {
      duration: MORPH_OPEN_MS * slow,
      easing: MORPH_EASE_OPEN,
      fill: "forwards",
    });
    // Full opacity suốt morph, một đường cong dứt khoát 520ms.
    anim.onfinish = finishOpen;
    anim.oncancel = finishOpen;
    clearFallback();
    fallbackRef.current = window.setTimeout(finishOpen, MORPH_OPEN_MS * slow + 150);
    // Khung 1 đã vẽ ghost ở rect nguồn + chrome ẩn; sang khung 2 mới bật
    // backdrop/chrome để transition chạy từ trạng thái opening (backdrop 360ms,
    // chrome trễ 300ms + 220ms theo CSS).
    const raf = requestAnimationFrame(() => {
      if (dialog.isConnected && dialog.open) dialog.setAttribute("data-phase", "open");
    });
    return () => {
      cancelAnimationFrame(raf);
      done = true;
      clearFallback();
      // StrictMode gắn lại giữa chừng: dialog còn mở thì giữ nguyên hiện trạng.
      if (dialog.open && ghostRef.current?.isConnected) return;
      try { anim.cancel(); } catch { /* đã xong */ }
      removeGhost();
      unlockScroll();
      restoreSource();
    };
    // dialogKey là trigger của lần mở hiện tại — đổi ảnh trong viewer không morph lại.
  }, [dialogKey]);

  function requestClose() {
    const dialog = ref.current;
    if (!dialog?.open || closing) return;
    // Đóng: reset zoom trước rồi mới đo morph (rect stage không dính transform).
    setZoom({ on: false, x: 50, y: 50 });
    setPanning(false);
    const slow = slowRef.current || 1;
    // Đo lại rect nguồn ngay lúc đóng (cuộn/resize sau lúc mở không làm lệch).
    const dest = measureSource();
    clearFallback();
    const settleClosed = () => {
      clearFallback();
      removeGhost();
      setClosing(false);
      restoreSource();
      unlockScroll();
      if (dialog.open) dialog.close();
    };
    if (!motionOK || dest === null) {
      // Nguồn ngoài màn hình: fade 200ms; Motion Off/giảm chuyển động: fade 150ms.
      const ms = !motionOK ? VIEWER_FADE_MS : OFFSCREEN_FADE_MS;
      setClosing(true);
      dialog.setAttribute("data-phase", "closing");
      const fade = dialog.animate([{ opacity: "1" }, { opacity: "0" }], { duration: ms, easing: "ease-out" });
      fade.onfinish = settleClosed;
      fade.oncancel = settleClosed;
      fallbackRef.current = window.setTimeout(settleClosed, ms + 200);
      return;
    }
    const stage = stageRef.current;
    const from = stage && stage.isConnected ? stage.getBoundingClientRect() : null;
    const src = activeDialogSrc;
    if (!from || !src || from.width < 2 || from.height < 2) {
      setClosing(true);
      dialog.setAttribute("data-phase", "closing");
      const fade = dialog.animate([{ opacity: "1" }, { opacity: "0" }], { duration: OFFSCREEN_FADE_MS, easing: "ease-out" });
      fade.onfinish = settleClosed;
      fade.oncancel = settleClosed;
      fallbackRef.current = window.setTimeout(settleClosed, OFFSCREEN_FADE_MS + 200);
      return;
    }
    setClosing(true);
    dialog.setAttribute("data-phase", "closing");
    const ghost = spawnGhost(dialog, from, src);
    hideSource();
    // Ghost bay về rect nguồn 380ms; chrome tắt trong 120ms, backdrop tắt cùng
    // nhịp morph (theo CSS data-phase="closing").
    let done = false;
    const finishClose = () => {
      if (done) return;
      done = true;
      settleClosed();
    };
    const anim = ghost.animate([ghostFrame(from), ghostFrame(dest)], {
      duration: MORPH_CLOSE_MS * slow,
      easing: MORPH_EASE_CLOSE,
      fill: "forwards",
    });
    anim.onfinish = finishClose;
    anim.oncancel = finishClose;
    // Dự phòng: animation kẹt (tab ẩn, motion bị ép) thì vẫn đóng dialog và
    // luôn trả lại ảnh nguồn.
    fallbackRef.current = window.setTimeout(finishClose, MORPH_FALLBACK_MS * slow);
  }

  // Đóng thật (sự kiện close của dialog): luôn trả ảnh nguồn + cuộn rồi mới dọn state.
  function handleClose() {
    clearFallback();
    removeGhost();
    restoreSource();
    unlockScroll();
    setClosing(false);
    ref.current?.removeAttribute("data-slow");
    onClose();
  }

  useEffect(() => {
    // Luôn giữ bản requestClose mới nhất: listener "cancel" gắn một lần nên
    // closure cũ sẽ thấy viewer=null (lúc mount) và Escape rớt vào nhánh fade.
    closeRef.current = requestClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      // Escape: morph về rồi mới đóng thay vì đóng ngay.
      if (dialog.open) {
        e.preventDefault();
        closeRef.current();
      }
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  // Đổi ảnh trong viewer (mũi tên, thumbs, vuốt): reset zoom, crossfade ngắn, không ghost.
  function go(nextIndex: number) {
    if (!viewer) return;
    setZoom({ on: false, x: 50, y: 50 });
    setPanning(false);
    onIndex(nextIndex);
  }
  function prev() { if (multi && viewer) go((idx - 1 + images.length) % images.length); }
  function next() { if (multi && viewer) go((idx + 1) % images.length); }

  function zoomAt(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    const x = clamp(((clientX - box.left) / Math.max(1, box.width)) * 100);
    const y = clamp(((clientY - box.top) / Math.max(1, box.height)) * 100);
    setZoom((z) => (z.on ? { on: false, x: 50, y: 50 } : { on: true, x, y }));
    setPanning(false);
  }
  function stageClick(e: React.MouseEvent) {
    // Tap cảm ứng đã xử lý ở touchend — bỏ qua click tổng hợp sau đó.
    if (Date.now() - lastTouchEnd.current < 600) return;
    if (e.clientX === 0 && e.clientY === 0) {
      // Bàn phím (Enter/Space trên stage): bật/tắt ở giữa ảnh.
      setZoom((z) => (z.on ? { on: false, x: 50, y: 50 } : { on: true, x: 50, y: 50 }));
      setPanning(false);
      return;
    }
    zoomAt(e.clientX, e.clientY);
  }
  function panTo(x: number, y: number) {
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    setZoom((z) => (z.on ? { ...z, x: clamp(x), y: clamp(y) } : z));
    markPanning();
  }
  // Desktop: rê chuột khi zoom thì điểm dưới con trỏ đi theo (gốc transform = con trỏ).
  function stagePointerMove(e: React.PointerEvent) {
    if (!zoom.on || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    panTo(((e.clientX - box.left) / Math.max(1, box.width)) * 100, ((e.clientY - box.top) / Math.max(1, box.height)) * 100);
  }
  // Touch khi zoom: một ngón kéo để pan (gốc transform dịch ngược tay theo tỉ lệ s-1).
  function stageTouchMove(e: React.TouchEvent) {
    if (!zoom.on || e.touches.length !== 1) return;
    const t = e.touches[0];
    const prevTouch = panTouch.current;
    panTouch.current = { x: t.clientX, y: t.clientY };
    if (!prevTouch) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const dx = ((t.clientX - prevTouch.x) / Math.max(1, box.width)) * 100;
    const dy = ((t.clientY - prevTouch.y) / Math.max(1, box.height)) * 100;
    setZoom((z) => {
      if (!z.on) return z;
      const clamp = (v: number) => Math.min(100, Math.max(0, v));
      return { ...z, x: clamp(z.x - dx / (ZOOM_SCALE - 1)), y: clamp(z.y - dy / (ZOOM_SCALE - 1)) };
    });
    markPanning();
  }
  function mediaTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchInfo.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    panTouch.current = zoom.on ? { x: t.clientX, y: t.clientY } : null;
  }
  function mediaTouchEnd(e: React.TouchEvent) {
    lastTouchEnd.current = Date.now();
    const info = touchInfo.current;
    touchInfo.current = null;
    panTouch.current = null;
    if (!info) return;
    const t = e.changedTouches[0];
    const moved = Math.hypot(t.clientX - info.x, t.clientY - info.y);
    // Vuốt đổi ảnh chỉ khi chưa zoom.
    if (!zoom.on && multi && Math.abs(t.clientX - info.x) >= 40 && moved >= 40) {
      lastTap.current = null;
      if (t.clientX - info.x < 0) next(); else prev();
      return;
    }
    // Tap: double-tap bật/tắt zoom 2.5× tại điểm chạm.
    if (moved < 12 && Date.now() - info.t < 500) {
      const last = lastTap.current;
      if (last && Date.now() - last.t < 320 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 32) {
        lastTap.current = null;
        zoomAt(t.clientX, t.clientY);
      } else {
        lastTap.current = { t: Date.now(), x: t.clientX, y: t.clientY };
      }
    }
  }

  return (
    <dialog
      ref={ref}
      className="cat-dialog"
      aria-labelledby="cat-dialog-title"
      onClose={handleClose}
      data-motion={motionOK ? "on" : "off"}
      onClick={(e) => {
        // Panel-less toàn màn hình: bấm vào nền (dialog/backdrop, vùng trống
        // head/media/foot quanh stage) thì đóng; stage và control giữ lại.
        const t = e.target as HTMLElement;
        if (t === e.currentTarget) { requestClose(); return; }
        if (t.classList?.contains("cat-dialog-media") || t.classList?.contains("cat-dialog-head") || t.classList?.contains("cat-dialog-foot")) requestClose();
      }}
      onKeyDown={(e) => {
        if (!viewer) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
        else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        else if (e.key === "+" || e.key === "z" || e.key === "Z") {
          // Deep zoom bằng bàn phím: bật/tắt ở giữa ảnh.
          e.preventDefault();
          setZoom((z) => (z.on ? { on: false, x: 50, y: 50 } : { on: true, x: 50, y: 50 }));
          setPanning(false);
        }
      }}
    >
      <div className="cat-chrome cat-dialog-head">
        <h2 id="cat-dialog-title">Xem ảnh{multi ? <span className="cat-dialog-count" aria-live="polite"> {idx + 1} / {images.length}</span> : null}</h2>
        <button className="cat-dialog-close" type="button" aria-label="Đóng ảnh phóng to" onClick={requestClose}>✕</button>
      </div>
      <div
        className="cat-chrome cat-dialog-media"
        onTouchStart={mediaTouchStart}
        onTouchMove={stageTouchMove}
        onTouchEnd={mediaTouchEnd}
      >
        {multi ? (
          <button type="button" className="cat-dialog-arrow cat-dialog-prev" aria-label="Ảnh trước" onClick={prev}>‹</button>
        ) : null}
        {viewer && activeDialogSrc ? (
          failed ? (
            <p className="cat-dialog-fail" role="img" aria-label={`Không tải được ảnh: ${viewer.alt}`}>Không tải được ảnh này.</p>
          ) : (
            <button
              ref={stageRef}
              type="button"
              className="cat-stage"
              data-zoom={zoom.on ? "on" : "off"}
              data-testid="cat-stage"
              aria-label={`Ảnh lớn: ${viewer.alt}. ${zoomLabel}`}
              onClick={stageClick}
              onPointerMove={stagePointerMove}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa */}
              <img
                key={activeDialogSrc}
                ref={imgRef}
                className="cat-stage-img is-in"
                src={activeDialogSrc}
                alt={viewer.alt}
                referrerPolicy="no-referrer"
                draggable={false}
                style={
                  zoom.on
                    ? { transform: `scale(${ZOOM_SCALE})`, transformOrigin: `${zoom.x}% ${zoom.y}%`, transition: panning ? "none" : `transform ${zoomMs}ms ${ZOOM_EASE}` }
                    : { transition: `transform ${zoomMs}ms ${ZOOM_EASE}` }
                }
                onLoad={(e) => {
                  // Ảnh khác tỉ lệ thì khớp lại cỡ stage (rect đích các lần sau).
                  const el = e.currentTarget;
                  if (el.naturalWidth > 0 && el.naturalHeight > 0 && stageRef.current) {
                    const fit = fitStageSize(el.naturalWidth / el.naturalHeight);
                    if (fit) {
                      const st = stageRef.current;
                      if (Math.abs(st.getBoundingClientRect().width - fit.w) > 2) {
                        st.style.width = `${fit.w}px`;
                        st.style.height = `${fit.h}px`;
                      }
                    }
                  }
                }}
                onError={() => {
                  const src = activeDialogSrc;
                  if (src) setFailedMap((prevMap) => (prevMap[src] ? prevMap : { ...prevMap, [src]: true }));
                }}
              />
            </button>
          )
        ) : null}
        {multi ? (
          <button type="button" className="cat-dialog-arrow cat-dialog-next" aria-label="Ảnh sau" onClick={next}>›</button>
        ) : null}
      </div>
      <div className="cat-chrome cat-dialog-foot">
        <p className="cat-dialog-caption">
          {viewer?.caption}
          <span className="cat-zoom-hint cat-zoom-hint-desktop" aria-hidden="true"> · Bấm vào ảnh để phóng to</span>
          <span className="cat-zoom-hint cat-zoom-hint-touch" aria-hidden="true"> · Chạm hai lần để phóng to</span>
        </p>
        {multi ? (
          <div className="cat-thumbs cat-dialog-thumbs" role="group" aria-label="Ảnh sản phẩm">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                className="cat-thumb"
                aria-label={`Xem ảnh ${i + 1} trên ${images.length}`}
                aria-current={i === idx}
                onClick={() => go(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa */}
                <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedMap((prevMap) => (prevMap[src] ? prevMap : { ...prevMap, [src]: true }))} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

// Guest lines reuse the stable storefront cart hook (single shared subscription).

export function DetailView({ id }: { id: string }) {
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const viewKey = `${id}|${retry}`;
  const [settled, setSettled] = useState<{ key: string; data?: CatalogProductDetail; error?: string; notFound?: boolean }>({ key: "" });
  const product = settled.key === viewKey ? settled.data ?? null : null;
  const loading = settled.key !== viewKey;
  const notFound = settled.key === viewKey ? settled.notFound ?? false : false;
  const error = settled.key === viewKey ? settled.error ?? "" : "";
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  // Ảnh lỗi theo từng URL: thumbnail hỏng chỉ ẩn chính nó; ảnh chính hỏng thì
  // chuyển sang ảnh còn tốt, chỉ hiện trạng thái lỗi khi không còn ảnh nào tốt.
  const [failedSrcs, setFailedSrcs] = useState<Record<string, true>>({});
  const [imgIdx, setImgIdx] = useState(0);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const fromRect = useRef<DOMRect | null>(null);
  const { enabled: motionOK } = useHomeMotion();
  const [addBusy, setAddBusy] = useState(false);
  const [addNotice, setAddNotice] = useState("");
  const [addError, setAddError] = useState("");
  const [stockAlert, setStockAlert] = useState("");
  const { cart, authState, refresh, setCart } = useCustomerCart();
  const guestLines = useCart();
  const reqId = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const my = ++reqId.current;
    fetchCatalogProduct(id, controller.signal)
      .then((result) => {
        if (reqId.current !== my) return;
        setSettled({ key: viewKey, data: result });
        // R5: không đoán trước lựa chọn — SKU duy nhất tự giải quyết nội bộ,
        // nhiều lựa chọn thì khách phải chọn thật (giống mẫu Nike đã đối chiếu).
        setColor("");
        setSize("");
        setQuantity(1);
        setStockAlert("");
        setAddNotice("");
        setAddError("");
        setFailedSrcs({});
        setImgIdx(0);
        setViewer(null);
        fromRect.current = null;
      })
      .catch((err) => {
        if (controller.signal.aborted || reqId.current !== my) return;
        setSettled({
          key: viewKey,
          notFound: err instanceof CatalogError && err.status === 404,
          error: err instanceof CatalogError && err.status === 404 ? undefined : err instanceof CatalogError ? err.message : "Không kết nối được máy chủ danh mục. Thử lại.",
        });
      });
    return () => controller.abort();
  }, [id, retry, viewKey]);

  // "Đã xem gần đây": ghi nhận ngay khi sản phẩm tải xong (localStorage, tối đa 12).
  const viewedId = product?.id;
  const viewedName = product?.name;
  const viewedPrice = product?.price;
  const viewedImage = product?.imageUrl;
  useEffect(() => {
    if (viewedId && viewedName && typeof viewedPrice === "number") {
      recordRecent({ id: viewedId, name: viewedName, price: viewedPrice, image: viewedImage ?? undefined, href: `/san-pham/${viewedId}` });
    }
  }, [viewedId, viewedName, viewedPrice, viewedImage]);

  const variants = product?.variants ?? [];
  // R5: giải quyết theo số ứng viên duy nhất — không `.find` tùy tiện.
  // Chiều thật duy nhất tự có hiệu lực (không bắt bấm cho có); mập mờ thật
  // (nhiều SKU mà không còn chiều thật nào) ⇒ trạng thái unavailable trung thực.
  const selection = resolveSelection(variants, color, size);
  const colors = selection.colors;
  const sizesForColor = selection.sizes;
  // Nhãn trục trung thực: mau_sac đôi khi mang chữ nguồn không phải màu
  // (đặt cọc/đặt hàng) — khi đó nhãn trung tính, không bao giờ hiện "Màu".
  const colorAxisLabel = axisLabel(colors, "color");
  const sizeAxisLabel = axisLabel(sizesForColor, "size");
  const selected = selection.selected;
  const price = product ? product.price + (selected?.additionalPrice ?? 0) : 0;
  const needColor = selection.needColor;
  const needSize = selection.needSize;
  const ambiguous = selection.ambiguous;

  // Gallery: mảng ảnh BE (sau này) hoặc imageUrl đơn hiện tại. Tính trực tiếp mỗi render
  // (rẻ, vài phần tử) để React Compiler không phải giữ memo thủ công.
  const gallery = galleryImages(product);
  const goodGallery = gallery.filter((src) => !failedSrcs[src]);
  const safeIdx = gallery.length ? Math.min(imgIdx, gallery.length - 1) : 0;
  const rawActive = gallery.length ? gallery[safeIdx] : undefined;
  // Ảnh chính hỏng thì dùng ảnh còn tốt đầu tiên; hết ảnh tốt mới báo lỗi.
  const activeSrc = rawActive && !failedSrcs[rawActive] ? rawActive : goodGallery[0] ?? null;
  const galleryExhausted = gallery.length > 0 && goodGallery.length === 0;
  const stocksBySize = sizeStocks(variants, selection.effColor, colors);
  // Ghi chú tồn thấp khi SKU đã chốt còn 1–3, kể cả sản phẩm một cỡ (khối cỡ ẩn):
  // dùng cỡ hiệu dụng của SKU, dự phòng cỡ khách đã chọn.
  const effSizeForNote = selected?.size || size;
  const lowNote = selected && selected.availableStock !== null && selected.availableStock !== undefined && selected.availableStock >= 1 && selected.availableStock <= 3 && effSizeForNote
    ? `Size ${effSizeForNote} chỉ còn ${selected.availableStock} sản phẩm`
    : null;
  // Part B: số lượng SKU đang chọn đã có trong giỏ (ghế đếm ở header dùng chung
  // nguồn này) để kẹp stepper và nhận diện giỏ đã giữ hết tồn.
  const skuId = selected?.skuId ?? null;
  const inCart = selected && skuId !== null
    ? (authState === "authenticated" && cart
      ? cart.items.reduce((n, line) => n + (line.skuId === skuId ? line.quantity : 0), 0)
      : authState === "guest"
        ? guestLines.reduce((n, line) => n + (line.skuId === skuId ? line.qty || 0 : 0), 0)
        : 0)
    : 0;
  const available = selected?.availableStock ?? null;
  const remaining = remainingForSku(available, inCart);
  const cartFull = available !== null && available > 0 && inCart >= available;
  // Số lượng hiệu dụng kẹp về trần còn thêm được — suy ra lúc render, không effect.
  const cappedQty = remaining !== null
    ? (remaining <= 0 ? 1 : Math.min(Math.max(1, quantity), remaining))
    : Math.max(1, quantity);
  // Part C: đã chọn mà tồn ≥ 4 thì chỉ một dòng lặng "Còn hàng" (không nêu số).
  const inStockNote = selected && !lowNote && selected.availableStock !== null && selected.availableStock !== undefined && selected.availableStock >= 4 && effSizeForNote
    ? "Còn hàng"
    : null;
  // SKU hết hàng (tồn khả dụng bằng 0): khóa nút mua.
  const soldOut = selected?.availableStock === 0;

  function chooseColor(next: string) {
    setColor(next);
    // Đổi màu ⇒ bỏ cỡ đã chọn (cỡ thuộc về màu cũ có thể không tồn tại).
    setSize("");
    setStockAlert("");
    setAddNotice("");
    setAddError("");
  }

  function openZoom(trigger: HTMLButtonElement) {
    if (!product || goodGallery.length === 0) return;
    const at = activeSrc ? Math.max(0, goodGallery.indexOf(activeSrc)) : 0;
    // Rect nguồn: hộp ảnh trang giao với khung nút — chỉ morph phần thật sự thấy được.
    const box = trigger.querySelector("img")?.getBoundingClientRect() ?? trigger.getBoundingClientRect();
    const frame = trigger.getBoundingClientRect();
    const left = Math.max(box.left, frame.left);
    const top = Math.max(box.top, frame.top);
    const right = Math.min(box.right, frame.right);
    const bottom = Math.min(box.bottom, frame.bottom);
    fromRect.current = right - left > 0 && bottom - top > 0
      ? new DOMRect(left, top, right - left, bottom - top)
      : frame;
    const next: Viewer = {
      images: goodGallery,
      index: at,
      alt: product.name,
      caption: product.name,
      trigger,
    };
    // FLIP trong dialog lo morph (~320ms); ở đây chỉ đặt state.
    setImgIdx(at);
    setViewer(next);
  }

  function closeZoom() {
    const trigger = viewer?.trigger;
    // Đóng qua backdrop/Escape đã morph trong dialog; ở đây chỉ dọn state + trả focus.
    setViewer(null);
    trigger?.focus();
  }

  async function addToCart() {
    if (!selected || addBusy) return;
    setAddBusy(true);
    setAddNotice("");
    setAddError("");
    setStockAlert("");
    try {
      const next = await addCustomerCartItem(selected.skuId, cappedQty);
      setCart(next);
      setAddNotice(`Đã thêm ${cappedQty} × ${product?.name ?? "sản phẩm"} vào giỏ hàng.`);
    } catch (failure) {
      if (failure instanceof CommerceError && failure.status === 401) {
        const current = readCart() as GuestItem[];
        const meta = [color, size].filter(Boolean).join(" · ");
        const existing = current.find((line) => line.skuId === selected.skuId && line.meta === meta);
        const next = existing
          ? current.map((line) => line === existing ? { ...line, qty: line.qty + cappedQty } : line)
          : [...current, { id: product?.id ?? Number(id), name: product?.name ?? "Sản phẩm", price, image: product?.imageUrl ?? undefined, qty: cappedQty, meta, skuId: selected.skuId, color, size }];
        writeCart(next);
        // Giữ nguyên sản phẩm/biến thể/số lượng trong giỏ tạm rồi chuyển thẳng
        // tới đăng nhập; giỏ sẽ nhập lại đúng một dòng sau khi đăng nhập.
        setAddNotice("Đang chuyển tới đăng nhập để giữ món này trong giỏ của bạn…");
        router.push("/dang-nhap?next=%2Fgio-hang");
      } else if (failure instanceof CommerceError && failure.status === 403) {
        setAddError("Tài khoản của bạn có vai trò Quản trị viên/Quản lý. Chức năng mua hàng trực tuyến chỉ dành cho tài khoản Khách hàng. Vui lòng chuyển sang tài khoản Khách hàng để đặt đơn.");
      } else if (selected && isStockShortageFailure(failure)) {
        // Giỏ đã giữ hết tồn (không phải hết hàng thật): đồng bộ giỏ rồi báo
        // theo mức đầy (inCart = available) — không bao giờ bảo qty 1 "giảm số lượng".
        void refresh();
        setStockAlert(cartStockAlertText({
          size: effSizeForNote || null,
          available,
          inCart: available ?? inCart,
          unit: cartUnitForCategory(product?.categoryName),
        }));
      } else {
        setAddError(failure instanceof Error ? failure.message : "Không thêm được vào giỏ. Thử lại.");
      }
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="catPage">
      <div className="cat-content cat-detail-content">
        <Link className="cat-text-button cat-back" href="/nam">
          <BackIcon /> Sản phẩm
        </Link>

        {loading ? (
          <p className="cat-status cat-info" role="status">Đang tải sản phẩm…</p>
        ) : notFound ? (
          <div className="cat-empty">
            <h2>Không tìm thấy sản phẩm</h2>
            <p>Sản phẩm có thể đã ngừng hiển thị hoặc mã không hợp lệ.</p>
            <Link className="cat-text-button" href="/nam">Về danh sách sản phẩm</Link>
          </div>
        ) : error ? (
          <div className="cat-status cat-error" role="alert">
            {error}{" "}
            <button className="cat-text-button" type="button" onClick={() => setRetry((n) => n + 1)}>Thử lại</button>
          </div>
        ) : product ? (
          <>
          <div className="cat-detail-layout">
            <figure className="cat-detail-figure">
              {gallery.length > 0 && !galleryExhausted && activeSrc ? (
                <>
                  <button
                    className="cat-detail-image-button"
                    type="button"
                    aria-label={`Phóng to ảnh ${product.name}${goodGallery.length > 1 ? ` (${goodGallery.indexOf(activeSrc) + 1} trên ${goodGallery.length})` : ""}`}
                    onClick={(event) => openZoom(event.currentTarget)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa */}
                    <img
                      className="cat-detail-image"
                      key={activeSrc}
                      src={activeSrc}
                      alt={product.name}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedSrcs((prev) => (prev[activeSrc] ? prev : { ...prev, [activeSrc]: true }))}
                    />
                    <span className="cat-image-zoom" aria-hidden="true"><ZoomIcon /></span>
                  </button>
                  {gallery.length > 1 ? (
                    <div className="cat-thumbs" role="group" aria-label="Ảnh sản phẩm">
                      {gallery.map((src, i) => {
                        // Thumbnail hỏng chỉ ẩn chính nó, không sập cả gallery.
                        if (failedSrcs[src]) return null;
                        return (
                          <button
                            key={`${src}-${i}`}
                            type="button"
                            className="cat-thumb"
                            aria-label={`Xem ảnh ${i + 1} trên ${gallery.length}`}
                            aria-current={src === activeSrc}
                            onClick={() => setImgIdx(i)}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh sản phẩm từ BE/minh họa */}
                            <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedSrcs((prev) => (prev[src] ? prev : { ...prev, [src]: true }))} />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </>
              ) : (
                <span className="cat-detail-image-fail" role="img" aria-label={`Không tải được ảnh: ${product.name}`}>
                  Không tải được ảnh sản phẩm
                </span>
              )}
            </figure>

            <section className="cat-detail-info" aria-label="Thông tin và lựa chọn sản phẩm">
              {product.brandName ? (
                <p className="cat-detail-brand">
                  {/* Logo hãng do BE cung cấp, đã kiểm định; FE chỉ hiển thị ở cỡ
                      nhãn nhỏ (24–28px cao). Không có/không tin cậy ⇒ chỉ chữ. */}
                  {product.brandLogoUrl ? (
                    // Logo thật từ BE nhưng render qua mask một màu: mực trắng/đen của
                    // asset không còn quyết định độ tương phản (Control contact sheet).
                    <span
                      className="cat-detail-brand-mark"
                      aria-hidden="true"
                      style={{ ["--brand-logo" as string]: `url("${product.brandLogoUrl}")` }}
                    />
                  ) : null}
                  <span>{product.brandName}</span>
                </p>
              ) : null}
              <h1>{product.name}</h1>
              <RatingLink productId={product.id} />
              <p className="cat-detail-price"><PriceTag value={price} size="hero" /></p>
              {selected && selected.additionalPrice > 0 ? (
                <p className="cat-price-note">Giá theo lựa chọn của bạn (đã gồm phụ thu nếu có).</p>
              ) : null}

              {colors.length > 1 ? (
                <div className="cat-option-block">
                  <h2>{colorAxisLabel} <span>{color || "Chọn"}</span></h2>
                  <div className="cat-option-options">
                    {colors.map((option) => (
                      <button
                        className="cat-option-chip"
                        type="button"
                        key={option}
                        aria-pressed={color === option}
                        onClick={() => chooseColor(option)}
                      >
                        {swatchColor(option) ? <span className="cat-color-swatch" aria-hidden="true" style={{ background: swatchColor(option) ?? undefined }} /> : null}
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {sizesForColor.length > 1 ? (
                <div className="cat-option-block">
                  <h2>{sizeAxisLabel} <span>{size || "Chọn"}</span></h2>
                  <div className="cat-option-options">
                    {sizesForColor.map((option) => {
                      const st = sizeState(stocksBySize.get(option));
                      const out = st === "out";
                      const low = st === "low";
                      return (
                        <button
                          className={`cat-option-chip${out ? " is-out" : ""}${low ? " is-low" : ""}`}
                          type="button"
                          key={option}
                          aria-pressed={size === option}
                          disabled={out}
                          title={out ? "Hết hàng" : undefined}
                          aria-label={out ? `${option}, Hết hàng` : low ? `${option}, sắp hết` : option}
                          onClick={() => { setSize(option); setStockAlert(""); setAddNotice(""); setAddError(""); }}
                        >
                          {low ? <span className="cat-lowdot" aria-hidden="true" /> : null}
                          <span>{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {lowNote ? <p className="cat-low-note" role="status">{lowNote}</p> : inStockNote ? <p className="cat-ok-note" role="status">{inStockNote}</p> : null}
                </div>
              ) : sizesForColor.length === 1 && lowNote ? (
                <p className="cat-low-note" role="status">{lowNote}</p>
              ) : sizesForColor.length === 1 && inStockNote ? (
                <p className="cat-ok-note" role="status">{inStockNote}</p>
              ) : null}

              {!variants.length ? (
                <p className="cat-readonly-note">Sản phẩm này chưa có lựa chọn màu hoặc kích thước.</p>
              ) : null}

              {/* R5: không còn dòng "Cỡ có sẵn" thừa — các pill cỡ đã liệt kê đủ. */}

              <div className="cat-buy-row">
                <div className="cat-stepper" aria-label="Số lượng">
                  <button type="button" aria-label="Giảm số lượng" disabled={cappedQty <= 1} onClick={() => { setStockAlert(""); setQuantity((q) => Math.max(1, Math.min(q, cappedQty) - 1)); }}>−</button>
                  <span aria-live="polite"><span key={cappedQty} className="qty-tick">{cappedQty}</span></span>
                  <button type="button" aria-label="Tăng số lượng" disabled={cappedQty >= MAX_LINE_QTY || (remaining !== null && cappedQty >= Math.max(remaining, 0))} title={cartFull ? "Bạn đã thêm hết số lượng còn lại vào giỏ" : undefined} onClick={() => { setStockAlert(""); setQuantity(Math.min(MAX_LINE_QTY, cappedQty + 1)); }}>+</button>
                </div>
                <button className="cat-button cat-primary" type="button" disabled={!selected || addBusy || soldOut || cartFull} aria-describedby={stockAlert ? "cat-stock-alert" : undefined} onClick={addToCart}>
                  {addBusy ? "Đang thêm…" : soldOut ? "Hết hàng" : cartFull ? "Đã có đủ trong giỏ" : "Thêm vào giỏ"}
                </button>
              </div>
              {stockAlert ? (
                <p id="cat-stock-alert" className="cat-stock-alert" role="alert">
                  {stockAlert} <Link className="cat-text-button" href="/gio-hang">Xem giỏ hàng</Link>
                </p>
              ) : null}
              {needColor || needSize || (!selected && variants.length > 0 && !ambiguous) || ambiguous ? (
                <p className="cat-readonly-note" role="status" id="cat-buy-note">
                  {needColor ? `Chọn ${colorAxisLabel.toLowerCase()} để thêm vào giỏ.` : needSize ? `Chọn ${sizeAxisLabel.toLowerCase()} để thêm vào giỏ.` : "Phiên bản chưa xác định được — liên hệ cửa hàng để được tư vấn."}
                </p>
              ) : null}
              {addNotice ? <p className="cat-readonly-note" role="status">{addNotice}{addNotice.includes("Đăng nhập") ? <> <Link className="cat-text-button" href="/dang-nhap?next=%2Fgio-hang">Đăng nhập →</Link></> : null}</p> : null}
              {/* Warm stock note: small inline copy under the add-to-cart row,
                  always in DOM with min-height so success/error swaps cause no layout jump. */}
              <p className="cat-stock-note" role="status" aria-live="polite">{addError}</p>

              <div className="pdActions">
                <FavoriteHeart productId={product.id} label size={18} />
                <ShareButton title={product.name} price={formatVnd(price)} />
              </div>

              <div className="cat-disclosures">
                <details>
                  <summary>Thông tin sản phẩm</summary>
                  <dl className="cat-attr-list">
                    {product.categoryName ? (<div><dt>Danh mục</dt><dd>{product.categoryName}</dd></div>) : null}
                    {product.material ? (<div><dt>Chất liệu</dt><dd>{product.material}</dd></div>) : null}
                    {product.style ? (<div><dt>Kiểu dáng</dt><dd>{product.style}</dd></div>) : null}
                    {product.brandName ? (<div><dt>Thương hiệu</dt><dd>{product.brandName}</dd></div>) : null}
                    {!product.categoryName && !product.material && !product.style && !product.brandName && !product.description ? (
                      <div><dt>Thông tin</dt><dd>Chưa có thông tin bổ sung.</dd></div>
                    ) : null}
                  </dl>
                  {product.description ? (
                    <div className="cat-detail-desc">
                      {product.description.split(/\n\s*\n/).map((para) => para.trim()).filter(Boolean).map((para, i) => (
                        // Văn bản thuần từ feed, React escape mặc định — không innerHTML.
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  ) : null}
                  {product.sourceHost ? (
                    <p className="cat-source-inline">
                      Tham khảo: {product.sourceUrl ? (<a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">{product.sourceHost}</a>) : product.sourceHost}
                    </p>
                  ) : null}
                </details>
                <details>
                  <summary>Giao hàng &amp; đổi trả</summary>
                  <div className="cat-tech-body">Liên hệ cửa hàng để biết chính sách giao hàng và đổi trả hiện hành.</div>
                </details>
              </div>
            </section>
          </div>
          <ReviewsSection productId={product.id} productName={product.name} />
          <RelatedRail productId={product.id} />
          <RecentlyViewedRail currentId={product.id} />
          </>
        ) : null}
        <ImageDialog
          viewer={viewer}
          motionOK={motionOK}
          fromRect={fromRect}
          onIndex={(next) => {
            setImgIdx(next);
            setViewer((v) => (v ? { ...v, index: next } : v));
          }}
          onClose={closeZoom}
        />
      </div>
    </div>
  );
}
