import { Hourglass } from "lucide-react";
import { capturedLabel, daysBetween } from "@/lib/dates";
import type { DeskView } from "@/lib/view";
import { PersonStamp } from "./Chips";

/**
 * Things other people owe you, as luggage-style tags. Each one says how long
 * you've been waiting and when you last heard anything - the context you
 * usually forget by the time you need to nudge.
 */
export function WaitingOn({ view }: { view: DeskView }) {
  const items = view.waitingOn();
  return (
    <section aria-labelledby="waiting-title">
      <h2 id="waiting-title" className="font-display text-[1.3rem] font-medium">
        Waiting on others
      </h2>
      {!items.length && <p className="font-hand mt-2 text-[1.2rem] text-ink-3">nobody owes you anything right now</p>}
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const thread = view.threadOf(item);
          const first = view.noteById.get(item.mentions[0]?.note ?? "");
          const last = view.noteById.get(item.mentions.at(-1)?.note ?? "");
          const waited = first ? -daysBetween(view.today, first.captured_at) : 0;
          return (
            <li key={item.id} className={`hue-${thread.hue} sheet flex gap-3 border-l-4 border-[var(--h)] px-4 py-3`}>
              <Hourglass className="mt-1 h-4 w-4 shrink-0 text-[var(--h)]" strokeWidth={2.2} />
              <div className="min-w-0">
                <p className="leading-snug font-medium">{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.people.map((p) => (
                    <PersonStamp key={p} person={view.personById.get(p)} />
                  ))}
                </div>
                <p className="font-hand mt-1 text-[1.1rem] leading-6 text-ink-2">
                  {waited === 0 ? "since today" : `${waited} ${waited === 1 ? "day" : "days"} so far`}
                  {last ? ` · last word ${capturedLabel(view.today, last.captured_at)}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
