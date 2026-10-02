import { cn } from "@/lib/utils";

/**
 * The MetaStack mark: three stacked index cards, the top one awake.
 * Pure SVG so it scales from favicon to hero. `animate` enables the blink.
 */
export function Logo({
  className,
  animate = false,
  title = "MetaStack",
}: {
  className?: string;
  animate?: boolean;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 128 128"
      role="img"
      aria-label={title}
      className={cn("block", className)}
      fill="none"
    >
      {/* bottom card */}
      <g transform="translate(14 60) rotate(-6)">
        <rect
          width="100"
          height="60"
          rx="10"
          fill="var(--paper, #fff)"
          stroke="var(--rule-strong, #9fb3d3)"
          strokeWidth="3"
        />
      </g>
      {/* middle card */}
      <g transform="translate(16 46) rotate(3)">
        <rect
          width="100"
          height="60"
          rx="10"
          fill="var(--paper, #fff)"
          stroke="var(--rule-strong, #9fb3d3)"
          strokeWidth="3"
        />
      </g>
      {/* top card with face */}
      <g transform="translate(14 28) rotate(-2)">
        <rect
          width="100"
          height="60"
          rx="10"
          fill="var(--paper, #fff)"
          stroke="var(--ink, #15203a)"
          strokeWidth="3.5"
        />
        <line
          x1="4"
          y1="16"
          x2="96"
          y2="16"
          stroke="var(--red, #e2505c)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="10"
          y1="32"
          x2="90"
          y2="32"
          stroke="var(--rule, #c5d3e8)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="10"
          y1="46"
          x2="90"
          y2="46"
          stroke="var(--rule, #c5d3e8)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* eyes */}
        <g className={animate ? "mascot-blink" : undefined}>
          <circle cx="36" cy="38" r="4.5" fill="var(--ink, #15203a)" />
          <circle cx="64" cy="38" r="4.5" fill="var(--ink, #15203a)" />
          <circle cx="37.5" cy="36.5" r="1.4" fill="var(--paper, #fff)" />
          <circle cx="65.5" cy="36.5" r="1.4" fill="var(--paper, #fff)" />
        </g>
        {/* blush */}
        <ellipse cx="27" cy="46" rx="5" ry="2.6" fill="var(--red, #e2505c)" opacity="0.35" />
        <ellipse cx="73" cy="46" rx="5" ry="2.6" fill="var(--red, #e2505c)" opacity="0.35" />
        {/* smile */}
        <path
          d="M43 48c3.5 4 10.5 4 14 0"
          stroke="var(--ink, #15203a)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
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
