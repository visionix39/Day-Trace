import { capturedLabel } from "@/lib/dates";
import { notes, today } from "@/lib/seed";
import type { Note } from "@/lib/types";

const tilts = ["tilt-l", "tilt-r", "tilt-0"];

/**
 * The most recent raw captures, pinned to the desk. Each source gets its own
 * object: notes are sticky notes, messages are speech bubbles, and text from
 * screenshots sits in a little photo frame in typewriter type.
 */
export function InboxStack({ count = 5 }: { count?: number }) {
  const recent = notes.slice(-count).reverse();
  return (
    <section aria-labelledby="inbox-title">
      <div className="flex items-baseline justify-between">
        <h2 id="inbox-title" className="font-display text-[1.3rem] font-medium">
          Recently dropped in
        </h2>
        <span className="font-hand text-[1.1rem] text-ink-3">{notes.length} in the jar</span>
      </div>
      <ul className="mt-5 space-y-5">
        {recent.map((note, i) => (
          <li key={note.id} className={`lift ${tilts[i % tilts.length]}`}>
            <Capture note={note} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Capture({ note }: { note: Note }) {
  const when = capturedLabel(today, note.captured_at);

  if (note.source === "message") {
    return (
      <figure>
        <figcaption className="mb-1 pl-1 text-[0.75rem] font-semibold text-ink-3">
          {note.from} · {when}
        </figcaption>
        <blockquote className="bubble px-4 py-2.5 text-[0.95rem] leading-relaxed">{note.text}</blockquote>
      </figure>
    );
  }

  if (note.source === "screenshot") {
    return (
      <figure className="snapshot">
        <pre className="snapshot-inner font-type overflow-x-auto px-3 py-2.5 text-[0.78rem] leading-relaxed whitespace-pre-wrap text-ink-2">
          {note.text}
        </pre>
        <figcaption className="font-hand mt-1.5 text-center text-[1.05rem] leading-none text-ink-3">
          from a {note.app} screenshot · {when}
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="sticky-note relative px-4 pt-4 pb-3">
      <div className="tape !w-14" />
      <p className="font-hand text-[1.3rem] leading-snug text-ink">{note.text}</p>
      <figcaption className="mt-1 text-right text-[0.72rem] font-semibold text-ink-2">{when}</figcaption>
    </figure>
  );
}
