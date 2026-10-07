"use client";

import { useEffect } from "react";

import { getStoredSettings, setSetting } from "@/lib/db";
import { isTheme } from "@/lib/settings";
import { pullSettings } from "@/lib/sync";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Themes chosen before preferences lived in IndexedDB were only in localStorage. */
async function adoptLegacyTheme() {
  if ((await getStoredSettings()).theme) return;
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return;
  }
  if (isTheme(legacy)) await setSetting("theme", legacy);
}

// Module scope, so strict mode's second effect run in dev reuses the first pull.
let pulled = false;

/**
 * On each page load, copies the signed-in account's preferences from the
 * database into this browser. Signed-out visitors keep their local copy.
 */
export function PreferencesSync() {
  useEffect(() => {
    if (pulled) return;
    pulled = true;
    void adoptLegacyTheme()
      .then(pullSettings)
      .catch(() => undefined);
  }, []);
  return null;
}
