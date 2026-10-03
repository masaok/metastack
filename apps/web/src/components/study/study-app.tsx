"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { cards, cardsForDeck, getCard, getDeck, isDeckSlug, type Card } from "@metastack/content";

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

function singleModel(id: string): SessionModel | null {
  const card = getCard(id);
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
      cards: [...cards],
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
    cards: cardsForDeck(scope),
    title: deck.title,
    scope,
    mode: "queue",
  };
}

function modelFor(route: StudyRoute, generation: number): SessionModel | null {
  if (route.kind === "card") return singleModel(route.id);
  return poolModel(route, generation);
}

function routeIsValid(route: StudyRoute): boolean {
  if (route.kind === "deck") return isDeckSlug(route.deck);
  if (route.kind === "card") return getCard(route.id) !== undefined;
  return true;
}

/**
 * One study session for every `/study` URL. The component stays mounted while
 * the address moves from card to card, so Back restores the previous card.
 */
export function StudyApp() {
  const pathname = usePathname();
  const route = parseStudyPath(pathname);
  const [prevPath, setPrevPath] = useState(pathname);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [model, setModel] = useState<SessionModel | null>(() =>
    route && routeIsValid(route) ? modelFor(route, 1) : null,
  );

  if (!route || !routeIsValid(route)) return null;

  let display = model;
  if (pathname !== prevPath) {
    const keep = route.kind === "card" && model?.mode === "queue" && queueIds.includes(route.id);
    const next = keep
      ? model
      : route.kind === "card"
        ? singleModel(route.id)
        : poolModel(route, (model?.generation ?? 0) + 1);
    setPrevPath(pathname);
    setModel(next);
    if (!keep) setQueueIds(route.kind === "card" ? (next?.cards.map((card) => card.id) ?? []) : []);
    display = next;
  }

  if (!display) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="index-card plain h-[360px] animate-pulse" />
      </div>
    );
  }

  return (
    <StudySessionHost
      model={display}
      activeId={route.kind === "card" ? route.id : undefined}
      queueIds={queueIds}
      onQueue={setQueueIds}
    />
  );
}

function StudySessionHost({
  model,
  activeId,
  queueIds,
  onQueue,
}: {
  model: SessionModel;
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
      title={model.title}
      scope={model.scope}
      activeId={activeId}
      onQueue={onQueue}
    />
  );
}
