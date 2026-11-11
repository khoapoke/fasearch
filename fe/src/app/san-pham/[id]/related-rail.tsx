"use client";

import { useEffect, useState } from "react";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";

type RelatedApi = { id: number; productName: string; price: number; imageUrl?: string | null };

/** "Có thể bạn cũng thích": tối đa 8 sản phẩm cùng danh mục/thương hiệu, chỉ hàng còn bán (BE lọc). Lỗi/rỗng ⇒ ẩn. */
export function RelatedRail({ productId }: { productId: number }) {
  const [state, setState] = useState<{ id: number; items: CardProduct[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalog/products/${productId}/related?limit=8`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { success?: boolean; result?: RelatedApi[] } | null) => {
        if (!payload?.success || !Array.isArray(payload.result)) return;
        setState({
          id: productId,
          items: payload.result
            .filter((p) => p.id !== productId && typeof p.price === "number")
            .map((p) => ({ id: p.id, name: p.productName, price: p.price, image: p.imageUrl ?? undefined, href: `/san-pham/${p.id}` })),
        });
      })
      .catch(() => { /* rail là phần phụ: lỗi thì ẩn, không chặn trang */ });
    return () => controller.abort();
  }, [productId]);

  if (!state || state.id !== productId || state.items.length === 0) return null;
  return (
    <section className="pdRelated" aria-labelledby="pd-related-title">
      <div className="pdSectionHead">
        <h2 id="pd-related-title">Có thể bạn cũng thích</h2>
      </div>
      <ul className="pdRail" tabIndex={0} aria-label="Sản phẩm liên quan, cuộn ngang">
        {state.items.map((item) => (
          <li key={item.id}><ProductCard product={item} /></li>
        ))}
      </ul>
    </section>
  );
}
