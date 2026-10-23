/**
 * The contract every AI provider implements. The rest of the app asks for
 * "JSON in the extraction shape" and never branches on vendor.
 */

export type ProviderId = "anthropic" | "openai" | "gemini" | "ollama";

export interface ExtractRequest {
  /** The visitor's own key. Empty for Ollama, which runs on their machine. */
  apiKey: string;
  model: string;
  system: string;
  user: string;
  signal?: AbortSignal;
}

export interface ProviderModule {
  /** Returns the model's answer as parsed JSON (still unchecked). */
  extract: (request: ExtractRequest) => Promise<unknown>;
}

export type ProviderErrorKind = "auth" | "model" | "rate" | "network" | "refusal" | "request" | "other";

/** A provider failure already turned into a sentence someone can act on. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: ProviderErrorKind,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
