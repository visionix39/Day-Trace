/**
 * The one place DayTrace talks to an AI: Groq, on its free tier.
 *
 * This file only ever runs on the server (the /api routes) or in the scoring
 * script on your machine - never in the browser - because it reads the API
 * key from an environment variable. Visitors use the app's key without ever
 * seeing it.
 *
 * Groq speaks the same API as OpenAI, so we use OpenAI's official SDK pointed
 * at Groq's address. The model is told to answer in an exact JSON Schema
 * ("structured outputs", strict mode), so the reply always has the right shape.
 */

import OpenAI from "openai";

export const DEFAULT_MODEL = "openai/gpt-oss-120b";

export type AiErrorKind = "no_key" | "rate" | "unavailable" | "bad_answer";

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: AiErrorKind,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export const aiModel = () => process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

export async function askForJson(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  apiKey?: string;
}): Promise<unknown> {
  const apiKey = opts.apiKey ?? process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new AiError("No GROQ_API_KEY is set on the server.", "no_key");

  const client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1", maxRetries: 1, timeout: 45_000 });
  try {
    const response = await client.chat.completions.create({
      model: aiModel(),
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName, strict: true, schema: opts.schema } },
    });
    const text = response.choices[0]?.message?.content;
    if (!text) throw new AiError("The AI returned an empty answer.", "bad_answer");
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AiError) throw error;
    if (error instanceof SyntaxError) throw new AiError("The AI's answer wasn't valid JSON.", "bad_answer");
    if (error instanceof OpenAI.RateLimitError) throw new AiError("The free AI quota is used up for the moment.", "rate");
    if (error instanceof OpenAI.AuthenticationError) throw new AiError("The server's Groq key was rejected.", "no_key");
    if (error instanceof OpenAI.BadRequestError) throw new AiError(`The AI rejected the request: ${error.message}`, "bad_answer");
    throw new AiError(error instanceof Error ? error.message : "The AI request failed.", "unavailable");
  }
}
