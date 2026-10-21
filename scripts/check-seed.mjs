// Sanity-checks the synthetic dataset so a typo in the JSON can't quietly
// break the UI or, later, the extractor's scores.
//
//   npm run check:seed
//
// Plain Node with no dependencies, so it runs before anything else is set up.

import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(`../data/seed/${path}`, import.meta.url), "utf8"));
const inbox = read("notes.json");
const key = read("expected.json");

const problems = [];
const fail = (msg) => problems.push(msg);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isDateTime = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Collects ids into a Set and reports any that appear twice. */
function ids(list, label) {
  const seen = new Set();
  for (const { id } of list) {
    if (seen.has(id)) fail(`${label}: duplicate id "${id}"`);
    seen.add(id);
  }
  return seen;
}

const noteIds = ids(inbox.notes, "notes");
const personIds = ids(key.people, "people");
const threadIds = ids(key.threads, "threads");
const itemIds = ids(key.items, "items");

if (inbox.anchor_date !== key.anchor_date) fail("anchor_date differs between notes.json and expected.json");

// Notes: valid shape, in time order, nothing captured after "today".
let previous = "";
for (const n of inbox.notes) {
  if (!["note", "screenshot", "message"].includes(n.source)) fail(`${n.id}: unknown source "${n.source}"`);
  if (!isDateTime(n.captured_at)) fail(`${n.id}: captured_at is not YYYY-MM-DDTHH:MM:SS`);
  if (n.captured_at < previous) fail(`${n.id}: notes are out of time order`);
  if (n.captured_at.slice(0, 10) > inbox.anchor_date) fail(`${n.id}: captured after anchor_date`);
  if (n.source === "message" && !n.from) fail(`${n.id}: a message needs "from"`);
  if (!n.text?.trim()) fail(`${n.id}: empty text`);
  previous = n.captured_at;
}

// Items: every reference resolves, and history makes sense.
const mentioned = new Set();
for (const it of key.items) {
  if (!["todo", "waiting", "event"].includes(it.kind)) fail(`${it.id}: unknown kind "${it.kind}"`);
  if (!threadIds.has(it.thread)) fail(`${it.id}: unknown thread "${it.thread}"`);
  if (it.due !== null && !isDate(it.due)) fail(`${it.id}: due is not YYYY-MM-DD or null`);
  for (const p of it.people) if (!personIds.has(p)) fail(`${it.id}: unknown person "${p}"`);

  if (!it.mentions.length) fail(`${it.id}: no mentions`);
  if (it.mentions[0]?.role !== "created") fail(`${it.id}: first mention must be "created"`);
  const resolved = it.mentions.some((m) => m.role === "resolved");
  if (resolved !== (it.status === "done")) fail(`${it.id}: status "${it.status}" disagrees with its mentions`);
  for (const m of it.mentions) {
    if (!noteIds.has(m.note)) fail(`${it.id}: mentions unknown note "${m.note}"`);
    mentioned.add(m.note);
  }
}

for (const l of key.links) {
  if (!itemIds.has(l.from) || !itemIds.has(l.to)) fail(`link ${l.from} -> ${l.to}: unknown item`);
  if (l.from === l.to) fail(`link ${l.from}: points at itself`);
}

// Every note is either the source of some item or explicitly marked as noise.
for (const id of noteIds) {
  const noise = key.notes_without_items.includes(id);
  if (!mentioned.has(id) && !noise) fail(`${id}: not used by any item and not listed in notes_without_items`);
  if (mentioned.has(id) && noise) fail(`${id}: listed as noise but an item mentions it`);
}

if (problems.length) {
  console.error(`✗ seed data has ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

const open = key.items.filter((i) => i.status === "open").length;
console.log(
  `✓ seed data looks good: ${inbox.notes.length} notes, ${key.items.length} items (${open} open), ` +
    `${key.people.length} people, ${key.threads.length} threads, ${key.links.length} links.`,
);
