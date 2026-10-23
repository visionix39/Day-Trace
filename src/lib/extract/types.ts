/**
 * A proposal is what an extractor *suggests* doing with a new note. Nothing in
 * it has touched the database yet: you review it, untick anything that's
 * wrong, and only then is it saved. Every row has a `key` so the review card
 * can switch rows on and off.
 */

import type { ItemKind, Note, Person, Relation } from "../types";

/** A person the note mentions: someone already known, or someone new. */
export type PersonRef = { id: string; name: string } | { id?: undefined; name: string; kind: Person["kind"]; role: string };

/** Where a new item gets filed: an existing thread, a new one, or nowhere yet. */
export type ThreadRef = { id: string } | { title: string } | null;

export interface ProposedItem {
  key: string; // "new:0", "new:1", …
  kind: ItemKind;
  title: string;
  people: PersonRef[];
  due: string | null;
  time: string | null;
  due_text: string | null;
  thread: ThreadRef;
}

export interface ProposedUpdate {
  key: string; // "upd:0", …
  item_id: string;
  /** resolve = it's done; update = it's still open but something changed. */
  action: "resolve" | "update";
  new_due: string | null;
  reason: string;
}

export interface ProposedLink {
  key: string; // "link:0", …
  /** An existing item id, or the key of a new item ("new:0"). */
  from: string;
  to: string;
  relation: Relation;
  why: string;
}

export interface Proposal {
  note: Note;
  items: ProposedItem[];
  updates: ProposedUpdate[];
  links: ProposedLink[];
  /** Which extractor made it, for the review card: "Offline rules", "Claude Opus 5.5"… */
  engine: string;
}
