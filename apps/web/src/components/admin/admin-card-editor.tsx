"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CARD_TYPES,
  DECKS,
  TAGS,
  type Card,
  type CardType,
  type DeckSlug,
  type Tag,
} from "@metastack/content";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/sync";
import { cn } from "@/lib/utils";

/** The form's own shape. Lists that are edited as text hold one entry per line. */
interface Draft {
  id: string;
  deck: DeckSlug;
  type: CardType;
  difficulty: number;
  tags: Tag[];
  prompt: string;
  points: Array<{ text: string; eli5: string }>;
  followUps: string;
  references: Array<{ title: string; url: string }>;
  stages: Array<{ name: string; points: string }>;
  body: string;
  reviewed: boolean;
}

const BLANK_POINT = { text: "", eli5: "" };
const BLANK_REFERENCE = { title: "", url: "" };
const BLANK_STAGE = { name: "", points: "" };

function draftFrom(card: Card | undefined): Draft {
  if (!card) {
    return {
      id: "",
      deck: "fundamentals",
      type: "concept",
      difficulty: 1,
      tags: [],
      prompt: "",
      points: [BLANK_POINT, BLANK_POINT, BLANK_POINT],
      followUps: "",
      references: [BLANK_REFERENCE],
      stages: [BLANK_STAGE, BLANK_STAGE, BLANK_STAGE],
      body: "",
      reviewed: false,
    };
  }
  return {
    id: card.id,
    deck: card.deck,
    type: card.type,
    difficulty: card.difficulty,
    tags: [...card.tags],
    prompt: card.prompt.trim(),
    points: card.keyPoints.map((text, i) => ({ text, eli5: card.eli5?.[i] ?? "" })),
    followUps: card.followUps.join("\n"),
    references: card.references.map((reference) => ({ ...reference })),
    stages: card.stages?.map((stage) => ({
      name: stage.name,
      points: stage.keyPoints.join("\n"),
    })) ?? [BLANK_STAGE, BLANK_STAGE, BLANK_STAGE],
    body: card.body,
    reviewed: card.reviewed,
  };
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** What the API validates. Plain-language lines are sent only when any is filled in. */
function payloadFrom(draft: Draft) {
  const eli5 = draft.points.map((point) => point.eli5.trim());
  return {
    id: draft.id.trim(),
    deck: draft.deck,
    type: draft.type,
    difficulty: draft.difficulty,
    tags: draft.tags,
    prompt: draft.prompt.trim(),
    keyPoints: draft.points.map((point) => point.text.trim()),
    ...(eli5.some(Boolean) ? { eli5 } : {}),
    followUps: lines(draft.followUps),
    references: draft.references.map((reference) => ({
      title: reference.title.trim(),
      url: reference.url.trim(),
    })),
    ...(draft.type === "design"
      ? {
          stages: draft.stages.map((stage) => ({
            name: stage.name.trim(),
            keyPoints: lines(stage.points),
          })),
        }
      : {}),
    body: draft.body,
    reviewed: draft.reviewed,
  };
}

const INPUT =
  "w-full rounded-md border border-rule bg-bg px-3 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-rule-strong";

export function AdminCardEditor({
  user,
  card,
  deckOptions,
}: {
  user: SessionUser;
  /** The stored card. Absent when creating one. */
  card?: Card;
  deckOptions: Array<{ slug: string; title: string }>;
}) {
  const router = useRouter();
  const isNew = !card;
  const [draft, setDraft] = useState<Draft>(() => draftFrom(card));
  const [issues, setIssues] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "deleting">("idle");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const busy = status === "saving" || status === "deleting";

  function change(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setStatus("idle");
  }

  function changeRow<K extends "points" | "references" | "stages">(
    key: K,
    index: number,
    patch: Partial<Draft[K][number]>,
  ) {
    change({
      [key]: draft[key].map((row, i) => (i === index ? { ...row, ...patch } : row)),
    } as Partial<Draft>);
  }

  function removeRow(key: "points" | "references" | "stages", index: number) {
    change({ [key]: draft[key].filter((_, i) => i !== index) } as Partial<Draft>);
  }

  function toggleTag(tag: Tag) {
    change({
      tags: draft.tags.includes(tag) ? draft.tags.filter((t) => t !== tag) : [...draft.tags, tag],
    });
  }

  async function remove() {
    if (!card) return;
    setStatus("deleting");
    setIssues([]);
    try {
      const response = await fetch(`/api/admin/cards/${card.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as {
        issues?: string[];
        error?: string;
      } | null;
      if (!response.ok) {
        setIssues(data?.issues ?? [data?.error ?? `The delete failed (${response.status}).`]);
        setStatus("idle");
        setConfirmingDelete(false);
        return;
      }
      router.push("/admin/cards");
      router.refresh();
    } catch {
      setIssues(["The delete did not reach the server. Check your connection and try again."]);
      setStatus("idle");
      setConfirmingDelete(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setIssues([]);
    const payload = payloadFrom(draft);
    try {
      const response = await fetch(isNew ? "/api/admin/cards" : `/api/admin/cards/${card.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        issues?: string[];
        error?: string;
      } | null;
      if (!response.ok) {
        setIssues(data?.issues ?? [data?.error ?? `The save failed (${response.status}).`]);
        setStatus("idle");
        return;
      }
      setStatus("saved");
      if (isNew) router.push(`/admin/cards/${payload.id}`);
      else router.refresh();
    } catch {
      setIssues(["The save did not reach the server. Check your connection and try again."]);
      setStatus("idle");
    }
  }

  return (
    <DashboardShell user={user} deckOptions={deckOptions} active="/admin/cards">
      <form onSubmit={save} className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-paper px-4 py-3">
          <Link
            href="/admin/cards"
            className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Cards
          </Link>
          <h1 className="min-w-0 truncate font-display text-base font-semibold">
            {isNew ? "New card" : card.id}
          </h1>
          <p className="ml-auto text-sm text-ink-3" role="status">
            {status === "saved" ? "Saved" : ""}
          </p>
          <Button type="submit" size="sm" disabled={busy}>
            {status === "saving" ? "Saving" : isNew ? "Create card" : "Save"}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6">
            {issues.length > 0 ? (
              <div
                role="alert"
                className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red-ink"
              >
                <p className="font-medium">That did not go through.</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Group title="Card">
              <Field label="Id" hint={isNew ? "Kebab-case. It cannot change later." : undefined}>
                <input
                  value={draft.id}
                  onChange={(event) => change({ id: event.target.value })}
                  disabled={!isNew}
                  placeholder="cache-aside-pattern"
                  className={cn(INPUT, "font-mono disabled:text-ink-3")}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Deck">
                  <select
                    value={draft.deck}
                    onChange={(event) => change({ deck: event.target.value as DeckSlug })}
                    className={INPUT}
                  >
                    {DECKS.map((deck) => (
                      <option key={deck.slug} value={deck.slug}>
                        {deck.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select
                    value={draft.type}
                    onChange={(event) => change({ type: event.target.value as CardType })}
                    className={INPUT}
                  >
                    {CARD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select
                    value={draft.difficulty}
                    onChange={(event) => change({ difficulty: Number(event.target.value) })}
                    className={INPUT}
                  >
                    <option value={1}>1 · easy</option>
                    <option value={2}>2 · medium</option>
                    <option value={3}>3 · hard</option>
                  </select>
                </Field>
              </div>
              <Field label="Prompt" hint="Phrased the way an interviewer would ask it.">
                <textarea
                  value={draft.prompt}
                  onChange={(event) => change({ prompt: event.target.value })}
                  rows={3}
                  className={INPUT}
                />
              </Field>
              <fieldset>
                <legend className="text-sm font-medium text-ink">Tags</legend>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TAGS.map((tag) => {
                    const on = draft.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs",
                          on
                            ? "border-ink bg-ink text-bg"
                            : "border-rule text-ink-2 hover:border-rule-strong hover:text-ink",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </Group>

            <Group
              title="Key points"
              description="Each point is something a strong answer says. The plain-language line is optional, but fill in all of them or none."
            >
              <ol className="space-y-3">
                {draft.points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 w-4 shrink-0 font-mono text-xs text-ink-3">{i + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <textarea
                        value={point.text}
                        onChange={(event) => changeRow("points", i, { text: event.target.value })}
                        rows={2}
                        aria-label={`Key point ${i + 1}`}
                        placeholder="Key point"
                        className={INPUT}
                      />
                      <textarea
                        value={point.eli5}
                        onChange={(event) => changeRow("points", i, { eli5: event.target.value })}
                        rows={2}
                        aria-label={`Plain-language version of key point ${i + 1}`}
                        placeholder="In plain words"
                        className={cn(INPUT, "text-ink-2")}
                      />
                    </div>
                    <RemoveButton
                      label={`Remove key point ${i + 1}`}
                      onClick={() => removeRow("points", i)}
                    />
                  </li>
                ))}
              </ol>
              <AddButton onClick={() => change({ points: [...draft.points, BLANK_POINT] })}>
                Add a key point
              </AddButton>
            </Group>

            {draft.type === "design" ? (
              <Group
                title="Stages"
                description="Design cards are drilled stage by stage. One key point per line."
              >
                <ol className="space-y-3">
                  {draft.stages.map((stage, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 w-4 shrink-0 font-mono text-xs text-ink-3">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <input
                          value={stage.name}
                          onChange={(event) => changeRow("stages", i, { name: event.target.value })}
                          aria-label={`Stage ${i + 1} name`}
                          placeholder="Stage name"
                          className={INPUT}
                        />
                        <textarea
                          value={stage.points}
                          onChange={(event) =>
                            changeRow("stages", i, { points: event.target.value })
                          }
                          rows={3}
                          aria-label={`Stage ${i + 1} key points`}
                          placeholder="One key point per line"
                          className={INPUT}
                        />
                      </div>
                      <RemoveButton
                        label={`Remove stage ${i + 1}`}
                        onClick={() => removeRow("stages", i)}
                      />
                    </li>
                  ))}
                </ol>
                <AddButton onClick={() => change({ stages: [...draft.stages, BLANK_STAGE] })}>
                  Add a stage
                </AddButton>
              </Group>
            ) : null}

            <Group
              title="Model answer"
              description="Markdown. Mermaid code fences render as diagrams."
            >
              <textarea
                value={draft.body}
                onChange={(event) => change({ body: event.target.value })}
                rows={16}
                aria-label="Model answer"
                className={cn(INPUT, "font-mono")}
              />
            </Group>

            <Group title="Follow-ups" description="Likely follow-up questions, one per line.">
              <textarea
                value={draft.followUps}
                onChange={(event) => change({ followUps: event.target.value })}
                rows={3}
                aria-label="Follow-up questions"
                className={INPUT}
              />
            </Group>

            <Group title="References" description="Public sources. At least one.">
              <ul className="space-y-2">
                {draft.references.map((reference, i) => (
                  <li key={i} className="flex gap-2">
                    <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                      <input
                        value={reference.title}
                        onChange={(event) =>
                          changeRow("references", i, { title: event.target.value })
                        }
                        aria-label={`Reference ${i + 1} title`}
                        placeholder="Title"
                        className={INPUT}
                      />
                      <input
                        value={reference.url}
                        onChange={(event) =>
                          changeRow("references", i, { url: event.target.value })
                        }
                        aria-label={`Reference ${i + 1} URL`}
                        placeholder="https://"
                        type="url"
                        className={INPUT}
                      />
                    </div>
                    <RemoveButton
                      label={`Remove reference ${i + 1}`}
                      onClick={() => removeRow("references", i)}
                    />
                  </li>
                ))}
              </ul>
              <AddButton
                onClick={() => change({ references: [...draft.references, BLANK_REFERENCE] })}
              >
                Add a reference
              </AddButton>
            </Group>

            <Group title="Publishing">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.reviewed}
                  onChange={(event) => change({ reviewed: event.target.checked })}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--red)]"
                />
                <span>
                  <span className="text-sm font-medium text-ink">Published</span>
                  <span className="block text-sm text-ink-2">
                    A published card is on the site and in study sessions. Clear this to take a card
                    off the site without losing anyone&apos;s progress on it.
                  </span>
                </span>
              </label>
              {card?.reviewed ? (
                <p className="text-sm">
                  <Link
                    href={`/cards/${card.id}`}
                    className="text-ink-2 underline underline-offset-4 hover:text-ink"
                  >
                    View the published card
                  </Link>
                </p>
              ) : null}
            </Group>

            {card ? (
              <Group
                title="Delete"
                description="Removes the card from the database for good. To take it off the site and keep it, clear Published instead."
              >
                {confirmingDelete ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm text-ink-2">
                      Delete <span className="font-mono text-ink">{card.id}</span>? This cannot be
                      undone.
                    </p>
                    <Button size="sm" onClick={() => void remove()} disabled={busy}>
                      {status === "deleting" ? "Deleting" : "Yes, delete it"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-ink"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Delete card
                  </Button>
                )}
              </Group>
            ) : null}
          </div>
        </div>
      </form>
    </DashboardShell>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-rule bg-paper">
      <div className="border-b border-rule px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-3">{description}</p> : null}
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {hint ? <span className="ml-2 text-xs text-ink-3">{hint}</span> : null}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"
    >
      <Plus className="h-4 w-4" aria-hidden /> {children}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mt-1 h-8 shrink-0 rounded-md px-2 text-ink-3 hover:bg-paper-2 hover:text-ink"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}
