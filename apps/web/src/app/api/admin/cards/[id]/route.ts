import { parseCardInput } from "@/lib/cards/draft";
import { adminOrRefusal, today } from "@/lib/server/admin-api";
import { removeCard, saveCard } from "@/lib/server/cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Replace a stored card. Its id cannot change, because progress is keyed by it. */
export async function PUT(request: Request, { params }: Context) {
  const admin = await adminOrRefusal();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  const parsed = parseCardInput(await request.json().catch(() => null), today());
  if (!parsed.ok) return Response.json({ issues: parsed.issues }, { status: 400 });
  if (parsed.card.id !== id) {
    return Response.json({ issues: ["id: a card's id cannot be changed"] }, { status: 400 });
  }

  const result = await saveCard(parsed.card, "update");
  if (result === "missing") {
    return Response.json({ issues: [`id: no card with the id "${id}"`] }, { status: 404 });
  }
  return Response.json({ card: parsed.card });
}

/** Delete a stored card. */
export async function DELETE(_request: Request, { params }: Context) {
  const admin = await adminOrRefusal();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  if (!(await removeCard(id))) {
    return Response.json({ issues: [`id: no card with the id "${id}"`] }, { status: 404 });
  }
  return Response.json({ deleted: id });
}
