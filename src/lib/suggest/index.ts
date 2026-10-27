/**
 * Today's nudges: the few next steps worth doing first.
 *
 * The AI version weighs everything and writes ready-to-send messages. The
 * offline version is a simple scoring rule (overdue > due today > blocking
 * others > gone quiet) with a template message. Either way the result is
 * kept in the database for the day, so opening the app doesn't spend the
 * free AI quota every time - it's only asked again when your list changes or
 * you press "think again".
 */

import { daysBetween } from "../dates";
import { getMeta, setMeta } from "../db";
import { engineLabel, type ReadMode } from "../extract";
import { authHeader } from "../auth/supabase";
import type { Item, Snapshot } from "../types";
import { Suggestions, type SuggestRequest } from "./schema";

export interface Nudge {
  item_id: string;
  action: string;
  why: string;
  draft: string | null;
}

export interface NudgeSet {
  nudges: Nudge[];
  engine: string;
  notice?: string;
}

function facts(desk: Snapshot, today: string) {
  const noteDate = new Map(desk.notes.map((n) => [n.id, n.captured_at]));
  const nameOf = new Map(desk.people.map((p) => [p.id, p.name]));
  const threadOf = new Map(desk.threads.map((t) => [t.id, t.title]));
  return desk.items
    .filter((i) => i.status === "open")
    .map((item) => {
      const dates = item.mentions.map((m) => noteDate.get(m.note) ?? today).sort();
      return {
        item,
        people: item.people.map((p) => nameOf.get(p) ?? p),
        thread: item.thread ? (threadOf.get(item.thread) ?? null) : null,
        age_days: -daysBetween(today, dates[0] ?? today),
        quiet_days: -daysBetween(today, dates.at(-1) ?? today),
        blocks: desk.links.filter((l) => l.to === item.id && l.relation === "depends_on").length,
      };
    });
}

export function buildSuggestRequest(desk: Snapshot, today: string): SuggestRequest {
  return {
    today,
    items: facts(desk, today)
      .slice(0, 60)
      .map((f) => ({
        id: f.item.id,
        kind: f.item.kind,
        title: f.item.title,
        due: f.item.due,
        people: f.people.slice(0, 10),
        thread: f.thread,
        age_days: f.age_days,
        quiet_days: f.quiet_days,
        blocks: f.blocks,
      })),
  };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** The rule-based picker. */
export function offlineNudges(desk: Snapshot, today: string): Nudge[] {
  const scored = facts(desk, today).map((f) => {
    const late = f.item.due ? -daysBetween(today, f.item.due) : null; // >0 = days overdue
    let score = 0;
    let why = "";
    if (f.item.kind === "waiting") {
      if (f.quiet_days >= 5) [score, why] = [2 + f.quiet_days * 0.05, `You haven't heard anything in ${f.quiet_days} days.`];
      if (late !== null && late > 0) [score, why] = [score + 1.5, `It was expected ${late === 1 ? "yesterday" : `${late} days ago`}.`];
    } else if (late !== null) {
      if (late > 0) [score, why] = [3 + late * 0.2, `It was due ${late === 1 ? "yesterday" : `${late} days ago`}.`];
      else if (late === 0) [score, why] = [2.5, "It's due today."];
      else if (late >= -2) [score, why] = [1.5, f.item.kind === "event" ? "It's coming up soon." : "It's due in the next couple of days."];
    }
    if (f.blocks) {
      score += f.blocks;
      why ||= "Something else is waiting on this.";
    }
    return { f, score, why };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ f, why }) => nudgeFor(f.item, f.people, why));
}

function nudgeFor(item: Item, people: string[], why: string): Nudge {
  const who = people[0]?.split(" ")[0];
  if (item.kind === "waiting") {
    return {
      item_id: item.id,
      action: who ? `Nudge ${who} about “${item.title}”` : `Chase up “${item.title}”`,
      why,
      draft: `Hi${who ? ` ${who}` : ""}, just checking in on ${lowerFirst(item.title)}. Any news? No rush - I just wanted to make sure it hadn't slipped through the cracks.`,
    };
  }
  if (item.kind === "event") return { item_id: item.id, action: `Get ready for ${lowerFirst(item.title)}`, why, draft: null };
  return { item_id: item.id, action: item.title, why, draft: null };
}

/** A fingerprint of the open list: nudges are recomputed when it changes. */
const signature = (desk: Snapshot, today: string) =>
  today +
  desk.items
    .filter((i) => i.status === "open")
    .map((i) => `${i.id}:${i.due ?? ""}`)
    .sort()
    .join(",");

export async function getNudges(desk: Snapshot, today: string, mode: ReadMode, force = false): Promise<NudgeSet> {
  const sig = `${mode}|${signature(desk, today)}`;
  if (!force) {
    try {
      const cached = JSON.parse(getMeta("nudges") ?? "null") as { sig: string; set: NudgeSet } | null;
      if (cached?.sig === sig) return cached.set;
    } catch {
      // A broken cache entry just means we compute again.
    }
  }

  let set: NudgeSet = { nudges: offlineNudges(desk, today), engine: "Offline rules" };
  if (mode === "ai") {
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(buildSuggestRequest(desk, today)),
      });
      const body = (await res.json().catch(() => ({}))) as { suggestions?: unknown; model?: string; error?: string };
      const parsed = Suggestions.safeParse({ suggestions: body.suggestions });
      if (res.ok && parsed.success) set = { nudges: parsed.data.suggestions, engine: engineLabel(body.model ?? "AI") };
      else
        set.notice =
          body.error === "rate"
            ? "The free AI is busy, so these come from the offline rules."
            : body.error === "no_key"
              ? "The AI isn't switched on for this site yet, so these come from the offline rules."
              : "These come from the offline rules for now.";
    } catch {
      set.notice = "Couldn't reach the AI, so these come from the offline rules.";
    }
  }
  // Only cache real AI answers or deliberate offline picks, so a busy moment is retried later.
  if (!set.notice) await setMeta("nudges", JSON.stringify({ sig, set }));
  return set;
}
