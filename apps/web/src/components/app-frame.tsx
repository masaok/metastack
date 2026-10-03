"use client";

import { usePathname } from "next/navigation";

import { PreferencesSync } from "@/components/preferences-sync";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
    return (
      <div id="main" className="fixed inset-0 overflow-hidden">
        <PreferencesSync />
        {children}
      </div>
    );
  }
  return (
    <>
      <PreferencesSync />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
