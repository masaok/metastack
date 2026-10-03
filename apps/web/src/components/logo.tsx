import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The mark is a flashcard with a sharp-cornered M cut out of it, on top of a second card
 * that shows only its red top and right edge.
 */
const MONOGRAM =
  "M5.5 27.2V8.6H9.7L14.5 17.5L19.3 8.6H23.5V27.2H19.3V15.2L14.5 22.4L9.7 15.2V27.2Z";

export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <defs>
        <mask id={`${id}-cut`}>
          <rect x="1" y="5" width="27" height="26" rx="4" fill="#fff" />
          <path d={MONOGRAM} fill="#000" />
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
