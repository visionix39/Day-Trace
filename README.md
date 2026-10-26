# DayTrace

**The AI that remembers your unfinished business.**

You know you have to reply to someone, cancel a trial, or chase a job
application, but by the time it matters you've forgotten the context. DayTrace
is an inbox you drop notes, messages and screenshot text into. It pulls out
what you owe, what you're waiting on, who's involved and when. It connects the
pieces ("waiting for Sarah's approval" links back to the proposal you sent last
Tuesday), lets you search everything you've ever dropped in, and starts each
day with a few next steps.

Free for everyone who opens it: the AI runs on Groq's free tier with the
site's own key, and search runs on an open-source model inside your browser.

## Run it

You need **Node 20 or newer** (`.nvmrc` pins 22).

```bash
npm install
cp .env.example .env.local      # then paste your free Groq key into it
npm run dev                     # http://localhost:3200
```

**Getting the free key (2 minutes, no card):** sign up at
[console.groq.com](https://console.groq.com), open **API Keys**, create one,
and put it in `.env.local` as `GROQ_API_KEY=...`. Restart `npm run dev`.

Without a key everything still works: notes are read by the offline rules
instead, and the app says so.

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run eval`       | Scores the offline rules against the answer key                 |
| `npm run eval -- --ai` | Scores the Groq model (uses your key, ~22 requests)           |
| `npm run check:seed` | Checks the sample dataset for broken references and bad dates   |
| `npm run typecheck`  | Runs TypeScript over everything without building                |
| `npm run build`      | Production build (what Vercel runs)                             |

## Put it online (Vercel)

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). The
   defaults are right.
2. In **Settings → Environment Variables**, add `GROQ_API_KEY` with your key.
3. Deploy. Anyone with the link can use the AI. The key stays on Vercel and is
   never sent to visitors' browsers.

## Try it

1. Open the app. The first visit fills your notebook with the sample day.
2. **Start here** shows up to three next steps. For a nudge, there's a
   ready-to-send message you can copy.
3. Drop a note in and press **Tuck it in** (or ⌘ + Enter):
   - `Sent Sarah the moodboard link. Need to send Priya my portfolio by Monday.`
   - **Screenshot text:** `WATERWORKS CO` / `Amount due  $42.10` / `Due by 3 Nov 2026`
   - **Message** from `Leila`: `Can you bring the candles? I'll pick up the flowers.`
4. **Here's what I found** lists what was picked up, including items it
   finished and connections it made. Untick mistakes and save. An **Undo**
   appears in the corner after every change.
5. Hover a row on the list and click the pencil to fix a title or date, or
   remove the item.
6. **Look back** answers questions: "the job hunt", "bills last week", "what is
   Sarah waiting on?", "anything from Leila", "October".
7. **read by: DayTrace AI · switch** flips to the offline rules and back.

## How it works

```
 your browser                                     Vercel                 Groq (free)
 ────────────                                     ──────                 ───────────
 note ─► pick the related open items (RAG) ─► /api/extract ─► gpt-oss-120b
                                                  (holds key,       answers in an
                                                   rate-limits)     exact JSON shape
 review card ◄─ checked against your notebook ◄──────────┘
      │
      ▼
 SQLite (sql.js) ─► saved to IndexedDB        no copy is kept on the server
      │
      ├─► embeddings (bge-small, runs in a Web Worker) ─► Look back search
      └─► today's open items ─► /api/suggest ─► Start here nudges
```

- **Your notebook lives in your browser.** It's real SQLite compiled to
  WebAssembly, created from `data/schema.sql` and saved to IndexedDB after each
  change. Undo is just "put back the copy from before".
- **The AI call goes through our server only to protect the key.** The two
  routes in `src/app/api` check the request, rate-limit each visitor, forward
  it to Groq and return the answer. They store nothing.
- **Structured outputs.** The model is handed a JSON Schema
  (`src/lib/extract/schema.ts`) in strict mode, so its answer always has the
  right shape. It's checked again on both server and browser, and anything
  pointing at a thread or item that doesn't exist is dropped.
- **RAG and linking.** With each note the AI gets the open items most related
  to it (shared words, shared people, recency, and meaning when search is
  ready; see `context.ts`). That's how it can say "this finishes *Send Sarah
  the moodboard link*" or "this waits on the proposal".
- **Hybrid, time-aware search.** "What did Sarah say last week" is split into
  a time range ("last week") and a question ("Sarah said"). The results combine
  meaning (embedding similarity), matching words, people and dates, and each
  result says which of those it matched on.
- **Nudges.** The AI ranks open items by urgency, what's blocking what, and
  what's gone quiet, and drafts messages. The answer is cached for the day, so
  opening the app doesn't use up the free quota.
- **Always a fallback.** No key, quota busy, or offline: the hand-written rules
  (`offline.ts`) read the note and pick the nudges instead.

## How good is it?

`npm run eval` replays Mina's 22 notes into an empty notebook, accepts every
suggestion, and compares the result with the hand-written answer key.

| Reader        | Found | Precise | F1   | Kind | Date | Status | Links |
| ------------- | ----- | ------- | ---- | ---- | ---- | ------ | ----- |
| Offline rules | 68%   | 65%     | 0.67 | 92%  | 83%  | 92%    | 0%    |
| Groq AI       | run `npm run eval -- --ai` with your key to fill this in |

## Project structure

```
day-trace/
├─ data/                     schema.sql and the synthetic dataset + answer key
├─ eval/                     saved scores from npm run eval
├─ scripts/                  eval.ts, check-seed.mjs, copy-wasm.mjs
└─ src/
   ├─ app/
   │  ├─ api/extract/        serverless: read a note with the AI
   │  └─ api/suggest/        serverless: pick today's next steps
   ├─ components/            Desk, Composer, ReviewCard, Nudges, DailyList,
   │                         WaitingOn, InboxStack, LookBack, ThreadStrands,
   │                         UndoToast, Masthead, Chips, Doodles
   └─ lib/
      ├─ ai/                 Groq client (server only) and route guard rails
      ├─ db/                 SQLite in the browser, IndexedDB, sample day
      ├─ extract/            offline rules, schema, prompt, context (RAG), checks
      ├─ search/             embeddings worker, time phrases, hybrid ranking
      ├─ suggest/            nudges: schema, prompt, offline picker
      ├─ store.ts            app state (zustand)
      ├─ view.ts             snapshot → daily list, threads, lookups
      └─ dates.ts, types.ts
```

## The stack, and why

| Piece                    | Why it's here                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| **Next.js 15 + React 19** | A static page plus two serverless routes; everything deploys to Vercel in one go.                |
| **Groq (free tier)**     | Free, fast, no card, and by default doesn't keep request data. `gpt-oss-120b` supports strict JSON schemas. |
| **openai SDK**           | Groq speaks OpenAI's API, so the official OpenAI client talks to it.                              |
| **sql.js**               | Real SQLite in the browser. Same SQL as a .sqlite file, no database server.                       |
| **transformers.js + bge-small** | Open-source embeddings running in the browser: semantic search with no key and no cost.    |
| **zod**                  | Writes each AI answer shape once; makes the JSON Schema and checks the reply.                     |
| **zustand**              | One small store, so every section reads the same snapshot.                                        |
| **Tailwind CSS 4**       | Layout. The paper, tape and stitches are hand-written CSS in `globals.css`.                       |

## The design

A well-loved paper notebook on a kitchen table, not a glossy dashboard: an
index-card composer, a ruled daily list with a red margin, sticky notes held on
with washi tape, speech-bubble messages, typewriter screenshot text, and one
red thread per corner of life with items sewn on as buttons. The copy is gentle
("a little overdue"), and dark mode is a warm "lamplight". Fonts: Fraunces,
Figtree, Caveat, Courier Prime.

## Privacy

- Your notebook (notes, items, search vectors) is stored only in your
  browser's IndexedDB.
- In **AI mode**, each note you tuck in (with the related open items and the
  names in your notebook) is sent through DayTrace's server to Groq to be
  read. DayTrace keeps no copy. Groq says it doesn't retain inference data by
  default, apart from short-term logs for abuse or reliability checks. See
  [Groq's data policy](https://console.groq.com/docs/your-data).
- In **Offline** mode, nothing leaves your browser.
- Search always runs on your device. The model is downloaded once from
  Hugging Face.
- The repository never contains a key; it lives in `.env.local` (ignored by
  git) or Vercel's settings.

## Roadmap

- [x] Set up the repository: README, structure, environment, synthetic dataset
- [x] Paste a note → extract todos, waiting-ons, events, people and dates
- [x] Save to SQLite in the browser; edit, remove, undo
- [x] Score extractors against `expected.json`
- [x] Link related items across notes, with RAG context
- [x] Search history with embeddings and time-aware retrieval
- [x] Next-step suggestions with ready-to-send drafts
- [ ] Ideas: export/import the notebook file, reminders, screenshot OCR in the browser

## Sample data

Everything you see on first run comes from `data/seed/`: three weeks in the
life of **Mina Okafor**, a made-up freelance designer. Every person, company
and amount is invented. See [`data/seed/README.md`](data/seed/README.md).
