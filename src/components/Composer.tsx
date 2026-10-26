"use client";

import { Camera, MessageCircle, PenLine, Sparkles, WifiOff } from "lucide-react";
import { useState } from "react";
import { useDesk } from "@/lib/store";
import type { NoteSource } from "@/lib/types";
import type { DeskView } from "@/lib/view";
import { KnotLogo } from "./Doodles";
import { ReviewCard } from "./ReviewCard";

const sources: { id: NoteSource; label: string; Icon: typeof PenLine }[] = [
  { id: "note", label: "Note", Icon: PenLine },
  { id: "screenshot", label: "Screenshot text", Icon: Camera },
  { id: "message", label: "Message", Icon: MessageCircle },
];

const placeholders: Record<NoteSource, string> = {
  note: "“Sarah said she'll send the contract Monday - remind me if she doesn't.”",
  screenshot: "Paste text copied from a screenshot: a bill, a booking, an email…",
  message: "“Can you pick up the keys before Friday? I'll sort the van.”",
};

/**
 * The inbox slot: an index card you drop things onto. The review card opens
 * underneath it once a note has been read.
 */
export function Composer({ view }: { view: DeskView }) {
  const [source, setSource] = useState<NoteSource>("note");
  const [text, setText] = useState("");
  const [from, setFrom] = useState("");
  const draft = useDesk((s) => s.draft);
  const mode = useDesk((s) => s.mode);
  const setMode = useDesk((s) => s.setMode);
  const submit = useDesk((s) => s.submit);

  const reading = draft.status === "reading";
  const ai = mode === "ai";

  const go = () => {
    if (!text.trim() || reading) return;
    void submit({ text, source, from: source === "message" ? from : undefined });
  };

  return (
    <div>
      <section aria-label="Drop something in" className="sheet relative overflow-hidden">
        {/* index-card header rule */}
        <div className="h-1.5 bg-thread opacity-80" />
        <div className="px-5 pt-4 pb-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="drop" className="font-hand text-[1.45rem] leading-none text-ink-2">
              drop something in…
            </label>
            <button
              type="button"
              onClick={() => setMode(ai ? "offline" : "ai")}
              aria-pressed={ai}
              title={ai ? "Read by the free AI. Click to use simple offline rules instead." : "Read by simple rules in your browser. Click to use the free AI."}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-rule px-2.5 py-0.5 text-[0.75rem] font-semibold text-ink-2 hover:border-ink-3"
            >
              {ai ? <Sparkles className="h-3.5 w-3.5 text-thread" strokeWidth={2.2} /> : <WifiOff className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.2} />}
              read by: {ai ? "DayTrace AI" : "Offline rules"}
              <span className="text-ink-3">· switch</span>
            </button>
          </div>

          <textarea
            id="drop"
            rows={3}
            value={text}
            disabled={reading}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();
            }}
            placeholder={placeholders[source]}
            className={`mt-2 w-full resize-y bg-transparent text-[1.05rem] leading-8 text-ink outline-none placeholder:text-ink-3 placeholder:italic disabled:opacity-60 ${
              source === "screenshot" ? "font-type text-[0.9rem]" : ""
            }`}
            style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule-blue) 31px 32px)" }}
          />

          {source === "message" && (
            <label className="mt-1 flex items-center gap-2 text-[0.85rem] text-ink-2">
              <span className="font-hand text-[1.2rem]">from</span>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="who sent it?"
                className="w-48 border-b-[1.5px] border-rule bg-transparent px-1 py-0.5 text-ink outline-none focus:border-thread"
              />
            </label>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div role="radiogroup" aria-label="What kind of thing is it?" className="flex flex-wrap gap-1.5">
              {sources.map(({ id, label, Icon }) => {
                const on = source === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setSource(id)}
                    className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1 text-[0.8rem] font-semibold transition-colors ${
                      on ? "border-thread bg-thread-wash text-ink" : "border-rule text-ink-2 hover:border-ink-3"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {reading ? (
                <span className="font-hand flex items-center gap-1.5 text-[1.2rem] text-ink-2">
                  <KnotLogo className="h-5 w-5 animate-[spin_2.4s_linear_infinite] text-thread" /> reading your note…
                </span>
              ) : (
                <span className="hidden text-[0.72rem] text-ink-3 sm:inline">⌘ + Enter</span>
              )}
              <button
                type="button"
                onClick={go}
                disabled={!text.trim() || reading}
                className="rounded-full bg-ink px-4 py-1.5 text-[0.85rem] font-semibold text-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tuck it in
              </button>
            </div>
          </div>
        </div>

        {draft.status === "error" && (
          <p role="alert" className="border-t-[1.5px] border-dashed border-rule px-5 py-3 text-[0.88rem] text-thread sm:px-6">
            {draft.message}
          </p>
        )}

        {draft.status === "review" && (
          <ReviewCard
            key={draft.proposal.note.id}
            proposal={draft.proposal}
            view={view}
            onSaved={() => {
              setText("");
              setFrom("");
            }}
          />
        )}
      </section>
    </div>
  );
}
