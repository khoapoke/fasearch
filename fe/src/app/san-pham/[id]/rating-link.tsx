"use client";

import { useEffect, useState } from "react";
import { REVIEWS_CHANGED_EVENT, fetchReviewSummary, type ReviewSummary } from "@/lib/review-client";
import { Stars } from "./stars";

/** Dòng sao + số đánh giá ngay dưới tên sản phẩm; bấm cuộn tới #danh-gia. */
export function RatingLink({ productId }: { productId: number }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = () => {
      fetchReviewSummary(productId, controller.signal)
        .then((value) => { setSummary(value); setFailed(false); })
        .catch((error) => { if (!(error instanceof DOMException)) setFailed(true); });
    };
    load();
    const onChange = (event: Event) => {
      if ((event as CustomEvent<{ productId: number }>).detail?.productId === productId) load();
    };
    window.addEventListener(REVIEWS_CHANGED_EVENT, onChange);
    return () => { controller.abort(); window.removeEventListener(REVIEWS_CHANGED_EVENT, onChange); };
  }, [productId]);

  if (failed || !summary) return <p className="pdRatingLine pdRatingPending" aria-hidden="true">&nbsp;</p>;
  const jump = (event: React.MouseEvent) => {
    event.preventDefault();
    const el = document.getElementById("danh-gia");
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", "#danh-gia");
  };
  return summary.count === 0 ? (
    <p className="pdRatingLine">
      <a className="pdRatingAnchor" href="#danh-gia" onClick={jump}>
        <Stars value={0} size={16} label="Chưa có đánh giá" />
        <span className="pdRatingText">Chưa có đánh giá</span>
      </a>
    </p>
  ) : (
    <p className="pdRatingLine">
      <a className="pdRatingAnchor" href="#danh-gia" onClick={jump}>
        <Stars value={summary.average} size={16} />
        <strong>{summary.average.toFixed(1)}</strong>
        <span className="pdRatingText">({summary.count.toLocaleString("vi-VN")} đánh giá)</span>
      </a>
    </p>
  );
}
