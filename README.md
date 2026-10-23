# DayTrace

**The AI that remembers your unfinished business.**

You know you have to reply to someone, cancel a trial, or chase a job
application, but by the time it matters you've forgotten the context. DayTrace
is an inbox you drop notes, messages and screenshot text into. It pulls out
what you owe, what you're waiting on, who's involved and when. It connects the
pieces ("waiting for Sarah's approval" links back to the proposal you sent last
Tuesday) and gives you a calm follow-up list each morning.

> **Status: steps 1-3 of the roadmap.** You can paste a note, have it read by
> offline rules or an AI of your choice, review what it found, and save it to a
> real SQLite database that lives in your browser.

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

## Try it

1. Open the app. The first visit fills the database with the sample day (see
   [Sample data](#sample-data)).
2. Type a note in **drop something in…** and press **Tuck it in** (or ⌘ + Enter).
   Some good ones to try:
   - `Sent Sarah the moodboard link. Need to book a vet appointment by next Tuesday.`
     This ticks off an existing item and adds a new one.
   - Choose **Screenshot text** and paste a bill:
     `WATERWORKS CO` / `Amount due  $42.10` / `Due by 3 Nov 2026`
   - Choose **Message**, write `Leila` in *from*, and paste
     `Can you bring the candles? I'll pick up the flowers.`
     That gives you one to-do for you and one waiting-on for Leila.
3. **Here's what I found** shows what was picked up. Untick anything that's
   wrong, then **Save to my desk**.
4. Tick things off on the list. Reload the page and everything is still there.
5. Click **read by: Offline rules** to switch helpers. Claude, GPT and Gemini
   need your own API key; **Local (Ollama)** needs Ollama running on your machine.
6. At the bottom of the page: **start a fresh notebook** (empty) or **bring back
   the sample day**.

## How it works

```
 you paste a note
        │
        ▼
 extract()  ──── Offline rules (src/lib/extract/offline.ts)
        │    └── or an AI: Claude / GPT / Gemini / Ollama, given the note,
        │        your open items, people and threads, and a JSON schema
        ▼
 a Proposal: new items · updates to old ones · links      (nothing saved yet)
        │
        ▼
 review card: you untick mistakes
        │
        ▼
 saveProposal()  ──►  SQLite in the browser (sql.js)  ──►  IndexedDB
        │
        ▼
 the desk redraws from the new snapshot
```

- **SQLite in the browser.** [sql.js](https://sql.js.org) is SQLite compiled to
  WebAssembly. The tables in `data/schema.sql` are created on first visit. After
  every change the whole database is exported as bytes and saved to IndexedDB,
  the browser's built-in storage, so it's still there next time.
- **Two kinds of extractor, one shape.** Both produce the same `Proposal`, so
  the UI doesn't care which one ran. The offline one is a **baseline**: simple
  rules that any AI has to beat.
- **Structured outputs.** The AI isn't asked to "reply in JSON". It's handed a
  JSON Schema (`src/lib/extract/schema.ts`) and the provider forces its answer
  into that shape. The answer is then checked again with zod, and anything that
  points at a thread or item that doesn't exist is dropped.
- **Context makes the links.** The AI sees your open items, so it can say "this
  finishes *Send Sarah the moodboard link*" or "this waits on the proposal"
  instead of creating duplicates. Today that's every open item; the search step
  will narrow it to the relevant ones.
- **You stay in charge.** Nothing is saved until you press Save.
- **The sample day moves with time.** It was written around 22 Oct 2026. When
  it loads, every date is shifted so that day lands on your real today.

## Project structure

```
day-trace/
├─ data/
│  ├─ schema.sql             SQLite tables (imported directly by the app)
│  └─ seed/                  the synthetic dataset and its answer key
├─ scripts/
│  ├─ check-seed.mjs         dataset validator
│  └─ copy-wasm.mjs          puts SQLite's .wasm file into public/
├─ src/
│  ├─ app/                   layout, page, global styles
│  ├─ components/
│  │  ├─ Desk.tsx            opens the database, lays out every section
│  │  ├─ Composer.tsx        the "drop something in" card
│  │  ├─ ReviewCard.tsx      "here's what I found", tick to keep
│  │  ├─ HelperSettings.tsx  pick Offline / Claude / GPT / Gemini / Ollama
│  │  ├─ DailyList.tsx       follow-ups on a ruled page (ticks save)
│  │  ├─ WaitingOn.tsx       things other people owe you
│  │  ├─ InboxStack.tsx      recent captures
│  │  ├─ ThreadStrands.tsx   how items connect
│  │  └─ Masthead, Chips, Doodles
│  └─ lib/
│     ├─ db/                 SQLite: open, read, save, reset; IndexedDB; sample day
│     ├─ extract/
│     │  ├─ offline.ts       the rule-based extractor
│     │  ├─ schema.ts        the JSON shape every AI must answer in
│     │  ├─ prompt.ts        what the AI is told
│     │  ├─ match.ts         name and word matching
│     │  ├─ providers/       Claude, GPT, Gemini, Ollama
│     │  └─ index.ts         one extract() for all of them, plus safety checks
│     ├─ store.ts            app state (zustand)
│     ├─ view.ts             snapshot → daily list, threads, lookups
│     ├─ dates.ts            date maths and friendly labels
│     └─ types.ts
└─ …config files
```

## The stack, and why

| Piece                       | Why it's here                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Next.js 15 + React 19**   | Builds to a static site that Vercel serves from its CDN, so there's no server to run or pay for.                  |
| **TypeScript (strict)**     | The data has a fixed shape (notes, items, links). Types catch a misspelt field before it reaches the screen.      |
| **Tailwind CSS 4**          | Layout and spacing. The crafted parts (paper, tape, stitches) are hand-written CSS in `globals.css`.              |
| **sql.js**                  | Real SQLite, running in the browser. Same SQL as a .sqlite file on disk, no database server.                      |
| **zod**                     | Describes the AI's answer once; gives the JSON Schema to providers and validates what comes back.                 |
| **zustand**                 | One small store for app state, so every section reads the same snapshot.                                          |
| **Anthropic / OpenAI / Google SDKs** | Official clients for each AI. Each is only downloaded when you first use it.                             |
| **lucide-react**            | A few plain icons. The personality comes from the custom doodles.                                                 |

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

- Your notes live in **your browser's IndexedDB** and nowhere else. The deployed
  site has no backend.
- AI helpers are **bring your own key**. Requests go straight from your browser
  to the provider you picked. Keys are kept in memory unless you tick
  *Remember my keys on this device*, which saves them in this browser's
  localStorage.
- **Offline rules** and **Ollama** never send your note anywhere.
- The repository contains no API keys and never will.

## Roadmap

- [x] **Set up the repository:** README, structure, environment, synthetic dataset
- [x] **Paste a note → extract** todos, waiting-ons, events, people and dates (offline rules or an LLM)
- [x] **Save to SQLite in the browser;** ticks and saved notes persist
- [ ] Score each extractor against `expected.json` (offline vs. Claude vs. GPT…)
- [ ] Search your history with embeddings and time-aware retrieval
- [ ] Edit an item after saving; undo
- [ ] A next-action suggester for the morning list

## Sample data

Everything you see on first run comes from `data/seed/`: three weeks in the
life of **Mina Okafor**, a made-up freelance designer. Every person, company
and amount is invented. See [`data/seed/README.md`](data/seed/README.md) for
what each file contains and what it tests.
