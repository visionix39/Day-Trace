/**
 * App state, in one zustand store: who's signed in, the latest database
 * snapshot, how notes get read, the note being reviewed, today's nudges, the
 * search index, and the one-step undo.
 *
 * Signing in (or choosing "just look around") opens that person's notebook;
 * everything below works the same for both.
 *
 * The flow for a new note:
 *   submit()  -> status "reading"  (the AI or the offline rules are working)
 *             -> status "review"   (you see the proposal and untick mistakes)
 *   save()    -> written to SQLite, snapshot refreshed, back to "idle"
 */

import { create } from "zustand";
import { authEnabled, supabase, toAccount, type Account } from "./auth/supabase";
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

type AuthResult = { ok: true; needsConfirm?: boolean } | { ok: false; message: string };

interface State {
  /** checking = reading a saved session; signed-out = show the welcome page. */
  account: { status: "checking" | "signed-out" | "guest" | "signed-in"; user: Account | null };
  sync: db.SyncStatus;
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
  signUp: (input: { name: string; email: string; password: string }) => Promise<AuthResult>;
  signIn: (input: { email: string; password: string }) => Promise<AuthResult>;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
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
let started = false;

/** Supabase's error messages, said a little more kindly. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Try again?";
  if (/already registered|already exists/i.test(message)) return "There's already an account with that email - try signing in.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first - check your inbox for the link.";
  if (/password/i.test(message) && /at least|short|weak/i.test(message)) return "That password is too short - use at least 8 characters.";
  if (/rate limit|too many/i.test(message)) return "Too many tries - wait a minute and try again.";
  if (/failed to fetch|network|load failed/i.test(message)) return "Couldn't reach the sign-in service. Check your connection and try again.";
  return message;
}

export const useDesk = create<State>((set, get) => {
  /** Runs a database change with an undo point in front of it. */
  async function change(label: string, fn: () => Promise<Snapshot>, extra: Partial<State> = {}) {
    const bytes = db.checkpoint();
    const snapshot = await fn();
    set({ snapshot, undo: { label, bytes }, ...extra });
    void get().loadNudges();
  }

  /** Opens one person's notebook, starting every per-notebook bit of state fresh. */
  async function openFor(owner: db.Owner, account: State["account"]) {
    set({ account, phase: "loading", snapshot: null, justDone: new Set(), undo: null, draft: { status: "idle" }, nudges: { status: "idle", set: null }, index: { status: "idle", vectors: new Map() } });
    try {
      set({ snapshot: await db.openDatabase(get().today, owner), phase: "ready" });
    } catch (error) {
      set({ phase: "failed", loadError: error instanceof Error ? error.message : String(error) });
      return;
    }
    void get().loadNudges();
    void get().indexNotes();
  }

  return {
    account: { status: "checking", user: null },
    sync: "local",
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
      if (started) return;
      started = true;
      set({ today: localToday(), mode: loadMode() });
      db.onSyncStatus((sync) => set({ sync }));

      // No accounts set up on this site: everyone gets a notebook in their browser.
      if (!authEnabled) return openFor({ kind: "guest" }, { status: "guest", user: null });

      // If the session ends elsewhere (signed out in another tab, expired), show the welcome page.
      supabase().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT" && get().account.status === "signed-in") set({ account: { status: "signed-out", user: null }, snapshot: null });
      });
      const { data } = await supabase().auth.getSession();
      if (data.session) await openFor({ kind: "user", id: data.session.user.id }, { status: "signed-in", user: toAccount(data.session.user) });
      else set({ account: { status: "signed-out", user: null } });
    },

    async signUp({ name, email, password }) {
      const { data, error } = await supabase().auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
      if (error) return { ok: false, message: friendly(error.message) };
      // With email confirmation on (Supabase's default), there's no session until the link is clicked.
      if (!data.session || !data.user) return { ok: true, needsConfirm: true };
      await openFor({ kind: "user", id: data.user.id }, { status: "signed-in", user: toAccount(data.user) });
      return { ok: true };
    },

    async signIn({ email, password }) {
      const { data, error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, message: friendly(error.message) };
      await openFor({ kind: "user", id: data.user.id }, { status: "signed-in", user: toAccount(data.user) });
      return { ok: true };
    },

    async continueAsGuest() {
      await openFor({ kind: "guest" }, { status: "guest", user: null });
    },

    async signOut() {
      inFlight?.abort();
      await db.closeDatabase();
      if (authEnabled) await supabase().auth.signOut();
      set({ account: { status: "signed-out", user: null }, snapshot: null, undo: null, draft: { status: "idle" } });
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
