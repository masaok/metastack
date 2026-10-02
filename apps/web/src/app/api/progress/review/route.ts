import type { CardState, ReviewRecord } from "@metastack/srs";

import { getSession } from "@/lib/auth/session";
import { appendReview } from "@/lib/server/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const body = (await request.json()) as { state?: CardState; review?: ReviewRecord };
  if (!body.state?.cardId || !body.review?.cardId) {
    return Response.json({ error: "state and review are required" }, { status: 400 });
  }
  await appendReview(user.id, body.state, body.review);
  return Response.json({ ok: true });
}
