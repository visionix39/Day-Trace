/**
 * "Look back": search across everything you've ever dropped in.
 *
 * It's hybrid retrieval - several weak signals added together, each of which
 * catches what the others miss:
 *
 *   meaning  - embedding similarity ("job hunt" finds the Lumen Labs note)
 *   words    - plain word overlap (exact names, amounts, "boiler")
 *   people   - a name in the question pulls in that person's notes and items
 *   time     - "last week", "in October" filter by when it was written
 *
 * Every result says which signals fired, so you can see *why* it matched.
 */

import type { Item, Note, Snapshot } from "../types";
import { overlap, peopleIn } from "../extract/match";
import { cosine } from "./embed";
import { parseTimeQuery, type TimeRange } from "./time";

export interface SearchHit {
  note: Note;
  score: number;
  reasons: string[];
  items: Item[];
}

export interface SearchResult {
  hits: SearchHit[];
  range: TimeRange | null;
  usedMeaning: boolean;
}

export function search(
  query: string,
  desk: Snapshot,
  today: string,
  vectors: { query: Float32Array | null; notes: Map<string, Float32Array> },
): SearchResult {
  const { range, rest } = parseTimeQuery(query, today);
  const people = peopleIn(rest, desk.people);
  const personIds = new Set(people.map((p) => p.id));
  const usedMeaning = !!vectors.query && vectors.notes.size > 0;

  // Items a note created or touched, to search alongside its text.
  const itemsOf = new Map<string, Item[]>();
  for (const item of desk.items) for (const m of item.mentions) itemsOf.set(m.note, [...(itemsOf.get(m.note) ?? []), item]);

  // Embedding scores bunch together (most notes sit near 0.5), so judge each
  // note against the others for this question: 1 = the closest note, 0 = a
  // typical one. A note counts as "similar meaning" only if it stands out.
  const raw = new Map<string, number>();
  if (vectors.query) for (const [id, v] of vectors.notes) raw.set(id, cosine(vectors.query, v));
  const sorted = [...raw.values()].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const top = sorted.at(-1) ?? 0;
  const meaningOf = (id: string) => {
    const c = raw.get(id);
    return c === undefined || top - median < 0.02 ? 0 : Math.max(0, (c - median) / (top - median));
  };

  const hits: SearchHit[] = [];
  for (const note of desk.notes) {
    const day = note.captured_at.slice(0, 10);
    if (range && (day < range.from || day > range.to)) continue;

    const items = itemsOf.get(note.id) ?? [];
    const haystack = [note.text, note.from ?? "", ...items.map((i) => i.title)].join(" ");
    const reasons: string[] = [];
    let score = 0;

    if (rest) {
      const words = overlap(rest, haystack);
      if (words >= 0.34) reasons.push("same words");
      const meaning = meaningOf(note.id);
      if (meaning >= 0.55) reasons.push("similar meaning");
      const person =
        people.length && (peopleIn(haystack, desk.people).some((p) => personIds.has(p.id)) || items.some((i) => i.people.some((p) => personIds.has(p))));
      if (person) reasons.push(people.map((p) => p.name.split(" ")[0]).join(", "));

      score = usedMeaning ? 0.65 * meaning + 0.35 * words : words;
      if (person) score += 0.35;
      if (score < 0.36 && !person) continue;
    } else {
      // A question that's only a time ("last week") lists everything from then.
      score = 0.5;
    }
    if (range) reasons.push(range.label);
    hits.push({ note, score, reasons, items });
  }

  hits.sort((a, b) => b.score - a.score || b.note.captured_at.localeCompare(a.note.captured_at));
  return { hits: hits.slice(0, 8), range, usedMeaning };
}
