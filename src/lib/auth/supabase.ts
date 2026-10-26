/**
 * Accounts, via Supabase (supabase.com, free tier).
 *
 * Supabase does two jobs for DayTrace:
 *   1. Sign-up / sign-in with email and password (it stores the passwords,
 *      safely hashed - they never touch our code or our server).
 *   2. A private folder per person where their notebook file is kept, so
 *      their history follows them to any device.
 *
 * The two values below are *meant* to be public: the "publishable" key only
 * lets a browser do what the security rules in supabase/setup.sql allow,
 * which is "a signed-in person can read and write their own folder". If they
 * aren't set, DayTrace runs as before, with one notebook per browser.
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

/** A real web address, like https://abcdefghijklmnopqrst.supabase.co. */
function isWebAddress(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Set when the settings are present but wrong, so the page can say what to
 * fix instead of crashing. Accounts stay off until it's fixed.
 */
export const authProblem: string | null =
  url && !isWebAddress(url)
    ? "Accounts are off: NEXT_PUBLIC_SUPABASE_URL should be your Supabase Project URL, like https://abcdefghijklmnopqrst.supabase.co."
    : url && !key
      ? "Accounts are off: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing."
      : null;

export const authEnabled = isWebAddress(url) && !!key;

let client: SupabaseClient | null = null;

/** The browser's Supabase client (one per page). */
export function supabase(): SupabaseClient {
  if (!authEnabled) throw new Error("Supabase isn't configured.");
  return (client ??= createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }));
}

export interface Account {
  id: string;
  email: string;
  name: string;
}

export const toAccount = (user: User): Account => ({
  id: user.id,
  email: user.email ?? "",
  name: (user.user_metadata?.name as string | undefined)?.trim() || (user.email ?? "").split("@")[0],
});

/**
 * The header that proves to our AI routes who's asking, so the free quota
 * can be shared fairly per person. Empty for guests.
 */
export async function authHeader(): Promise<Record<string, string>> {
  if (!authEnabled) return {};
  const { data } = await supabase().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
