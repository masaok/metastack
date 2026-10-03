import { Github } from "lucide-react";
import Link from "next/link";

import { AuthButton } from "@/components/auth-button";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { GITHUB_URL } from "@/lib/utils";

const nav = [
  { href: "/decks", label: "Decks" },
  { href: "/cards", label: "Cards" },
  { href: "/blog", label: "Blog" },
  { href: "/settings", label: "Settings" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="MetaStack home">
          <Logo className="h-8 w-8 shrink-0" />
          <Wordmark />
        </Link>
        <nav className="ml-4 hidden items-center gap-1 sm:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="MetaStack on GitHub"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 hover:text-ink"
          >
            <Github className="h-4 w-4" />
          </a>
          <span className="sm:hidden">
            <AuthButton compact />
          </span>
          <span className="hidden sm:inline-flex">
            <AuthButton />
          </span>
          <ThemeToggle />
          <ButtonLink href="/study" size="sm" className="ml-1">
            <span className="sm:hidden">Drill</span>
            <span className="hidden sm:inline">Start drilling</span>
          </ButtonLink>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 sm:hidden" aria-label="Primary mobile">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-3 py-1 text-sm whitespace-nowrap text-ink-2 hover:bg-paper-2"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
