import type { CardState, ReviewRecord } from "@metastack/srs";

import {
  exportData,
  getStoredSettings,
  getUnsyncedKeys,
  importData,
  putSettings,
  setSetting,
  setUnsyncedKeys,
  type ExportFile,
} from "@/lib/db";
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

// One push at a time, so the server ends on the value the user picked last.
let pushQueue: Promise<void> = Promise.resolve();

/**
 * Sends every unsynced preference to the account. A key stays unsynced after
 * a network or server failure and is retried on the next save or page load.
 * Signed out, there is no account to send to, so the keys are cleared.
 */
export function flushSettings(): Promise<void> {
  pushQueue = pushQueue
    .then(async () => {
      const keys = await getUnsyncedKeys();
      if (keys.length === 0) return;
      if (!(await loadSession())) {
        await setUnsyncedKeys([]);
        return;
      }
      const local = await getStoredSettings();
      const patch: Partial<Settings> = {};
      for (const key of keys) Object.assign(patch, { [key]: local[key] });
      const res = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok && res.status !== 401) return;
      const now = await getStoredSettings();
      const still = await getUnsyncedKeys();
      await setUnsyncedKeys(still.filter((key) => now[key] !== patch[key]));
    })
    .catch(() => undefined);
  return pushQueue;
}

/**
 * Copies the account's preferences into this browser. Returns null when
 * signed out. Keys changed here and not yet confirmed by the server are
 * kept; for every other key the account's copy wins.
 */
export async function pullSettings(): Promise<Partial<Settings> | null> {
  if (!(await loadSession())) return null;
  await flushSettings();
  const res = await fetch("/api/settings", { credentials: "same-origin" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Could not load settings from the server.");
  const body = (await res.json()) as { settings: Partial<Settings> };
  const unsynced = await getUnsyncedKeys();
  const incoming = { ...body.settings };
  for (const key of unsynced) delete incoming[key];
  await putSettings(incoming);
  if (incoming.theme) applyTheme(incoming.theme);
  return incoming;
}

/** Marks preferences as changed here and sends them to the account when signed in. */
export async function pushPreferences(keys: Array<keyof Settings>): Promise<void> {
  await setUnsyncedKeys([...(await getUnsyncedKeys()), ...keys]);
  await flushSettings();
}

/** Saves one preference locally and, when signed in, to the account. */
export async function savePreference<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await setSetting(key, value);
  void pushPreferences([key]);
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
