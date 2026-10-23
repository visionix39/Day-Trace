/**
 * GPT via OpenAI's Responses API, from the browser with the visitor's own key.
 * `text.format` with a strict JSON schema is OpenAI's structured outputs.
 */

import OpenAI from "openai";
import { extractionJsonSchema } from "../schema";
import { ProviderError, type ProviderModule } from "./types";

function translate(error: unknown): ProviderError {
  if (error instanceof OpenAI.AuthenticationError) return new ProviderError("OpenAI didn't accept this API key. Check it in the helper settings.", "auth");
  if (error instanceof OpenAI.PermissionDeniedError || error instanceof OpenAI.NotFoundError) {
    return new ProviderError("This key can't use that model. Pick another one.", "model");
  }
  if (error instanceof OpenAI.RateLimitError) return new ProviderError("OpenAI says slow down, or the account is out of credit.", "rate");
  if (error instanceof OpenAI.BadRequestError) return new ProviderError(`OpenAI rejected the request: ${error.message}`, "request");
  if (error instanceof OpenAI.APIConnectionError) {
    // OpenAI hides error details from browsers, so a bad key or empty account
    // can look like a plain connection failure.
    return new ProviderError("Couldn't get an answer from OpenAI. Check your connection, key and billing.", "network");
  }
  if (error instanceof OpenAI.APIError) return new ProviderError(`OpenAI error ${error.status ?? ""}: ${error.message}`.trim(), "other");
  return new ProviderError(error instanceof Error ? error.message : "The GPT request failed.", "other");
}

export const openai: ProviderModule = {
  async extract({ apiKey, model, system, user, signal }) {
    const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
    try {
      const response = await client.responses.create(
        {
          model,
          instructions: system,
          input: user,
          store: false,
          text: { format: { type: "json_schema", name: "extraction", schema: extractionJsonSchema(), strict: true } },
        },
        { signal },
      );
      if (response.status === "incomplete") throw new ProviderError("GPT stopped before finishing its answer.", "other");
      return JSON.parse(response.output_text);
    } catch (error) {
      if (error instanceof ProviderError || error instanceof OpenAI.APIUserAbortError) throw error;
      if (error instanceof SyntaxError) throw new ProviderError("GPT's answer wasn't valid JSON.", "other");
      throw translate(error);
    }
  },
};
