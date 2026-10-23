/**
 * Turns a database Snapshot into what the screens need: lookups by id, the
 * daily list sorted onto shelves, the beads on each thread. Pure functions -
 * no database, no React - so they're easy to reason about and test.
 */

import { bucketFor, type Bucket } from "./dates";
import type { Item, Snapshot, Thread } from "./types";

/** Items not filed under any thread are shown together as loose ends. */
export const LOOSE: Thread = { id: "_loose", title: "Loose ends", hue: "clay" };

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

export type DeskView = ReturnType<typeof buildView>;

/**
 * @param justDone items ticked off this visit. They stay on the list
 *   (struck through) until you reload, so ticking one doesn't make it vanish
 *   from under your cursor.
 */
export function buildView(snap: Snapshot, today: string, justDone: Set<string>) {
  const threads = snap.items.some((i) => !i.thread) ? [...snap.threads, LOOSE] : snap.threads;
  const personById = byId(snap.people);
  const threadById = byId(threads);
  const itemById = byId(snap.items);
  const noteById = byId(snap.notes);
  const threadOf = (item: Item) => threadById.get(item.thread ?? LOOSE.id) ?? LOOSE;

  /** Open items (and today's ticks) sorted onto shelves, soonest first. */
  function dailyList(): Record<Bucket, Item[]> {
    const shelves: Record<Bucket, Item[]> = { overdue: [], today: [], soon: [], later: [], someday: [] };
    for (const item of snap.items) {
      if (item.kind === "waiting") continue;
      if (item.status === "open" || justDone.has(item.id)) shelves[bucketFor(today, item.due)].push(item);
    }
    for (const shelf of Object.values(shelves)) shelf.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
    return shelves;
  }

  /** A thread's items in the order they first appeared - the beads on the string. */
  function strand(threadId: string) {
    return snap.items
      .filter((i) => (i.thread ?? LOOSE.id) === threadId)
      .map((i) => ({ item: i, since: noteById.get(i.mentions[0]?.note ?? "")?.captured_at ?? today }))
      .sort((a, b) => a.since.localeCompare(b.since));
  }

  return {
    ...snap,
    today,
    threads,
    personById,
    threadById,
    itemById,
    noteById,
    threadOf,
    dailyList,
    strand,
    waitingOn: () => snap.items.filter((i) => i.kind === "waiting" && i.status === "open"),
    linksFor: (itemId: string) => snap.links.filter((l) => l.from === itemId || l.to === itemId),
    isDone: (item: Item) => item.status === "done",
  };
}
