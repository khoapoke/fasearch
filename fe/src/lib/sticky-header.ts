"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Thanh điều hướng dính, thu gọn theo hướng cuộn (NAV2).
 *
 * - Xuống quá ~96px → thu gọn; lên ≥24px → mở lại; vùng đầu trang <32px luôn mở.
 * - Dùng bộ tích luỹ hướng + ngưỡng trễ, không phản ứng từng pixel và không
 *   re-render mỗi lần cuộn: chỉ đổi state khi vượt ngưỡng.
 * - `freeze` (menu đang mở hoặc tiêu điểm bàn phím trong header) chặn mở rộng,
 *   nhưng không đóng menu hay di chuyển tiêu điểm.
 * - Tắt/giảm chuyển động: giữ thanh dính ở trạng thái mở, không di chuyển.
 * - Header có chiều cao cố định; chỉ phần bên trong đổi padding nên không có
 *   layout shift cho nội dung phía dưới.
 */

export const STICKY_DOWN_THRESHOLD = 96;
export const STICKY_UP_THRESHOLD = 24;
export const STICKY_TOP_RESET = 32;

export type StickyState = { compact: boolean };

export function nextStickyState(
  current: StickyState,
  input: { y: number; delta: number; upTravel: number; frozen: boolean },
): { compact: boolean; upTravel: number } {
  const { y, delta, upTravel, frozen } = input;
  if (y < STICKY_TOP_RESET) return { compact: false, upTravel: 0 };
  if (delta > 0) {
    return { compact: y > STICKY_DOWN_THRESHOLD ? true : current.compact, upTravel: 0 };
  }
  if (delta < 0) {
    const travel = upTravel + Math.abs(delta);
    if (!frozen && travel >= STICKY_UP_THRESHOLD) return { compact: false, upTravel: 0 };
    return { compact: current.compact, upTravel: travel };
  }
  return { compact: current.compact, upTravel };
}

export function useStickyHeader(options: { frozen: boolean; enabled: boolean }) {
  const { frozen, enabled } = options;
  const [compact, setCompact] = useState(false);
  const state = useRef({ compact: false, upTravel: 0, lastY: 0 });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      state.current = { compact: false, upTravel: 0, lastY: window.scrollY };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: state sync/reset or one-shot mount read inside an effect; refactor would change behaviour
      setCompact(false);
      return;
    }
    state.current.lastY = window.scrollY;

    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const y = window.scrollY;
        const prev = state.current;
        const delta = y - prev.lastY;
        const next = nextStickyState(
          { compact: prev.compact },
          { y, delta, upTravel: prev.upTravel, frozen },
        );
        state.current = { compact: next.compact, upTravel: next.upTravel, lastY: y };
        setCompact((value) => (value === next.compact ? value : next.compact));
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [enabled, frozen]);

  return compact;
}
