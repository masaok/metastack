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

/**
 * Re-applies the OS theme whenever it changes, unless the user picked Light
 * or Dark. Uses the same rule as the inline script: an explicit choice is the
 * only thing cached in localStorage. Returns the unsubscribe function.
 */
export function followSystemTheme(): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    let explicit: string | null = null;
    try {
      explicit = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // storage unavailable; treat the choice as System
    }
    if (explicit !== "light" && explicit !== "dark") applyTheme("system");
  };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
