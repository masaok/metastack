"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/dashboard")) {
    return (
      <div id="main" className="fixed inset-0 overflow-hidden">
        {children}
      </div>
    );
  }
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
