"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { cardsForDeck, getDeck, isDeckSlug, type Card } from "@metastack/content";

import { StudySession } from "@/components/study/session";
import { parseStudyPath, studyCardPath, type StudyRoute } from "@/lib/study-url";

type SessionModel = {
  key: string;
  generation: number;
  entry: string;
  cards: Card[];
  title: string;
  scope: string;
  mode: "queue" | "single";
};

/** Every card the server loaded, with a lookup by id. */
type Bank = { cards: readonly Card[]; byId: ReadonlyMap<string, Card> };

function singleModel(bank: Bank, id: string): SessionModel | null {
  const card = bank.byId.get(id);
  if (!card) return null;
  const deck = getDeck(card.deck);
  return {
    key: `card:${id}`,
    generation: 0,
    entry: `/study/card/${id}`,
    cards: [card],
    title: deck?.title ?? "Study",
    scope: "card",
    mode: "single",
  };
}

function poolModel(
  bank: Bank,
  route: Extract<StudyRoute, { kind: "all" | "deck" }>,
  generation: number,
): SessionModel | null {
  const scope = route.kind === "all" ? "all" : route.deck;
  const entry = route.kind === "all" ? "/study" : `/study/${route.deck}`;
  if (scope === "all") {
    return {
      key: `queue:all:${generation}`,
      generation,
      entry,
      cards: [...bank.cards],
      title: "All decks",
      scope,
      mode: "queue",
    };
  }
  if (!isDeckSlug(scope)) return null;
  const deck = getDeck(scope);
  if (!deck) return null;
  return {
    key: `queue:${scope}:${generation}`,
    generation,
    entry,
    cards: cardsForDeck(bank.cards, scope),
    title: deck.title,
    scope,
    mode: "queue",
  };
}

function modelFor(bank: Bank, route: StudyRoute, generation: number): SessionModel | null {
  if (route.kind === "card") return singleModel(bank, route.id);
  return poolModel(bank, route, generation);
}

function routeIsValid(bank: Bank, route: StudyRoute): boolean {
  if (route.kind === "deck") return isDeckSlug(route.deck);
  if (route.kind === "card") return bank.byId.has(route.id);
  return true;
}

/**
 * One study session for every `/study` URL. The component stays mounted while
 * the address moves from card to card, so Back restores the previous card.
 */
export function StudyApp({ cards }: { cards: readonly Card[] }) {
  const pathname = usePathname();
  const route = parseStudyPath(pathname);
  const bank = useMemo<Bank>(
    () => ({ cards, byId: new Map(cards.map((card) => [card.id, card])) }),
    [cards],
  );
  const [prevPath, setPrevPath] = useState(pathname);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [model, setModel] = useState<SessionModel | null>(() =>
    route && routeIsValid(bank, route) ? modelFor(bank, route, 1) : null,
  );

  if (!route || !routeIsValid(bank, route)) return null;

  let display = model;
  if (pathname !== prevPath) {
    const keep = route.kind === "card" && model?.mode === "queue" && queueIds.includes(route.id);
    const next = keep
      ? model
      : route.kind === "card"
        ? singleModel(bank, route.id)
        : poolModel(bank, route, (model?.generation ?? 0) + 1);
    setPrevPath(pathname);
    setModel(next);
    if (!keep) setQueueIds(route.kind === "card" ? (next?.cards.map((card) => card.id) ?? []) : []);
    display = next;
  }

  if (!display) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:max-w-6xl">
        <div className="index-card h-[360px] animate-pulse" />
      </div>
    );
  }

  return (
    <StudySessionHost
      model={display}
      bank={bank.cards}
      activeId={route.kind === "card" ? route.id : undefined}
      queueIds={queueIds}
      onQueue={setQueueIds}
    />
  );
}

function StudySessionHost({
  model,
  bank,
  activeId,
  queueIds,
  onQueue,
}: {
  model: SessionModel;
  bank: readonly Card[];
  activeId?: string;
  queueIds: string[];
  onQueue: (ids: string[]) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Replace `/study` only after the queue is in state, so the card URL keeps
  // this same session instead of opening the card on its own.
  useEffect(() => {
    const current = parseStudyPath(pathname);
    if (!current || current.kind === "card") return;
    const first = queueIds[0];
    if (!first) return;
    router.replace(studyCardPath(first));
  }, [pathname, queueIds, router]);

  return (
    <StudySession
      key={model.key}
      cards={model.cards}
      bank={bank}
      title={model.title}
      scope={model.scope}
      activeId={activeId}
      onQueue={onQueue}
    />
  );
}
