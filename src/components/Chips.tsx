import { dueLabel, daysBetween } from "@/lib/dates";
import { personById, today } from "@/lib/seed";

/** A person's name as a small rubber stamp. */
export function PersonStamp({ id }: { id: string }) {
  const person = personById.get(id);
  if (!person) return null;
  // First names keep stamps short, but "Dr. Haddad" can't become "Dr.".
  const short = person.kind === "org" || /^(Mr|Mrs|Ms|Dr)\./.test(person.name) ? person.name : person.name.split(" ")[0];
  return (
    <span className="stamp text-ink-2" title={person.role}>
      {short}
    </span>
  );
}

/**
 * When something is due, in friendly words. Overdue gets the thread colour -
 * a nudge, never alarm red.
 */
export function DueChip({ due, time }: { due: string | null; time?: string }) {
  if (!due) return <span className="font-hand text-[1.05rem] text-ink-3">whenever</span>;
  const late = daysBetween(today, due) < 0;
  return (
    <span className={`font-hand text-[1.15rem] leading-none ${late ? "text-thread" : "text-ink-2"}`}>
      {late ? `was due ${dueLabel(today, due)}` : dueLabel(today, due)}
      {time ? ` · ${time}` : ""}
    </span>
  );
}
