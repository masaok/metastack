/** Address of one card in the study UI. Stable, so a link opens that card. */
export function studyCardPath(id: string): string {
  return `/study/card/${encodeURIComponent(id)}`;
}

export type StudyRoute =
  { kind: "all" } | { kind: "deck"; deck: string } | { kind: "card"; id: string };

export function parseStudyPath(pathname: string): StudyRoute | null {
  if (pathname === "/study") return { kind: "all" };
  const card = /^\/study\/card\/([^/]+)$/.exec(pathname);
  if (card?.[1]) return { kind: "card", id: decodeURIComponent(card[1]) };
  const deck = /^\/study\/([^/]+)$/.exec(pathname);
  if (deck?.[1]) return { kind: "deck", deck: decodeURIComponent(deck[1]) };
  return null;
}
