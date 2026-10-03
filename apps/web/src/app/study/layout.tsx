import { StudyApp } from "@/components/study/study-app";

export default function StudyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudyApp />
      {children}
    </>
  );
}
