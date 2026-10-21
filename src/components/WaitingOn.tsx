import { Hourglass } from "lucide-react";
import { capturedLabel, daysBetween } from "@/lib/dates";
import { noteById, threadById, today, waitingOn } from "@/lib/seed";
import { PersonStamp } from "./Chips";

/**
 * Things other people owe you, as luggage-style tags. Each one says how long
 * you've been waiting and when you last heard anything - the context you
 * usually forget by the time you need to nudge.
 */
export function WaitingOn() {
  const items = waitingOn();
  return (
    <section aria-labelledby="waiting-title">
      <h2 id="waiting-title" className="font-display text-[1.3rem] font-medium">
        Waiting on others
      </h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => {
          const thread = threadById.get(item.thread)!;
          const first = noteById.get(item.mentions[0].note)!;
          const last = noteById.get(item.mentions.at(-1)!.note)!;
          const waited = -daysBetween(today, first.captured_at);
          return (
            <li key={item.id} className={`hue-${thread.hue} sheet flex gap-3 border-l-4 border-[var(--h)] px-4 py-3`}>
              <Hourglass className="mt-1 h-4 w-4 shrink-0 text-[var(--h)]" strokeWidth={2.2} />
              <div className="min-w-0">
                <p className="leading-snug font-medium">{item.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.people.map((p) => (
                    <PersonStamp key={p} id={p} />
                  ))}
                </div>
                <p className="font-hand mt-1 text-[1.1rem] leading-6 text-ink-2">
                  {waited} days so far · last word {capturedLabel(today, last.captured_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
