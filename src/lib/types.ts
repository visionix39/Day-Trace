/**
 * The shapes DayTrace works with. They match data/schema.sql and the seed JSON
 * field for field, so the same objects flow from the dataset, into SQLite and
 * out to the UI without translation.
 */

export type NoteSource = "note" | "screenshot" | "message";

/** One raw capture, exactly as pasted. */
export interface Note {
  id: string;
  captured_at: string;
  source: NoteSource;
  /** Who sent it, for messages. */
  from?: string;
  /** Which app a screenshot came from. */
  app?: string;
  text: string;
}

export interface Person {
  id: string;
  name: string;
  kind: "person" | "org";
  aliases: string[];
  role: string;
}

/** Colour family for a thread; each maps to a token in globals.css. */
export type Hue = "thread" | "sky" | "rose" | "sage" | "plum" | "honey" | "clay";
export const HUES: Hue[] = ["thread", "sky", "rose", "sage", "plum", "honey", "clay"];

export interface Thread {
  id: string;
  title: string;
  hue: Hue;
}

/**
 * todo    - I owe someone something
 * waiting - someone owes me something
 * event   - something happens at a set time
 */
export type ItemKind = "todo" | "waiting" | "event";

export type Relation = "depends_on" | "part_of" | "follows_up" | "related";

export interface Mention {
  note: string;
  role: "created" | "updated" | "resolved";
}

export interface Item {
  id: string;
  kind: ItemKind;
  /** null until the item is filed under a thread ("loose ends"). */
  thread: string | null;
  title: string;
  people: string[];
  due: string | null;
  time?: string | null;
  due_text: string | null;
  status: "open" | "done";
  mentions: Mention[];
}

export interface Link {
  from: string;
  to: string;
  relation: Relation;
  why: string;
}

/** Everything in the database, read out in one go for the UI. */
export interface Snapshot {
  owner: string | null;
  notes: Note[];
  people: Person[];
  threads: Thread[];
  items: Item[];
  links: Link[];
}
