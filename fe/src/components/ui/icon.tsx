// Internal SVG icon set traced from the Stitch reference glyph language
// (outline, 2px stroke, round caps). No runtime icon-font dependency.
const PATHS: Record<string, React.ReactNode> = {
  search: <circle cx="11" cy="11" r="7" />,
  searchExtra: <path d="m20 20 3.5 3.5" />,
  heart: (
    <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9Z" />
  ),
  bag: <path d="M6 8h12l1 12.5H5L6 8Z" />,
  bagHandle: <path d="M9 10V6a3 3 0 0 1 6 0v4" />,
  user: <circle cx="12" cy="8" r="4" />,
  userBody: <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />,
  camera: (
    <path d="M4 8h3l2-2.5h6L17 8h3a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V9.5A1.5 1.5 0 0 1 4 8Z" />
  ),
  cameraLens: <circle cx="12" cy="13.5" r="3.5" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  grid: <rect x="4" y="4" width="7" height="7" rx="1.5" />,
  grid2: <rect x="13" y="4" width="7" height="7" rx="1.5" />,
  grid3: <rect x="4" y="13" width="7" height="7" rx="1.5" />,
  grid4: <rect x="13" y="13" width="7" height="7" rx="1.5" />,
  tag: <path d="M3.5 12V4.5A1 1 0 0 1 4.5 3.5H12L20.5 12a1 1 0 0 1 0 1.4l-6.1 6.1a1 1 0 0 1-1.4 0L3.5 12Z" />,
  tagDot: <circle cx="9" cy="9" r="1.4" />,
  box: <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />,
  boxLine: <path d="M4 7.5 12 12l8-4.5M12 12v9" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />,
  receipt: <path d="M6 3.5h12V20l-2-1.4-2 1.4-2-1.4L10 20l-2-1.4L6 20V3.5Z" />,
  ticket: <path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4V8Z" />,
  ticketLine: <path d="M13 7v2M13 11v2M13 15v2" />,
  gear: <circle cx="12" cy="12" r="3" />,
  gearRing: (
    <path d="M12 2.8v2.7M12 18.5v2.7M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M2.8 12h2.7M18.5 12h2.7M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" />
  ),
  shield: <path d="M12 3 5 5.8v5.4c0 4.4 2.9 7.4 7 9.3 4.1-1.9 7-4.9 7-9.3V5.8L12 3Z" />,
  shieldCheck: <path d="m9.2 11.6 2 2 3.6-3.8" />,
  bell: <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13.5 6 9.5" />,
  bellDot: <path d="M10 19a2 2 0 0 0 4 0" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="m14.5 5.5 4 4L8 20l-4.5.5L4 16 14.5 5.5Z" />,
  trash: <path d="M4.5 6.5h15M9.5 6V4.5A1 1 0 0 1 10.5 3.5h3a1 1 0 0 1 1 1V6M6.5 6.5 7.5 20a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13.5" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  lock: <rect x="5" y="10.5" width="14" height="10" rx="2" />,
  lockShackle: <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />,
  truck: <path d="M2.5 6.5h11V16h-11zM13.5 10h4l3 3v3h-7" />,
  truckWheel: <circle cx="6.5" cy="17.5" r="1.8" />,
  truckWheel2: <circle cx="16.5" cy="17.5" r="1.8" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5" />,
  uploadBase: <path d="M4 20h16" />,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 3.5V8h-4.5" />,
  logout: <path d="M14 4h-8v16h8M10 12h11M18 8.5 21.5 12 18 15.5" />,
  pin: <path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21Z" />,
  pinDot: <circle cx="12" cy="10.5" r="2.2" />,
  phone: (
    <path d="M7 3.5h3l1.5 4-2 1.5a12 12 0 0 0 4 4l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C10 17 7 14 6.9 6.6A1.5 1.5 0 0 1 7 3.5Z" />
  ),
  history: <path d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4.5 12H2.8M4.5 12l-1-3.5" />,
  historyHands: <path d="M12 7.5V12l3 2" />,
  spark: <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />,
  hanger: <circle cx="12" cy="5" r="2" />,
  hangerBody: <path d="M12 7v2M12 9 3.5 17a1.5 1.5 0 0 0 1 2.6l7.5-4 7.5 4a1.5 1.5 0 0 0 1-2.6L12 9Z" />,
};

export type IconName = keyof typeof PATHS;

const EXTRA: Record<string, IconName[]> = {
  search: ["search", "searchExtra"],
  heart: ["heart"],
  bag: ["bag", "bagHandle"],
  user: ["user", "userBody"],
  camera: ["camera", "cameraLens"],
  menu: ["menu"],
  grid: ["grid", "grid2", "grid3", "grid4"],
  tag: ["tag", "tagDot"],
  box: ["box", "boxLine"],
  chart: ["chart"],
  receipt: ["receipt"],
  ticket: ["ticket", "ticketLine"],
  gear: ["gear", "gearRing"],
  shield: ["shield", "shieldCheck"],
  bell: ["bell", "bellDot"],
  plus: ["plus"],
  edit: ["edit"],
  trash: ["trash"],
  check: ["check"],
  lock: ["lock", "lockShackle"],
  truck: ["truck", "truckWheel", "truckWheel2"],
  upload: ["upload", "uploadBase"],
  arrowRight: ["arrowRight"],
  arrowUpRight: ["arrowUpRight"],
  chevronDown: ["chevronDown"],
  chevronRight: ["chevronRight"],
  x: ["x"],
  filter: ["filter"],
  refresh: ["refresh"],
  logout: ["logout"],
  pin: ["pin", "pinDot"],
  phone: ["phone"],
  history: ["history", "historyHands"],
  spark: ["spark"],
  hanger: ["hanger", "hangerBody"],
};

export type UiIcon = keyof typeof EXTRA;

export function Icon({
  name,
  size = 20,
  className,
  filled = false,
}: {
  name: UiIcon;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {EXTRA[name].map((key) => (
        <g key={key}>{PATHS[key]}</g>
      ))}
    </svg>
  );
}
