"use client";

import { useEffect, useState } from "react";

import { fetchSession, type SessionUser } from "@/lib/sync";

export function AuthButton() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    void fetchSession().then(setUser);
  }, []);

  if (user === undefined) {
    return <span className="hidden h-9 w-9 sm:inline-block" aria-hidden />;
  }

  if (!user) {
    return (
      <a
        href="/api/auth/github"
        className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
      >
        Sign in
      </a>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <a href="/dashboard" className="flex items-center gap-2 rounded-full hover:opacity-80">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-full border border-rule"
          />
        ) : null}
        <span className="hidden text-sm text-ink-2 sm:inline">{user.login}</span>
      </a>
      <a
        href="/api/auth/logout"
        className="rounded-full px-2 py-1 text-xs text-ink-3 hover:bg-paper-2 hover:text-ink"
      >
        Sign out
      </a>
    </span>
  );
}
