/**
 * The morning nudges: "here are the 3 things worth doing first, and why" -
 * with a ready-to-send message when the next step is talking to someone.
 *
 * Like extraction, it has a request shape (checked on the server), an answer
 * shape (forced on the AI with structured outputs), and fixed instructions.
 */

import { z } from "zod";
import { closeSchema } from "../extract/schema";

export const SuggestRequest = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z
    .array(
      z.object({
        id: z.string().max(40),
        kind: z.enum(["todo", "waiting", "event"]),
        title: z.string().max(200),
        due: z.string().nullable(),
        people: z.array(z.string().max(80)).max(10),
        thread: z.string().max(120).nullable(),
        /** Days since the item first appeared. */
        age_days: z.number().int(),
        /** Days since any note last mentioned it. */
        quiet_days: z.number().int(),
        /** How many other items are waiting on this one. */
        blocks: z.number().int(),
      }),
    )
    .max(60),
});

export type SuggestRequest = z.infer<typeof SuggestRequest>;

export const Suggestions = z.object({
  suggestions: z
    .array(
      z.object({
        item_id: z.string().describe("id of the item this is about."),
        action: z.string().describe("The next step, short and specific: 'Nudge Priya about the application'."),
        why: z.string().describe("One short, friendly sentence on why now."),
        draft: z.string().nullable().describe("A ready-to-send message if the step is contacting someone, else null."),
      }),
    )
    .describe("At most 3, most important first."),
});

export type Suggestions = z.infer<typeof Suggestions>;

export const suggestionsJsonSchema = () => closeSchema(z.toJSONSchema(Suggestions) as Record<string, unknown>);

export const SUGGEST_SYSTEM = `You help someone choose what to do first today from their list of follow-ups. Be a calm, kind assistant, not a nag.

Pick at most 3 items, most important first. Weigh:
- overdue or due today;
- items other things are waiting on ("blocks" > 0);
- waiting items that have gone quiet (high quiet_days) - the move is a polite nudge;
- events coming up soon that need preparation.
Skip anything that can safely wait.

For each pick, write the next step as a short action and one sentence on why now. When the step is contacting someone (a nudge, a reply, a confirmation), write a short ready-to-send message in "draft": two or three warm, specific sentences, no subject line, no sign-off name. Otherwise draft is null.

Only use item ids from the list.`;

export function suggestUserMessage(req: SuggestRequest): string {
  return `<today>${req.today}</today>\n<items>${JSON.stringify(req.items)}</items>`;
}
