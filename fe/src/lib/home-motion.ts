"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tuỳ chọn chuyển động của Home.
 *
 * - Mặc định bám theo thiết bị (`prefers-reduced-motion`).
 * - Người dùng có thể tắt hẳn bằng nút trong demo; lựa chọn chỉ nằm ở
 *   localStorage (`fa-motion`), không liên quan tài khoản/auth.
 * - Mọi hiệu ứng đều dừng khi tắt hoặc khi thiết bị yêu cầu giảm chuyển động;
 *   không có timer bù (catch-up) sau khi tab bị ẩn.
 * - Dùng chung toàn site: mọi nơi gọi `useHomeMotion()` (header, Home, marquee…)
 *   cùng đọc một store, nên đổi "Chuyển động" ở menu giao diện có hiệu lực ngay,
 *   không cần tải lại. Thuộc tính `html[data-motion="off"]` (đặt trước lần vẽ đầu
 *   bởi `motionBootScript`) để CSS dừng transition/animation toàn trang.
 */

export type MotionPreference = "auto" | "off";

export const MOTION_STORAGE_KEY = "fa-motion";
export const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function normalizeMotionPreference(value: unknown): MotionPreference {
  return value === "off" ? "off" : "auto";
}

export function readMotionPreference(storage?: Pick<Storage, "getItem"> | null): MotionPreference {
  try {
    return normalizeMotionPreference(storage?.getItem(MOTION_STORAGE_KEY));
  } catch {
    return "auto";
  }
}

export function writeMotionPreference(value: MotionPreference, storage?: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(MOTION_STORAGE_KEY, value);
  } catch {
    // localStorage bị chặn: giữ mặc định, không làm hỏng trang.
  }
}

/** Chỉ phụ thuộc hai đầu vào thuần để test được. */
export function isMotionEnabled(preference: MotionPreference, prefersReduced: boolean): boolean {
  return preference === "auto" && !prefersReduced;
}

export const MOTION_EVENT = "fa-motion-change";

function applyMotionAttribute(value: MotionPreference): void {
  if (typeof document === "undefined") return;
  if (value === "off") document.documentElement.setAttribute("data-motion", "off");
  else document.documentElement.removeAttribute("data-motion");
}

function subscribePreference(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MOTION_STORAGE_KEY) {
      applyMotionAttribute(readMotionPreference(window.localStorage));
      onChange();
    }
  };
  window.addEventListener(MOTION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MOTION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeReduced(onChange: () => void): () => void {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useHomeMotion(): {
  enabled: boolean;
  prefersReduced: boolean;
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
} {
  // Snapshot server = mặc định ("auto", không reduce) → hydration khớp; sau mount
  // client đọc giá trị thật mà không cần effect + setState.
  const preference = useSyncExternalStore<MotionPreference>(
    subscribePreference,
    () => readMotionPreference(window.localStorage),
    () => "auto",
  );
  const prefersReduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );

  const setPreference = useCallback((next: MotionPreference) => {
    writeMotionPreference(next, window.localStorage);
    applyMotionAttribute(next);
    window.dispatchEvent(new Event(MOTION_EVENT));
  }, []);

  return { enabled: isMotionEnabled(preference, prefersReduced), prefersReduced, preference, setPreference };
}
