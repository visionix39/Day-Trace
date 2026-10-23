/**
 * App state, in one zustand store: the latest database snapshot, your helper
 * settings, and the note currently being read or reviewed.
 *
 * The flow for a new note:
 *   submit()  -> status "reading"  (the extractor is working)
 *             -> status "review"   (you see the proposal and untick mistakes)
 *   save()    -> written to SQLite, snapshot refreshed, back to "idle"
 */

import { create } from "zustand";
import { localNow, localToday } from "./dates";
import { openDatabase, resetDatabase, saveProposal, setItemDone } from "./db";
import { extract, type Engine } from "./extract";
import { findProvider } from "./extract/providers/catalog";
import type { ProviderId } from "./extract/providers/types";
import type { Proposal } from "./extract/types";
import type { NoteSource, Snapshot } from "./types";

export type HelperId = "offline" | ProviderId;

export interface Settings {
  helper: HelperId;
  models: Record<ProviderId, string>;
  /** Your own keys. Kept in memory only, unless `remember` is on. */
  keys: Record<ProviderId, string>;
  remember: boolean;
}

type Draft =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "review"; proposal: Proposal }
  | { status: "error"; message: string };

interface State {
  phase: "loading" | "ready" | "failed";
  loadError: string | null;
  today: string;
  snapshot: Snapshot | null;
  justDone: Set<string>;
  settings: Settings;
  draft: Draft;

  init: () => Promise<void>;
  submit: (input: { text: string; source: NoteSource; from?: string }) => Promise<void>;
  save: (keep: Set<string>) => Promise<void>;
  discard: () => void;
  toggleDone: (itemId: string) => Promise<void>;
  reset: (withSample: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SETTINGS_KEY = "daytrace.settings";

const DEFAULT_SETTINGS: Settings = {
  helper: "offline",
  models: { anthropic: "claude-opus-5-5", openai: "gpt-6-sol", gemini: "gemini-3.8-flash", ollama: "qwen3:8b" },
  keys: { anthropic: "", openai: "", gemini: "", ollama: "" },
  remember: false,
};

// localStorage can be missing or blocked (private windows), so every access is guarded.
function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
    if (!saved) return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      models: { ...DEFAULT_SETTINGS.models, ...saved.models },
      keys: saved.remember ? { ...DEFAULT_SETTINGS.keys, ...saved.keys } : DEFAULT_SETTINGS.keys,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function storeSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, keys: s.remember ? s.keys : DEFAULT_SETTINGS.keys }));
  } catch {
    // Not being able to remember settings is fine; the app still works.
  }
}

let inFlight: AbortController | null = null;

export const useDesk = create<State>((set, get) => ({
  phase: "loading",
  loadError: null,
  today: localToday(),
  snapshot: null,
  justDone: new Set(),
  settings: DEFAULT_SETTINGS,
  draft: { status: "idle" },

  async init() {
    if (get().snapshot) return;
    const today = localToday();
    set({ today, settings: loadSettings() });
    try {
      set({ snapshot: await openDatabase(today), phase: "ready" });
    } catch (error) {
      set({ phase: "failed", loadError: error instanceof Error ? error.message : String(error) });
    }
  },

  async submit({ text, source, from }) {
    const { snapshot, settings, today } = get();
    if (!snapshot || !text.trim()) return;

    const note = {
      id: `n_${crypto.randomUUID().slice(0, 8)}`,
      captured_at: localNow(),
      source,
      ...(from?.trim() ? { from: from.trim() } : {}),
      text: text.trim(),
    };

    let engine: Engine = { kind: "offline" };
    if (settings.helper !== "offline") {
      const provider = settings.helper;
      const apiKey = settings.keys[provider].trim();
      if (findProvider(provider).keyLabel && !apiKey) {
        set({ draft: { status: "error", message: `Add your ${findProvider(provider).name} key in the helper settings, or switch to Offline.` } });
        return;
      }
      engine = { kind: "ai", provider, model: settings.models[provider].trim(), apiKey };
    }

    inFlight?.abort();
    inFlight = new AbortController();
    set({ draft: { status: "reading" } });
    try {
      const proposal = await extract(note, snapshot, today, engine, inFlight.signal);
      set({ draft: { status: "review", proposal } });
    } catch (error) {
      if ((error as Error)?.name?.includes("Abort")) return;
      set({ draft: { status: "error", message: error instanceof Error ? error.message : String(error) } });
    }
  },

  async save(keep) {
    const { draft } = get();
    if (draft.status !== "review") return;
    set({ snapshot: await saveProposal(draft.proposal, keep), draft: { status: "idle" } });
  },

  discard() {
    inFlight?.abort();
    set({ draft: { status: "idle" } });
  },

  async toggleDone(itemId) {
    const item = get().snapshot?.items.find((i) => i.id === itemId);
    if (!item) return;
    const done = item.status === "open";
    const justDone = new Set(get().justDone);
    if (done) justDone.add(itemId);
    set({ snapshot: await setItemDone(itemId, done), justDone });
  },

  async reset(withSample) {
    set({ snapshot: await resetDatabase(get().today, withSample), justDone: new Set(), draft: { status: "idle" } });
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    storeSettings(settings);
    set({ settings });
  },
}));
