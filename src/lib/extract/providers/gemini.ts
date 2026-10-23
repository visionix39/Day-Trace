/**
 * Gemini via Google's GenAI SDK, from the browser with the visitor's own key.
 * `responseJsonSchema` is Gemini's structured outputs.
 */

import { ApiError, GoogleGenAI } from "@google/genai";
import { extractionJsonSchema } from "../schema";
import { ProviderError, type ProviderModule } from "./types";

function translate(error: unknown): ProviderError {
  if (error instanceof ApiError) {
    // Gemini reports a bad key as a 400 whose message mentions the key.
    if (error.status === 401 || /api key not valid|api_key_invalid/i.test(error.message)) {
      return new ProviderError("Google didn't accept this Gemini key. Check it in the helper settings.", "auth");
    }
    if (error.status === 403 || error.status === 404) return new ProviderError("This key can't use that model. Pick another one.", "model");
    if (error.status === 429) return new ProviderError("Gemini's rate limit or free quota is used up. Try again in a moment.", "rate");
    return new ProviderError(`Gemini error ${error.status}: ${error.message}`, error.status === 400 ? "request" : "other");
  }
  if (error instanceof TypeError) return new ProviderError("Couldn't reach Google. Check your connection.", "network");
  return new ProviderError(error instanceof Error ? error.message : "The Gemini request failed.", "other");
}

export const gemini: ProviderModule = {
  async extract({ apiKey, model, system, user, signal }) {
    try {
      const response = await new GoogleGenAI({ apiKey }).models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseJsonSchema: extractionJsonSchema(),
          abortSignal: signal,
        },
      });
      if (!response.text) throw new ProviderError("Gemini returned an empty answer.", "other");
      return JSON.parse(response.text);
    } catch (error) {
      if (error instanceof ProviderError || (error as Error)?.name === "AbortError") throw error;
      if (error instanceof SyntaxError) throw new ProviderError("Gemini's answer wasn't valid JSON.", "other");
      throw translate(error);
    }
  },
};
