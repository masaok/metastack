import { getSession } from "@/lib/auth/session";
import type { ExportFile } from "@/lib/db";
import { loadProgress, replaceProgress } from "@/lib/server/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isExportFile(value: unknown): value is ExportFile {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.app === "metastack" &&
    v.version === 1 &&
    Array.isArray(v.cardStates) &&
    Array.isArray(v.reviews)
  );
}

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  return Response.json(await loadProgress(user.id));
}

export async function PUT(request: Request) {
  const user = await getSession();
  if (!user) return Response.json({ error: "sign in required" }, { status: 401 });
  const body: unknown = await request.json();
  if (!isExportFile(body)) {
    return Response.json({ error: "not a MetaStack export" }, { status: 400 });
  }
  await replaceProgress(user.id, body);
  return Response.json({
    cards: body.cardStates.length,
    reviews: body.reviews.length,
  });
}
