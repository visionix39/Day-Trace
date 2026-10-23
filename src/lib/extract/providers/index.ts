/**
 * Provider dispatch. Each vendor SDK is loaded the first time it's used, so
 * someone who only uses Gemini never downloads the Claude or OpenAI clients.
 */

import type { ExtractRequest, ProviderId, ProviderModule } from "./types";

const LOADERS: Record<ProviderId, () => Promise<ProviderModule>> = {
  anthropic: () => import("./anthropic").then((m) => m.anthropic),
  openai: () => import("./openai").then((m) => m.openai),
  gemini: () => import("./gemini").then((m) => m.gemini),
  ollama: () => import("./ollama").then((m) => m.ollama),
};

export async function extractWith(provider: ProviderId, request: ExtractRequest): Promise<unknown> {
  const module = await LOADERS[provider]();
  return module.extract(request);
}

export { ProviderError } from "./types";
export type { ProviderId } from "./types";
