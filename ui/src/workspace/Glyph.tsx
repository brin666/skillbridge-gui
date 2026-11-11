import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  memory: (
    <>
      <path d="M12 4a4 4 0 0 0-7.5 2A3.5 3.5 0 0 0 4 13a4 4 0 0 0 8 4.5A4 4 0 0 0 20 13a3.5 3.5 0 0 0-.5-7A4 4 0 0 0 12 4Z" />
      <path d="M12 4v16" />
    </>
  ),
  plug: (
    <>
      <path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6" />
    </>
  ),
  layout: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  pen: (
    <>
      <path d="m15 4 5 5M5 19l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L11 18l-6 1Z" />
    </>
  ),
  motion: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  code: (
    <>
      <path d="m8 6-6 6 6 6m8-12 6 6-6 6" />
    </>
  ),
  text: (
    <>
      <path d="M4 5h16M12 5v15M8 20h8" />
    </>
  ),
  folder: (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8h13l1 12.5h-15L5.5 8Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  sparkle: (
    <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z" />
  ),
  calm: (
    <>
      <path d="M4 12c2.5-3 5.5-3 8 0s5.5 3 8 0" />
    </>
  ),
  wave: (
    <>
      <path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0" />
    </>
  ),
  all: (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="7" cy="17" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3ZM12 9v5M12 17h.01" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  star: (
    <path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1 3-6Z" />
  ),
  // 来源（自绘示意图形，非官方标志）
  codex: (
    <>
      <path d="M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6Z" />
      <path d="m9 10 2.5 2L9 14M13 14.5h2.5" />
    </>
  ),
  claude: (
    <>
      <path d="M12 4v16M4 12h16M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />
    </>
  ),
  cursor: (
    <>
      <path d="M5 4 19 11l-6 1.8L10.5 19Z" />
    </>
  ),
};
export function Glyph({
  name,
  size = 20,
  stroke = 1.7,
}: {
  name: string;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.file}
    </svg>
  );
}
