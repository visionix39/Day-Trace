/**
 * Date helpers that speak like a person ("tomorrow", "Sat") rather than a
 * calendar. All of them take "today" as an argument instead of reading the
 * clock, so the sample data always looks the same no matter when you open it.
 *
 * Dates are handled as plain 'YYYY-MM-DD' strings at noon UTC, which sidesteps
 * time-zone and daylight-saving edge cases for day arithmetic.
 */

const DAY = 86_400_000;

const toUtc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T12:00:00Z`);

/** Whole days from `today` to `iso` (negative = in the past). */
export function daysBetween(today: string, iso: string): number {
  return Math.round((toUtc(iso) - toUtc(today)) / DAY);
}

const weekday = (iso: string, style: "short" | "long" = "short") =>
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
