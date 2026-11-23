import { useEffect } from "react";

/* Colours follow the section in view: `bar` tints the mobile browser toolbar,
   `accent` recolours the tab icon so desktop tabs shift too. */
export interface SectionTheme {
  id: string;
  bar: string;
  accent: string;
}

export const SECTION_THEMES: SectionTheme[] = [
  { id: "top", bar: "#2b0b3d", accent: "#ff2bd6" },
  { id: "why", bar: "#171034", accent: "#8b5cf6" },
  { id: "music", bar: "#062637", accent: "#2bd9ff" },
  { id: "shows", bar: "#1b1338", accent: "#8b5cf6" },
  { id: "voices", bar: "#2a0a33", accent: "#ff2bd6" },
  { id: "pricing", bar: "#3a2408", accent: "#ffb224" },
  { id: "faq", bar: "#0f2a24", accent: "#3ee58f" },
  { id: "book", bar: "#3b0a30", accent: "#ff2bd6" },
];

export const DEFAULT_THEME: SectionTheme = { id: "", bar: "#0a0512", accent: "#ff2bd6" };

export function themeFor(id: string): SectionTheme {
  return SECTION_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

export function faviconFor(accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0A0512"/><rect x="8" y="18" width="48" height="28" fill="none" stroke="${accent}" stroke-width="4"/><text x="32" y="39" font-family="Arial Black,Arial" font-size="17" font-weight="900" fill="#F5EFFA" text-anchor="middle">KC</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function useThemeColor() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const nodes = SECTION_THEMES.map((theme) => ({ theme, el: document.getElementById(theme.id) }));
    let last = "";

    const apply = () => {
      const probe = window.scrollY + window.innerHeight * 0.4;
      let theme = DEFAULT_THEME;
      for (const node of nodes) {
        if (node.el && node.el.getBoundingClientRect().top + window.scrollY <= probe) theme = node.theme;
      }
      if (theme.id === last) return;
      last = theme.id;
      if (meta && meta.content !== theme.bar) meta.content = theme.bar;
      if (icon) icon.href = faviconFor(theme.accent);
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);
}
