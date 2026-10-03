"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import { savePreference } from "@/lib/sync";
import { applyTheme, currentTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle({
  className,
  label = false,
}: {
  className?: string;
  /** Show the name of the theme the button switches to beside the icon, where there is room. */
  label?: boolean;
}) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as const);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    void savePreference("theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2 hover:text-ink",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Moon className="h-4 w-4 shrink-0" aria-hidden />
      )}
      {label ? (
        <span className="hidden sm:inline">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
      ) : null}
    </button>
  );
}
