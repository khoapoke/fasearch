"use client";

import { useMemo, useSyncExternalStore } from "react";
import { ProductCard } from "@/components/storefront/product-card";
import { RECENT_EVENT, RECENT_KEY, clearRecent, readRecent } from "@/lib/recently-viewed";

function subscribe(onChange: () => void) {
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(RECENT_EVENT, onChange); window.removeEventListener("storage", onChange); };
}

function snapshot(): string {
  try { return window.localStorage.getItem(RECENT_KEY) ?? ""; } catch { return ""; }
}

/** Rail "Sản phẩm đã xem gần đây": dữ liệu từ localStorage, không cần đăng nhập, loại trừ sản phẩm đang xem. */
export function RecentlyViewedRail({ currentId }: { currentId: number }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const items = useMemo(
    () => readRecent({ getItem: () => raw || null, setItem: () => undefined }).filter((item) => item.id !== currentId),
    [raw, currentId],
  );

  if (items.length === 0) return null;
  return (
    <section className="pdRecent" aria-labelledby="pd-recent-title">
      <div className="pdSectionHead">
        <h2 id="pd-recent-title">Sản phẩm đã xem gần đây</h2>
        <button className="cat-text-button" type="button" onClick={() => clearRecent()}>
          Xóa lịch sử xem
        </button>
      </div>
      <ul className="pdRail" tabIndex={0} aria-label="Danh sách sản phẩm đã xem, cuộn ngang">
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={{ id: item.id, name: item.name, price: item.price, image: item.image, href: item.href }} />
          </li>
        ))}
      </ul>
    </section>
  );
}
