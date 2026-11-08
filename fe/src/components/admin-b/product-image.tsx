"use client";
import { useState } from "react";
import { toCatalogImageUrl } from "@/lib/admin-catalog-client";
import { Icon } from "./icons";

export function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  // BE trả path /api/v1/products/images/...; FE chỉ phục vụ ảnh qua BFF catalog.
  const resolved = toCatalogImageUrl(src);
  if (!resolved || failed) return <span className="catalog-thumb-fail" role="img" aria-label={`Chưa có ảnh: ${alt}`}><Icon name="package" /></span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL field from BE; no upload proxy
    <img className="catalog-thumb" src={resolved} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}
