import type { Theme } from "./settings";

export const THEME_STORAGE_KEY = "metastack-theme";

/** The theme the page is showing right now. */
export function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Applies a theme preference to the page and caches it in localStorage, which
 * is what the inline script in the root layout reads before first paint.
 */
export function applyTheme(theme: Theme): void {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    if (theme === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // storage unavailable; the attribute still applies for this page
  }
}
