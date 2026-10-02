import type { Metadata } from "next";
import { cards } from "@metastack/content";
import { StudySession } from "@/components/study/session";

export const metadata: Metadata = {
  title: "Study",
  description: "A mixed session of due reviews and new cards across every deck.",
};

export default function StudyAllPage() {
  return <StudySession cards={[...cards]} title="All decks" />;
}
