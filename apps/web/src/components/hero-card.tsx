"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

import type { Card } from "@metastack/content";

import { Logo } from "@/components/logo";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** The live card in the hero. Flip it to see the rubric; nothing is saved. */
export function HeroCard({ card }: { card: Card }) {
  const [flipped, setFlipped] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => card.keyPoints.map(() => false));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" || e.target instanceof HTMLInputElement) return;
      const el = document.activeElement;
      if (el && el !== document.body && !el.closest("[data-hero-card]")) return;
      e.preventDefault();
      setFlipped((f) => !f);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hit = checked.filter(Boolean).length;

  return (
    <div className="relative" data-hero-card>
      <Logo
        className="pointer-events-none absolute -top-14 right-8 z-0 h-28 w-28 sm:-top-16 sm:right-10 sm:h-32 sm:w-32"
        title=""
      />
      <div className="flip-scene relative z-10">
        <div className={cn("flip-inner", flipped && "is-flipped")}>
          {/* front */}
          <button
            type="button"
            onClick={() => setFlipped(true)}
            aria-pressed={flipped}
            aria-label="Flip the card to see the key points"
            className="index-card flip-face flex min-h-[400px] w-full flex-col overflow-hidden text-left sm:min-h-[440px]"
          >
            <div className="flex-1 px-6 pt-6 pb-7 sm:px-9 sm:pt-7">
              <Eyebrow>
                <span className="text-red-ink">{card.deck}</span>
                <span aria-hidden>·</span>
                <span>{card.type}</span>
                <span className="ml-auto font-mono font-normal normal-case">#{card.id}</span>
              </Eyebrow>
              <p className="card-prompt mt-5 text-balance">{card.prompt.trim()}</p>
            </div>
            <div className="flex items-center gap-2 border-t border-rule/60 bg-paper-2/70 px-6 py-4 text-sm text-ink-2 sm:px-9">
              <RotateCw className="h-4 w-4" />
              Flip to check your answer
              <Kbd className="ml-1">space</Kbd>
            </div>
          </button>

          {/* back */}
          <div
            className="index-card flip-face flip-back flex flex-col overflow-hidden"
            aria-hidden={!flipped}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-6 sm:px-9 sm:pt-7">
              <Eyebrow>
                <span className="text-blue">key points</span>
                <span className="ml-auto font-mono font-normal normal-case">
                  {hit}/{card.keyPoints.length} hit
                </span>
              </Eyebrow>
              <ul className="mt-5 space-y-2.5">
                {card.keyPoints.map((kp, i) => (
                  <li key={kp}>
                    <label className="flex cursor-pointer items-start gap-3 text-[0.95rem] leading-snug">
                      <input
                        type="checkbox"
                        checked={checked[i] ?? false}
                        tabIndex={flipped ? 0 : -1}
                        onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--red)]"
                      />
                      <span className={cn(checked[i] && "text-ink-2 line-through")}>{kp}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-rule/60 bg-paper-2/70 px-6 py-3 text-sm text-ink-2 sm:px-9">
              <span>
                {hit === 0
                  ? "Tick what you said out loud."
                  : hit / card.keyPoints.length >= 0.95
                    ? "Easy. Next review in about a week."
                    : hit / card.keyPoints.length >= 0.7
                      ? "Good. You'll see this again in a few days."
                      : hit / card.keyPoints.length >= 0.4
                        ? "Hard. Back tomorrow."
                        : "Again. Back in ten minutes."}
              </span>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                tabIndex={flipped ? 0 : -1}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-ink-2 hover:bg-paper-2 hover:text-ink"
              >
                <RotateCw className="h-4 w-4" /> Flip back
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* the rest of the stack, peeking out below */}
      <div
        aria-hidden
        className="absolute inset-x-3 -bottom-2 -z-10 h-6 rounded-b-[20px] border border-rule bg-paper-2"
      />
      <div
        aria-hidden
        className="absolute inset-x-6 -bottom-4 -z-20 h-6 rounded-b-[20px] border border-rule bg-paper-2 opacity-70"
      />
    </div>
  );
}

/** Small uppercase label row, shared with the study card's header. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-ink-3 uppercase">
      {children}
    </div>
  );
}
