import type { CardState, ReviewRecord } from "@metastack/srs";

import { exportData, importData, putSettings, setSetting, type ExportFile } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { applyTheme } from "@/lib/theme";

import { mergeProgress } from "./progress/merge";

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  admin: boolean;
}

export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: SessionUser | null };
  return body.user;
}

// One session request per page load. Sign-in and sign-out are full-page
// redirects, so the module (and this cache) starts fresh after either.
let cachedSession: SessionUser | null | undefined;
let inflightSession: Promise<SessionUser | null> | undefined;

/** The cached session without fetching: `undefined` until the first load resolves. */
export function peekSession(): SessionUser | null | undefined {
  return cachedSession;
}

/** The session, fetched at most once per page load. Null when signed out. */
export function loadSession(): Promise<SessionUser | null> {
  if (cachedSession !== undefined) return Promise.resolve(cachedSession);
  inflightSession ??= fetchSession()
    .catch(() => null)
    .then((user) => {
      cachedSession = user;
      return user;
    });
  return inflightSession;
}

export async function pushReview(state: CardState, review: ReviewRecord): Promise<void> {
  const res = await fetch("/api/progress/review", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, review }),
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error("Could not save the review to the server.");
}

/** Sends changed preferences to the account. Signed-out visitors keep them local. */
export async function pushSettings(patch: Partial<Settings>): Promise<void> {
  if (!(await loadSession())) return;
  const res = await fetch("/api/settings", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.status === 401) return;
  if (!res.ok) throw new Error("Could not save the setting to the server.");
}

/**
 * Copies the account's preferences into this browser. Returns null when
 * signed out. The server copy wins: it is what the user set most recently
 * on any device.
 */
export async function pullSettings(): Promise<Partial<Settings> | null> {
  if (!(await loadSession())) return null;
  const res = await fetch("/api/settings", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load settings from the server.");
  const body = (await res.json()) as { settings: Partial<Settings> };
  await putSettings(body.settings);
  if (body.settings.theme) applyTheme(body.settings.theme);
  return body.settings;
}

/** Saves one preference locally and, when signed in, to the account. */
export async function savePreference<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await setSetting(key, value);
  void pushSettings({ [key]: value } as Partial<Settings>).catch(() => undefined);
}

export async function syncProgress(): Promise<{ cards: number; reviews: number } | null> {
  const session = await fetchSession();
  if (!session) return null;
  const remoteRes = await fetch("/api/progress", { credentials: "same-origin" });
  if (!remoteRes.ok) throw new Error("Could not load saved progress.");
  const remote = (await remoteRes.json()) as ExportFile;
  const local = await exportData();
  const merged = mergeProgress(local, remote);
  await importData(JSON.stringify(merged));
  if (merged.settings.theme) applyTheme(merged.settings.theme);
  const put = await fetch("/api/progress", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(merged),
  });
  if (!put.ok) throw new Error("Could not save progress to the server.");
  return { cards: merged.cardStates.length, reviews: merged.reviews.length };
}
