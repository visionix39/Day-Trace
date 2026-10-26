/**
 * DayTrace's memory: a real SQLite database running inside the browser.
 *
 * sql.js is SQLite compiled to WebAssembly, so the same SQL you'd run against
 * a .sqlite file works here, with no server. This module is the only place
 * that talks SQL; everything else asks it for a Snapshot or hands it a
 * Proposal to save.
 */

import initSqlJs, { type Database, type SqlValue } from "sql.js";
import schema from "../../../data/schema.sql";
import type { Proposal } from "../extract/types";
import { HUES, type Hue, type Item, type Link, type Mention, type Note, type Person, type Snapshot, type Thread } from "../types";
import { loadBytes, saveBytes } from "./persist";
import { sampleSnapshot } from "./sample";

let db: Database | null = null;

/** Short random ids like "i_3f9a1c2b". */
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

function rows<T>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = db!.prepare(sql);
  stmt.bind(params);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as T);
  stmt.free();
  return out;
}

const run = (sql: string, params: SqlValue[] = []) => db!.run(sql, params);

/** Runs `fn` as one transaction: all of it is saved, or none of it. */
function transaction(fn: () => void) {
  run("BEGIN");
  try {
    fn();
    run("COMMIT");
  } catch (error) {
    run("ROLLBACK");
    throw error;
  }
}

/** Writes the in-memory database to IndexedDB. */
async function persist() {
  await saveBytes(db!.export());
  // Exporting resets per-connection settings, so switch this back on.
  run("PRAGMA foreign_keys = ON");
}

/**
 * Opens the database: from IndexedDB if you've been here before, otherwise a
 * new one filled with the sample day.
 */
export async function openDatabase(today: string): Promise<Snapshot> {
  if (!db) {
    // The .wasm file is served from public/ (copied there by scripts/copy-wasm.mjs).
    const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
    const saved = await loadBytes();
    db = saved ? new SQL.Database(saved) : new SQL.Database();
    run("PRAGMA foreign_keys = ON");
    if (!saved) {
      db.exec(schema);
      insertSnapshot(sampleSnapshot(today));
      await persist();
    }
  }
  return readSnapshot();
}

// ---------------------------------------------------------------- reading

export function readSnapshot(): Snapshot {
  const notes = rows<{ id: string; captured_at: string; source: Note["source"]; sender: string | null; app: string | null; text: string }>(
    "SELECT * FROM notes ORDER BY captured_at",
  ).map(({ sender, app, ...n }) => ({ ...n, ...(sender ? { from: sender } : {}), ...(app ? { app } : {}) }));

  const people = rows<Omit<Person, "aliases"> & { aliases: string }>("SELECT * FROM people ORDER BY name").map((p) => ({
    ...p,
    aliases: JSON.parse(p.aliases) as string[],
  }));

  const threads = rows<Thread>("SELECT * FROM threads");

  // Gather each item's people and history with two queries instead of 2×N.
  const peopleOf = new Map<string, string[]>();
  for (const r of rows<{ item_id: string; person_id: string }>("SELECT * FROM item_people")) {
    peopleOf.set(r.item_id, [...(peopleOf.get(r.item_id) ?? []), r.person_id]);
  }
  const mentionsOf = new Map<string, Mention[]>();
  for (const r of rows<{ item_id: string; note_id: string; role: Mention["role"] }>(
    "SELECT m.* FROM item_mentions m JOIN notes n ON n.id = m.note_id ORDER BY n.captured_at",
  )) {
    mentionsOf.set(r.item_id, [...(mentionsOf.get(r.item_id) ?? []), { note: r.note_id, role: r.role }]);
  }

  const items = rows<Omit<Item, "people" | "mentions">>("SELECT * FROM items").map((i) => ({
    ...i,
    people: peopleOf.get(i.id) ?? [],
    mentions: mentionsOf.get(i.id) ?? [],
  }));

  const links = rows<{ from_item: string; to_item: string; relation: Link["relation"]; why: string }>("SELECT * FROM links").map(
    (l) => ({ from: l.from_item, to: l.to_item, relation: l.relation, why: l.why }),
  );

  const owner = rows<{ value: string }>("SELECT value FROM meta WHERE key = 'owner'")[0]?.value ?? null;
  return { owner, notes, people, threads, items, links };
}

// ---------------------------------------------------------------- writing

function insertSnapshot(s: Snapshot) {
  transaction(() => {
    if (s.owner) run("INSERT OR REPLACE INTO meta VALUES ('owner', ?)", [s.owner]);
    for (const n of s.notes) {
      run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [n.id, n.captured_at, n.source, n.from ?? null, n.app ?? null, n.text]);
    }
    for (const p of s.people) run("INSERT INTO people VALUES (?, ?, ?, ?, ?)", [p.id, p.name, p.kind, p.role, JSON.stringify(p.aliases)]);
    for (const t of s.threads) run("INSERT INTO threads VALUES (?, ?, ?)", [t.id, t.title, t.hue]);
    for (const i of s.items) {
      run("INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [i.id, i.kind, i.thread, i.title, i.due, i.time ?? null, i.due_text, i.status]);
      for (const p of i.people) run("INSERT INTO item_people VALUES (?, ?)", [i.id, p]);
      for (const m of i.mentions) run("INSERT INTO item_mentions VALUES (?, ?, ?)", [i.id, m.note, m.role]);
    }
    for (const l of s.links) run("INSERT INTO links VALUES (?, ?, ?, ?)", [l.from, l.to, l.relation, l.why]);
  });
}

/** Picks a colour for a new thread: the least-used hue so far. */
function nextHue(): Hue {
  const used = new Map(rows<{ hue: Hue; n: number }>("SELECT hue, COUNT(*) AS n FROM threads GROUP BY hue").map((r) => [r.hue, r.n]));
  return [...HUES].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0];
}

/**
 * Saves a reviewed proposal. `keep` holds the keys of the rows you left
 * ticked; anything else is skipped. The note itself is always saved, even if
 * nothing in it needed following up - it's still part of your history.
 */
export async function saveProposal(p: Proposal, keep: Set<string>): Promise<Snapshot> {
  transaction(() => {
    const n = p.note;
    run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [n.id, n.captured_at, n.source, n.from ?? null, n.app ?? null, n.text]);

    // New items get real ids; links that point at "new:0" are rewritten to them.
    const idFor = new Map<string, string>();
    const newThreads = new Map<string, string>(); // title (lower-case) -> id
    const newPeople = new Map<string, string>(); // name (lower-case) -> id

    for (const item of p.items.filter((i) => keep.has(i.key))) {
      const id = newId("i");
      idFor.set(item.key, id);

      let thread: string | null = null;
      if (item.thread && "id" in item.thread) thread = item.thread.id;
      else if (item.thread) {
        const title = item.thread.title.trim();
        thread = newThreads.get(title.toLowerCase()) ?? null;
        if (!thread) {
          thread = newId("t");
          newThreads.set(title.toLowerCase(), thread);
          run("INSERT INTO threads VALUES (?, ?, ?)", [thread, title, nextHue()]);
        }
      }

      run("INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, 'open')", [id, item.kind, thread, item.title, item.due, item.time, item.due_text]);
      run("INSERT INTO item_mentions VALUES (?, ?, 'created')", [id, n.id]);

      for (const person of item.people) {
        let pid = person.id ?? newPeople.get(person.name.toLowerCase());
        if (!pid && person.id === undefined) {
          pid = newId("p");
          newPeople.set(person.name.toLowerCase(), pid);
          run("INSERT INTO people VALUES (?, ?, ?, ?, '[]')", [pid, person.name, person.kind, person.role]);
        }
        run("INSERT OR IGNORE INTO item_people VALUES (?, ?)", [id, pid!]);
      }
    }

    for (const u of p.updates.filter((u) => keep.has(u.key))) {
      if (u.action === "resolve") run("UPDATE items SET status = 'done' WHERE id = ?", [u.item_id]);
      if (u.new_due) run("UPDATE items SET due = ? WHERE id = ?", [u.new_due, u.item_id]);
      run("INSERT OR REPLACE INTO item_mentions VALUES (?, ?, ?)", [u.item_id, n.id, u.action === "resolve" ? "resolved" : "updated"]);
    }

    for (const l of p.links.filter((l) => keep.has(l.key))) {
      const from = idFor.get(l.from) ?? l.from;
      const to = idFor.get(l.to) ?? l.to;
      // Skip links whose new end was unticked.
      if (from.startsWith("new:") || to.startsWith("new:") || from === to) continue;
      run("INSERT OR IGNORE INTO links VALUES (?, ?, ?, ?)", [from, to, l.relation, l.why]);
    }
  });
  await persist();
  return readSnapshot();
}

/** Ticks an item off (or back on) from the daily list. */
export async function setItemDone(id: string, done: boolean): Promise<Snapshot> {
  run("UPDATE items SET status = ? WHERE id = ?", [done ? "done" : "open", id]);
  await persist();
  return readSnapshot();
}

/** Wipes everything. With `withSample`, the sample day is loaded back in. */
export async function resetDatabase(today: string, withSample: boolean): Promise<Snapshot> {
  for (const table of ["links", "item_mentions", "item_people", "note_embeddings", "items", "threads", "people", "notes", "meta"]) {
    run(`DELETE FROM ${table}`);
  }
  if (withSample) insertSnapshot(sampleSnapshot(today));
  await persist();
  return readSnapshot();
}

// ------------------------------------------------- small facts and edits

export function getMeta(key: string): string | null {
  return rows<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key])[0]?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  run("INSERT OR REPLACE INTO meta VALUES (?, ?)", [key, value]);
  await persist();
}

/** Fixes an item after the fact: a better title, the right date. */
export async function updateItem(id: string, patch: { title?: string; due?: string | null }): Promise<Snapshot> {
  if (patch.title !== undefined) run("UPDATE items SET title = ? WHERE id = ?", [patch.title, id]);
  if (patch.due !== undefined) run("UPDATE items SET due = ? WHERE id = ?", [patch.due, id]);
  await persist();
  return readSnapshot();
}

/** Removes an item; its people, history and links go with it (ON DELETE CASCADE). */
export async function deleteItem(id: string): Promise<Snapshot> {
  run("DELETE FROM items WHERE id = ?", [id]);
  await persist();
  return readSnapshot();
}

// ------------------------------------------------------------------ undo

/**
 * Undo is the simplest kind there is: before a change, keep a copy of the
 * whole database (it's small - a few hundred KB); to undo, put the copy back.
 */
export const checkpoint = (): Uint8Array => db!.export();

export async function restore(bytes: Uint8Array): Promise<Snapshot> {
  const SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
  db?.close();
  db = new SQL.Database(bytes);
  await persist();
  return readSnapshot();
}

// ------------------------------------------------------------ embeddings

/** Stored note vectors for one embedding model, by note id. */
export function readEmbeddings(model: string): Map<string, Float32Array> {
  const out = new Map<string, Float32Array>();
  for (const r of rows<{ note_id: string; vector: Uint8Array }>("SELECT note_id, vector FROM note_embeddings WHERE model = ?", [model])) {
    // Copy into a fresh buffer: the bytes SQLite hands back may not be 4-byte aligned.
    out.set(r.note_id, new Float32Array(r.vector.slice().buffer));
  }
  return out;
}

export async function saveEmbeddings(model: string, vectors: Map<string, Float32Array>): Promise<void> {
  transaction(() => {
    for (const [noteId, v] of vectors) {
      run("INSERT OR REPLACE INTO note_embeddings VALUES (?, ?, ?)", [noteId, model, new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice()]);
    }
  });
  await persist();
}
