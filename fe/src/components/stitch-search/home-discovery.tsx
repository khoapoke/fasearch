"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CatalogItem, CatalogPageResponse } from "@/lib/catalog-contract";
import { discoveryCardHrefs } from "@/lib/catalog-contract";
import { SaveButton } from "@/components/library/save-button";
import styles from "./home-discovery.module.css";

// Honest discovery strip: the first page of the live catalog, labelled as a
// sample — never ranked, never "bestsellers".
export function HomeDiscovery() {
  const [view, setView] = useState<{ item: CatalogItem; href: string }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    fetch("/api/catalog/products?page=1&size=8", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const payload = (await response.json()) as CatalogPageResponse;
        // One mapping from the SAME payload: cards + authoritative snapshot.
        // Empty snapshot or no items => no cards at all (never misleading).
        const cards = discoveryCardHrefs({ ...payload, items: payload.items.slice(0, 8) });
        if (cards.length === 0) {
          setFailed(true);
          return;
        }
        const byId = new Map(payload.items.map((item) => [item.product_id, item]));
        setView(
          cards.flatMap((card) => {
            const item = byId.get(card.product_id);
            return item ? [{ item, href: card.href }] : [];
          }),
        );
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!view) {
    return (
      <section className={styles.section} aria-label="Một số sản phẩm trong catalog">
        <div className={styles.head}>
          <h2>Một số sản phẩm trong catalog</h2>
        </div>
        <p className={styles.muted}>Đang tải sản phẩm…</p>
      </section>
    );
  }
  if (view.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Một số sản phẩm trong catalog">
      <div className={styles.head}>
        <div>
          <h2>Một số sản phẩm trong catalog</h2>
          <p className={styles.muted}>
            Vài sản phẩm đang được công bố — mở catalog để duyệt toàn bộ.
          </p>
        </div>
        <Link className={styles.more} href="/catalog">
          Duyệt catalog
        </Link>
      </div>
      <ol className={styles.grid}>
        {view.map(({ item, href }) => (
          <li key={`${item.product_id}:${item.product_version_id}`} className={styles.cell}>
            <Link
              className={styles.card}
              href={href}
              aria-label={`Xem chi tiết ${item.title}`}
            >
              <span className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.image} src={item.image_url} alt={item.title} />
              </span>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.meta}>{item.product_id}</span>
            </Link>
            <SaveButton productId={item.product_id} title={item.title} />
          </li>
        ))}
      </ol>
    </section>
  );
}
