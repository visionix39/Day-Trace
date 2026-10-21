"use client";

import { Camera, MessageCircle, PenLine } from "lucide-react";
import { useState } from "react";
import type { NoteSource } from "@/lib/types";

const sources: { id: NoteSource; label: string; Icon: typeof PenLine }[] = [
  { id: "note", label: "Note", Icon: PenLine },
  { id: "screenshot", label: "Screenshot text", Icon: Camera },
  { id: "message", label: "Message", Icon: MessageCircle },
];

/**
 * The inbox slot: an index card you drop things onto. It's laid out and
 * typeable already, but "Tuck it in" stays off until the extractor exists -
 * that's the next step on the roadmap.
 */
export function Composer() {
  const [source, setSource] = useState<NoteSource>("note");
  const [text, setText] = useState("");

  return (
    <section aria-label="Drop something in" className="sheet relative overflow-hidden">
      {/* index-card header rule */}
      <div className="h-1.5 bg-thread opacity-80" />
      <div className="px-5 pt-4 pb-4 sm:px-6">
        <label htmlFor="drop" className="font-hand text-[1.45rem] leading-none text-ink-2">
          drop something in…
        </label>
        <textarea
          id="drop"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="“Sarah said she'll send the contract Monday - remind me if she doesn't.”"
          className="mt-2 w-full resize-none bg-transparent text-[1.05rem] leading-8 text-ink outline-none placeholder:text-ink-3 placeholder:italic"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--rule-blue) 31px 32px)" }}
        />

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
            <span className="font-hand text-[1.1rem] text-ink-3">the sorting comes in step 2 ✿</span>
            <button
              type="button"
              disabled
              className="rounded-full bg-ink px-4 py-1.5 text-[0.85rem] font-semibold text-card disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tuck it in
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
