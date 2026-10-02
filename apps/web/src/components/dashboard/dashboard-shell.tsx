"use client";

import {
  BookOpen,
  GalleryVerticalEnd,
  Layers,
  LayoutGrid,
  LogIn,
  Play,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import type { SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/study", label: "Study", icon: Play },
  { href: "/decks", label: "Decks", icon: Layers },
  { href: "/cards", label: "Cards", icon: GalleryVerticalEnd },
  { href: "/blog", label: "Blog", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardShell({
  user,
  deckOptions,
  active,
  children,
}: {
  user: SessionUser | null;
  deckOptions: Array<{ slug: string; title: string }>;
  active: "/dashboard" | "/admin";
  children: React.ReactNode;
}) {
  const onAdmin = active === "/admin";
  const items = user?.admin ? NAV.filter((item) => item.href !== "/dashboard") : NAV;

  return (
    <div className="flex h-full min-h-0 bg-bg text-ink">
      <aside className="flex h-full w-14 shrink-0 flex-col border-r border-rule bg-paper sm:w-60">
        <div className="flex shrink-0 items-center gap-2 border-b border-rule px-3 py-3">
          <Logo className="h-7 w-7 shrink-0" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-display text-sm font-semibold">MetaStack</p>
            <p className="truncate text-xs text-ink-3">{user ? user.login : "Signed out"}</p>
          </div>
        </div>
        <nav
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
          aria-label="Dashboard"
        >
          <ul className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const current = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink",
                      current && "bg-paper-2 font-medium text-ink",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="hidden truncate sm:inline">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 hidden px-2 text-xs font-medium tracking-wide text-ink-3 uppercase sm:block">
            Decks
          </p>
          <ul className="mt-1 hidden space-y-0.5 sm:block">
            {deckOptions.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/study/${item.slug}`}
                  className="block truncate rounded-md px-2 py-1.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {user?.admin ? (
          <div className="shrink-0 space-y-1 border-t border-rule px-2 py-2">
            <Link
              href="/dashboard"
              aria-current={active === "/dashboard" ? "page" : undefined}
              title="Dashboard"
              className={cn(
                "flex items-center justify-center gap-2 rounded-md px-2 py-2 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink sm:justify-start",
                active === "/dashboard" && "bg-paper-2 font-medium text-ink",
              )}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link
              href="/admin"
              aria-current={onAdmin ? "page" : undefined}
              title="Admin"
              className={cn(
                "flex items-center justify-center gap-2 rounded-md bg-red/10 px-2 py-2 text-sm font-semibold text-red hover:bg-red/20 sm:justify-start",
                onAdmin && "bg-red text-white hover:bg-red-ink",
              )}
            >
              <Shield className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        ) : null}
        <div className="shrink-0 border-t border-rule p-2">
          {user ? (
            <div className="flex items-center gap-2 px-1 py-1">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full border border-rule"
                />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper-2 text-xs font-medium">
                  {user.login.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="hidden min-w-0 flex-1 sm:block">
                <p className="truncate text-sm">{user.login}</p>
                <a href="/api/auth/logout" className="text-xs text-ink-3 hover:text-ink">
                  Sign out
                </a>
              </div>
            </div>
          ) : (
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2 rounded-md bg-ink px-2 py-2 text-sm text-bg hover:opacity-90 sm:justify-start"
            >
              <LogIn className="h-4 w-4 shrink-0 sm:hidden" aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign in with GitHub</span>
            </a>
          )}
        </div>
      </aside>
      {children}
    </div>
  );
}
