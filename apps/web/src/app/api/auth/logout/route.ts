import { siteUrl } from "@/lib/auth/env";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await clearSessionCookie();
  return Response.redirect(siteUrl(request.url), 303);
}

export async function GET(request: Request) {
  await clearSessionCookie();
  return Response.redirect(siteUrl(request.url));
}
