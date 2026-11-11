const paths = {
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></>,
  memory: <><path d="M12 4a4 4 0 0 0-7.5 2A3.5 3.5 0 0 0 4 13a4 4 0 0 0 8 4.5A4 4 0 0 0 20 13a3.5 3.5 0 0 0-.5-7A4 4 0 0 0 12 4Z"/><path d="M12 4v16"/></>,
  plug: <path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0V8ZM12 18v3"/>,
  chart: <path d="M4 3v17h17M8 15v-4M13 15V7M18 15v-6"/>,
  folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>,
  bag: <><path d="M5.5 8h13l1 12.5h-15L5.5 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>, check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
  arrow: <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5"/>, search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></>,
  sparkle: <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7Z"/>,
  calm: <path d="M4 12c2.5-3 5.5-3 8 0s5.5 3 8 0"/>,
  wave: <path d="M3 12c1.5-4 3-4 4.5 0s3 4 4.5 0 3-4 4.5 0 3 4 4.5 0"/>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  github: <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 9 3 3-3 3M12.5 15H17"/></>,
  window: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></>,
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z"/>,
  codex: <><path d="M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6Z"/><path d="m9 10 2.5 2L9 14M13 14.5h2.5"/></>,
};
export function Glyph({name, size = 20, stroke = 1.7}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}
export function BrandMark({size = 22}) {
  return <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true"><path d="M5 21V10a9 9 0 0 1 18 0v11M5 15h18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>;
}
