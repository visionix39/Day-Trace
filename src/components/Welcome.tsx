"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useState } from "react";
import { useDesk } from "@/lib/store";
import { KnotLogo, Squiggle } from "./Doodles";

type Tab = "signin" | "signup";

/**
 * The front cover of the notebook: sign in, make an account, or just have a
 * look around with the sample day.
 */
export function Welcome() {
  const signIn = useDesk((s) => s.signIn);
  const signUp = useDesk((s) => s.signUp);
  const continueAsGuest = useDesk((s) => s.continueAsGuest);
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tab === "signup" && password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    const result = tab === "signin" ? await signIn({ email, password }) : await signUp({ name, email, password });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.needsConfirm) setSentTo(email.trim());
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
      {/* The cover: a cloth spine with running stitches, and the title. */}
      <section className="sheet relative overflow-hidden py-12 pr-8 pl-16 sm:py-16 sm:pl-20">
        <div aria-hidden="true" className="hue-thread absolute inset-y-0 left-0 w-9 bg-[var(--hw)] sm:w-11">
          <span className="stitch absolute inset-y-6 left-1/2 w-[2px] -translate-x-1/2" />
        </div>
        <div className="flex items-center gap-2.5 text-thread">
          <KnotLogo className="h-11 w-11" />
          <span className="font-display text-[2.1rem] font-semibold tracking-tight text-ink">DayTrace</span>
        </div>
        <h1 className="font-display mt-8 text-[2.1rem] leading-[1.15] font-light sm:text-[2.6rem]">
          The notebook that remembers your <em className="text-thread">unfinished business</em>.
        </h1>
        <Squiggle className="mt-3 h-2.5 w-48 text-thread opacity-70" />
        <ul className="font-hand mt-6 space-y-1.5 text-[1.3rem] leading-7 text-ink-2">
          <li>✿ drop in notes, messages, screenshot text</li>
          <li>✿ it pulls out who owes what, and by when</li>
          <li>✿ and hands you a gentle list each morning</li>
        </ul>
      </section>

      <section aria-label="Sign in" className="sheet card-in relative px-6 pt-8 pb-7 sm:px-8">
        <div className="tape" />
        {sentTo ? (
          <div className="text-center">
            <Mail className="mx-auto h-9 w-9 text-thread" strokeWidth={1.8} />
            <h2 className="font-display mt-3 text-[1.5rem] font-medium">Check your inbox</h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
              We sent a link to <strong className="text-ink">{sentTo}</strong>. Click it to confirm your email, then come back and sign in.
            </p>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setTab("signin");
              }}
              className="mt-5 rounded-full bg-ink px-5 py-2 text-[0.9rem] font-semibold text-card"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <div role="tablist" className="flex gap-1.5">
              {(["signin", "signup"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className={`rounded-full border-[1.5px] px-3.5 py-1 text-[0.85rem] font-semibold transition-colors ${
                    tab === t ? "border-thread bg-thread-wash text-ink" : "border-rule text-ink-2 hover:border-ink-3"
                  }`}
                >
                  {t === "signin" ? "Sign in" : "New here?"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {tab === "signup" && <Field label="What should we call you?" value={name} onChange={setName} autoComplete="given-name" placeholder="Fiza" />}
              <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required placeholder="you@example.com" />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                required
                placeholder={tab === "signup" ? "at least 8 characters" : ""}
              />
              {error && (
                <p role="alert" className="text-[0.88rem] text-thread">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.95rem] font-semibold text-card hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Opening your notebook…" : tab === "signin" ? "Open my notebook" : "Make my notebook"}
              </button>
            </form>

            <div className="mt-6 border-t-[1.5px] border-dashed border-rule pt-4 text-center">
              <button
                type="button"
                onClick={() => void continueAsGuest()}
                className="font-hand inline-flex items-center gap-1.5 text-[1.3rem] text-ink-2 hover:text-thread"
              >
                or just look around with a sample day <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-1 text-[0.72rem] text-ink-3">Guest notebooks stay in this browser only.</p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  ...input
}: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="text-[0.8rem] font-semibold text-ink-2">{label}</span>
      <input
        {...input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b-[1.5px] border-rule bg-transparent px-0.5 py-1.5 text-[1rem] outline-none placeholder:text-ink-3 placeholder:italic focus:border-thread"
      />
    </label>
  );
}
