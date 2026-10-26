/**
 * One entry point for reading a note: `extract(note, …)` returns a Proposal,
 * whichever reader did the work.
 *
 *  - "ai": the note (plus the relevant context) goes to our /api/extract
 *    route, which asks the free Groq model. If that can't help - no key set
 *    up, the free quota is busy, no connection - the offline rules step in
 *    and the review card says so. You always get an answer.
 *  - "offline": the hand-written rules, entirely in the browser.
 *
 * This file is also the safety net for AI answers: a model can name a thread
 * that doesn't exist, point at an item that's already done, or write a date
 * as "Friday". Everything is checked against your notebook here and anything
 * that doesn't hold up is dropped.
 */

import { authHeader } from "../auth/supabase";
import type { Item, Note, Snapshot } from "../types";
import { buildRequest } from "./context";
import { findPerson } from "./match";
import { extractOffline } from "./offline";
import { Extraction } from "./schema";
import type { PersonRef, Proposal } from "./types";

export type ReadMode = "ai" | "offline";

const FALLBACK: Record<string, string> = {
  no_key: "The AI isn't switched on for this site yet, so the offline rules read this one.",
  rate: "The free AI is busy right now, so the offline rules read this one. Try again in a few minutes.",
};

const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: string | null | undefined): s is string => !!s && /^\d{2}:\d{2}$/.test(s);

/** "openai/gpt-oss-120b" -> "gpt-oss-120b via Groq". */
export const engineLabel = (model: string) => `${model.split("/").pop()} via Groq`;

export async function extract(
  note: Note,
  desk: Snapshot,
  today: string,
  mode: ReadMode,
  opts: { similarity?: (item: Item) => number; signal?: AbortSignal } = {},
): Promise<Proposal> {
  if (mode === "offline") return extractOffline(note, desk);

  let reason = "Couldn't reach the AI, so the offline rules read this one.";
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(buildRequest(note, desk, today, opts.similarity)),
      signal: opts.signal,
    });
    const body = (await res.json().catch(() => ({}))) as { extraction?: unknown; model?: string; error?: string };
    const parsed = Extraction.safeParse(body.extraction);
    if (res.ok && parsed.success) return toProposal(parsed.data, note, desk, engineLabel(body.model ?? "AI"));
    reason = FALLBACK[body.error ?? ""] ?? "The AI's answer didn't come through, so the offline rules read this one.";
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
  }
  return { ...extractOffline(note, desk), notice: reason };
}

/** Turns a checked AI answer into a Proposal, keeping only what's valid. */
export function toProposal(x: Extraction, note: Note, desk: Snapshot, engine: string): Proposal {
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
