import "server-only";

import { getSession, type SessionUser } from "@/lib/auth/session";

/** The admin behind an API request, or the response that refuses it. */
export async function adminOrRefusal(): Promise<SessionUser | Response> {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  if (!user.admin) return Response.json({ error: "admin only" }, { status: 403 });
  return user;
}

/** Today as YYYY-MM-DD in UTC, the date a saved card is stamped with. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
