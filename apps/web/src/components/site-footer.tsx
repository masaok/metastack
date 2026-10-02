import Link from "next/link";

import { Logo } from "@/components/logo";
import { GITHUB_URL } from "@/lib/utils";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-7" />
          <p>
            MetaStack is open source under the MIT license. Progress lives in your browser and never
            leaves it.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            GitHub
          </a>
          <a
            href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            Contribute a card
          </a>
          <a
            href={`${GITHUB_URL}/issues/new/choose`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            Report a problem
          </a>
          <Link href="/settings" className="hover:text-ink">
            Export progress
          </Link>
        </nav>
      </div>
    </footer>
  );
}
