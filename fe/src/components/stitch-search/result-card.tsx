import type { FashionCategory, SearchProduct } from "@/lib/search-contract";
import styles from "./result-card.module.css";

const categoryNames: Record<FashionCategory, string> = {
  TOP: "Áo",
  BOTTOM: "Quần / váy rời",
  ONE_PIECE: "Trang phục liền",
};

export function categoryLabel(category: FashionCategory): string {
  return categoryNames[category];
}

// Live card: only actual API response fields (image, title, category, rank,
// raw similarity). No prices, ratings, sizes or sale badges — the image-search
// contract does not provide them.
export function ResultCard({ product }: { product: SearchProduct }) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={product.image_url}
          alt={product.title}
          loading="lazy"
        />
        <span className={styles.rank} title={`Hạng ${product.rank}`}>
          {product.rank}
        </span>
      </div>
      <div className={styles.info}>
        <span className={styles.category}>{categoryNames[product.category]}</span>
        <h3 className={styles.title}>{product.title}</h3>
        <div className={styles.scoreRow}>
          <span>Mức tương đồng</span>
          <strong>{(product.similarity_score * 100).toFixed(1)}%</strong>
        </div>
      </div>
    </article>
  );
}
