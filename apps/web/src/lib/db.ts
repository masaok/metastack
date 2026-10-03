"use client";

import Dexie, { type EntityTable } from "dexie";

import { dayKey, type CardState, type ReviewRecord } from "@metastack/srs";

import {
  DEFAULT_SETTINGS,
  isNewLimit,
  isStudyMode,
  isTheme,
  SETTING_KEYS,
  type Settings,
} from "./settings";

export { DEFAULT_SETTINGS } from "./settings";
export type { Settings, StudyMode, Theme } from "./settings";

interface SettingRow {
  key: string;
  value: unknown;
}

export interface StoredReview extends ReviewRecord {
  id?: number;
}

/** Shape of the JSON produced by `exportData` and accepted by `importData`. */
export interface ExportFile {
  app: "metastack";
  version: 1;
  exportedAt: string;
  cardStates: CardState[];
  reviews: ReviewRecord[];
  settings: Partial<Settings>;
}

class MetaStackDB extends Dexie {
  cardStates!: EntityTable<CardState, "cardId">;
  reviews!: EntityTable<StoredReview, "id">;
  settings!: EntityTable<SettingRow, "key">;

  constructor() {
    super("metastack");
    this.version(1).stores({
      cardStates: "cardId, due, state",
      reviews: "++id, cardId, reviewedAt, previousState",
      settings: "key",
    });
  }
}

let instance: MetaStackDB | null = null;

/** Lazily constructed so importing this module on the server is harmless. */
export function db(): MetaStackDB {
  if (!instance) instance = new MetaStackDB();
  return instance;
}

/** Only the settings the user has set. Defaults are left out so a sync cannot overwrite another device with them. */
export async function getStoredSettings(): Promise<Partial<Settings>> {
  const rows = await db().settings.toArray();
  const out: Partial<Settings> = {};
  for (const row of rows) {
    if (row.key === "newLimit" && isNewLimit(row.value)) out.newLimit = row.value;
    if (row.key === "mode" && isStudyMode(row.value)) out.mode = row.value;
    if (row.key === "theme" && isTheme(row.value)) out.theme = row.value;
  }
  return out;
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getStoredSettings()) };
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db().settings.put({ key, value });
}

const UNSYNCED_ROW = "unsynced";

/** Preference keys changed here that the account has not confirmed yet. */
export async function getUnsyncedKeys(): Promise<Array<keyof Settings>> {
  const row = await db().settings.get(UNSYNCED_ROW);
  if (!Array.isArray(row?.value)) return [];
  return SETTING_KEYS.filter((key) => (row.value as unknown[]).includes(key));
}

export async function setUnsyncedKeys(keys: Array<keyof Settings>) {
  await db().settings.put({ key: UNSYNCED_ROW, value: [...new Set(keys)] });
}

/** Writes every key present in the patch. Used when the server copy arrives. */
export async function putSettings(patch: Partial<Settings>) {
  const rows = SETTING_KEYS.filter((key) => patch[key] !== undefined).map((key) => ({
    key,
    value: patch[key],
  }));
  if (rows.length) await db().settings.bulkPut(rows);
}

/** How many cards were studied for the first time today (local calendar day). */
export async function countNewIntroducedToday(now = new Date()): Promise<number> {
  const today = dayKey(now);
  const rows = await db().reviews.where("previousState").equals("new").toArray();
  const seen = new Set<string>();
  for (const r of rows) {
    if (dayKey(r.reviewedAt) === today) seen.add(r.cardId);
  }
  return seen.size;
}

export async function saveReview(state: CardState, review: ReviewRecord) {
  const d = db();
  await d.transaction("rw", d.cardStates, d.reviews, async () => {
    await d.cardStates.put(state);
    await d.reviews.add(review);
  });
}

export async function exportData(): Promise<ExportFile> {
  const d = db();
  const [cardStates, reviews, settings] = await Promise.all([
    d.cardStates.toArray(),
    d.reviews.toArray(),
    getStoredSettings(),
  ]);
  return {
    app: "metastack",
    version: 1,
    exportedAt: new Date().toISOString(),
    cardStates,
    reviews: reviews.map((r) => ({
      cardId: r.cardId,
      rating: r.rating,
      previousState: r.previousState,
      reviewedAt: r.reviewedAt,
      scheduledDays: r.scheduledDays,
    })),
    settings,
  };
}

function isExportFile(value: unknown): value is ExportFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "metastack" &&
    v.version === 1 &&
    Array.isArray(v.cardStates) &&
    Array.isArray(v.reviews)
  );
}

/** Replaces all local progress with the contents of an export file. */
export async function importData(json: string): Promise<{ cards: number; reviews: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!isExportFile(parsed)) {
    throw new Error("That file is not a MetaStack export.");
  }
  const d = db();
  await d.transaction("rw", d.cardStates, d.reviews, d.settings, async () => {
    await d.cardStates.clear();
    await d.reviews.clear();
    await d.cardStates.bulkPut(parsed.cardStates);
    await d.reviews.bulkAdd(parsed.reviews);
    await putSettings(parsed.settings ?? {});
  });
  return { cards: parsed.cardStates.length, reviews: parsed.reviews.length };
}

export async function resetAll() {
  const d = db();
  await d.transaction("rw", d.cardStates, d.reviews, d.settings, async () => {
    await d.cardStates.clear();
    await d.reviews.clear();
    await d.settings.clear();
  });
}
