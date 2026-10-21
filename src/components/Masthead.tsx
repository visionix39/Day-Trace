import { longDate } from "@/lib/dates";
import { dailyList, owner, today } from "@/lib/seed";
import { KnotLogo, Squiggle, SunDoodle } from "./Doodles";

const words = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];

export function Masthead() {
  const shelves = dailyList();
  const now = shelves.overdue.length + shelves.today.length;
  const name = owner.split(" ")[0];

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5 text-thread">
          <KnotLogo className="h-9 w-9" />
          <span className="font-display text-[1.7rem] font-semibold tracking-tight text-ink">DayTrace</span>
        </div>
        <h1 className="font-display mt-5 max-w-xl text-[2rem] leading-[1.15] font-light text-ink sm:text-[2.5rem]">
          Good morning, {name}.{" "}
          <em className="text-ink-2">
            {words[now] ?? `${now} things`} {now === 1 ? "wants" : "want"} you today.
          </em>
        </h1>
      </div>

      <div className="relative self-start pr-1 sm:self-end sm:text-right">
        <div className="flex items-center gap-2 sm:justify-end">
          <SunDoodle className="hue-honey h-6 w-6 text-[var(--h)]" />
          <span className="font-hand text-[1.6rem] leading-none text-ink">{longDate(today)}</span>
        </div>
        <Squiggle className="mt-0.5 h-2.5 w-full text-thread opacity-70" />
      </div>
    </header>
  );
}
