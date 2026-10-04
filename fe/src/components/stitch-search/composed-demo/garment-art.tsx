import type { DemoGarment } from "./composed-scenes";

// Minimal flat garment illustration for the composed hero demo. Decorative:
// every card keeps a text name/category so meaning never depends on the
// drawing, and no remote image is loaded.
export function GarmentArt({ garment }: { garment: DemoGarment }) {
  const { shape, cloth, clothDark } = garment;
  return (
    <svg
      viewBox="0 0 120 150"
      role="img"
      aria-label={`Minh họa: ${garment.name}`}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <rect x="0" y="0" width="120" height="150" fill="#f9fafb" />
      {shape === "shirt" && (
        <g>
          <rect x="38" y="30" width="44" height="62" rx="4" fill={cloth} />
          <rect x="18" y="34" width="22" height="30" rx="4" fill={clothDark} />
          <rect x="80" y="34" width="22" height="30" rx="4" fill={clothDark} />
          <rect x="52" y="30" width="16" height="10" rx="3" fill={clothDark} />
          <line x1="60" y1="42" x2="60" y2="92" stroke={clothDark} strokeWidth="2" />
        </g>
      )}
      {shape === "tee" && (
        <g>
          <rect x="34" y="36" width="52" height="56" rx="6" fill={cloth} />
          <rect x="14" y="40" width="24" height="26" rx="5" fill={clothDark} />
          <rect x="82" y="40" width="24" height="26" rx="5" fill={clothDark} />
          <ellipse cx="60" cy="38" rx="11" ry="5" fill={clothDark} />
        </g>
      )}
      {shape === "shorts" && (
        <g>
          <rect x="36" y="34" width="48" height="14" rx="3" fill={clothDark} />
          <rect x="36" y="48" width="22" height="52" rx="4" fill={cloth} />
          <rect x="62" y="48" width="22" height="52" rx="4" fill={cloth} />
        </g>
      )}
      {(shape === "dress" || shape === "maxi") && (
        <g>
          <rect x="48" y="26" width="24" height="26" rx="4" fill={cloth} />
          <line x1="50" y1="26" x2="50" y2="16" stroke={clothDark} strokeWidth="4" strokeLinecap="round" />
          <line x1="70" y1="26" x2="70" y2="16" stroke={clothDark} strokeWidth="4" strokeLinecap="round" />
          <path
            d={`M48 52 L${shape === "maxi" ? "30" : "38"} 118 L${shape === "maxi" ? "90" : "82"} 118 L72 52 Z`}
            fill={cloth}
            stroke={clothDark}
            strokeWidth="2"
          />
          <line x1="48" y1="52" x2="72" y2="52" stroke={clothDark} strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}
