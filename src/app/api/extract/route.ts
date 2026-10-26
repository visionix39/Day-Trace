/**
 * POST /api/extract - reads one note with the AI.
 *
 * On Vercel this file becomes a small serverless function: it wakes up for a
 * request, uses the app's Groq key (from an environment variable, never sent
 * to the browser) and goes back to sleep. Notes aren't stored or logged here;
 * the answer goes straight back to your browser, which saves it.
 */

import { AiError, aiModel, askForJson } from "@/lib/ai/groq";
import { allow, identify, json, readJson, sameSite } from "@/lib/ai/guard";
import { ExtractRequest } from "@/lib/extract/context";
import { SYSTEM, userMessage } from "@/lib/extract/prompt";
import { Extraction, extractionJsonSchema } from "@/lib/extract/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameSite(req)) return json({ error: "forbidden" }, 403);
  if (!process.env.GROQ_API_KEY) return json({ error: "no_key" }, 503);
  const who = await identify(req);
  if (!allow(who, "extract", who.signedIn ? 30 : 10)) return json({ error: "rate" }, 429);

  let body: ExtractRequest;
  try {
    const parsed = ExtractRequest.safeParse(await readJson(req, 64_000));
    if (!parsed.success) return json({ error: "bad_request" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  try {
    const raw = await askForJson({ system: SYSTEM, user: userMessage(body), schemaName: "extraction", schema: extractionJsonSchema() });
    const extraction = Extraction.safeParse(raw);
    if (!extraction.success) return json({ error: "bad_answer" }, 502);
    return json({ extraction: extraction.data, model: aiModel() });
  } catch (error) {
    const kind = error instanceof AiError ? error.kind : "unavailable";
    return json({ error: kind }, kind === "rate" ? 429 : kind === "no_key" ? 503 : 502);
  }
}
