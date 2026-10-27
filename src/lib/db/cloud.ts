/**
 * Keeps a signed-in person's notebook in their private Supabase folder.
 *
 * The notebook is a single SQLite file, so syncing is simple: after a change,
 * upload the file; when signing in on any device, download it. If two devices
 * edit at the same time, the last one to save wins - fine for one person's
 * notes, and the trade-off for keeping everything else so simple.
 */

import { supabase } from "../auth/supabase";

const BUCKET = "notebooks";
const path = (userId: string) => `${userId}/notebook.sqlite`;

/** The saved notebook, or null if this account doesn't have one yet. */
export async function downloadNotebook(userId: string): Promise<Uint8Array | null> {
  const { data, error } = await supabase().storage.from(BUCKET).download(path(userId));
  if (error) {
    // A missing file is the normal "new account" case, not a failure.
    if (/not.?found|404|does not exist/i.test(`${error.message} ${(error as { status?: number }).status ?? ""}`)) return null;
    throw error;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function uploadNotebook(userId: string, bytes: Uint8Array): Promise<void> {
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(path(userId), new Blob([bytes.slice()], { type: "application/x-sqlite3" }), { upsert: true, cacheControl: "0" });
  if (error) throw error;
}
