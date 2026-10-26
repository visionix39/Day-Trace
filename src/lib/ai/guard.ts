/**
 * Guard rails for the public AI routes. The free Groq key is shared by every
 * visitor, so we keep any one person (or script) from using it all up:
 *
 *  - only same-site requests are accepted,
 *  - bodies are size-capped,
 *  - each visitor gets a small number of calls per ten minutes.
 *
 * The counter lives in the function's memory. On Vercel several copies of a
 * function can run at once, so this is a speed bump rather than a wall - fine
 * for a demo, and Groq's own limits are the backstop.
 */

const WINDOW_MS = 10 * 60 * 1000;
const calls = new Map<string, number[]>();

export function visitorId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** True if this visitor still has calls left for `bucket`; records the call. */
export function allow(req: Request, bucket: string, perWindow: number): boolean {
  const key = `${bucket}:${visitorId(req)}`;
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
