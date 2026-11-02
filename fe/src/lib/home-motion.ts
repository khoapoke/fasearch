"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tuỳ chọn chuyển động của Home.
 *
 * - Mặc định bám theo thiết bị (`prefers-reduced-motion`).
 * - Người dùng có thể tắt hẳn bằng nút trong demo; lựa chọn chỉ nằm ở
 *   localStorage (`fa-motion`), không liên quan tài khoản/auth.
 * - Mọi hiệu ứng đều dừng khi tắt hoặc khi thiết bị yêu cầu giảm chuyển động;
 *   không có timer bù (catch-up) sau khi tab bị ẩn.
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

export function useHomeMotion(): {
  enabled: boolean;
  prefersReduced: boolean;
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
} {
  const [preference, setPreferenceState] = useState<MotionPreference>("auto");
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOTION_QUERY);
    const apply = () => {
      setPreferenceState(readMotionPreference(window.localStorage));
      setPrefersReduced(media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const setPreference = useCallback((next: MotionPreference) => {
    writeMotionPreference(next, window.localStorage);
    setPreferenceState(next);
  }, []);

  return { enabled: isMotionEnabled(preference, prefersReduced), prefersReduced, preference, setPreference };
}
