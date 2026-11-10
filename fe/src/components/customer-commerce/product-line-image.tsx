"use client";

import { useState, type CSSProperties } from "react";

export function ProductLineImage({ src, className, style, alt = "" }: { src: string | null | undefined; className?: string; style?: CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <span className={className} style={style} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- product image comes from the catalog
    <img className={className} style={style} src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
  );
}
