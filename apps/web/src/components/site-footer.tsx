import { Github } from "lucide-react";
import Link from "next/link";

import { DECKS } from "@metastack/content";

import { Logo } from "@/components/logo";
import { GITHUB_URL } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const columns: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: "Study",
    links: [
      { label: "Start a session", href: "/study" },
      ...DECKS.map((deck) => ({ label: deck.title, href: `/study/${deck.slug}` })),
      { label: "Browse every card", href: "/cards" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Source on GitHub", href: GITHUB_URL, external: true },
      {
        label: "Contribute a card",
        href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`,
        external: true,
      },
      { label: "Report a problem", href: `${GITHUB_URL}/issues/new/choose`, external: true },
    ],
  },
  {
    heading: "Your progress",
    links: [
      { label: "Deck overview", href: "/decks" },
      { label: "Settings", href: "/settings" },
      { label: "Export or import", href: "/settings" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-rule/70 bg-paper-2/60">
      <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 sm:px-6">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)] lg:gap-8">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="MetaStack home">
              <Logo className="h-10 w-10" />
              <span className="font-display text-2xl font-bold tracking-tight text-ink">
                Meta<span className="text-red">Stack</span>
              </span>
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-ink-2">
              System design flashcards scheduled by FSRS. Open source under the MIT license, with no
              paywall and no tracking. Progress lives in your browser; sign in only if you want a
              copy that follows you.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-md border border-rule-strong bg-paper px-4 text-sm font-medium text-ink hover:bg-paper-2"
            >
              <Github className="h-4 w-4" aria-hidden />
              Star on GitHub
            </a>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">
                {column.heading}
              </h2>
              <ul className="mt-5 space-y-3 text-sm text-ink-2">
                {column.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-ink">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-rule/70 pt-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} MetaStack. Released under the MIT license.</p>
          <p>Scheduling by FSRS. No analytics, no third-party scripts.</p>
        </div>
      </div>
    </footer>
  );
}
