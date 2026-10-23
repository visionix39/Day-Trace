/**
 * The exact JSON shape an AI must answer with.
 *
 * Every provider supports "structured outputs": you hand it a JSON Schema and
 * it is constrained to produce JSON that fits. We write the shape once with
 * zod, give providers the JSON Schema version of it, and then check the
 * answer with zod again - so a model that drifts (a local one, say) is caught
 * here rather than half-saving bad data.
 */

import { z } from "zod";

export const Extraction = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(["todo", "waiting", "event"]),
        title: z.string().describe("Short, list-style, from the writer's point of view: 'Send Sarah the moodboard link'."),
        people: z.array(z.string()).describe("Names as they should be shown. Never the writer themself."),
        due: z.string().nullable().describe("YYYY-MM-DD, or null if no date is given or implied."),
        time: z.string().nullable().describe("HH:MM in 24h, for events with a time, else null."),
        due_text: z.string().nullable().describe("The original words that gave the date, e.g. 'by Friday'."),
        thread_id: z.string().nullable().describe("id of an existing thread this belongs to, else null."),
        new_thread_title: z.string().nullable().describe("If no existing thread fits, a short title for a new one; else null."),
      }),
    )
    .describe("New things to follow up on that are not already in the open list."),
  updates: z
    .array(
      z.object({
        item_id: z.string().describe("id of an item from the open list."),
        action: z.enum(["resolve", "update"]),
        new_due: z.string().nullable().describe("YYYY-MM-DD if the note moves the date, else null."),
        reason: z.string().describe("A few words quoting or paraphrasing the note."),
      }),
    )
    .describe("Changes to items already in the open list."),
  links: z
    .array(
      z.object({
        from: z.string().describe("'new:N' for the Nth new item (0-based), or an existing item id."),
        to: z.string().describe("'new:N' or an existing item id."),
        relation: z.enum(["depends_on", "part_of", "follows_up", "related"]),
        why: z.string().describe("One short sentence."),
      }),
    )
    .describe("Connections between items. 'from depends_on to' means from can't finish until to is done."),
  people: z
    .array(
      z.object({
        name: z.string(),
        kind: z.enum(["person", "org"]),
        role: z.string().nullable().describe("e.g. 'Landlord', 'Recruiter at Lumen Labs', or null."),
      }),
    )
    .describe("Everyone named in items above who is NOT already in the known people list."),
});

export type Extraction = z.infer<typeof Extraction>;

/**
 * The JSON Schema version, tightened the way the strictest providers want:
 * every object closed to extra keys, and no $schema header.
 */
export function extractionJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(Extraction) as Record<string, unknown>;
  delete schema.$schema;
  const close = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (obj.type === "object") obj.additionalProperties = false;
    Object.values(obj).forEach((child) => (Array.isArray(child) ? child.forEach(close) : close(child)));
  };
  close(schema);
  return schema;
}
