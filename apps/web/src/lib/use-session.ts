"use client";

import { useEffect, useState } from "react";

import { fetchSession, type SessionUser } from "@/lib/sync";

// One request per page load, shared by every component that asks.
let cached: SessionUser | null | undefined;
let inflight: Promise<SessionUser | null> | undefined;

function loadSession(): Promise<SessionUser | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  inflight ??= fetchSession()
    .catch(() => null)
    .then((user) => {
      cached = user;
      return user;
    });
  return inflight;
}

/** `undefined` while loading, `null` when signed out. */
export function useSession(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(cached);

  useEffect(() => {
    let live = true;
    void loadSession().then((next) => {
      if (live) setUser(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return user;
}
