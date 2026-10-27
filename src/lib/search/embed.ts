/**
 * The main-thread side of the embedding worker: `embed(texts)` returns one
 * vector per text. If the model can't load (offline on first visit, an old
 * browser), search quietly carries on with word matching only.
 */

import type { Item, Note } from "../types";

/** Stored vectors are tagged with this, so changing models re-indexes cleanly. */
export const EMBED_MODEL = "Xenova/bge-small-en-v1.5";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; vectors?: Float32Array[]; error?: string }>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.vectors) job.resolve(event.data.vectors);
      else job.reject(new Error(event.data.error ?? "embedding failed"));
    };
  }
  return worker;
}

/** `kind` matters: questions and the notes they search are embedded slightly differently. */
export function embed(texts: string[], kind: "query" | "doc"): Promise<Float32Array[]> {
  if (!texts.length) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, texts, kind });
  });
}

/** What gets embedded for a note: its text plus the titles of the follow-ups it produced. */
export function docText(note: Note, items: Item[]): string {
  const titles = items.filter((i) => i.mentions.some((m) => m.note === note.id)).map((i) => i.title);
  return [note.text, ...titles].join(". ");
}

/** Cosine similarity. The vectors are already normalised, so it's a dot product. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
