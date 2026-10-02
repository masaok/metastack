import { siteUrl } from "@/lib/auth/env";
import { exchangeCode } from "@/lib/auth/github";
import { setSessionCookie, takeOAuthState } from "@/lib/auth/session";
import { upsertUser } from "@/lib/server/progress";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteUrl(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = await takeOAuthState();
  if (!code || !state || !expected || state !== expected) {
    return Response.redirect(`${origin}/settings?auth=denied`);
  }
  try {
    const user = await exchangeCode(code, request.url);
    await upsertUser(user);
    await setSessionCookie(user);
    return Response.redirect(`${origin}/dashboard?auth=ok`);
  } catch {
    return Response.redirect(`${origin}/settings?auth=error`);
  }
}
