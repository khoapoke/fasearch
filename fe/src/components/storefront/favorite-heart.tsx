"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { FAVORITE_EVENT, isFavoriteAuthed, loadFavoriteIds, toggleFavoriteServer, type FavoriteChange } from "@/lib/favorites-store";
import "./favorite-heart.css";

const PARTICLES = 8;

/**
 * Một trái tim yêu thích dùng chung cho thẻ sản phẩm và trang chi tiết.
 * - Optimistic: đổi trạng thái ngay, hoàn tác + báo lỗi nếu máy chủ từ chối.
 * - Chuyển động: spring (scale vọt rồi lắng), vòng sóng + tia nhỏ khi thích; bỏ khi giảm chuyển động / Chuyển động: Tắt (CSS).
 * - Đồng bộ giữa các trái tim cùng sản phẩm trên trang qua sự kiện FAVORITE_EVENT.
 */
export function FavoriteHeart({
  productId,
  productName,
  className = "",
  size = 17,
  label = false,
  reach,
}: {
  productId: number;
  /** Tên sản phẩm cho nhãn đọc màn hình (thẻ danh sách). */
  productName?: string;
  className?: string;
  size?: number;
  /** true: hiện chữ "Yêu thích" cạnh icon (trang chi tiết). */
  label?: boolean;
  /** Tia bay xa bao nhiêu px (mặc định theo CSS). */
  reach?: number;
}) {
  const [loved, setLoved] = useState<boolean | null>(null);
  const [burst, setBurst] = useState(0);
  const [drop, setDrop] = useState(0);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    loadFavoriteIds()
      .then((ids) => { if (active) setLoved(ids.has(productId)); })
      .catch(() => { if (active) setLoved(false); });
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<FavoriteChange>).detail;
      if (detail && detail.id === productId) setLoved(detail.loved);
    };
    window.addEventListener(FAVORITE_EVENT, onChange);
    return () => { active = false; window.removeEventListener(FAVORITE_EVENT, onChange); };
  }, [productId]);

  const isLoved = loved ?? false;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 3500);
    return () => clearTimeout(timer);
  }, [error]);

  async function onClick() {
    if (busy.current || loved === null) return;
    if (!isFavoriteAuthed()) {
      router.push("/dang-nhap?next=" + encodeURIComponent(window.location.pathname + window.location.search));
      return;
    }
    busy.current = true;
    setError("");
    const previous = isLoved;
    const next = !previous;
    setLoved(next);
    if (next) setBurst((n) => n + 1);
    else setDrop((n) => n + 1);
    try {
      await toggleFavoriteServer(productId);
    } catch (failure) {
      setLoved(previous);
      if (failure instanceof Error && failure.message === "AUTH_REQUIRED") {
        router.push("/dang-nhap?next=" + encodeURIComponent(window.location.pathname + window.location.search));
      } else {
        setError("Chưa lưu được yêu thích. Thử lại.");
      }
    } finally {
      busy.current = false;
    }
  }

  const verb = isLoved ? "Bỏ yêu thích" : "Thêm vào yêu thích";
  const name = productName ? `${verb}: ${productName}` : verb;
  return (
    <button
      className={`favHeart ${label ? "favHeartLabel " : ""}${className}`.trim()}
      type="button"
      aria-pressed={isLoved}
      aria-label={name}
      aria-busy={loved === null}
      data-error={error ? "" : undefined}
      data-pop={burst > 0 && isLoved ? burst : undefined}
      data-drop={drop > 0 && !isLoved ? drop : undefined}
      style={reach ? ({ ["--fav-reach" as string]: `${reach}px` } as React.CSSProperties) : undefined}
      onClick={onClick}
    >
      <span className="favIcon">
        <Icon name="heart" size={size} filled={isLoved} />
        {isLoved && burst > 0 ? (
          <span key={burst} className="favBurst" aria-hidden="true">
            <span className="favRing" />
            {Array.from({ length: PARTICLES }, (_, i) => (
              <i key={i} style={{ ["--a" as string]: `${(360 / PARTICLES) * i}deg` } as React.CSSProperties} />
            ))}
          </span>
        ) : null}
      </span>
      {label ? <span className="favText">{isLoved ? "Đã yêu thích" : "Yêu thích"}</span> : null}
      <span className="favLive" role="status" aria-live="polite">{error}</span>
    </button>
  );
}
