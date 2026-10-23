"use client";

import type { Bucket } from "@/lib/dates";
import { useDesk } from "@/lib/store";
import type { Item } from "@/lib/types";
import type { DeskView } from "@/lib/view";
import { DueChip, PersonStamp } from "./Chips";
import { CheckDoodle } from "./Doodles";

const shelves: { id: Bucket; title: string }[] = [
  { id: "overdue", title: "a little overdue" },
  { id: "today", title: "today" },
  { id: "soon", title: "this week" },
  { id: "later", title: "later on" },
  { id: "someday", title: "whenever you're free" },
];

// How to describe a link from either end: "waits on" one way, "unblocks" back.
const verbs = {
  depends_on: ["waits on", "unblocks"],
  part_of: ["part of", "includes"],
  follows_up: ["follows", "followed by"],
  related: ["goes with", "goes with"],
} as const;

/**
 * The daily follow-up list, written on a ruled notebook page. Ticking an item
 * saves it to the database straight away.
 */
export function DailyList({ view }: { view: DeskView }) {
  const list = view.dailyList();
  const toggleDone = useDesk((s) => s.toggleDone);
  const empty = shelves.every(({ id }) => !list[id].length);

  return (
    <section aria-labelledby="daily-title" className="sheet ruled relative pt-5 pb-6">
      <div className="tape" />
      <h2 id="daily-title" className="font-display pl-[62px] text-[1.55rem] leading-8 font-medium">
        Your follow-ups
      </h2>

      {empty && (
        <p className="font-hand mt-8 pr-6 pl-[62px] text-[1.35rem] leading-8 text-ink-3">
          a clean page ✿ drop a note in above and anything you need to follow up on lands here.
        </p>
      )}

      {shelves.map(({ id, title }) =>
        list[id].length ? (
          <div key={id} className="mt-8">
            <h3 className="font-hand pl-[62px] text-[1.4rem] leading-8 text-thread">{title}</h3>
            <ul>
              {list[id].map((item) => (
                <Row key={item.id} item={item} view={view} onToggle={() => toggleDone(item.id)} />
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </section>
  );
}

function Row({ item, view, onToggle }: { item: Item; view: DeskView; onToggle: () => void }) {
  const thread = view.threadOf(item);
  const done = item.status === "done";
  // Show the one connection that best explains *why* this matters.
  const link = view.linksFor(item.id)[0];
  const other = link && view.itemById.get(link.from === item.id ? link.to : link.from);

  return (
    <li className={`hue-${thread.hue} group flex gap-3 py-2 pr-4 pl-3 sm:pr-6`} data-done={done}>
      {item.kind === "event" ? (
        <span className="mt-1 flex h-[26px] w-[26px] shrink-0 items-center justify-center" title="An event">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[var(--h)]" />
        </span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Mark “${item.title}” as not done` : `Tick off “${item.title}”`}
          className="mt-1 shrink-0 text-[var(--h)]"
        >
          <CheckDoodle className="h-[26px] w-[26px]" />
        </button>
      )}

      <div className="min-w-0 flex-1 pl-[9px]">
        <p className={`text-[1.02rem] leading-8 ${done ? "struck" : ""}`}>{item.title}</p>
        <div className="-mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-3">
            <span className="h-2 w-2 rounded-full bg-[var(--h)]" />
            {thread.title}
          </span>
          {item.people.map((p) => (
            <PersonStamp key={p} person={view.personById.get(p)} />
          ))}
          <span className="ml-auto">
            <DueChip today={view.today} due={item.due} time={item.time} />
          </span>
        </div>
        {other && (
          <p className="font-hand mt-0.5 text-[1.05rem] leading-6 text-ink-3">
            ↳ {verbs[link.relation][link.from === item.id ? 0 : 1]} “{other.title}”
          </p>
        )}
      </div>
    </li>
  );
}
