-- DayTrace memory, as SQLite.
--
-- This runs inside the browser (SQLite compiled to WebAssembly) and is saved
-- to the browser's own storage, so there is no database server to host. The
-- tables mirror data/seed/expected.json one-to-one, which is how the seed
-- loader will fill them.
--
-- Dates are ISO-8601 text ('2026-10-22' or '2026-10-22T09:00:00'). SQLite has
-- no date type, and ISO strings sort correctly as plain text.

PRAGMA foreign_keys = ON;

-- Everything Mina pastes in, exactly as pasted. Never edited: if the AI gets
-- something wrong we can always re-read the original.
CREATE TABLE notes (
  id           TEXT PRIMARY KEY,
  captured_at  TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('note', 'screenshot', 'message')),
  sender       TEXT,            -- who a message came from
  app          TEXT,            -- where a screenshot was taken
  text         TEXT NOT NULL
);

-- People and organisations that show up in notes. Aliases let "Sarah C." and
-- "Sarah" resolve to the same row.
CREATE TABLE people (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL CHECK (kind IN ('person', 'org')),
  role     TEXT,
  aliases  TEXT NOT NULL DEFAULT '[]'   -- JSON array of strings
);

-- A thread is a bit of life that several items belong to ("Fernway rebrand").
CREATE TABLE threads (
  id     TEXT PRIMARY KEY,
  title  TEXT NOT NULL,
  hue    TEXT NOT NULL
);

-- The extracted things to follow up on.
--   todo    - I owe someone something
--   waiting - someone owes me something
--   event   - something happens at a time
CREATE TABLE items (
  id        TEXT PRIMARY KEY,
  kind      TEXT NOT NULL CHECK (kind IN ('todo', 'waiting', 'event')),
  thread    TEXT REFERENCES threads(id),
  title     TEXT NOT NULL,
  due       TEXT,                -- best-guess date, NULL when none was given
  time      TEXT,                -- 'HH:MM' for events
  due_text  TEXT,                -- the original words, e.g. "by Friday"
  status    TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done'))
);

CREATE TABLE item_people (
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, person_id)
);

-- Which notes talk about which item, and what each note did to it. This is
-- the item's history: created on the 9th, nudged on the 15th, done on the 21st.
CREATE TABLE item_mentions (
  item_id  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  role     TEXT NOT NULL CHECK (role IN ('created', 'updated', 'resolved')),
  PRIMARY KEY (item_id, note_id)
);

-- How items connect. "Waiting for Sarah's approval" depends_on "send the
-- proposal" - this table is the part that makes DayTrace more than a list.
CREATE TABLE links (
  from_item  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_item    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  relation   TEXT NOT NULL CHECK (relation IN ('depends_on', 'part_of', 'follows_up', 'related')),
  why        TEXT,
  PRIMARY KEY (from_item, to_item, relation)
);

-- Coming with search: one embedding (a list of numbers that captures meaning)
-- per note, stored as raw bytes, so "that coffee client" can find Fernway.
CREATE TABLE note_embeddings (
  note_id  TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  model    TEXT NOT NULL,
  vector   BLOB NOT NULL
);

-- The daily list asks "what's open, soonest first" constantly.
CREATE INDEX items_open_by_due ON items (status, due);
CREATE INDEX mentions_by_note  ON item_mentions (note_id);
