"use client";

import { ExternalLink, X } from "lucide-react";
import { PROVIDERS, findProvider } from "@/lib/extract/providers/catalog";
import { useDesk, type HelperId } from "@/lib/store";

const OFFLINE = { id: "offline" as const, name: "Offline rules", blurb: "Simple word rules. Free, instant, no key - but easily fooled." };

/**
 * Choose who reads your notes. Keys are yours: they stay in this browser
 * (in memory, or saved here only if you tick "remember") and go straight to
 * the provider you picked.
 */
export function HelperSettings({ onClose }: { onClose: () => void }) {
  const settings = useDesk((s) => s.settings);
  const update = useDesk((s) => s.updateSettings);
  const helper = settings.helper;
  const spec = helper === "offline" ? null : findProvider(helper);

  return (
    <section aria-label="Who reads your notes" className="sheet card-in relative mt-3 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[1.2rem] font-medium">Who reads your notes?</h2>
          <p className="font-hand text-[1.15rem] leading-6 text-ink-3">pick a helper - you can switch any time</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close helper settings" className="rounded-full p-1 text-ink-3 hover:text-ink">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div role="radiogroup" aria-label="Helper" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {[OFFLINE, ...PROVIDERS].map((p) => {
          const on = helper === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => update({ helper: p.id as HelperId })}
              className={`rounded-md border-[1.5px] px-3 py-2.5 text-left transition-colors ${
                on ? "border-thread bg-thread-wash" : "border-rule hover:border-ink-3"
              }`}
            >
              <span className="block text-[0.9rem] font-semibold">{p.name}</span>
              <span className="mt-0.5 block text-[0.75rem] leading-snug text-ink-2">{p.blurb}</span>
            </button>
          );
        })}
      </div>

      {spec && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {spec.keyLabel ? (
            <label className="block">
              <span className="text-[0.8rem] font-semibold text-ink-2">{spec.keyLabel}</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={settings.keys[spec.id]}
                onChange={(e) => update({ keys: { ...settings.keys, [spec.id]: e.target.value } })}
                placeholder={spec.keyPlaceholder}
                className="mt-1 w-full rounded-md border-[1.5px] border-rule bg-card-2 px-3 py-2 text-[0.9rem] outline-none focus:border-thread"
              />
              {spec.keyUrl && (
                <a href={spec.keyUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-thread hover:underline">
                  get a key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>
          ) : (
            <div className="text-[0.85rem] leading-relaxed text-ink-2">
              <p className="font-semibold text-ink">No key needed.</p>
              <p>
                Install Ollama, then in a terminal run <code className="font-type rounded bg-card-2 px-1">ollama pull {settings.models.ollama}</code>.
                DayTrace talks to it at localhost:11434.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-[0.8rem] font-semibold text-ink-2">Model</span>
            <input
              list={`models-${spec.id}`}
              spellCheck={false}
              value={settings.models[spec.id]}
              onChange={(e) => update({ models: { ...settings.models, [spec.id]: e.target.value } })}
              className="mt-1 w-full rounded-md border-[1.5px] border-rule bg-card-2 px-3 py-2 text-[0.9rem] outline-none focus:border-thread"
            />
            <datalist id={`models-${spec.id}`}>
              {spec.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </datalist>
          </label>

          {spec.keyLabel && (
            <label className="flex items-start gap-2 text-[0.82rem] text-ink-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.remember}
                onChange={(e) => update({ remember: e.target.checked })}
                className="mt-0.5 accent-[var(--thread-ink)]"
              />
              <span>
                Remember my keys on this device. Otherwise they&apos;re forgotten when you close the tab. Either way they only ever go to{" "}
                {spec.name === "GPT" ? "OpenAI" : spec.name === "Gemini" ? "Google" : "Anthropic"}.
              </span>
            </label>
          )}
        </div>
      )}
    </section>
  );
}
