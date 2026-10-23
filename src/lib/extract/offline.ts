/**
 * The offline extractor: hand-written rules, no AI, no key, nothing leaves
 * the browser.
 *
 * It exists for two reasons. You can try DayTrace straight away without an
 * API key, and it's a *baseline*: the simple approach any AI version has to
 * beat. It works sentence by sentence, looking for signal words ("need to",
 * "waiting on", "sent", "booked"), date phrases ("by Friday", "the 24th")
 * and names it already knows. It gets the easy cases right and misses
 * anything that needs real understanding - which is exactly the point.
 */

import { addDays, dayOfWeek, daysBetween, endOfMonth } from "../dates";
import type { Item, ItemKind, Note, Person, Snapshot } from "../types";
import { findPerson, overlap, peopleIn, words } from "./match";
import type { PersonRef, Proposal, ProposedItem, ProposedLink, ProposedUpdate, ThreadRef } from "./types";

// ------------------------------------------------------------------ dates

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1 };
const MONTH_RX = "(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\\.?";
// Spelled out so "month" isn't read as "mon".
const WEEKDAY_RX =
  /\b(?:(next|this|by|on|until)\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/;

const pad = (n: number) => String(n).padStart(2, "0");

/** A day-of-month in `from`'s month, or next month's if that day has passed. */
function nextDayOfMonth(from: string, day: number): string {
  const [y, m] = from.split("-").map(Number);
  const here = `${y}-${pad(m)}-${pad(day)}`;
  if (daysBetween(from, here) >= 0) return here;
  return m === 12 ? `${y + 1}-01-${pad(day)}` : `${y}-${pad(m + 1)}-${pad(day)}`;
}

/** A month + day, in `from`'s year unless that's well in the past. */
function monthDay(from: string, month: number, day: number): string {
  const y = Number(from.slice(0, 4));
  const date = `${y}-${pad(month + 1)}-${pad(day)}`;
  return daysBetween(from, date) < -60 ? `${y + 1}-${pad(month + 1)}-${pad(day)}` : date;
}

/**
 * Finds the first date phrase in `text` and turns it into 'YYYY-MM-DD',
 * counting from `from` (the day the note was written, not today).
 */
export function parseDate(text: string, from: string): { due: string; due_text: string } | null {
  const t = text.toLowerCase();
  const hit = (rx: RegExp) => t.match(rx);
  let m: RegExpMatchArray | null;

  if ((m = hit(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return { due: m[0], due_text: m[0] };
  if ((m = hit(new RegExp(`\\b${MONTH_RX}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    return { due: monthDay(from, MONTHS.indexOf(m[1].slice(0, 3)), Number(m[2])), due_text: m[0] };
  }
  if ((m = hit(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RX}`)))) {
    return { due: monthDay(from, MONTHS.indexOf(m[2].slice(0, 3)), Number(m[1])), due_text: m[0] };
  }
  if ((m = hit(/\b(today|tonight|this (?:morning|afternoon|evening))\b/))) return { due: from, due_text: m[0] };
  if ((m = hit(/\btomorrow\b/))) return { due: addDays(from, 1), due_text: m[0] };
  // "the 24th" before weekdays, so "Sat the 24th" means the 24th.
  if ((m = hit(/\bthe (\d{1,2})(?:st|nd|rd|th)\b/))) return { due: nextDayOfMonth(from, Number(m[1])), due_text: m[0] };
  if ((m = hit(WEEKDAY_RX))) {
    let diff = (WEEKDAYS.indexOf(m[2].slice(0, 3)) - dayOfWeek(from) + 7) % 7 || 7;
    // "next Tuesday" is the coming one; only "next week" pushes it a week on.
    if (/next week/.test(t)) diff += diff < 7 ? 7 : 0;
    return { due: addDays(from, diff), due_text: m[0] };
  }
  if ((m = hit(/\b(end of (?:the )?month|this month|month end)\b/))) return { due: endOfMonth(from), due_text: m[0] };
  if ((m = hit(/\b(?:in|within) (\d+|one|two|three|four|five|six|a) (day|week)s?\b/))) {
    const n = Number(m[1]) || NUMBERS[m[1]];
    return { due: addDays(from, m[2] === "week" ? n * 7 : n), due_text: m[0] };
  }
  if ((m = hit(/\bnext week\b/))) return { due: addDays(from, 7), due_text: m[0] };
  return null;
}

/** "9:30am" -> "09:30", "7pm" -> "19:00". */
function parseTime(text: string): string | null {
  const m = text.toLowerCase().match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3] === "pm" ? 12 : 0);
  return `${pad(h)}:${m[2] ?? "00"}`;
}

// ------------------------------------------------------------- sentences

/** First-person "I did it": a sentence that starts with a done verb, or says something went well. */
const DONE = /^(?:\W*)(?:just |finally )?(sent|paid|booked|emailed|texted|called|replied|submitted|renewed|cancell?ed|finished|done|bought|ordered|signed)\b|✅|\b(?:is|was|'s|are) (?:now )?(?:booked|paid|sent|done|sorted|confirmed)\b|\bwent (?:well|fine|ok|great)\b/i;
/** Someone else owes you. "I'll…" only counts in a message, where "I" is them. */
const WAITING = /\b(waiting (?:on|for)|get back (?:to|within|by|in)|hear(?:d)? back|will (?:send|reply|get back|confirm|let me know)|on (?:her|him|them) now|needs? (?:sign-off|approval|a yes)|it'?s on (?:her|him|them))\b/i;
const WAITING_IN_MESSAGE = /\bi'?ll (?:get|send|book|let|confirm|reply|sort|handle|bring|pick up|call|text|email|ask|do|take)\b/i;
const EVENT = /\b(appointment|dinner|lunch|breakfast|meeting|call|visit|party|flight|interview|wedding|dentist|doctor)\b/i;
/** You owe something: an obligation phrase anywhere, or a to-do verb leading the sentence. */
const TODO = /\b(need to|needs to|have to|has to|must|should|remember to|don'?t forget to|remind me|can you|could you|did you|i owe|i'?ll|follow up|keep meaning to|do it|wants? (?:a|an|the|me to)|asked (?:me|for))\b/i;
const IMPERATIVE = /^(?:\W*)(renew|cancel|pay|book|reply|email|text|call(?! with)|send|buy|get|handle|start|finish|tell|ask|follow up|pick up|check|order|sign)\b/i;
/** A direct question asking you to do something. */
const ASK = /\b(?:can|could|did|would) you\b/i;
const FILLER = /^(?:don'?t forget like|fingers crossed|lol|haha|thanks|thank you|ok\b)/i;

/** Splits a note into sentences - but not at "Mr." or "Dr.". */
const sentences = (text: string) =>
  text
    .split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.!?])\s+|\n+|;\s*/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3 && !FILLER.test(s));

/** Of "a - b - c", the clause that actually carries the to-do, for a tighter title. */
function keyClause(sentence: string, signal: RegExp): string {
  const clauses = sentence.split(/\s+[-–—]\s+/);
  return clauses.find((c) => signal.test(c)) ?? sentence;
}

/** Turns a sentence into a short, list-style title. */
function cleanTitle(sentence: string): string {
  let t = sentence
    .replace(/^(?:and |also |so |ok |hi!? |now )+/i, "")
    .replace(/^(?:i )?(?:really )?(?:need|have|got|keep meaning) to /i, "")
    .replace(/^(?:remember|don'?t forget|remind me) to /i, "")
    .replace(/^(?:can|could|would|did) you (?:also |please )?/i, "")
    .replace(/^please /i, "")
    .replace(/^(?:booked|made|got) (?:an? |the )?/i, "")
    .replace(/[\s.!?…]+$/u, "")
    .replace(/\s+yet$/i, "")
    .replace(/\s+/g, " ");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 90 ? `${t.slice(0, 88).replace(/\s+\S*$/, "")}…` : t;
}

/** Names introduced by "with/from/ask/tell/email/text…" that we haven't met. */
function newNamesIn(sentence: string, known: Person[]): string[] {
  const skip = new Set([...WEEKDAYS, ...MONTHS]);
  const out: string[] = [];
  for (const m of sentence.matchAll(/\b(?:with|from|ask|tell|email|emailed|text|call|message|remind)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g)) {
    const name = m[1];
    if (skip.has(name.slice(0, 3).toLowerCase()) || findPerson(name, known)) continue;
    out.push(name);
  }
  return out;
}

/** "WATERWORKS CO" -> "Waterworks Co"; anything already mixed-case is left alone. */
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

// ------------------------------------------------------------------ main

export function extractOffline(note: Note, desk: Snapshot): Proposal {
  const from = note.captured_at.slice(0, 10);
  const open = desk.items.filter((i) => i.status === "open");
  const items: ProposedItem[] = [];
  const updates: ProposedUpdate[] = [];
  const links: ProposedLink[] = [];
  const touched = new Set<string>();

  /** The existing open item this text is most clearly about. */
  const bestMatch = (text: string, minScore: number): Item | undefined => {
    const mentioned = new Set(peopleIn(text, desk.people).map((p) => p.id));
    let best: Item | undefined;
    let bestScore = minScore;
    for (const item of open) {
      if (touched.has(item.id)) continue;
      // Sharing a person makes a match more believable.
      const score = overlap(text, item.title) + (item.people.some((p) => mentioned.has(p)) ? 0.2 : 0);
      if (score >= bestScore) [best, bestScore] = [item, score];
    }
    return best;
  };

  const resolve = (item: Item, reason: string) => {
    touched.add(item.id);
    updates.push({ key: `upd:${updates.length}`, item_id: item.id, action: "resolve", new_due: null, reason });
  };

  /** Either nudges a matching open item or adds a new one. */
  const propose = (draft: Omit<ProposedItem, "key">, context: string) => {
    const same = bestMatch(context, 0.6);
    if (same) {
      touched.add(same.id);
      const moved = draft.due && draft.due !== same.due ? draft.due : null;
      updates.push({ key: `upd:${updates.length}`, item_id: same.id, action: "update", new_due: moved, reason: `mentioned again: “${context}”` });
      return;
    }
    const key = `new:${items.length}`;
    items.push({ key, ...draft });

    // A gentle link to the closest open item in the same thread.
    const threadId = draft.thread && "id" in draft.thread ? draft.thread.id : null;
    const neighbour = threadId ? bestMatch(context, 0.2) : undefined;
    if (neighbour && neighbour.thread === threadId) {
      links.push({ key: `link:${links.length}`, from: key, to: neighbour.id, relation: "related", why: "Same people, same thread." });
    }
  };

  /** People in a sentence: known names, newly introduced names, and a message's sender. */
  const sender = note.source === "message" && note.from ? note.from : null;
  const peopleFor = (s: string): PersonRef[] => {
    const found: PersonRef[] = [];
    const add = (p: PersonRef) => {
      if (!found.some((f) => (p.id ? f.id === p.id : f.name.toLowerCase() === p.name.toLowerCase()))) found.push(p);
    };
    for (const p of peopleIn(s, desk.people)) add({ id: p.id, name: p.name });
    for (const name of newNamesIn(s, desk.people)) add({ name, kind: "person", role: "" });
    if (sender) {
      const known = findPerson(sender, desk.people);
      add(known ? { id: known.id, name: known.name } : { name: sender, kind: "person", role: "" });
    }
    return found;
  };

  /** Thread: wherever these people's other items live, else a thread title that shares words. */
  const threadFor = (s: string, people: PersonRef[]): ThreadRef => {
    const ids = new Set(people.flatMap((p) => (p.id ? [p.id] : [])));
    const votes = new Map<string, number>();
    for (const i of desk.items) if (i.thread && i.people.some((p) => ids.has(p))) votes.set(i.thread, (votes.get(i.thread) ?? 0) + 1);
    const byPeople = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
    const byWords = desk.threads.find((t) => overlap(s, t.title) >= 0.5)?.id;
    const id = byPeople ?? byWords;
    return id ? { id } : null;
  };

  // Screenshots are read as a whole: bills, trials and statements put the
  // important bits on separate lines.
  if (note.source === "screenshot") {
    readScreenshot(note, from, desk, { bestMatch, resolve, propose, threadFor });
    return { note, items, updates, links, engine: "Offline rules" };
  }

  for (const s of sentences(note.text)) {
    const date = parseDate(s, from);

    // 1. Something got done: tick off the matching open item. ("Booked the
    //    dentist for Tues at 9:30" also creates the appointment, so carry on.)
    if (DONE.test(s)) {
      const match = bestMatch(s, 0.34);
      if (match) {
        resolve(match, `“${s}”`);
        if (!(EVENT.test(s) && date)) continue;
      }
    }

    // 2. Is this a new thing to follow up on?
    const waiting = WAITING.test(s) || (!!sender && WAITING_IN_MESSAGE.test(s));
    // "Need to book an appointment" is a to-do; "dentist Tues 9:30" is an event.
    const kind: ItemKind | null = waiting
      ? "waiting"
      : TODO.test(s)
        ? "todo"
        : EVENT.test(s) && date
          ? "event"
          : IMPERATIVE.test(s)
            ? "todo"
            : null;
    if (!kind) continue;

    // A short fragment ("Start this month.") usually just dates the line before it.
    const last = items.at(-1);
    const short = words(s).size < 4;
    if (short && date && last && !last.due && !ASK.test(s)) {
      Object.assign(last, { due: date.due, due_text: date.due_text });
      continue;
    }
    // Other short to-dos need a clear verb or question, or they're just chatter.
    if (short && kind === "todo" && !IMPERATIVE.test(s) && !ASK.test(s)) continue;

    const people = peopleFor(s);
    const signal = kind === "waiting" ? WAITING : kind === "event" ? EVENT : TODO;
    propose(
      { kind, title: cleanTitle(keyClause(s, signal)), people, due: date?.due ?? null, time: parseTime(s), due_text: date?.due_text ?? null, thread: threadFor(s, people) },
      s,
    );
  }

  return { note, items, updates, links, engine: "Offline rules" };
}

type Helpers = {
  bestMatch: (text: string, minScore: number) => Item | undefined;
  resolve: (item: Item, reason: string) => void;
  propose: (draft: Omit<ProposedItem, "key">, context: string) => void;
  threadFor: (s: string, people: PersonRef[]) => ThreadRef;
};

/**
 * Bills, trials and payment lists. The first line is usually who it's from;
 * the date that matters follows "due", "ends" or "expires", not the
 * statement date at the top.
 */
function readScreenshot(note: Note, from: string, desk: Snapshot, h: Helpers) {
  const lines = note.text.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = titleCase(lines[0]?.split(/\s{2,}/)[0] ?? "Screenshot");

  // A list of payments: anything marked PAID finishes the matching bill.
  for (const line of lines.filter((l) => /\bpaid\b/i.test(l))) {
    const match = h.bestMatch(line.replace(/\bpaid\b/i, "") + " pay bill", 0.3);
    if (match) h.resolve(match, `marked paid: “${line.replace(/\s{2,}/g, " ")}”`);
  }

  const key = note.text.search(/\b(due|ends|expires|renews|by)\b/i);
  const date = key >= 0 ? parseDate(note.text.slice(key), from) : null;
  const amount = (key >= 0 ? note.text.slice(key) : note.text).match(/[$£€]\s?\d+(?:[.,]\d{2})?/)?.[0];
  const known = peopleIn(note.text, desk.people).map((p) => ({ id: p.id, name: p.name }));

  let title: string | null = null;
  if (/\btrial\b/i.test(note.text)) title = `Cancel or keep ${name} before the trial ends`;
  else if (/\b(amount due|due by|pay (?:online|by|now)|balance due)\b/i.test(note.text)) title = `Pay the ${name} bill${amount ? ` (${amount})` : ""}`;
  else if (/\b(expires|renews)\b/i.test(note.text)) title = `Check ${name} before it ${/expires/i.test(note.text) ? "expires" : "renews"}`;
  if (!title) return;

  h.propose(
    { kind: "todo", title, people: known, due: date?.due ?? null, time: null, due_text: date?.due_text ?? null, thread: h.threadFor(note.text, known) },
    title,
  );
}
