/**
 * What the browser sends to the server when it asks the AI to read a note.
 *
 * Your notebook lives in the browser, so the server knows nothing about you.
 * Each request carries just enough context: the note, the open items most
 * related to it, the people you know, and your threads. Choosing *which* open
 * items to send is the retrieval step of RAG (retrieval-augmented generation):
 * the more relevant the context, the better the AI links the new note to what
 * you're already tracking.
 *
 * The same zod schema checks the request on the server, so a hand-made request
 * can't smuggle in a 10 MB note or a thousand items.
 */

import { z } from "zod";
import { daysBetween } from "../dates";
import type { Item, Note, Snapshot } from "../types";
import { overlap, peopleIn } from "./match";

const DATE = /^\d{4}-\d{2}-\d{2}/;
const MAX_ITEMS = 40;

export const ExtractRequest = z.object({
  today: z.string().regex(DATE),
  note: z.object({
    captured_at: z.string().regex(DATE),
    source: z.enum(["note", "screenshot", "message"]),
    from: z.string().max(80).nullable(),
    text: z.string().min(1).max(4000),
  }),
  open_items: z
    .array(
      z.object({
        id: z.string().max(40),
        kind: z.enum(["todo", "waiting", "event"]),
        title: z.string().max(200),
        due: z.string().nullable(),
        thread: z.string().max(40).nullable(),
        people: z.array(z.string().max(80)).max(10),
      }),
    )
    .max(MAX_ITEMS),
  people: z.array(z.object({ id: z.string().max(40), name: z.string().max(80), aliases: z.array(z.string().max(80)).max(10), role: z.string().max(120) })).max(150),
  threads: z.array(z.object({ id: z.string().max(40), title: z.string().max(120) })).max(60),
});

export type ExtractRequest = z.infer<typeof ExtractRequest>;

/**
 * Ranks open items by how related they are to the note: shared words, shared
 * people, and recency (things touched lately are more likely to come up
 * again). `similarity`, when the in-browser embedding model is ready, adds
 * "means the same thing" on top of "uses the same words": it scores an item
 * by how close the new note is to the notes that item came from.
 */
export function relevantOpenItems(note: Note, desk: Snapshot, today: string, similarity?: (item: Item) => number) {
  const inNote = new Set(peopleIn(`${note.text} ${note.from ?? ""}`, desk.people).map((p) => p.id));
  const lastTouched = new Map<string, string>();
  const noteDate = new Map(desk.notes.map((n) => [n.id, n.captured_at]));
  for (const i of desk.items) {
    const dates = i.mentions.map((m) => noteDate.get(m.note) ?? "").sort();
    lastTouched.set(i.id, dates.at(-1) ?? "");
  }

  return desk.items
    .filter((i) => i.status === "open")
    .map((item) => {
      const age = lastTouched.get(item.id) ? -daysBetween(today, lastTouched.get(item.id)!) : 99;
      const score =
        overlap(note.text, item.title) +
        (item.people.some((p) => inNote.has(p)) ? 0.5 : 0) +
        (similarity ? similarity(item) : 0) +
        Math.max(0, 0.3 - age * 0.02);
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS)
    .map((r) => r.item);
}

export function buildRequest(note: Note, desk: Snapshot, today: string, similarity?: (item: Item) => number): ExtractRequest {
  const nameOf = new Map(desk.people.map((p) => [p.id, p.name]));
  return {
    today,
    note: { captured_at: note.captured_at, source: note.source, from: note.from ?? null, text: note.text.slice(0, 4000) },
    open_items: relevantOpenItems(note, desk, today, similarity).map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      due: i.due,
      thread: i.thread,
      people: i.people.map((p) => nameOf.get(p) ?? p).slice(0, 10),
    })),
    people: desk.people.slice(0, 150).map((p) => ({ id: p.id, name: p.name, aliases: p.aliases.slice(0, 10), role: p.role })),
    threads: desk.threads.slice(0, 60).map((t) => ({ id: t.id, title: t.title })),
  };
}
