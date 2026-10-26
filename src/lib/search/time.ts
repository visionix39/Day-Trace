/**
 * Temporal retrieval: understanding *when* in a question.
 *
 * "what did Sarah say last week" is really two questions - "Sarah said" and
 * "last week". This pulls the time phrase out, turns it into a date range,
 * and hands back the rest of the question for the meaning search.
 */

import { addDays, dayOfWeek, endOfMonth } from "../dates";

export interface TimeRange {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive
  label: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const monday = (iso: string) => addDays(iso, -((dayOfWeek(iso) + 6) % 7));

export function parseTimeQuery(query: string, today: string): { range: TimeRange | null; rest: string } {
  const q = query.toLowerCase();
  const take = (rx: RegExp, make: (m: RegExpMatchArray) => TimeRange | null) => {
    const m = q.match(rx);
    if (!m) return null;
    const range = make(m);
    return range ? { range, rest: (q.slice(0, m.index) + q.slice(m.index! + m[0].length)).replace(/\s+/g, " ").trim() } : null;
  };

  return (
    take(/\b(?:from |on )?today\b/, () => ({ from: today, to: today, label: "today" })) ??
    take(/\b(?:from |on )?yesterday\b/, () => ({ from: addDays(today, -1), to: addDays(today, -1), label: "yesterday" })) ??
    take(/\bthis week\b/, () => ({ from: monday(today), to: today, label: "this week" })) ??
    take(/\blast week\b/, () => ({ from: addDays(monday(today), -7), to: addDays(monday(today), -1), label: "last week" })) ??
    take(/\bthis month\b/, () => ({ from: `${today.slice(0, 7)}-01`, to: today, label: "this month" })) ??
    take(/\blast month\b/, () => {
      const start = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7) + "-01";
      return { from: start, to: endOfMonth(start), label: "last month" };
    }) ??
    take(/\b(?:recently|lately|the last (?:few|couple of) days)\b/, () => ({ from: addDays(today, -7), to: today, label: "the last week" })) ??
    take(/\b(\d+) days? ago\b/, (m) => {
      const d = addDays(today, -Number(m[1]));
      return { from: d, to: d, label: `${m[1]} days ago` };
    }) ??
    take(/\b(?:last |on )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/, (m) => {
      // The most recent one before today.
      const back = (dayOfWeek(today) - WEEKDAYS.indexOf(m[1]) + 7) % 7 || 7;
      const d = addDays(today, -back);
      return { from: d, to: d, label: m[1] };
    }) ??
    take(/\b(?:in )?(january|february|march|april|may|june|july|august|september|october|november|december)\b/, (m) => {
      const month = MONTHS.indexOf(m[1]) + 1;
      let year = Number(today.slice(0, 4));
      if (month > Number(today.slice(5, 7))) year -= 1; // "in December" in October means last year
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      return { from: start, to: endOfMonth(start), label: m[1] };
    }) ?? { range: null, rest: query.trim() }
  );
}
