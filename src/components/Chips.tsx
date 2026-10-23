import { daysBetween, dueLabel } from "@/lib/dates";
import type { Person } from "@/lib/types";

/** A person's name as a small rubber stamp. */
export function PersonStamp({ person }: { person: Person | undefined }) {
  if (!person) return null;
  // First names keep stamps short, but "Dr. Haddad" can't become "Dr.".
  const short = person.kind === "org" || /^(Mr|Mrs|Ms|Dr)\./.test(person.name) ? person.name : person.name.split(" ")[0];
  return (
    <span className="stamp text-ink-2" title={person.role || undefined}>
      {short}
    </span>
  );
}

/**
 * When something is due, in friendly words. Overdue gets the thread colour -
 * a nudge, never alarm red.
 */
export function DueChip({ today, due, time }: { today: string; due: string | null; time?: string | null }) {
  if (!due) return <span className="font-hand text-[1.05rem] text-ink-3">whenever</span>;
  const late = daysBetween(today, due) < 0;
  return (
    <span className={`font-hand text-[1.15rem] leading-none ${late ? "text-thread" : "text-ink-2"}`}>
      {late ? `was due ${dueLabel(today, due)}` : dueLabel(today, due)}
      {time ? ` · ${time}` : ""}
    </span>
  );
}
