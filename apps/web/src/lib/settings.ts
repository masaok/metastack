/**
 * User preferences. Stored in IndexedDB for everyone and mirrored to the
 * account's row in the database when signed in, so they follow the user.
 * This module has no "use client" directive: the server validates with it too.
 */

export type StudyMode = "rubric" | "quick";
export type Theme = "system" | "light" | "dark";

export interface Settings {
  /** New cards introduced per day across all decks. */
  newLimit: number;
  mode: StudyMode;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = { newLimit: 10, mode: "rubric", theme: "system" };

export const SETTING_KEYS = ["newLimit", "mode", "theme"] as const satisfies ReadonlyArray<
  keyof Settings
>;

export const NEW_LIMIT_MIN = 1;
export const NEW_LIMIT_MAX = 100;

export function isStudyMode(value: unknown): value is StudyMode {
  return value === "rubric" || value === "quick";
}

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function isNewLimit(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= NEW_LIMIT_MIN &&
    value <= NEW_LIMIT_MAX
  );
}

/** Keeps the keys that carry a valid value and drops everything else. */
export function parseSettingsPatch(value: unknown): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  if (isNewLimit(v.newLimit)) out.newLimit = v.newLimit;
  if (isStudyMode(v.mode)) out.mode = v.mode;
  if (isTheme(v.theme)) out.theme = v.theme;
  return out;
}
