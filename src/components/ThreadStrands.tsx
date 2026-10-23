import { capturedLabel } from "@/lib/dates";
import type { DeskView } from "@/lib/view";
import { SewnButton } from "./Doodles";

/**
 * The bit that makes DayTrace more than a to-do list: each part of life is a
 * thread, and every item that belongs to it is a button sewn on in the order
 * it happened. Where one thing is waiting on another, the stitch says so.
 */
export function ThreadStrands({ view }: { view: DeskView }) {
  // Busiest threads first - that's where the tangles are. Empty ones are hidden.
  const sorted = view.threads
    .map((t) => ({ thread: t, beads: view.strand(t.id) }))
    .filter((t) => t.beads.length)
    .sort((a, b) => b.beads.length - a.beads.length);

  if (!sorted.length) return null;

  return (
    <section aria-labelledby="threads-title">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="threads-title" className="font-display text-[1.55rem] font-medium">
          How it all connects
        </h2>
        <p className="font-hand text-[1.2rem] text-ink-3">each thread is a little corner of your life</p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map(({ thread, beads }) => (
          <article key={thread.id} className={`hue-${thread.hue} sheet px-5 pt-4 pb-5`}>
            <header className="flex items-center justify-between gap-3">
              <h3 className="font-display text-[1.1rem] font-medium">{thread.title}</h3>
              <span className="shrink-0 rounded-full bg-[var(--hw)] px-2 py-0.5 text-[0.7rem] font-bold whitespace-nowrap text-[var(--h)]">
                {beads.filter((b) => b.item.status === "open").length} open
              </span>
            </header>

            <ol className="relative mt-4">
              {/* the running stitch behind the buttons */}
              <span aria-hidden="true" className="stitch absolute top-3 bottom-3 left-[11px] w-[2px]" />
              {beads.map(({ item, since }) => {
                const waitsOn = view.links.filter((l) => l.from === item.id && l.relation === "depends_on");
                return (
                  <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <SewnButton done={item.status === "done"} className="relative h-6 w-6 shrink-0" />
                    <div className="min-w-0 pt-0.5">
                      <p className={`text-[0.92rem] leading-snug ${item.status === "done" ? "struck" : ""}`}>{item.title}</p>
                      <p className="mt-0.5 text-[0.72rem] font-semibold text-ink-3">
                        {item.kind} · since {capturedLabel(view.today, since)}
                      </p>
                      {waitsOn.map((l) => (
                        <p key={l.to} className="font-hand text-[1.02rem] leading-5 text-[var(--h)]">
                          waiting on “{view.itemById.get(l.to)?.title}”
                        </p>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}
