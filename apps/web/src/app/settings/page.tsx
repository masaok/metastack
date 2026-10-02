import type { Metadata } from "next";

import { SettingsPanel } from "@/components/settings-panel";

export const metadata: Metadata = {
  title: "Settings",
  description: "Daily limit, study mode, and export or import of your progress.",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Settings
      </h1>
      <p className="mt-2 text-ink-2">Nothing here leaves your browser.</p>
      <div className="mt-8">
        <SettingsPanel />
      </div>
    </div>
  );
}
