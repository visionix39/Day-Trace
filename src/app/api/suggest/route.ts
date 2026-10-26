/**
 * POST /api/suggest - picks today's few most useful next steps.
 *
 * Same shape as /api/extract: the browser sends a trimmed view of your open
 * items, the AI answers in a fixed JSON shape, nothing is stored here.
 */

import { AiError, aiModel, askForJson } from "@/lib/ai/groq";
import { allow, json, readJson, sameSite } from "@/lib/ai/guard";
import { SUGGEST_SYSTEM, SuggestRequest, Suggestions, suggestionsJsonSchema, suggestUserMessage } from "@/lib/suggest/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameSite(req)) return json({ error: "forbidden" }, 403);
  if (!process.env.GROQ_API_KEY) return json({ error: "no_key" }, 503);
  if (!allow(req, "suggest", 8)) return json({ error: "rate" }, 429);

  let body: SuggestRequest;
  try {
    const parsed = SuggestRequest.safeParse(await readJson(req, 64_000));
    if (!parsed.success) return json({ error: "bad_request" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  try {
    const raw = await askForJson({ system: SUGGEST_SYSTEM, user: suggestUserMessage(body), schemaName: "suggestions", schema: suggestionsJsonSchema() });
    const parsed = Suggestions.safeParse(raw);
    if (!parsed.success) return json({ error: "bad_answer" }, 502);
    const ids = new Set(body.items.map((i) => i.id));
    return json({ suggestions: parsed.data.suggestions.filter((s) => ids.has(s.item_id)).slice(0, 3), model: aiModel() });
  } catch (error) {
    const kind = error instanceof AiError ? error.kind : "unavailable";
    return json({ error: kind }, kind === "rate" ? 429 : kind === "no_key" ? 503 : 502);
  }
}
