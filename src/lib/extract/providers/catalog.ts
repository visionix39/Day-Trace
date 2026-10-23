/**
 * The helpers you can pick in Settings. Model lists are starting points; the
 * model box accepts any id your account (or your Ollama install) has.
 */

import type { ProviderId } from "./types";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderSpec {
  id: ProviderId;
  name: string;
  blurb: string;
  /** null when no key is needed (Ollama). */
  keyLabel: string | null;
  keyPlaceholder: string;
  keyUrl: string | null;
  models: ModelOption[];
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: "anthropic",
    name: "Claude",
    blurb: "Anthropic. Very good at reading between the lines.",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
    ],
  },
  {
    id: "openai",
    name: "GPT",
    blurb: "OpenAI.",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-6-sol", label: "GPT-6 Sol" },
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    blurb: "Google. Has a free tier.",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
    ],
  },
  {
    id: "ollama",
    name: "Local (Ollama)",
    blurb: "A model running on your own computer. Free and fully private.",
    keyLabel: null,
    keyPlaceholder: "",
    keyUrl: "https://ollama.com/download",
    models: [
      { id: "qwen3:8b", label: "qwen3:8b" },
      { id: "llama3.2", label: "llama3.2" },
    ],
  },
];

export const findProvider = (id: ProviderId) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

/** "Claude Opus 5.5" for a known model, the bare id otherwise. */
export const modelLabel = (provider: ProviderId, model: string) =>
  findProvider(provider).models.find((m) => m.id === model)?.label ?? model;
