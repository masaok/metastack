"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  db,
  exportData,
  getSettings,
  importData,
  resetAll,
  setSetting,
  type Settings,
  type StudyMode,
} from "@/lib/db";
import { fetchSession, syncProgress, type SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-full border border-rule px-4 text-sm font-medium";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useLiveQuery(
    async () => {
      const d = db();
      const [learned, reviews] = await Promise.all([
        d.cardStates.where("state").notEqual("new").count(),
        d.reviews.count(),
      ]);
      return { learned, reviews };
    },
    [],
    null,
  );

  useEffect(() => {
    void getSettings().then(setSettings);
    void fetchSession().then((signedIn) => {
      setUser(signedIn);
      const auth = new URLSearchParams(window.location.search).get("auth");
      if (auth) window.history.replaceState({}, "", "/settings");
      if (auth === "denied") {
        setMessage({ tone: "error", text: "GitHub sign-in was cancelled." });
        return;
      }
      if (auth === "error") {
        setMessage({ tone: "error", text: "GitHub sign-in failed. Check the app callback URL." });
        return;
      }
      if (auth === "ok") {
        setSyncing(true);
        return syncProgress()
          .then(async (result) => {
            setSettings(await getSettings());
            setUser(await fetchSession());
            if (!result) {
              setMessage({ tone: "error", text: "Sign in first to sync." });
              return;
            }
            setMessage({
              tone: "ok",
              text: `Signed in. Progress merged with the server copy. ${result.cards} cards, ${result.reviews} reviews.`,
            });
          })
          .catch((err: unknown) => {
            setMessage({
              tone: "error",
              text: err instanceof Error ? err.message : "Sync failed.",
            });
          })
          .finally(() => setSyncing(false));
      }
    });
  }, []);

  async function onSync(okText = "Progress synced with the server.") {
    setSyncing(true);
    try {
      const result = await syncProgress();
      setSettings(await getSettings());
      setUser(await fetchSession());
      if (!result) {
        setMessage({ tone: "error", text: "Sign in first to sync." });
        return;
      }
      setMessage({
        tone: "ok",
        text: `${okText} ${result.cards} cards, ${result.reviews} reviews.`,
      });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setSyncing(false);
    }
  }

  async function updateLimit(value: number) {
    const n = Math.min(100, Math.max(1, Math.round(value)));
    setSettings((s) => (s ? { ...s, newLimit: n } : s));
    await setSetting("newLimit", n);
  }

  async function updateMode(mode: StudyMode) {
    setSettings((s) => (s ? { ...s, mode } : s));
    await setSetting("mode", mode);
  }

  async function onExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metastack-progress-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({
      tone: "ok",
      text: `Exported ${data.cardStates.length} card states and ${data.reviews.length} reviews.`,
    });
  }

  async function onImport(file: File) {
    try {
      const result = await importData(await file.text());
      setSettings(await getSettings());
      setMessage({
        tone: "ok",
        text: `Imported ${result.cards} card states and ${result.reviews} reviews.`,
      });
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : "Import failed." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onReset() {
    await resetAll();
    setSettings(await getSettings());
    setConfirmReset(false);
    setMessage({ tone: "ok", text: "Progress cleared. Every card is new again." });
  }

  if (!settings) {
    return <div className="index-card plain h-64 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <Section
        title="Daily new cards"
        description="How many cards you have never seen can enter a session per day. Due reviews are never limited."
      >
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={1}
            max={50}
            value={settings.newLimit}
            onChange={(e) => void updateLimit(Number(e.target.value))}
            className="w-full accent-[var(--red)]"
            aria-label="Daily new card limit"
          />
          <input
            type="number"
            min={1}
            max={100}
            value={settings.newLimit}
            onChange={(e) => void updateLimit(Number(e.target.value))}
            className="h-10 w-20 rounded-lg border border-rule bg-paper px-3 text-center font-mono text-sm"
            aria-label="Daily new card limit (number)"
          />
        </div>
      </Section>

      <Section
        title="Default study mode"
        description="Rubric mode shows key points as checkboxes and suggests a rating from your coverage. Quick mode is flip and rate."
      >
        <div role="radiogroup" className="flex gap-2">
          {(["rubric", "quick"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={settings.mode === m}
              onClick={() => void updateMode(m)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm capitalize",
                settings.mode === m
                  ? "border-ink bg-ink text-bg"
                  : "border-rule text-ink-2 hover:text-ink",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Account"
        description={
          user
            ? `Signed in as ${user.login}. Reviews in this browser are copied to your account after each rating.`
            : "Optional. Sign in with GitHub so progress follows you to another browser."
        }
      >
        <div className="flex flex-wrap gap-3">
          {user ? (
            <>
              <Button variant="outline" onClick={() => void onSync()} disabled={syncing}>
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <a href="/api/auth/logout" className={cn(buttonClass, "hover:bg-paper-2")}>
                Sign out
              </a>
            </>
          ) : (
            <a
              href="/api/auth/github"
              className={cn(buttonClass, "bg-ink text-bg hover:opacity-90")}
            >
              Sign in with GitHub
            </a>
          )}
        </div>
      </Section>

      <Section
        title="Your data"
        description={
          totals
            ? `${totals.learned} cards learned, ${totals.reviews} reviews, stored in this browser. Export to move it, or sign in to keep a server copy.`
            : "Stored in this browser. Export to move it, or sign in to keep a server copy."
        }
      >
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void onExport()}>
            <Download className="h-4 w-4" /> Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Import JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
            }}
          />
          {confirmReset ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-ink-2">Delete all progress?</span>
              <Button variant="primary" size="sm" onClick={() => void onReset()}>
                Yes, delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Keep it
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmReset(true)} className="text-red-ink">
              <Trash2 className="h-4 w-4" /> Reset progress
            </Button>
          )}
        </div>
        {message && (
          <p
            role="status"
            className={cn("mt-4 text-sm", message.tone === "ok" ? "text-green" : "text-red-ink")}
          >
            {message.text}
          </p>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-rule bg-paper p-6">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
