import { parseCardInput } from "@/lib/cards/draft";
import { adminOrRefusal, today } from "@/lib/server/admin-api";
import { saveCard } from "@/lib/server/cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Create a card. The id must not be taken. */
export async function POST(request: Request) {
  const admin = await adminOrRefusal();
  if (admin instanceof Response) return admin;

  const parsed = parseCardInput(await request.json().catch(() => null), today());
  if (!parsed.ok) return Response.json({ issues: parsed.issues }, { status: 400 });

  const result = await saveCard(parsed.card, "create");
  if (result === "exists") {
    return Response.json(
      { issues: [`id: a card with the id "${parsed.card.id}" already exists`] },
      { status: 409 },
    );
  }
  return Response.json({ card: parsed.card }, { status: 201 });
}
