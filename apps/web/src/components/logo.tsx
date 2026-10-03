import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The mark is a flashcard with an M cut out of it, on top of a second card
 * that shows only its red top and right edge.
 */
const MONOGRAM = "M8 25V11l6.5 9 6.5-9v14";

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
            strokeWidth="3.4"
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
