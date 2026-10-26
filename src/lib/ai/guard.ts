/**
 * Guard rails for the public AI routes. The free Groq key is shared by every
 * visitor, so we keep any one person (or script) from using it all up:
 *
 *  - only same-site requests are accepted,
 *  - bodies are size-capped,
 *  - each person gets a number of calls per ten minutes: signed-in accounts
 *    a fair share each, guests a smaller one per network address.
 *
 * The counter lives in the function's memory. On Vercel several copies of a
 * function can run at once, so this is a speed bump rather than a wall - fine
 * for a demo, and Groq's own limits are the backstop.
 */

import { createClient } from "@supabase/supabase-js";

const WINDOW_MS = 10 * 60 * 1000;
const calls = new Map<string, number[]>();

const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";

// Checked sign-in tokens, remembered briefly so each AI call doesn't wait on Supabase.
const verified = new Map<string, { id: string; until: number }>();

/**
 * Who's asking: an account id if the request carries a valid sign-in token
 * (checked with Supabase, so it can't be faked), otherwise the network address.
 */
export async function identify(req: Request): Promise<{ key: string; signedIn: boolean }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (token && url && anon) {
    const hit = verified.get(token);
    if (hit && hit.until > Date.now()) return { key: `user:${hit.id}`, signedIn: true };
    // Any problem checking the token (bad settings, Supabase unreachable) means "treat as a guest".
    const data = await Promise.resolve()
      .then(() => createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token))
      .then((r) => r.data)
      .catch(() => ({ user: null }));
    if (data.user) {
      verified.set(token, { id: data.user.id, until: Date.now() + 5 * 60 * 1000 });
      if (verified.size > 2_000) verified.clear();
      return { key: `user:${data.user.id}`, signedIn: true };
    }
  }
  return { key: `ip:${ipOf(req)}`, signedIn: false };
}

/** True if this person still has calls left for `bucket`; records the call. */
export function allow(who: { key: string }, bucket: string, perWindow: number): boolean {
  const key = `${bucket}:${who.key}`;
  const now = Date.now();
  const recent = (calls.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= perWindow) {
    calls.set(key, recent);
    return false;
  }
  recent.push(now);
  calls.set(key, recent);
  // Forget idle visitors now and then so the map can't grow forever.
  if (calls.size > 5_000) for (const [k, v] of calls) if (!v.some((t) => now - t < WINDOW_MS)) calls.delete(k);
  return true;
}

/** Rejects requests from other websites trying to borrow the key. */
export function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers omit it
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** Reads a JSON body, refusing anything larger than `maxBytes`. */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("too_large");
  return JSON.parse(text);
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
