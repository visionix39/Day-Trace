/**
 * What the AI is told. Two parts:
 *
 *  - SYSTEM: the job description. It never changes, so providers can cache it.
 *  - The user message: today's context (what's already on your list, who you
 *    know, which threads exist) followed by the new note.
 *
 * Giving the model your open items is what lets it say "this note finishes
 * that task" or "this is waiting on that proposal" instead of creating
 * duplicates. That's retrieval in its simplest form: we pick what's relevant
 * (here, every open item) and put it in front of the model.
 */

import { weekday } from "../dates";
import type { Note, Snapshot } from "../types";

export const SYSTEM = `You are DayTrace's note reader. Someone pastes in a quick note, a message they received, or text copied from a screenshot. You find what they need to follow up on and connect it to what they're already tracking.

What to extract:
- todo: something the writer owes someone or needs to do ("need to renew passport", "can you send the link?" in a message they received).
- waiting: something someone else owes the writer ("she'll get back to me", "waiting on approval").
- event: something that happens at a specific time (an appointment, a dinner, a call).
Skip chit-chat, observations and anything with no follow-up. An empty result is a good answer for a note with nothing in it.

Dates:
- Resolve relative dates against the day the note was written (given below), not today. "By Friday" means the first Friday on or after that day; "next week Thursday" means Thursday of the following week; "end of the month" means its last day.
- Use null when no date is stated or clearly implied. Never invent one.

Using the open list:
- If the note says an open item is finished (sent, paid, booked, done), add an update with action "resolve".
- If it moves a date or nudges an open item, add an update with action "update" (and new_due if the date changed).
- Don't create a new item that duplicates an open one.
- Add links where one thing genuinely depends on, is part of, or follows up another - including links to open items. Don't link things that merely share a person.

Threads and people:
- Reuse an existing thread id when the item belongs to that part of life; otherwise give a short new_thread_title ("Kitchen renovation"). Use null for both only for true one-offs.
- Match people to the known list by name or alias and write them the way the list does. List anyone new in "people".
- The writer is never one of the people.

Titles are short and practical, like a line on a to-do list, and keep the specifics (names, amounts, what exactly).`;

/** The per-note message: context first, then the note itself. */
export function userMessage(note: Note, desk: Snapshot, today: string): string {
  const open = desk.items
    .filter((i) => i.status === "open")
    .map((i) => ({ id: i.id, kind: i.kind, title: i.title, due: i.due, thread: i.thread, people: i.people }));
  const people = desk.people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, role: p.role }));
  const threads = desk.threads.map((t) => ({ id: t.id, title: t.title }));
  const written = note.captured_at.slice(0, 10);

  return [
    `<today>${today} (${weekday(today, "long")})</today>`,
    `<threads>${JSON.stringify(threads)}</threads>`,
    `<known_people>${JSON.stringify(people)}</known_people>`,
    `<open_items>${JSON.stringify(open)}</open_items>`,
    `<note written="${note.captured_at}" weekday="${weekday(written, "long")}" source="${note.source}"${note.from ? ` from="${note.from}"` : ""}>`,
    note.text,
    `</note>`,
  ].join("\n");
}
