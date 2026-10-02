import { cn } from "@/lib/utils";

type Tone = "neutral" | "red" | "blue" | "green" | "amber";

const tones: Record<Tone, string> = {
  neutral: "border-rule bg-paper-2 text-ink-2",
  red: "border-red/30 bg-red/10 text-red-ink",
  blue: "border-blue/30 bg-blue/10 text-blue",
  green: "border-green/30 bg-green/10 text-green",
  amber: "border-amber/40 bg-amber/10 text-amber",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
