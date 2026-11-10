// Sao đánh giá: 5 sao nền + lớp sao vàng cắt theo tỉ lệ (hỗ trợ 4.3 sao).
const STAR = "M12 2.8l2.78 5.9 6.42.8-4.72 4.45 1.22 6.4L12 17.2l-5.7 3.15 1.22-6.4L2.8 9.5l6.42-.8L12 2.8Z";

function Row({ size }: { size: number }) {
  return (
    <span className="pdStarRow" style={{ ["--s" as string]: `${size}px` }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"><path d={STAR} /></svg>
      ))}
    </span>
  );
}

export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(5, value)) / 5 * 100;
  return (
    <span className="pdStars" role="img" aria-label={label ?? `${value.toFixed(1)} trên 5 sao`}>
      <span className="pdStarsBase"><Row size={size} /></span>
      <span className="pdStarsFill" style={{ width: `${pct}%` }}><Row size={size} /></span>
    </span>
  );
}
