import { cn } from "@/lib/utils";

/**
 * The MetaStack mark: three cards in a stack, the front one ruled in red.
 * Built from a few large shapes so it still reads as a favicon.
 */
export function Logo({ className, title = "MetaStack" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("block", className)}>
      <rect x="11" y="14" width="17" height="12" rx="2.5" fill="var(--ink, #15203a)" />
      <rect x="7" y="10" width="17" height="12" rx="2.5" fill="var(--ink, #15203a)" />
      <rect x="3" y="6" width="17" height="12" rx="2.5" fill="var(--ink, #15203a)" />
      <rect x="5.2" y="8" width="12.6" height="3.2" rx="1.4" fill="var(--red, #e2505c)" />
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
