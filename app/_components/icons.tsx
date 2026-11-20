import type { CSSProperties, ReactNode } from 'react';

// Bộ icon nét mảnh (inline SVG, viewBox 24, stroke = currentColor) — không thêm thư viện.
// Dùng ở màn chấm công CBNV (đồng hồ, nhân viên, vị trí, ca, giải trình…).

const PATHS: Record<string, ReactNode> = {
  settings: (
    <>
      <line x1="4" y1="8" x2="13" y2="8" />
      <line x1="18" y1="8" x2="20" y2="8" />
      <circle cx="16" cy="8" r="2" />
      <line x1="4" y1="16" x2="6" y2="16" />
      <line x1="11" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="16" r="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
    </>
  ),
  arrowIn: (
    <>
      <path d="M16 7 8 15" />
      <path d="M8 10v5h5" />
    </>
  ),
  arrowOut: (
    <>
      <path d="M8 16 16 8" />
      <path d="M11 8h5v5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </>
  ),
  ruler: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="1" />
      <path d="M7 8v3M11 8v4M15 8v3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8.5 8.5 0 1 1 18 6" />
      <path d="M18 2.5V6h-3.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <rect x="5" y="12" width="3" height="6" />
      <rect x="10.5" y="6" width="3" height="12" />
      <rect x="16" y="9" width="3" height="9" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 18,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
