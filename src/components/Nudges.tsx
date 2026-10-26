"use client";

import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { Nudge } from "@/lib/suggest";
import { useDesk } from "@/lib/store";
import type { DeskView } from "@/lib/view";

const tilts = ["tilt-l", "tilt-0", "tilt-r"];

/**
 * "Start here": a few next steps, written like notes a thoughtful friend left
 * on your desk. When the step is getting in touch with someone, there's a
 * message ready to copy.
 */
export function Nudges({ view }: { view: DeskView }) {
  const { status, set } = useDesk((s) => s.nudges);
  const loadNudges = useDesk((s) => s.loadNudges);
  const nudges = set?.nudges ?? [];

  if (status !== "loading" && !nudges.length) return null;

  return (
    <section aria-labelledby="nudges-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <h2 id="nudges-title" className="font-display text-[1.55rem] font-medium">
            Start here
          </h2>
          <p className="font-hand text-[1.2rem] text-ink-3">{status === "loading" && !nudges.length ? "having a think…" : "a few things worth doing first"}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadNudges(true)}
          disabled={status === "loading"}
          className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-ink-3 hover:text-thread disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
          think again
        </button>
      </div>

      <ol className="mt-5 grid gap-5 md:grid-cols-3">
        {nudges.map((n, i) => (
          <NudgeCard key={n.item_id} nudge={n} index={i} view={view} />
        ))}
      </ol>
      {set && (
        <p className="mt-3 text-right text-[0.7rem] font-semibold text-ink-3">
          {set.notice ?? `suggested by ${set.engine}`}
        </p>
      )}
    </section>
  );
}

function NudgeCard({ nudge, index, view }: { nudge: Nudge; index: number; view: DeskView }) {
  const [copied, setCopied] = useState(false);
  const item = view.itemById.get(nudge.item_id);
  const thread = item ? view.threadOf(item) : null;

  const copy = async () => {
    if (!nudge.draft) return;
    try {
      await navigator.clipboard.writeText(nudge.draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the text is on screen to copy by hand.
    }
  };

  return (
    <li className={`hue-${thread?.hue ?? "thread"} lift ${tilts[index % 3]} sheet card-in relative flex flex-col px-5 pt-5 pb-4`}>
      <span className="font-hand absolute -top-3 -left-2 grid h-9 w-9 place-items-center rounded-full bg-[var(--hw)] text-[1.4rem] text-[var(--h)] shadow-sm">
        {index + 1}
      </span>
      <p className="font-medium leading-snug">{nudge.action}</p>
      <p className="font-hand mt-1 text-[1.15rem] leading-6 text-ink-2">{nudge.why}</p>
      {nudge.draft && (
        <div className="mt-3 rounded-md border-[1.5px] border-dashed border-rule bg-card-2 px-3 py-2">
          <p className="text-[0.85rem] leading-relaxed text-ink-2">{nudge.draft}</p>
          <button type="button" onClick={copy} className="mt-1.5 flex items-center gap-1 text-[0.72rem] font-semibold text-[var(--h)] hover:underline">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "copied" : "copy message"}
          </button>
        </div>
      )}
      {thread && <p className="mt-auto pt-3 text-[0.7rem] font-semibold text-ink-3">{thread.title}</p>}
    </li>
  );
}
