import { getSession } from "@/lib/auth/session";
import { loadSettings, upsertSettings } from "@/lib/server/progress";
import { parseSettingsPatch } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  return Response.json({ settings: await loadSettings(user.id) });
}

/** Saves the keys present in the body. Other keys keep their stored value. */
export async function PATCH(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const patch = parseSettingsPatch(await request.json().catch(() => null));
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no valid settings in the body" }, { status: 400 });
  }
  await upsertSettings(user.id, patch);
  return Response.json({ settings: await loadSettings(user.id) });
}
