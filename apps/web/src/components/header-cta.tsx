"use client";

import { ButtonLink } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

/**
 * Signed-in visitors get Dashboard; everyone else gets Start drilling. Both
 * labels share one grid cell, so the button keeps the wider label's width
 * and nothing shifts when the session resolves.
 */
export function HeaderCta() {
  const user = useSession();
  const signedIn = Boolean(user);

  return (
    <ButtonLink
      href={signedIn ? "/dashboard" : "/study"}
      size="sm"
      className={cn("ml-1", user === undefined && "invisible")}
    >
      <span className="grid justify-items-center">
        <span className={cn("col-start-1 row-start-1", !signedIn && "invisible")}>Dashboard</span>
        <span className={cn("col-start-1 row-start-1", signedIn && "invisible")}>
          <span className="sm:hidden">Drill</span>
          <span className="hidden sm:inline">Start drilling</span>
        </span>
      </span>
    </ButtonLink>
  );
}
