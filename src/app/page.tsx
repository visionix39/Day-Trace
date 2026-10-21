import { Composer } from "@/components/Composer";
import { DailyList } from "@/components/DailyList";
import { InboxStack } from "@/components/InboxStack";
import { Masthead } from "@/components/Masthead";
import { ThreadStrands } from "@/components/ThreadStrands";
import { WaitingOn } from "@/components/WaitingOn";

/**
 * The desk. Today it is drawn from the hand-labelled sample data in
 * data/seed, so every view shows what DayTrace should produce once the
 * extractor is real.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      <Masthead />

      <div className="mt-10">
        <Composer />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-10">
        <DailyList />
        <aside className="space-y-12">
          <WaitingOn />
          <InboxStack />
        </aside>
      </div>

      <div className="mt-16">
        <ThreadStrands />
      </div>

      <footer className="font-hand mt-16 text-center text-[1.15rem] text-ink-3">
        sample day · Mina and everyone she knows are made up · nothing here leaves your browser
      </footer>
    </main>
  );
}
