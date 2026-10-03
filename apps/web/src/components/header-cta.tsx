"use client";

import { ButtonLink } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

/** Signed-in visitors get Dashboard; everyone else gets Start drilling. */
export function HeaderCta() {
  const user = useSession();
  const loading = user === undefined;
  const href = user ? "/dashboard" : "/study";

  return (
    <ButtonLink
      href={href}
      size="sm"
      className={loading ? "invisible ml-1" : "ml-1"}
      aria-hidden={loading || undefined}
      tabIndex={loading ? -1 : undefined}
    >
      {user ? (
        "Dashboard"
      ) : (
        <>
          <span className="sm:hidden">Drill</span>
          <span className="hidden sm:inline">Start drilling</span>
        </>
      )}
    </ButtonLink>
  );
}
