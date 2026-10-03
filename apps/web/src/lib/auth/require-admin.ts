import "server-only";

import { redirect } from "next/navigation";

import { getSession, type SessionUser } from "./session";

/** Every admin page calls this itself; a layout check would not run on each navigation. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/api/auth/github");
  if (!user.admin) redirect("/dashboard");
  return user;
}
