import React from "react";

const paths: Record<string, React.ReactNode> = {
  play: <path d="M7 4.5v15l13-7.5L7 4.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M19 5v14L9 12l10-7z" fill="currentColor" stroke="none" />
      <rect x="5" y="5" width="2.4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M5 5v14l10-7L5 5z" fill="currentColor" stroke="none" />
      <rect x="16.6" y="5" width="2.4" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  volumeX: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  arrowRight: <path d="M4 12h16m-6-6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  disc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3a9 9 0 0 1 9 9" opacity="0.45" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 4v7m0 4v5M12 4v3m0 4v9M19 4v11m0 4v1" />
      <circle cx="5" cy="13" r="2" />
      <circle cx="12" cy="9" r="2" />
      <circle cx="19" cy="17" r="2" />
    </>
  ),
  download: <path d="M12 4v11m-5-4l5 5 5-5M4 20h16" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3.5 7.5L12 13.5l8.5-6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 20a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  star: (
    <path
      d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8L12 2.8z"
      fill="currentColor"
      stroke="none"
    />
  ),
  spark: (
    <path
      d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2z"
      fill="currentColor"
      stroke="none"
    />
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4.5" height="7" rx="2" />
      <rect x="16.5" y="14" width="4.5" height="7" rx="2" />
    </>
  ),
  send: <path d="M21 3L10.5 13.5M21 3l-7 18-3.5-7.5L3 10l18-7z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  spotify: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 9.6c3.2-.9 6.6-.6 9.2.9M8 12.6c2.6-.7 5.3-.4 7.4.8M8.5 15.4c2-.5 4-.3 5.6.6" />
    </>
  ),
  soundcloud: (
    <>
      <path d="M3 16v-3M5.8 17V10M8.6 17V8.5" />
      <path d="M11.4 17V7.2a5.2 5.2 0 0 1 7.8 4.5A3 3 0 0 1 18.6 17h-7.2z" />
    </>
  ),
  tiktok: (
    <path
      d="M16.6 3c.4 2.3 1.9 3.8 4.2 4v3.1c-1.6 0-3-.5-4.2-1.4v6.5a5.9 5.9 0 1 1-5.9-5.9c.3 0 .7 0 1 .1v3.2a2.8 2.8 0 1 0 1.9 2.6V3h3z"
      fill="currentColor"
      stroke="none"
    />
  ),
};

export function Icon({
  name,
  className = "w-5 h-5",
  strokeWidth = 1.8,
}: {
  name: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? null}
    </svg>
  );
}