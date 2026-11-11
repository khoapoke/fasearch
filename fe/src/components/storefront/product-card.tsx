"use client";

import Link from "next/link";
import { FavoriteHeart } from "./favorite-heart";
import { PriceTag } from "./price-tag";
import { StitchImage } from "@/components/ui/stitch-image";
import "./listing.css";

export type CardProduct = {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  image?: string;
  rating?: number;
  sold?: string;
  colors?: string[];
  moreColors?: number;
  badges?: Array<{ text: string; kind?: "off" | "tech" | "plain" }>;
  match?: number;
  href: string;
};

export function formatVnd(value: number): string {
  return value.toLocaleString("vi-VN") + "đ";
}

export function ProductCard({ product }: { product: CardProduct }) {
  return (
    <article className="pCard">
      <Link className="pCardMedia" href={product.href} aria-label={product.name}>
        <StitchImage src={product.image} alt={product.name} />
        {product.badges && product.badges.length > 0 ? (
          <span className="pCardBadges">
            {product.badges.map((b) => (
              <span
                key={b.text}
                className={
                  "pBadge" + (b.kind === "off" ? " pBadgeOff" : b.kind === "tech" ? " pBadgeTech" : "")
                }
              >
                {b.text}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
      <FavoriteHeart productId={product.id} className="pFav" />
      <div className="pCardBody">
        {product.colors && product.colors.length > 0 ? (
          <p className="pCardDots">
            {product.colors.map((c) => (
              <span key={c} className="pDot" style={{ background: c }} />
            ))}
            {product.moreColors ? <span>+{product.moreColors} màu</span> : null}
          </p>
        ) : null}
        <Link className="pCardName" href={product.href}>
          {product.name}
        </Link>
        <p className="pCardMeta">
          {typeof product.rating === "number" ? (
            <span className="pCardStars">★ {product.rating.toFixed(1)}</span>
          ) : null}
          {product.sold ? <span>Đã bán {product.sold}</span> : null}
        </p>
        <p className="pCardPrice">
          <span className="pPrice"><PriceTag value={product.price} /></span>
          {product.oldPrice ? <span className="pOld">{formatVnd(product.oldPrice)}</span> : null}
        </p>
        {typeof product.match === "number" ? (
          <span className="pMatch">AI Match {product.match}%</span>
        ) : null}
      </div>
    </article>
  );
}

