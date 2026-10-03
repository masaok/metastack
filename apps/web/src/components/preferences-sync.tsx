"use client";

import { useEffect } from "react";

import { pullSettings } from "@/lib/sync";

/**
 * On each page load, copies the signed-in account's preferences from the
 * database into this browser. Signed-out visitors keep their local copy.
 */
export function PreferencesSync() {
  useEffect(() => {
    void pullSettings().catch(() => undefined);
  }, []);
  return null;
}
