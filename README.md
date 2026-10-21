# DayTrace

**The AI that remembers your unfinished business.**

You know you have to reply to someone, cancel a trial, or chase a job
application, but by the time it matters you've forgotten the context. DayTrace
is an inbox you drop notes, messages and screenshot text into. It pulls out
what you owe, what you're waiting on, who's involved and when. It connects the
pieces ("waiting for Sarah's approval" links back to the proposal you sent last
Tuesday) and gives you a calm follow-up list each morning.

> **Status: step 1 of the roadmap.** The repository, structure, environment and
> a synthetic dataset are in place. The UI runs on hand-labelled sample data so
> you can see the finished experience. AI extraction comes next.

## Run it

You need **Node 20 or newer** (`.nvmrc` pins 22).

```bash
npm install
npm run dev          # http://localhost:3200
```

Other scripts:

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run check:seed` | Checks the sample dataset for broken references and bad dates |
| `npm run typecheck`  | Runs TypeScript over everything without building              |
| `npm run build`      | Production build (what Vercel runs)                           |

No `.env` file is needed. DayTrace has no server and no API keys of its own
(see [Privacy and keys](#privacy-and-keys)).

## Project structure

```
day-trace/
├─ data/
│  ├─ schema.sql            SQLite tables: notes, people, threads, items, links
│  └─ seed/
│     ├─ notes.json         22 raw captures: what you paste in
│     ├─ expected.json      the answer key: what a perfect extractor pulls out
│     └─ README.md          how the dataset is built and what it tests
├─ scripts/
│  └─ check-seed.mjs        dataset validator (plain Node, no dependencies)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx         fonts and page metadata
│  │  ├─ page.tsx           the desk: every section put together
│  │  └─ globals.css        colour tokens, paper textures, light + dark
│  ├─ components/
│  │  ├─ Masthead.tsx       logo, greeting, today's date
│  │  ├─ Composer.tsx       the "drop something in" card
│  │  ├─ DailyList.tsx      follow-ups on a ruled notebook page
│  │  ├─ WaitingOn.tsx      things other people owe you
│  │  ├─ InboxStack.tsx     recent captures as stickies, bubbles, snapshots
│  │  ├─ ThreadStrands.tsx  how items connect, as buttons sewn on a thread
│  │  ├─ Chips.tsx          person stamps and due-date labels
│  │  └─ Doodles.tsx        hand-drawn SVGs (logo, sun, check, sewn button)
│  └─ lib/
│     ├─ types.ts           Note, Item, Person, Thread, Link
│     ├─ seed.ts            loads the dataset, builds the daily list
│     └─ dates.ts           "tomorrow", "Sat", "3 days ago"
├─ next.config.ts
├─ vercel.json              security headers for the deployed site
└─ package.json
```

As the roadmap moves forward, new code goes in `src/lib/db/` (SQLite in the
browser), `src/lib/extract/` (the AI extractor and its prompt) and
`src/lib/search/` (embeddings and retrieval).

## The stack, and why

| Piece                        | Why it's here                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Next.js 15 + React 19**    | Builds to a static site that Vercel serves from its CDN, so there's no server to run or pay for.                    |
| **TypeScript (strict)**      | The data has a fixed shape (notes, items, links). Types catch a misspelt field before it reaches the screen.        |
| **Tailwind CSS 4**           | Layout and spacing in the markup. The crafted parts (paper, tape, stitches) are hand-written CSS in `globals.css`.  |
| **SQLite** (`data/schema.sql`) | One small file-shaped database with real SQL for "what's open, soonest first". It runs in the browser via WebAssembly. |
| **lucide-react**             | A few plain icons. The personality comes from the custom doodles.                                                   |

Planned for later steps: `sql.js` (SQLite compiled to WebAssembly), an LLM for
extraction, and an embedding model for search.

## The design

The idea is a well-loved paper notebook on a kitchen table, not a glossy
dashboard.

- **Surfaces are desk objects.** The composer is an index card, the daily list is
  a ruled page with a red margin, notes are sticky notes held on with washi tape,
  messages are speech bubbles, and screenshot text sits in a photo frame in
  typewriter type.
- **One red thread.** Every part of life (a client, a job hunt, a birthday) is a
  thread with its own soft colour. Items are buttons sewn onto it, filled when
  done. This is the "connects related events" idea made visible.
- **Gentle language.** "a little overdue", not "OVERDUE". Overdue items use the
  thread colour, never alarm red.
- **Four typefaces, one job each.** Fraunces (soft serif) for headings, Figtree
  for reading, Caveat handwriting for asides, Courier Prime for screenshot text.
- **Lamplight dark mode.** It follows your system setting. The paper turns walnut
  and the ink turns cream.

## Privacy and keys

DayTrace is designed to keep your notes on your device. The database lives in
your browser's storage, and the deployed site has no backend that could see
your notes. When AI extraction arrives it will be **bring your own key**: you
paste a key from your own Claude, OpenAI or Gemini account (or point it at a
local model) and requests go straight from your browser to that provider. The
repository will never contain an API key.

## Roadmap

- [x] **Set up the repository:** README, structure, environment, synthetic dataset
- [ ] Paste a note → extract todos, waiting-ons, events, people and dates with an LLM
- [ ] Save everything to SQLite in the browser; ticks and edits persist
- [ ] Score the extractor against `expected.json`
- [ ] Link related items across notes (the thread view, for real)
- [ ] Search your history with embeddings and time-aware retrieval
- [ ] A next-action suggester for the morning list

## Sample data

Everything you see comes from `data/seed/`: three weeks in the life of **Mina
Okafor**, a made-up freelance designer. Every person, company and amount is
invented. See [`data/seed/README.md`](data/seed/README.md) for what each file
contains and what it tests.
