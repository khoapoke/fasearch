"use client";
import { useState } from "react";
export function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="catalog-thumb-fail" role="img" aria-label={`Không tải được ảnh: ${alt}`}>Ảnh lỗi</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL field from BE; no upload proxy
    <img className="catalog-thumb" src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}
