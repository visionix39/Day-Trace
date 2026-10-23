/**
 * Date helpers that speak like a person ("tomorrow", "Sat") rather than a
 * calendar. They take "today" as an argument instead of reading the clock, so
 * the same function works for the live app, the sample data and tests.
 *
 * Dates are handled as plain 'YYYY-MM-DD' strings at noon UTC, which sidesteps
 * time-zone and daylight-saving edge cases for day arithmetic.
 */

const DAY = 86_400_000;

const toUtc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date on this device, as 'YYYY-MM-DD'. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Right now on this device, as 'YYYY-MM-DDTHH:MM:SS' (no time zone). */
export function localNow(): string {
  const d = new Date();
  return `${localToday()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Whole days from `today` to `iso` (negative = in the past). */
export function daysBetween(today: string, iso: string): number {
  return Math.round((toUtc(iso) - toUtc(today)) / DAY);
}

/** `iso` moved by `days`, keeping any time part: works on dates and date-times. */
export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY) + iso.slice(10);
}

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (iso: string) => new Date(toUtc(iso)).getUTCDay();

/** Last day of the month `iso` falls in. */
export function endOfMonth(iso: string): string {
  const d = new Date(toUtc(iso));
  return fromUtc(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12));
}

export const weekday = (iso: string, style: "short" | "long" = "short") =>
  new Date(toUtc(iso)).toLocaleDateString("en-GB", { weekday: style, timeZone: "UTC" });

const dayMonth = (iso: string) =>
  new Date(toUtc(iso)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Thursday, 22 October" - for the masthead. */
export function longDate(iso: string): string {
  return new Date(toUtc(iso)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** A friendly label for a due date relative to today. */
export function dueLabel(today: string, iso: string): string {
  const d = daysBetween(today, iso);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d < 0) return `${-d} days ago`;
  if (d < 7) return weekday(iso);
  return dayMonth(iso);
}

/** "3 days ago", "this morning" - for when a note was captured. */
export function capturedLabel(today: string, iso: string): string {
  const d = daysBetween(today, iso);
  if (d === 0) return Number(iso.slice(11, 13)) < 12 ? "this morning" : "today";
  if (d === -1) return "yesterday";
  if (d > -7) return weekday(iso, "long");
  return dayMonth(iso);
}

export type Bucket = "overdue" | "today" | "soon" | "later" | "someday";

/** Which shelf of the daily list an item sits on. */
export function bucketFor(today: string, due: string | null): Bucket {
  if (!due) return "someday";
  const d = daysBetween(today, due);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "soon";
  return "later";
}
