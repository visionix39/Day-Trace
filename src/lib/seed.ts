/**
 * Loads the synthetic dataset from data/seed and shapes it for the UI.
 *
 * For now the UI reads the hand-written answer key (expected.json) directly,
 * so you can see what DayTrace should feel like before the AI exists. Once the
 * extractor lands, the same views will read from SQLite instead and this file
 * becomes the thing that seeds the database on first run.
 */

import inbox from "../../data/seed/notes.json";
import key from "../../data/seed/expected.json";
import { bucketFor, type Bucket } from "./dates";
import type { Item, Link, Note, Person, Thread } from "./types";

// JSON imports are typed loosely (strings, not unions), so assert the shapes
// here once. scripts/check-seed.mjs is what actually guarantees them.
export const notes = inbox.notes as Note[];
export const people = key.people as Person[];
export const threads = key.threads as Thread[];
export const items = key.items as Item[];
export const links = key.links as Link[];

/** The fixed "today" the sample data was written around. */
export const today = key.anchor_date;
export const owner = inbox.owner;

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
export const personById = byId(people);
export const threadById = byId(threads);
export const itemById = byId(items);
export const noteById = byId(notes);

/** Open items sorted onto shelves, soonest first within each. */
export function dailyList(): Record<Bucket, Item[]> {
  const shelves: Record<Bucket, Item[]> = { overdue: [], today: [], soon: [], later: [], someday: [] };
  const open = items.filter((i) => i.status === "open" && i.kind !== "waiting");
  for (const item of open) shelves[bucketFor(today, item.due)].push(item);
  for (const shelf of Object.values(shelves)) shelf.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  return shelves;
}

/** Things other people owe you, still open. */
export const waitingOn = () => items.filter((i) => i.kind === "waiting" && i.status === "open");

/**
 * A thread's items in the order they first appeared, each with the date of
 * the note that created it - the beads on the string.
 */
export function strand(threadId: string) {
  return items
    .filter((i) => i.thread === threadId)
    .map((i) => ({ item: i, since: noteById.get(i.mentions[0].note)!.captured_at }))
    .sort((a, b) => a.since.localeCompare(b.since));
}

/** Links that touch an item, from its point of view. */
export const linksFor = (itemId: string) => links.filter((l) => l.from === itemId || l.to === itemId);
