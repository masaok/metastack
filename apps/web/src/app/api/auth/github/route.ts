import { randomBytes } from "node:crypto";

import { authorizeUrl } from "@/lib/auth/github";
import { setOAuthState } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const state = randomBytes(16).toString("hex");
  await setOAuthState(state);
  return Response.redirect(authorizeUrl(state, request.url));
}
