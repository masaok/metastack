import type { CardState, ReviewRecord } from "@metastack/srs";

import { exportData, importData, type ExportFile } from "@/lib/db";

import { mergeProgress } from "./progress/merge";

export interface SessionUser {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function fetchSession(): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: SessionUser | null };
  return body.user;
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

export async function syncProgress(): Promise<{ cards: number; reviews: number } | null> {
  const session = await fetchSession();
  if (!session) return null;
  const remoteRes = await fetch("/api/progress", { credentials: "same-origin" });
  if (!remoteRes.ok) throw new Error("Could not load saved progress.");
  const remote = (await remoteRes.json()) as ExportFile;
  const local = await exportData();
  const merged = mergeProgress(local, remote);
  await importData(JSON.stringify(merged));
  const put = await fetch("/api/progress", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(merged),
  });
  if (!put.ok) throw new Error("Could not save progress to the server.");
  return { cards: merged.cardStates.length, reviews: merged.reviews.length };
}
