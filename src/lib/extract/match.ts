/**
 * Small text-matching helpers shared by both extractors: recognising people
 * you already know, and judging whether two bits of text are about the same
 * thing. Deliberately simple - word overlap, not meaning. (Matching by
 * meaning is what embeddings will add in the search step.)
 */

import type { Person } from "../types";

const STOP = new Set(
  "a after an and are as at be been before but by can could did do does don't for from get got had has have he her him his i i'm i'll i've if in into is it it's its just me my need needs of on or our she so still that the their them then they this to too up was we were what when will with would you your".split(
    " ",
  ),
);

/** The meaningful words in a piece of text, lower-cased. */
export function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/'s\b/g, "")
      .replace(/[^a-z0-9' ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      // A very light stemmer, so "booked" matches "book" and "links" matches "link".
      .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, "") : w)),
  );
}

/**
 * How much two texts share, from 0 to 1: shared words divided by the smaller
 * text's word count, so a short title fully contained in a long note scores 1.
 */
export function overlap(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim();

/** Every way a person can be written: full name, first name, aliases. */
function namesFor(p: Person): string[] {
  const names = [p.name, ...p.aliases];
  if (p.kind === "person" && !/^(mr|mrs|ms|dr)\b/i.test(p.name)) names.push(p.name.split(" ")[0]);
  return names.map(norm).filter(Boolean);
}

/** The known person a name refers to, if any ("Sarah C." -> Sarah Chen). */
export function findPerson(name: string, people: Person[]): Person | undefined {
  const n = norm(name);
  const exact = people.find((p) => namesFor(p).includes(n));
  if (exact) return exact;
  // "Sarah C." is Sarah Chen - as long as there's only one Sarah.
  const first = n.split(" ")[0];
  const sameFirst = people.filter((p) => p.kind === "person" && norm(p.name).split(" ")[0] === first);
  return sameFirst.length === 1 ? sameFirst[0] : undefined;
}

/** Known people whose name appears as a whole word in the text. */
export function peopleIn(text: string, people: Person[]): Person[] {
  const t = ` ${norm(text)} `;
  return people.filter((p) => namesFor(p).some((n) => n.length > 1 && t.includes(` ${n} `)));
}
