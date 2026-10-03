import { StudyApp } from "@/components/study/study-app";
import { loadCards } from "@/lib/server/cards";

export default async function StudyLayout({ children }: { children: React.ReactNode }) {
  const cards = await loadCards();
  return (
    <>
      <StudyApp cards={cards} />
      {children}
    </>
  );
}
