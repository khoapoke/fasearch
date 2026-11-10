"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  FIT_LABEL,
  ReviewError,
  deleteReview,
  fetchMyReviewState,
  fetchReviewSummary,
  fetchReviews,
  notifyReviewsChanged,
  submitReview,
  type ReviewEligibility,
  type ReviewItem,
  type ReviewSummary,
  type SizeFit,
} from "@/lib/review-client";
import { Stars } from "./stars";

const PAGE_SIZE = 5;
const SORTS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "Mới nhất" },
  { value: "rating_desc", label: "Sao cao nhất" },
  { value: "rating_asc", label: "Sao thấp nhất" },
];
const FITS: SizeFit[] = ["NHO", "VUA", "RONG"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function RatingInput({ value, onChange, labelledBy }: { value: number; onChange: (n: number) => void; labelledBy: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const LABELS = ["", "Rất tệ", "Chưa tốt", "Bình thường", "Tốt", "Tuyệt vời"];
  return (
    <div className="pdStarInput" role="radiogroup" aria-labelledby={labelledBy} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao`}
          className={"pdStarBtn" + (n <= shown ? " is-on" : "")}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); }
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); }
          }}
        >
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><path d="M12 2.8l2.78 5.9 6.42.8-4.72 4.45 1.22 6.4L12 17.2l-5.7 3.15 1.22-6.4L2.8 9.5l6.42-.8L12 2.8Z" /></svg>
        </button>
      ))}
      <span className="pdStarWord" aria-live="polite">{LABELS[shown] ?? ""}</span>
    </div>
  );
}

function ReviewForm({
  productId,
  initial,
  onSaved,
  onCancel,
}: {
  productId: number;
  initial: ReviewItem | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [fit, setFit] = useState<SizeFit | null>(initial?.sizeFit ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (rating < 1) { setError("Vui lòng chọn số sao trước khi gửi."); return; }
    setBusy(true);
    setError("");
    try {
      await submitReview(productId, { rating, title: title.trim(), body: body.trim(), sizeFit: fit }, Boolean(initial));
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không gửi được đánh giá. Thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pdForm" onSubmit={submit} noValidate>
      <h3>{initial ? "Chỉnh sửa đánh giá của bạn" : "Viết đánh giá"}</h3>
      <div className="pdField">
        <span id={`${uid}-r`} className="pdLabel">Bạn chấm sản phẩm mấy sao?</span>
        <RatingInput value={rating} onChange={setRating} labelledBy={`${uid}-r`} />
      </div>
      <div className="pdField">
        <span className="pdLabel" id={`${uid}-f`}>Kích cỡ có vừa không? <em>(không bắt buộc)</em></span>
        <div className="pdChips" role="group" aria-labelledby={`${uid}-f`}>
          {FITS.map((value) => (
            <button key={value} type="button" className="pdChip" aria-pressed={fit === value} onClick={() => setFit(fit === value ? null : value)}>
              {FIT_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="pdField">
        <label className="pdLabel" htmlFor={`${uid}-t`}>Tiêu đề <em>(không bắt buộc)</em></label>
        <input id={`${uid}-t`} className="pdInput" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Vải mát, form đẹp" autoComplete="off" />
      </div>
      <div className="pdField">
        <label className="pdLabel" htmlFor={`${uid}-b`}>Nhận xét của bạn <em>(không bắt buộc)</em></label>
        <textarea id={`${uid}-b`} className="pdInput pdTextarea" maxLength={2000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Chất vải, đường may, cảm giác khi mặc…" />
        <span className="pdCount" aria-hidden="true">{body.length}/2000</span>
      </div>
      {error ? <p className="pdFormError" role="alert">{error}</p> : null}
      <div className="pdFormActions">
        <button className="cat-button cat-primary" type="submit" disabled={busy}>{busy ? "Đang gửi…" : initial ? "Lưu thay đổi" : "Gửi đánh giá"}</button>
        {onCancel ? <button className="cat-button" type="button" onClick={onCancel} disabled={busy}>Hủy</button> : null}
      </div>
    </form>
  );
}

function ReviewCard({ review, mine, onEdit, onDelete }: { review: ReviewItem; mine?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <li className="pdReview">
      <div className="pdReviewTop">
        <Stars value={review.rating} size={15} label={`${review.rating} trên 5 sao`} />
        {review.title ? <strong className="pdReviewTitle">{review.title}</strong> : null}
      </div>
      {review.body ? <p className="pdReviewBody">{review.body}</p> : null}
      <p className="pdReviewMeta">
        <span>{mine ? "Bạn" : review.authorName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
        {review.verifiedPurchase ? <span className="pdVerified">Đã mua hàng</span> : null}
        {review.sizeFit ? <span className="pdFitPill">Size: {FIT_LABEL[review.sizeFit]}</span> : null}
        {mine && review.hidden ? <span className="pdHidden">Đang bị ẩn</span> : null}
      </p>
      {mine ? (
        <p className="pdReviewActions">
          <button type="button" className="cat-text-button" onClick={onEdit}>Sửa</button>
          <button type="button" className="cat-text-button" onClick={onDelete}>Xóa</button>
        </p>
      ) : null}
    </li>
  );
}

export function ReviewsSection({ productId }: { productId: number; productName?: string }) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [filter, setFilter] = useState<number | null>(null);
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [total, setTotal] = useState(0);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  const [me, setMe] = useState<ReviewEligibility | null | undefined>(undefined); // undefined = đang tải, null = chưa đăng nhập
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reqRef = useRef(0);

  const loadSummary = useCallback(() => {
    fetchReviewSummary(productId)
      .then((value) => { setSummary(value); setSummaryError(""); })
      .catch((error: unknown) => setSummaryError(error instanceof Error ? error.message : "Không tải được đánh giá."));
  }, [productId]);

  const loadMe = useCallback(() => {
    fetchMyReviewState(productId).then(setMe).catch(() => setMe(null));
  }, [productId]);

  const loadFirstPage = useCallback((rating: number | null, order: string) => {
    const my = ++reqRef.current;
    fetchReviews(productId, { rating, sort: order, page: 0, size: PAGE_SIZE })
      .then((result) => {
        if (reqRef.current !== my) return;
        setItems(result.content);
        setPage(result.pageNumber);
        setLast(result.last);
        setTotal(result.totalElements);
        setListState("ready");
      })
      .catch(() => { if (reqRef.current === my) setListState("error"); });
  }, [productId]);

  useEffect(() => { loadSummary(); loadMe(); }, [loadSummary, loadMe]);
  useEffect(() => { loadFirstPage(filter, sort); }, [filter, sort, loadFirstPage]);

  const pickFilter = (value: number | null) => { setFilter(value); setListState("loading"); };
  const pickSort = (value: string) => { setSort(value); setListState("loading"); };
  const retryList = () => { setListState("loading"); loadFirstPage(filter, sort); };

  async function loadMore() {
    if (more || last) return;
    setMore(true);
    try {
      const result = await fetchReviews(productId, { rating: filter, sort, page: page + 1, size: PAGE_SIZE });
      setItems((current) => {
        const known = new Set(current.map((r) => r.id));
        return [...current, ...result.content.filter((r) => !known.has(r.id))];
      });
      setPage(result.pageNumber);
      setLast(result.last);
    } catch {
      setListState("error");
    } finally {
      setMore(false);
    }
  }

  function afterChange(message: string) {
    setEditing(false);
    setConfirmDelete(false);
    setNotice(message);
    loadSummary();
    loadMe();
    loadFirstPage(filter, sort);
    notifyReviewsChanged(productId);
  }

  async function remove() {
    try {
      await deleteReview(productId);
      afterChange("Đã xóa đánh giá của bạn.");
    } catch (failure) {
      setNotice(failure instanceof ReviewError ? failure.message : "Không xóa được đánh giá. Thử lại.");
      setConfirmDelete(false);
    }
  }

  const count = summary?.count ?? 0;
  const maxBar = Math.max(1, ...Object.values(summary?.distribution ?? {}));
  const fitTotal = summary?.fitCount ?? 0;
  const fitPct = (key: SizeFit) => (fitTotal ? Math.round(((summary?.fit[key] ?? 0) / fitTotal) * 100) : 0);
  const fitVerdictText = summary?.fitVerdict
    ? summary.fitVerdict === "VUA" ? "Đa số khách thấy vừa" : summary.fitVerdict === "NHO" ? "Hơi nhỏ, cân nhắc lên 1 size" : "Hơi rộng, cân nhắc xuống 1 size"
    : null;
  const mine = me?.myReview ?? null;

  return (
    <section className="pdReviews" id="danh-gia" aria-labelledby="pd-reviews-title" tabIndex={-1}>
      <div className="pdSectionHead">
        <h2 id="pd-reviews-title">Đánh giá sản phẩm</h2>
      </div>

      {summaryError ? <p className="cat-status cat-error" role="alert">{summaryError}</p> : null}

      <div className="pdReviewGrid">
        <div className="pdSummaryCard" aria-label="Tổng quan đánh giá">
          <div className="pdBig">
            <span className="pdBigNum">{count ? summary!.average.toFixed(1) : "–"}</span>
            <div>
              <Stars value={count ? summary!.average : 0} size={20} />
              <p className="pdBigCount">{count ? `${count.toLocaleString("vi-VN")} đánh giá` : "Chưa có đánh giá"}</p>
            </div>
          </div>
          <ul className="pdBars" aria-label="Phân bố số sao">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary?.distribution[String(star)] ?? 0;
              return (
                <li key={star}>
                  <button type="button" className="pdBarRow" aria-pressed={filter === star} disabled={n === 0} onClick={() => pickFilter(filter === star ? null : star)} aria-label={`${star} sao: ${n} đánh giá${filter === star ? ", đang lọc" : ""}`}>
                    <span className="pdBarStar">{star} <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 2.8l2.78 5.9 6.42.8-4.72 4.45 1.22 6.4L12 17.2l-5.7 3.15 1.22-6.4L2.8 9.5l6.42-.8L12 2.8Z" /></svg></span>
                    <span className="pdBarTrack"><span className="pdBarFill" style={{ width: `${(n / maxBar) * 100}%` }} /></span>
                    <span className="pdBarNum">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {fitTotal >= 5 && fitVerdictText ? <div className="pdFit" aria-label="Cảm nhận về kích cỡ">
            <p className="pdFitTitle">Kích cỡ</p>
            <div className="pdFitMeter" role="img" aria-label={`Hơi nhỏ ${fitPct("NHO")}%, vừa vặn ${fitPct("VUA")}%, hơi rộng ${fitPct("RONG")}%`}>
              {fitTotal ? FITS.filter((key) => (summary?.fit[key] ?? 0) > 0).map((key) => <span key={key} className={`pdFitSeg pdFit-${key}`} style={{ flexGrow: summary?.fit[key] ?? 0 }} />) : <span className="pdFitSeg pdFit-empty" />}
            </div>
            <div className="pdFitLegend" aria-hidden="true">
              {FITS.map((key) => <span key={key}>{FIT_LABEL[key]}: {summary?.fit[key] ?? 0}</span>)}
            </div>
            <p className="pdFitVerdict">{fitVerdictText}</p>
          </div> : null}
        </div>

        <div className="pdReviewMain">
          {notice ? <p className="cat-readonly-note flash-in" role="status" data-fresh>{notice}</p> : null}

          {me === undefined ? null : me === null ? (
            <p className="pdGate">
              <Link className="cat-text-button" href={`/dang-nhap?next=${encodeURIComponent(`/san-pham/${productId}#danh-gia`)}`}>Đăng nhập</Link> để viết đánh giá.
            </p>
          ) : me.alreadyReviewed && mine ? (
            editing ? (
              <ReviewForm productId={productId} initial={mine} onSaved={() => afterChange("Đã cập nhật đánh giá của bạn.")} onCancel={() => setEditing(false)} />
            ) : (
              <div className="pdMine">
                <p className="pdMineHead">Bạn đã đánh giá sản phẩm này.</p>
                <ul className="pdReviewList">
                  <ReviewCard review={mine} mine onEdit={() => { setEditing(true); setNotice(""); }} onDelete={() => setConfirmDelete(true)} />
                </ul>
                {confirmDelete ? (
                  <p className="pdConfirm" role="alertdialog" aria-label="Xác nhận xóa đánh giá">
                    Xóa đánh giá này?
                    <button type="button" className="cat-button" onClick={remove}>Xóa đánh giá</button>
                    <button type="button" className="cat-text-button" onClick={() => setConfirmDelete(false)}>Giữ lại</button>
                  </p>
                ) : null}
              </div>
            )
          ) : me.canReview ? (
            <ReviewForm productId={productId} initial={null} onSaved={() => afterChange("Cảm ơn bạn! Đánh giá của bạn đã được đăng.")} />
          ) : me.reason === "NOT_PURCHASED" ? (
            <p className="pdGate">Bạn có thể đánh giá sản phẩm sau khi đơn hàng được giao thành công.</p>
          ) : null}

          <div className="pdToolbar">
            <div className="pdChips" role="group" aria-label="Lọc theo số sao">
              <button type="button" className="pdChip" aria-pressed={filter === null} onClick={() => pickFilter(null)}>Tất cả{count ? ` (${count})` : ""}</button>
              {[5, 4, 3, 2, 1].map((star) => {
                const n = summary?.distribution[String(star)] ?? 0;
                return (
                  <button key={star} type="button" className="pdChip" aria-pressed={filter === star} disabled={n === 0 && filter !== star} onClick={() => pickFilter(filter === star ? null : star)}>
                    {star} sao{n ? ` (${n})` : ""}
                  </button>
                );
              })}
            </div>
            <label className="pdSort">
              <span>Sắp xếp</span>
              <select value={sort} onChange={(e) => pickSort(e.target.value)}>
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {listState === "loading" ? (
            <ul className="pdReviewList" aria-busy="true" aria-label="Đang tải đánh giá">
              {[0, 1, 2].map((i) => <li key={i} className="pdReview pdSkeleton" aria-hidden="true"><span /><span /><span /></li>)}
            </ul>
          ) : listState === "error" ? (
            <div className="cat-status cat-error" role="alert">
              Không tải được đánh giá.{" "}
              <button type="button" className="cat-text-button" onClick={retryList}>Thử lại</button>
            </div>
          ) : items.length === 0 ? (
            <div className="pdEmpty">
              <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" focusable="false"><path d="M24 6l5.4 11.5 12.6 1.6-9.3 8.7 2.4 12.5L24 34l-11.1 6.3 2.4-12.5L6 19.1l12.6-1.6L24 6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
              <p className="pdEmptyTitle">{filter ? `Chưa có đánh giá ${filter} sao` : "Chưa có đánh giá nào"}</p>
              <p className="pdEmptyText">{filter ? "Thử bỏ bộ lọc để xem các đánh giá khác." : "Hãy là người đầu tiên chia sẻ cảm nhận sau khi nhận hàng."}</p>
              {filter ? <button type="button" className="cat-text-button" onClick={() => pickFilter(null)}>Xem tất cả đánh giá</button> : null}
            </div>
          ) : (
            <>
              <p className="pdListCount" role="status">Hiển thị {items.length}/{total} đánh giá{filter ? ` ${filter} sao` : ""}</p>
              <ul className="pdReviewList">
                {items.map((review) => <ReviewCard key={review.id} review={review} />)}
              </ul>
              {!last ? (
                <button type="button" className="cat-button pdMore" onClick={loadMore} disabled={more}>{more ? "Đang tải…" : "Xem thêm đánh giá"}</button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
