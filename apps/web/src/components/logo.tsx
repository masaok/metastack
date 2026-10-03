import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The mark is a flashcard with MS cut out of it, on top of a second card
 * that shows only its red top and right edge. The S is three stacked bars.
 */
const MONOGRAM =
  "M5 24.5V11.5l3.5 5.5 3.5-5.5v13M23.5 11.5H19.75a3.25 3.25 0 0 0 0 6.5h1a3.25 3.25 0 0 1 0 6.5H17";

export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <defs>
        <mask id={`${id}-cut`}>
          <rect x="1" y="5" width="27" height="26" rx="4" fill="#fff" />
          <path
            d={MONOGRAM}
            fill="none"
            stroke="#000"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <path
        d="M8 2H27a4 4 0 0 1 4 4V24"
        fill="none"
        stroke="var(--red, #e2505c)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="1"
        y="5"
        width="27"
        height="26"
        rx="4"
        fill="var(--ink, #15203a)"
        mask={`url(#${id}-cut)`}
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("shrink-0 font-display text-[1.15rem] font-bold tracking-tight", className)}
    >
      Meta<span className="text-red">Stack</span>
    </span>
  );
}
