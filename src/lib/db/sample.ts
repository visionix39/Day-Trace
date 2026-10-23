/**
 * The sample day (Mina's three weeks from data/seed), shaped for the database.
 *
 * The dataset was written around a fixed "today" (its anchor_date). If we
 * loaded it as-is, a month from now everything would look overdue. So every
 * date is slid forward by the same number of days, which makes the anchor
 * land on your real today while keeping all the gaps between events intact.
 */

import inbox from "../../../data/seed/notes.json";
import key from "../../../data/seed/expected.json";
import { addDays, daysBetween } from "../dates";
import type { Snapshot } from "../types";

export function sampleSnapshot(today: string): Snapshot {
  const shift = daysBetween(key.anchor_date, today);
  const move = (iso: string | null) => (iso ? addDays(iso, shift) : null);

  return {
    owner: inbox.owner,
    notes: (inbox.notes as Snapshot["notes"]).map((n) => ({ ...n, captured_at: move(n.captured_at)! })),
    people: key.people as Snapshot["people"],
    threads: key.threads as Snapshot["threads"],
    items: (key.items as Snapshot["items"]).map((i) => ({ ...i, due: move(i.due) })),
    links: key.links as Snapshot["links"],
  };
}
