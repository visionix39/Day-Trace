"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { capturedLabel } from "@/lib/dates";
import { search, type SearchResult } from "@/lib/search";
import { useDesk } from "@/lib/store";
import type { DeskView } from "@/lib/view";

const EXAMPLES = ["what is Sarah waiting on?", "bills last week", "the job hunt", "anything from Leila", "October"];

/**
 * "Look back": ask your notebook a question. Results come from meaning,
 * matching words, people and dates (see lib/search), and each one shows
 * which of those it matched on.
 */
export function LookBack({ view }: { view: DeskView }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const index = useDesk((s) => s.index);
  const queryVector = useDesk((s) => s.queryVector);
  const ticket = useRef(0);

  // Search as you type, a moment after you stop.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResult(null);
      return;
    }
    const mine = ++ticket.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      const qv = await queryVector(q);
      if (mine !== ticket.current) return;
      setResult(search(q, view, view.today, { query: qv, notes: index.vectors }));
      setBusy(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, view, index.vectors, queryVector]);

  const status =
    index.status === "ready"
      ? "searching by meaning, words, people and dates"
      : index.status === "loading"
        ? "teaching search what your notes mean… (first time only)"
        : index.status === "unavailable"
          ? "searching by words, people and dates"
          : "";

  return (
    <section aria-labelledby="lookback-title">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="lookback-title" className="font-display text-[1.55rem] font-medium">
          Look back
        </h2>
        <p className="font-hand text-[1.2rem] text-ink-3">ask your notebook anything</p>
      </div>

      <div className="sheet mt-4 px-5 py-4 sm:px-6">
        <label className="flex items-center gap-3 border-b-[1.5px] border-rule pb-2 focus-within:border-thread">
          <Search className="h-5 w-5 shrink-0 text-ink-3" />
          <span className="sr-only">Search your notes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="what did Sarah say last week?"
            className="w-full bg-transparent text-[1.05rem] outline-none placeholder:text-ink-3 placeholder:italic"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setQuery(e)}
                className="rounded-full border-[1.5px] border-rule px-2.5 py-0.5 text-[0.75rem] font-semibold text-ink-2 hover:border-ink-3"
              >
                {e}
              </button>
            ))}
          </div>
          <span className="text-[0.7rem] font-semibold text-ink-3">{busy ? "looking…" : status}</span>
        </div>

        {result && (
          <div className="mt-4">
            {result.range && (
              <p className="font-hand text-[1.15rem] text-thread">
                {result.range.label}: {result.range.from === result.range.to ? result.range.from : `${result.range.from} → ${result.range.to}`}
              </p>
            )}
            {!result.hits.length && <p className="font-hand text-[1.25rem] text-ink-3">nothing matches that - try fewer words?</p>}
            <ul className="divide-y-[1.5px] divide-dashed divide-rule">
              {result.hits.map((hit) => (
                <li key={hit.note.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[0.75rem] font-semibold text-ink-3">
                      {hit.note.source === "message" ? `${hit.note.from ?? "message"} · ` : hit.note.source === "screenshot" ? "screenshot · " : ""}
                      {capturedLabel(view.today, hit.note.captured_at)} · {hit.note.captured_at.slice(0, 10)}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {hit.reasons.map((r) => (
                        <span key={r} className="rounded-full bg-thread-wash px-2 py-px text-[0.66rem] font-bold text-thread">
                          {r}
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className={`mt-1 leading-relaxed ${hit.note.source === "screenshot" ? "font-type text-[0.82rem] whitespace-pre-wrap" : "text-[0.95rem]"}`}>
                    {hit.note.text}
                  </p>
                  {!!hit.items.length && (
                    <p className="font-hand mt-1 text-[1.05rem] leading-6 text-ink-3">
                      ↳ {hit.items.map((i) => `${i.status === "done" ? "✓ " : ""}${i.title}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
