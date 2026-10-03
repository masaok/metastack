"use client";

import { useEffect, useState } from "react";

import { loadSession, peekSession, type SessionUser } from "@/lib/sync";

/** `undefined` while loading, `null` when signed out. */
export function useSession(): SessionUser | null | undefined {
  const [user, setUser] = useState<SessionUser | null | undefined>(peekSession);

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
