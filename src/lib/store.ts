/**
 * App state, in one zustand store: the latest database snapshot, how notes
 * get read, the note being reviewed, today's nudges, the search index, and
 * the one-step undo.
 *
 * The flow for a new note:
 *   submit()  -> status "reading"  (the AI or the offline rules are working)
 *             -> status "review"   (you see the proposal and untick mistakes)
 *   save()    -> written to SQLite, snapshot refreshed, back to "idle"
 */

import { create } from "zustand";
import { localNow, localToday } from "./dates";
import * as db from "./db";
import { extract, type ReadMode } from "./extract";
import type { Proposal } from "./extract/types";
import { cosine, docText, embed, EMBED_MODEL } from "./search/embed";
import { getNudges, type NudgeSet } from "./suggest";
import type { Item, NoteSource, Snapshot } from "./types";

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
  mode: ReadMode;
  draft: Draft;
  /** The last change, kept so it can be taken back. */
  undo: { label: string; bytes: Uint8Array } | null;
  nudges: { status: "idle" | "loading" | "ready"; set: NudgeSet | null };
  /** In-browser embeddings for search: one vector per note. */
  index: { status: "idle" | "loading" | "ready" | "unavailable"; vectors: Map<string, Float32Array> };

  init: () => Promise<void>;
  setMode: (mode: ReadMode) => void;
  submit: (input: { text: string; source: NoteSource; from?: string }) => Promise<void>;
  save: (keep: Set<string>) => Promise<void>;
  discard: () => void;
  toggleDone: (itemId: string) => Promise<void>;
  editItem: (itemId: string, patch: { title?: string; due?: string | null }) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  takeBack: () => Promise<void>;
  dismissUndo: () => void;
  reset: (withSample: boolean) => Promise<void>;
  loadNudges: (force?: boolean) => Promise<void>;
  indexNotes: () => Promise<void>;
  queryVector: (query: string) => Promise<Float32Array | null>;
}

const MODE_KEY = "daytrace.mode";

// localStorage can be missing or blocked (private windows), so every access is guarded.
function loadMode(): ReadMode {
  try {
    return localStorage.getItem(MODE_KEY) === "offline" ? "offline" : "ai";
  } catch {
    return "ai";
  }
}

let inFlight: AbortController | null = null;

export const useDesk = create<State>((set, get) => {
  /** Runs a database change with an undo point in front of it. */
  async function change(label: string, fn: () => Promise<Snapshot>, extra: Partial<State> = {}) {
    const bytes = db.checkpoint();
    const snapshot = await fn();
    set({ snapshot, undo: { label, bytes }, ...extra });
    void get().loadNudges();
  }

  return {
    phase: "loading",
    loadError: null,
    today: localToday(),
    snapshot: null,
    justDone: new Set(),
    mode: "ai",
    draft: { status: "idle" },
    undo: null,
    nudges: { status: "idle", set: null },
    index: { status: "idle", vectors: new Map() },

    async init() {
      if (get().snapshot) return;
      const today = localToday();
      set({ today, mode: loadMode() });
      try {
        set({ snapshot: await db.openDatabase(today), phase: "ready" });
      } catch (error) {
        set({ phase: "failed", loadError: error instanceof Error ? error.message : String(error) });
        return;
      }
      void get().loadNudges();
      void get().indexNotes();
    },

    setMode(mode) {
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch {
        // Not remembering the choice is fine.
      }
      set({ mode });
      void get().loadNudges();
    },

    async submit({ text, source, from }) {
      const { snapshot, mode, today, index } = get();
      if (!snapshot || !text.trim()) return;

      const note = {
        id: `n_${crypto.randomUUID().slice(0, 8)}`,
        captured_at: localNow(),
        source,
        ...(from?.trim() ? { from: from.trim() } : {}),
        text: text.trim(),
      };

      inFlight?.abort();
      inFlight = new AbortController();
      set({ draft: { status: "reading" } });

      // If search is ready, use meaning too when choosing which open items to
      // show the AI: an item scores by how close this note is to its notes.
      let similarity: ((item: Item) => number) | undefined;
      if (mode === "ai" && index.status === "ready") {
        try {
          const [v] = await embed([note.text], "doc");
          // bge scores cluster around 0.5; stretch the useful top end.
          const near = (noteId: string) => (index.vectors.get(noteId) ? Math.max(0, (cosine(v, index.vectors.get(noteId)!) - 0.55) * 3) : 0);
          similarity = (item) => Math.max(0, ...item.mentions.map((m) => near(m.note)));
        } catch {
          // Word matching alone is fine.
        }
      }

      try {
        const proposal = await extract(note, snapshot, today, mode, { similarity, signal: inFlight.signal });
        set({ draft: { status: "review", proposal } });
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        set({ draft: { status: "error", message: error instanceof Error ? error.message : String(error) } });
      }
    },

    async save(keep) {
      const { draft } = get();
      if (draft.status !== "review") return;
      await change("Note saved", () => db.saveProposal(draft.proposal, keep), { draft: { status: "idle" } });
      void get().indexNotes();
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
      await change(done ? "Ticked off" : "Back on the list", () => db.setItemDone(itemId, done), { justDone });
    },

    async editItem(itemId, patch) {
      await change("Item updated", () => db.updateItem(itemId, patch));
    },

    async removeItem(itemId) {
      await change("Item removed", () => db.deleteItem(itemId));
    },

    async takeBack() {
      const { undo } = get();
      if (!undo) return;
      set({ snapshot: await db.restore(undo.bytes), undo: null, justDone: new Set() });
      void get().loadNudges();
    },

    dismissUndo() {
      set({ undo: null });
    },

    async reset(withSample) {
      await change(withSample ? "Sample day restored" : "Notebook cleared", () => db.resetDatabase(get().today, withSample), {
        justDone: new Set(),
        draft: { status: "idle" },
        index: { status: get().index.status === "unavailable" ? "unavailable" : "idle", vectors: new Map() },
      });
      void get().indexNotes();
    },

    async loadNudges(force = false) {
      const { snapshot, today, mode } = get();
      if (!snapshot) return;
      set({ nudges: { status: "loading", set: get().nudges.set } });
      const result = await getNudges(snapshot, today, mode, force);
      set({ nudges: { status: "ready", set: result } });
    },

    /** Embeds any notes that don't have a vector yet (all of them, the first time). */
    async indexNotes() {
      const { snapshot, index } = get();
      if (!snapshot || index.status === "loading" || index.status === "unavailable") return;
      const vectors = index.vectors.size ? new Map(index.vectors) : db.readEmbeddings(EMBED_MODEL);
      const missing = snapshot.notes.filter((n) => !vectors.has(n.id));
      if (!missing.length) {
        set({ index: { status: "ready", vectors } });
        return;
      }
      set({ index: { status: "loading", vectors } });
      try {
        const fresh = await embed(missing.map((n) => docText(n, snapshot.items)), "doc");
        const added = new Map(missing.map((n, i) => [n.id, fresh[i]]));
        await db.saveEmbeddings(EMBED_MODEL, added);
        set({ index: { status: "ready", vectors: new Map([...vectors, ...added]) } });
      } catch {
        // No model (offline first visit, old browser): search uses words only.
        set({ index: { status: "unavailable", vectors } });
      }
    },

    async queryVector(query) {
      if (get().index.status !== "ready") return null;
      try {
        return (await embed([query], "query"))[0];
      } catch {
        return null;
      }
    },
  };
});
