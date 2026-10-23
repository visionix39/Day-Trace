/**
 * A model running on your own computer through Ollama (ollama.com). The
 * browser talks to Ollama's local server directly, so the note never leaves
 * your machine. Ollama accepts a JSON Schema as `format` and constrains the
 * model to it.
 *
 * Ollama has no official browser SDK, so this is a plain fetch to its REST API.
 */

import { extractionJsonSchema } from "../schema";
import { ProviderError, type ProviderModule } from "./types";

const OLLAMA = "http://localhost:11434";

export const ollama: ProviderModule = {
  async extract({ model, system, user, signal }) {
    let response: Response;
    try {
      response = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: extractionJsonSchema(),
          options: { temperature: 0 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal,
      });
    } catch (error) {
      if ((error as Error)?.name === "AbortError") throw error;
      throw new ProviderError(
        "Couldn't reach Ollama on this computer. Is it running? If this site isn't on localhost, start Ollama with OLLAMA_ORIGINS set to this site's address.",
        "network",
      );
    }
    if (response.status === 404) throw new ProviderError(`Ollama doesn't have "${model}". Run: ollama pull ${model}`, "model");
    if (!response.ok) throw new ProviderError(`Ollama error ${response.status}: ${await response.text()}`, "other");

    const body = (await response.json()) as { message?: { content?: string } };
    try {
      return JSON.parse(body.message?.content ?? "");
    } catch {
      throw new ProviderError("The local model's answer wasn't valid JSON. A larger model usually fixes this.", "other");
    }
  },
};
