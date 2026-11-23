import { useEffect } from "react";

/* `bar` tints the mobile browser toolbar. The logo stays brand pink everywhere. */
export interface SectionTheme {
  id: string;
  bar: string;
}

export const BRAND_ACCENT = "#ff2bd6";

export const SECTION_THEMES: SectionTheme[] = [
  { id: "top", bar: "#2b0b3d" },
  { id: "why", bar: "#171034" },
  { id: "music", bar: "#062637" },
  { id: "shows", bar: "#1b1338" },
  { id: "voices", bar: "#2a0a33" },
  { id: "pricing", bar: "#3a2408" },
  { id: "faq", bar: "#0f2a24" },
  { id: "book", bar: "#3b0a30" },
];

export const DEFAULT_THEME: SectionTheme = { id: "", bar: "#0a0512" };

/** Pink shades the desktop tab icon pulses between, so the mark never leaves the brand. */
export const TAB_STOPS = ["#ff2bd6", "#ff9df0", "#e015a6"];

const TICK_MS = 80;
const LOOP_MS = 6000;

export function themeFor(id: string): SectionTheme {
  return SECTION_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

export function mixHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(from);
  const [r2, g2, b2] = hexToRgb(to);
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return `#${toHex(r1 + (r2 - r1) * clamp(t))}${toHex(g1 + (g2 - g1) * clamp(t))}${toHex(b1 + (b2 - b1) * clamp(t))}`;
}

/** Smoothly blends around the brand stops; 0 and 1 both return the first stop. */
export function tabAccentAt(progress: number): string {
  const stops = [...TAB_STOPS, TAB_STOPS[0]];
  const p = ((progress % 1) + 1) % 1;
  const scaled = p * (stops.length - 1);
  const index = Math.min(Math.floor(scaled), stops.length - 2);
  return mixHex(stops[index], stops[index + 1], scaled - index);
}

/** Animation is for fine pointers only, and never against a reduced-motion preference. */
export function canAnimateTab(win: Window = window): boolean {
  if (typeof win.matchMedia !== "function") return false;
  return win.matchMedia("(hover: hover) and (pointer: fine)").matches && !win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function faviconFor(accent: string = BRAND_ACCENT): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0A0512"/><rect x="8" y="18" width="48" height="28" fill="none" stroke="${accent}" stroke-width="4"/><text x="32" y="39" font-family="Arial Black,Arial" font-size="17" font-weight="900" fill="#F5EFFA" text-anchor="middle">KC</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function useThemeColor({ animateTab = true }: { animateTab?: boolean } = {}) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const nodes = SECTION_THEMES.map((theme) => ({ theme, el: document.getElementById(theme.id) }));
    const animate = animateTab && canAnimateTab();
    let last = "";
    let progress = 0;
    let timer = 0;

    const apply = () => {
      const probe = window.scrollY + window.innerHeight * 0.4;
      let theme = DEFAULT_THEME;
      for (const node of nodes) {
        if (node.el && node.el.getBoundingClientRect().top + window.scrollY <= probe) theme = node.theme;
      }
      if (theme.id === last) return;
      last = theme.id;
      if (meta && meta.content !== theme.bar) meta.content = theme.bar;
    };

    const tick = () => {
      progress = (progress + TICK_MS / LOOP_MS) % 1;
      if (icon) icon.href = faviconFor(tabAccentAt(progress));
    };
    const start = () => {
      if (!animate || timer) return;
      timer = window.setInterval(tick, TICK_MS);
    };
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    apply();
    if (icon) icon.href = faviconFor();
    if (animate) tick();
    start();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [animateTab]);
}
