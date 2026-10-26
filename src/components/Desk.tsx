"use client";

import { useEffect, useMemo } from "react";
import { authEnabled, authProblem } from "@/lib/auth/supabase";
import { useDesk } from "@/lib/store";
import { buildView } from "@/lib/view";
import { Composer } from "./Composer";
import { DailyList } from "./DailyList";
import { KnotLogo } from "./Doodles";
import { InboxStack } from "./InboxStack";
import { LookBack } from "./LookBack";
import { Masthead } from "./Masthead";
import { Nudges } from "./Nudges";
import { ThreadStrands } from "./ThreadStrands";
import { UndoToast } from "./UndoToast";
import { WaitingOn } from "./WaitingOn";
import { Welcome } from "./Welcome";

/**
 * The whole desk. Once you've signed in (or chosen to look around), it opens
 * your notebook, and every section draws from the same snapshot, so they can
 * never disagree with each other.
 */
export function Desk() {
  const { account, sync, phase, loadError, snapshot, today, justDone, init, reset } = useDesk();
  useEffect(() => void init(), [init]);
  const view = useMemo(() => (snapshot ? buildView(snapshot, today, justDone) : null), [snapshot, today, justDone]);

  if (account.status === "signed-out") return <Welcome />;

  if (phase === "failed") {
    return (
      <Centered>
        <p className="font-display text-[1.4rem]">Couldn&apos;t open your notebook.</p>
        <p className="mt-2 text-[0.9rem] text-ink-2">{loadError}</p>
      </Centered>
    );
  }
  if (!view) {
    return (
      <Centered>
        <KnotLogo className="mx-auto h-10 w-10 animate-[spin_2.4s_linear_infinite] text-thread" />
        <p className="font-hand mt-3 text-[1.4rem] text-ink-2">opening your notebook…</p>
      </Centered>
    );
  }

  const confirmReset = (withSample: boolean) => {
    const question = withSample
      ? "Replace everything with the sample day? Your own notes will be deleted."
      : "Start a fresh, empty notebook? Everything here, including the sample day, will be deleted.";
    if (window.confirm(question)) void reset(withSample);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8 sm:pt-14">
      {authProblem && (
        <p role="alert" className="mb-6 rounded-md border-[1.5px] border-dashed border-thread px-4 py-2 text-[0.85rem] text-thread">
          {authProblem} Fix it in your .env file and restart the dev server.
        </p>
      )}
      <Masthead view={view} />

      <div className="mt-10">
        <Composer view={view} />
      </div>

      <div className="mt-12">
        <Nudges view={view} />
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-10">
        <DailyList view={view} />
        <aside className="space-y-12">
          <WaitingOn view={view} />
          <InboxStack view={view} />
        </aside>
      </div>

      <div className="mt-16">
        <LookBack view={view} />
      </div>

      <div className="mt-16">
        <ThreadStrands view={view} />
      </div>

      <footer className="mt-16 text-center">
        <p className="font-hand text-[1.15rem] text-ink-3">
          {view.owner ? `this is ${view.owner}'s sample day - everyone in it is made up · ` : ""}
          {SYNC_TEXT[account.status === "signed-in" ? sync : "local"]} · in AI mode, each note is read by a free AI (Groq), which keeps no copy
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[0.78rem] font-semibold text-ink-3">
          <button type="button" onClick={() => confirmReset(false)} className="hover:text-thread hover:underline">
            start a fresh notebook
          </button>
          <button type="button" onClick={() => confirmReset(true)} className="hover:text-thread hover:underline">
            bring back the sample day
          </button>
        </div>
      </footer>
      <UndoToast />
    </main>
  );
}

const SYNC_TEXT = {
  local: authEnabled ? "this guest notebook lives only in this browser" : "your notebook lives only in this browser",
  saving: "saving to your account…",
  saved: "saved to your account ✓",
  offline: "couldn't reach your account - kept on this device, will retry",
} as const;

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-[70vh] place-items-center px-4 text-center">{<div>{children}</div>}</main>;
}
