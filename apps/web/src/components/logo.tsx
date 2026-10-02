import { cn } from "@/lib/utils";

/**
 * The MetaStack mark: a geometric M. The legs are ink and the chevron is red,
 * drawn with a few thick strokes so it still reads as a favicon.
 */
export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <path
        d="M6 26V7L16 17L26 7V26"
        fill="none"
        stroke="var(--ink, #15203a)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7L16 17L26 7"
        fill="none"
        stroke="var(--red, #e2505c)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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
