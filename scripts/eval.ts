/**
 * Scores an extractor against the answer key.
 *
 *   npm run eval            the offline rules (free, instant)
 *   npm run eval -- --ai    the Groq model (needs GROQ_API_KEY in .env.local)
 *
 * How it works: start from an empty notebook, feed Mina's 22 notes in one at a
 * time - exactly like a person using the app, accepting every suggestion -
 * then compare the final notebook with data/seed/expected.json.
 *
 * What the numbers mean:
 *   found      share of the 19 real follow-ups that were picked up (recall)
 *   precise    share of what was picked up that was real (precision)
 *   F1         one number balancing the two
 *   kind       of the found ones, right type (todo / waiting / event)
 *   date       of the found ones with a due date, exactly the right day
 *   status     of the found ones, right open/done state at the end
 *   links      share of the 9 real connections that were made
 *   noise      the note with nothing in it produced nothing
 *
 * A follow-up counts as "found" when its title shares most of its words with
 * a real one. That's a rough judge - "Pay CityPower bill" and "Pay the
 * electricity bill" won't match - so treat small differences with caution.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import key from "../data/seed/expected.json";
import inbox from "../data/seed/notes.json";
import { askForJson } from "../src/lib/ai/groq";
import { buildRequest } from "../src/lib/extract/context";
import { engineLabel, toProposal } from "../src/lib/extract/index";
import { overlap } from "../src/lib/extract/match";
import { extractOffline } from "../src/lib/extract/offline";
import { SYSTEM, userMessage } from "../src/lib/extract/prompt";
import { Extraction, extractionJsonSchema } from "../src/lib/extract/schema";
import type { Proposal } from "../src/lib/extract/types";
import { HUES, type Item, type Note, type Snapshot } from "../src/lib/types";

const useAi = process.argv.includes("--ai");

// A tiny .env.local reader, so the script needs no extra package.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (useAi && !process.env.GROQ_API_KEY) {
  console.error("Set GROQ_API_KEY in .env.local first (see .env.example).");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Applies a proposal to an in-memory notebook, the way saveProposal does in SQLite. */
function apply(desk: Snapshot, p: Proposal) {
  desk.notes.push(p.note);
  const idFor = new Map<string, string>();
  for (const it of p.items) {
    const id = `i${desk.items.length + 1}`;
    idFor.set(it.key, id);
    let thread: string | null = null;
    if (it.thread && "id" in it.thread) thread = it.thread.id;
    else if (it.thread) {
      const title = it.thread.title;
      thread = desk.threads.find((t) => t.title.toLowerCase() === title.toLowerCase())?.id ?? null;
      if (!thread) {
        thread = `t${desk.threads.length + 1}`;
        desk.threads.push({ id: thread, title, hue: HUES[desk.threads.length % HUES.length] });
      }
    }
    const people = it.people.map((ref) => {
      if (ref.id !== undefined) return ref.id;
      const id = `p${desk.people.length + 1}`;
      desk.people.push({ id, name: ref.name, kind: ref.kind, role: ref.role, aliases: [] });
      return id;
    });
    desk.items.push({ id, kind: it.kind, thread, title: it.title, people, due: it.due, time: it.time, due_text: it.due_text, status: "open", mentions: [{ note: p.note.id, role: "created" }] });
  }
  for (const u of p.updates) {
    const item = desk.items.find((i) => i.id === u.item_id);
    if (!item) continue;
    if (u.action === "resolve") item.status = "done";
    if (u.new_due) item.due = u.new_due;
    item.mentions.push({ note: p.note.id, role: u.action === "resolve" ? "resolved" : "updated" });
  }
  for (const l of p.links) {
    const from = idFor.get(l.from) ?? l.from;
    const to = idFor.get(l.to) ?? l.to;
    if (!from.startsWith("new:") && !to.startsWith("new:")) desk.links.push({ from, to, relation: l.relation, why: l.why });
  }
}

async function read(note: Note, desk: Snapshot): Promise<Proposal> {
  if (!useAi) return extractOffline(note, desk);
  const today = note.captured_at.slice(0, 10);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await askForJson({ system: SYSTEM, user: userMessage(buildRequest(note, desk, today)), schemaName: "extraction", schema: extractionJsonSchema() });
      const parsed = Extraction.safeParse(raw);
      if (parsed.success) return toProposal(parsed.data, note, desk, engineLabel(process.env.GROQ_MODEL || "openai/gpt-oss-120b"));
    } catch (error) {
      console.warn(`  ${note.id}: ${(error as Error).message} - retrying`);
    }
    await sleep(5000 * (attempt + 1));
  }
  console.warn(`  ${note.id}: gave up, counting as nothing found`);
  return { note, items: [], updates: [], links: [], engine: "AI" };
}

const similar = (a: string, b: string) => Math.max(overlap(a, b), overlap(b, a));
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "-");

async function main() {
  const desk: Snapshot = { owner: null, notes: [], people: [], threads: [], items: [], links: [] };
  const produced = new Map<string, number>();
  console.log(`Reading ${inbox.notes.length} notes with ${useAi ? "the AI" : "the offline rules"}…`);

  for (const note of inbox.notes as Note[]) {
    const p = await read(note, desk);
    produced.set(note.id, p.items.length + p.updates.length);
    apply(desk, p);
    if (useAi) await sleep(2500); // stay well inside the free tier's per-minute limit
  }

  // Pair each real follow-up with its closest predicted one, best pairs first.
  const gold = key.items as Item[];
  const pairs: { g: Item; p: Item; score: number }[] = [];
  for (const g of gold) for (const p of desk.items) {
    const score = similar(g.title, p.title) + (g.kind === p.kind ? 0.1 : 0);
    if (score >= 0.5) pairs.push({ g, p, score });
  }
  pairs.sort((a, b) => b.score - a.score);
  const match = new Map<string, Item>();
  const used = new Set<string>();
  for (const { g, p } of pairs) if (!match.has(g.id) && !used.has(p.id)) [match.set(g.id, p), used.add(p.id)];

  const matched = [...match.entries()].map(([gid, p]) => ({ g: gold.find((x) => x.id === gid)!, p }));
  const withDue = matched.filter((m) => m.g.due);
  const goldLinks = key.links;
  const linked = goldLinks.filter((l) => {
    const a = match.get(l.from)?.id;
    const b = match.get(l.to)?.id;
    return a && b && desk.links.some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
  });

  const precision = desk.items.length ? matched.length / desk.items.length : 0;
  const recall = matched.length / gold.length;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const noiseOk = key.notes_without_items.every((id) => !produced.get(id));

  const scores = {
    engine: useAi ? engineLabel(process.env.GROQ_MODEL || "openai/gpt-oss-120b") : "Offline rules",
    found: pct(matched.length, gold.length),
    precise: pct(matched.length, desk.items.length),
    f1: f1.toFixed(2),
    kind: pct(matched.filter((m) => m.g.kind === m.p.kind).length, matched.length),
    date: pct(withDue.filter((m) => m.g.due === m.p.due).length, withDue.length),
    status: pct(matched.filter((m) => m.g.status === m.p.status).length, matched.length),
    links: pct(linked.length, goldLinks.length),
    noise: noiseOk ? "ok" : "made something up",
  };

  console.log(`\n${scores.engine}: ${desk.items.length} follow-ups created, ${matched.length} of ${gold.length} real ones found\n`);
  console.table(scores);
  console.log("\nMissed:");
  for (const g of gold.filter((g) => !match.has(g.id))) console.log(`  - ${g.title}`);

  mkdirSync("eval", { recursive: true });
  const file = `eval/results-${useAi ? "ai" : "offline"}.json`;
  writeFileSync(file, JSON.stringify({ scores, matched: matched.map((m) => ({ expected: m.g.title, got: m.p.title })) }, null, 2) + "\n");
  console.log(`\nSaved ${file}`);
}

void main();
