import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * The mark is a short stack of cards. The front card has a red margin,
 * like an index card, and an M cut out of it. The M stays one solid color
 * so the mark does not read as an envelope.
 */
const CARD = { x: 2, y: 6, width: 26, height: 24, rx: 3.5 };
const MONOGRAM = "M8 27.2V8.6H12.2L17 17.5L21.8 8.6H26V27.2H21.8V15.2L17 22.4L12.2 15.2V27.2Z";

export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <defs>
        <mask id={`${id}-cut`}>
          <rect {...CARD} fill="#fff" />
          <path d={MONOGRAM} fill="#000" />
        </mask>
        <mask id={`${id}-peek`}>
          <rect x="6" y="2" width="24" height="22" rx="3.5" fill="#fff" />
          <rect {...CARD} fill="#000" />
        </mask>
        <clipPath id={`${id}-card`}>
          <rect {...CARD} />
        </clipPath>
      </defs>
      <rect
        x="6"
        y="2"
        width="24"
        height="22"
        rx="3.5"
        fill="var(--ink, #15203a)"
        opacity="0.4"
        mask={`url(#${id}-peek)`}
      />
      <rect {...CARD} fill="var(--ink, #15203a)" mask={`url(#${id}-cut)`} />
      <rect
        x="2"
        y="6"
        width="4.2"
        height="24"
        fill="var(--red, #e2505c)"
        clipPath={`url(#${id}-card)`}
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
