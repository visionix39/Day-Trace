"use client";

import { useState } from "react";
import { dueLabel } from "@/lib/dates";
import type { Proposal, ProposedItem } from "@/lib/extract/types";
import { useDesk } from "@/lib/store";
import type { DeskView } from "@/lib/view";

const KIND = { todo: "to do", waiting: "waiting on", event: "event" } as const;
const RELATION = { depends_on: "waits on", part_of: "is part of", follows_up: "follows up", related: "goes with" } as const;

/**
 * "Here's what I found": the extractor's proposal, before anything is saved.
 * Every row starts ticked; untick what's wrong and save the rest. This is the
 * human-in-the-loop step - the AI suggests, you decide.
 */
export function ReviewCard({ proposal, view, onSaved }: { proposal: Proposal; view: DeskView; onSaved: () => void }) {
  const save = useDesk((s) => s.save);
  const discard = useDesk((s) => s.discard);
  const [keep, setKeep] = useState(() => new Set([...proposal.items, ...proposal.updates, ...proposal.links].map((r) => r.key)));
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const titleOf = (ref: string) =>
    ref.startsWith("new:") ? proposal.items.find((i) => i.key === ref)?.title : view.itemById.get(ref)?.title;

  const nothing = !proposal.items.length && !proposal.updates.length;

  async function onSave() {
    setSaving(true);
    try {
      await save(keep);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="What DayTrace found" className="card-in border-t-[1.5px] border-dashed border-rule px-5 pt-4 pb-5 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[1.2rem] font-medium">Here&apos;s what I found</h2>
        <span className="text-[0.72rem] font-semibold text-ink-3">read by {proposal.engine}</span>
      </div>

      {nothing && (
        <p className="font-hand mt-2 text-[1.25rem] leading-7 text-ink-2">
          nothing to follow up on in this one - I&apos;ll just keep it in your jar.
        </p>
      )}

      {!!proposal.items.length && (
        <Group title="new follow-ups">
          {proposal.items.map((item) => (
            <Row key={item.key} on={keep.has(item.key)} onToggle={() => toggle(item.key)}>
              <NewItem item={item} view={view} />
            </Row>
          ))}
        </Group>
      )}

      {!!proposal.updates.length && (
        <Group title="changes to things you already had">
          {proposal.updates.map((u) => (
            <Row key={u.key} on={keep.has(u.key)} onToggle={() => toggle(u.key)}>
              <p className="leading-snug">
                <span className="font-semibold">{u.action === "resolve" ? "✓ mark done" : "↻ update"}:</span> {view.itemById.get(u.item_id)?.title}
                {u.new_due && <span className="text-ink-2"> → due {dueLabel(view.today, u.new_due)}</span>}
              </p>
              <p className="font-hand text-[1.05rem] leading-5 text-ink-3">{u.reason}</p>
            </Row>
          ))}
        </Group>
      )}

      {!!proposal.links.length && (
        <Group title="connections">
          {proposal.links.map((l) => (
            <Row key={l.key} on={keep.has(l.key)} onToggle={() => toggle(l.key)}>
              <p className="leading-snug">
                “{titleOf(l.from)}” <span className="font-semibold text-thread">{RELATION[l.relation]}</span> “{titleOf(l.to)}”
              </p>
              <p className="font-hand text-[1.05rem] leading-5 text-ink-3">{l.why}</p>
            </Row>
          ))}
        </Group>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={discard} className="rounded-full px-3 py-1.5 text-[0.85rem] font-semibold text-ink-2 hover:text-ink">
          Never mind
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-ink px-4 py-1.5 text-[0.85rem] font-semibold text-card hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : nothing ? "Keep the note" : "Save to my desk"}
        </button>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-hand text-[1.25rem] leading-7 text-thread">{title}</h3>
      <ul className="mt-1 space-y-1.5">{children}</ul>
    </div>
  );
}

function Row({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <li>
      <label className={`flex cursor-pointer gap-3 rounded-md px-2 py-1.5 text-[0.92rem] transition-opacity hover:bg-card-2 ${on ? "" : "opacity-45"}`}>
        <input type="checkbox" checked={on} onChange={onToggle} className="mt-1 shrink-0 accent-[var(--thread-ink)]" />
        <div className="min-w-0">{children}</div>
      </label>
    </li>
  );
}

function NewItem({ item, view }: { item: ProposedItem; view: DeskView }) {
  const thread = item.thread && "id" in item.thread ? view.threadById.get(item.thread.id)?.title : item.thread?.title;
  const isNewThread = !!item.thread && "title" in item.thread;
  return (
    <>
      <p className="leading-snug">
        <span className="mr-1.5 rounded-full bg-thread-wash px-1.5 py-px text-[0.68rem] font-bold tracking-wide text-thread uppercase">{KIND[item.kind]}</span>
        {item.title}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-ink-2">
        {[
          item.due ? `due ${dueLabel(view.today, item.due)}${item.time ? ` at ${item.time}` : ""}` : "no date",
          item.people.length ? `with ${item.people.map((p) => p.name).join(", ")}${item.people.some((p) => !p.id) ? " (new)" : ""}` : null,
          thread ? `${isNewThread ? "new thread: " : ""}${thread}` : "loose end",
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </>
  );
}
