import { frontMatterSchema, MIN_BODY_LENGTH, toCard, type Card } from "@metastack/content";

export type CardInputResult = { ok: true; card: Card } | { ok: false; issues: string[] };

/**
 * Validate a card sent by the admin editor against the same schema the
 * Markdown cards pass. `updated` is the day of the save, never the client's value.
 */
export function parseCardInput(input: unknown, today: string): CardInputResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, issues: ["the body must be a JSON object"] };
  }
  const { body, ...fields } = input as Record<string, unknown>;
  const issues: string[] = [];

  const parsed = frontMatterSchema.safeParse({ ...fields, updated: today });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }

  const answer = typeof body === "string" ? body.trim() : "";
  if (answer.length < MIN_BODY_LENGTH) {
    issues.push(`body: the model answer is too short (min ${MIN_BODY_LENGTH} characters)`);
  }

  if (!parsed.success || issues.length > 0) return { ok: false, issues };
  return { ok: true, card: toCard(parsed.data, answer) };
}
