"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { syncProgress } from "@/lib/sync";

/** Merges IndexedDB with the server copy after the OAuth redirect. */
export function SyncAfterLogin() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const auth = new URLSearchParams(window.location.search).get("auth");
    if (auth !== "ok" || started.current) return;
    started.current = true;
    void syncProgress()
      .catch(() => undefined)
      .finally(() => {
        router.replace("/dashboard");
        router.refresh();
      });
  }, [router]);

  return null;
}
