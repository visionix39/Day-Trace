/**
 * Claude, called straight from the browser with the visitor's own key.
 *
 * `dangerouslyAllowBrowser` is the SDK's explicit opt-in for exactly this
 * case: the key belongs to the person using the page, so it's theirs to send
 * to Anthropic, and it never touches any server of ours.
 *
 * `messages.parse` + `betaZodOutputFormat` is structured outputs: Claude is
 * constrained to the Extraction schema and the SDK hands back the parsed,
 * already-validated object.
 */

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Extraction } from "../schema";
import { ProviderError, type ProviderModule } from "./types";

/**
 * Models that support server-side refusal fallbacks: if a safety check
 * declines the request, the API retries it on a suitable model in the same
 * call instead of returning nothing.
 */
const supportsFallbacks = (model: string) => /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/.test(model);

function translate(error: unknown): ProviderError {
  if (error instanceof Anthropic.AuthenticationError) return new ProviderError("Anthropic didn't accept this API key. Check it in the helper settings.", "auth");
  if (error instanceof Anthropic.PermissionDeniedError) return new ProviderError("This key can't use that model. Pick another one.", "model");
  if (error instanceof Anthropic.NotFoundError) return new ProviderError("Anthropic doesn't know that model id. Pick another one.", "model");
  if (error instanceof Anthropic.RateLimitError) return new ProviderError("Anthropic says slow down, or the account is out of credit. Try again in a moment.", "rate");
  if (error instanceof Anthropic.BadRequestError) return new ProviderError(`Anthropic rejected the request: ${error.message}`, "request");
  if (error instanceof Anthropic.APIConnectionError) return new ProviderError("Couldn't reach Anthropic. Check your connection.", "network");
  if (error instanceof Anthropic.APIError) return new ProviderError(`Anthropic error ${error.status ?? ""}: ${error.message}`.trim(), "other");
  return new ProviderError(error instanceof Error ? error.message : "The Claude request failed.", "other");
}

export const anthropic: ProviderModule = {
  async extract({ apiKey, model, system, user, signal }) {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
    try {
      const response = await client.beta.messages.parse(
        {
          model,
          max_tokens: 16000,
          // Thinking is adaptive by default on current models; "medium"
          // effort is plenty for reading a short note.
          output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
          // The system prompt never changes, so it can be cached between notes.
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          ...(supportsFallbacks(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal },
      );
      if (response.stop_reason === "refusal") {
        throw new ProviderError(`Claude declined to read this note${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."}`, "refusal");
      }
      if (response.stop_reason === "max_tokens") throw new ProviderError("Claude ran out of room before finishing. Try a shorter note.", "other");
      if (!response.parsed_output) throw new ProviderError("Claude's answer didn't fit the expected shape.", "other");
      return response.parsed_output;
    } catch (error) {
      if (error instanceof ProviderError || error instanceof Anthropic.APIUserAbortError) throw error;
      throw translate(error);
    }
  },
};
