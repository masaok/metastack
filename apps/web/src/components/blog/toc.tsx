"use client";

import { useEffect, useState } from "react";

import type { Heading } from "@/lib/blog/schema";
import { cn } from "@/lib/utils";

/**
 * Table of contents for one post. Sticky beside the body on wide screens, a
 * plain list above the body on phones. The active entry follows the h2 whose
 * section is nearest the top of the viewport.
 */
export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    const update = () => {
      const line = 96;
      let current = elements[0];
      for (const el of elements) {
        if (el.getBoundingClientRect().top - line <= 0) current = el;
      }
      setActiveId(current?.id);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" data-toc className="text-sm">
      <p className="text-xs font-medium tracking-wide text-ink-3 uppercase">On this page</p>
      <ol className="mt-3 space-y-1 border-l border-rule">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-1 pl-3 leading-snug transition-colors",
                  active
                    ? "border-red font-medium text-ink"
                    : "border-transparent text-ink-2 hover:border-rule-strong hover:text-ink",
                )}
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
