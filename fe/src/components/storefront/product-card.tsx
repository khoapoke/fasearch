"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearFavoriteCache, isFavoriteCached, loadFavoriteIds, toggleFavoriteServer } from "@/lib/favorites-store";
import { Icon } from "@/components/ui/icon";
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
  const [loved, setLoved] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    loadFavoriteIds().then((ids) => { if (active) setLoved(ids.has(product.id)); }).catch(() => { if (active) setLoved(false); });
    return () => { active = false; };
  }, [product.id]);
  const isLoved = loved ?? false;
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
      <button
        className="pFav"
        type="button"
        aria-pressed={isLoved}
        aria-label={isLoved ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
        onClick={async () => {
          try {
            const next = await toggleFavoriteServer(product.id);
            setLoved(next);
          } catch {
            window.location.href = "/dang-nhap?next=" + encodeURIComponent(window.location.pathname);
          }
        }}
      >
        <Icon name="heart" size={17} filled={isLoved} />
      </button>
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
          <span className="pPrice">{formatVnd(product.price)}</span>
          {product.oldPrice ? <span className="pOld">{formatVnd(product.oldPrice)}</span> : null}
        </p>
        {typeof product.match === "number" ? (
          <span className="pMatch">AI Match {product.match}%</span>
        ) : null}
      </div>
    </article>
  );
}

