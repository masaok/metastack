import { cn } from "@/lib/utils";

/**
 * The mark is a stack of three flashcards. The front card is solid, with
 * the red rule of an index card. The two behind it show only their top
 * and right edges.
 */
export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <g fill="none" stroke="var(--ink, #15203a)" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5H27a3 3 0 0 1 3 3V19" opacity="0.35" />
        <path d="M8 9H23a3 3 0 0 1 3 3V23" opacity="0.6" />
      </g>
      <rect x="2" y="12" width="21" height="17" rx="3" fill="var(--ink, #15203a)" />
      <rect x="2" y="16.5" width="21" height="2" fill="var(--red, #e2505c)" />
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
