/**
 * One entry point for reading a note: `extract(note, …)` returns a Proposal,
 * whichever helper did the reading.
 *
 * For the AI helpers this is also the safety net. A model can name a thread
 * that doesn't exist, point at an item that's already done, or write a date
 * as "Friday". Everything it says is checked against the database here and
 * anything that doesn't hold up is dropped, so the review card only ever
 * shows changes that can actually be saved.
 */

import type { Note, Snapshot } from "../types";
import { findPerson } from "./match";
import { extractOffline } from "./offline";
import { SYSTEM, userMessage } from "./prompt";
import { extractWith, ProviderError, type ProviderId } from "./providers";
import { modelLabel } from "./providers/catalog";
import { Extraction } from "./schema";
import type { PersonRef, Proposal } from "./types";

export type Engine = { kind: "offline" } | { kind: "ai"; provider: ProviderId; model: string; apiKey: string };

const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: string | null | undefined): s is string => !!s && /^\d{2}:\d{2}$/.test(s);

export async function extract(note: Note, desk: Snapshot, today: string, engine: Engine, signal?: AbortSignal): Promise<Proposal> {
  if (engine.kind === "offline") return extractOffline(note, desk);

  const raw = await extractWith(engine.provider, {
    apiKey: engine.apiKey,
    model: engine.model,
    system: SYSTEM,
    user: userMessage(note, desk, today),
    signal,
  });
  const parsed = Extraction.safeParse(raw);
  if (!parsed.success) throw new ProviderError("The AI's answer didn't match the expected shape. Try again, or pick a stronger model.", "other");
  return toProposal(parsed.data, note, desk, modelLabel(engine.provider, engine.model));
}

/** Turns a checked AI answer into a Proposal, keeping only what's valid. */
function toProposal(x: Extraction, note: Note, desk: Snapshot, engine: string): Proposal {
  const threadIds = new Set(desk.threads.map((t) => t.id));
  const openIds = new Set(desk.items.filter((i) => i.status === "open").map((i) => i.id));
  const allIds = new Set(desk.items.map((i) => i.id));
  const described = new Map(x.people.map((p) => [p.name.toLowerCase(), p]));

  const person = (name: string): PersonRef => {
    const known = findPerson(name, desk.people);
    if (known) return { id: known.id, name: known.name };
    const d = described.get(name.toLowerCase());
    return { name, kind: d?.kind ?? "person", role: d?.role ?? "" };
  };

  const items = x.items.map((i, n) => ({
    key: `new:${n}`,
    kind: i.kind,
    title: i.title.trim(),
    // Dedupe people the model listed twice under different spellings.
    people: [...new Map(i.people.map(person).map((p) => [p.id ?? p.name.toLowerCase(), p])).values()],
    due: isDate(i.due) ? i.due : null,
    time: isTime(i.time) ? i.time : null,
    due_text: i.due_text,
    thread: i.thread_id && threadIds.has(i.thread_id) ? { id: i.thread_id } : i.new_thread_title?.trim() ? { title: i.new_thread_title.trim() } : null,
  }));

  const updates = x.updates
    .filter((u) => openIds.has(u.item_id))
    .map((u, n) => ({ key: `upd:${n}`, item_id: u.item_id, action: u.action, new_due: isDate(u.new_due) ? u.new_due : null, reason: u.reason }));

  const valid = (ref: string) => allIds.has(ref) || (/^new:\d+$/.test(ref) && Number(ref.slice(4)) < items.length);
  const links = x.links
    .filter((l) => valid(l.from) && valid(l.to) && l.from !== l.to)
    .map((l, n) => ({ key: `link:${n}`, ...l }));

  return { note, items, updates, links, engine };
}
