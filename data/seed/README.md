# Synthetic dataset

Three weeks (1–22 October 2026) of Mina Okafor's inbox. Mina is invented, and
so is everyone and everything in it.

## Files

**`notes.json`: the input.** 22 raw captures, written the way people really
jot things down: lowercase, emoji, half-sentences. Each has a `source`:

- `note`: something Mina typed
- `message`: a text from someone (`from` says who)
- `screenshot`: text lifted from a screenshot (`app` says where), with OCR-ish
  spacing

**`expected.json`: the answer key.** What a perfect extractor would produce
after reading every note:

- `people`: 13 people and organisations, with aliases ("Sarah C." → Sarah Chen)
- `threads`: 7 corners of Mina's life (a client project, a job application, …)
- `items`: 19 things to follow up on. Each is a `todo` (Mina owes it), `waiting`
  (someone owes Mina) or `event` (happens at a time), with a due date, the
  original wording (`due_text`), and a `mentions` history of which notes
  created, updated or resolved it
- `links`: 9 connections between items, each with a one-line `why`
- `notes_without_items`: notes that contain nothing to act on

`anchor_date` (2026-10-22) is the fixed "today". Relative phrases like "by
Friday" are resolved against the date each note was captured, and the UI
always treats the anchor as today, so the sample looks the same whenever you
open it.

## What it's built to test

| Case                               | Where                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| Relative dates                     | "by Friday" (n04, n19), "Thursday or Friday next week" (n10) |
| Something resolved by a later note | proposal sent (n04 → n07), bill paid (n05 → n20)            |
| Waiting on someone else            | Sarah's sign-off (n07), Lumen's reply (n03)                 |
| A dependency chain                 | sign-off waits on proposal *and* revised timeline           |
| The same person, different names   | "Sarah Chen", "Sarah", "Sarah C."                           |
| Screenshot text with noise         | n05, n09, n20                                               |
| One note touching several items    | n20 updates the gym and Streamly and resolves the bill      |
| Nothing to extract                 | n06 (a café and a baking show)                              |
| Overdue on "today"                 | the moodboard link (n12, n18)                               |

Run `npm run check:seed` after any edit. It checks that every reference
resolves, dates parse, notes are in time order, and every note is either used
or marked as noise.
