-- Public roadmap board for navibeat.app/roadmap.
--
-- Zammad on the NAS is the source of truth for every item; this database is a
-- read model the edge can serve, plus the two things that can only originate at
-- the edge: votes and what visitors write in. Nothing here is authoritative
-- except `votes`, `comments` and `submissions`, and the sync carries those back.

CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY,        -- Zammad ticket id
  number       TEXT    NOT NULL,
  title        TEXT    NOT NULL,           -- public_title ONLY, never the ticket subject
  kind         TEXT,                       -- BUG | CR
  section      TEXT,                       -- Apple | Android | Linux | Rockbox | Mixes | NaviFin
  status       TEXT    NOT NULL,           -- considering | progress | shipped | declined
  votes        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS items_board ON items(status, votes DESC);

-- One row per person per item. `voter` is a salted hash of IP + user agent: the
-- raw address is never stored. Households behind one address share a hash and
-- therefore share a vote, which is the accepted cost of not asking anyone to
-- make an account.
CREATE TABLE IF NOT EXISTS votes (
  item_id    INTEGER NOT NULL,
  voter      TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  PRIMARY KEY (item_id, voter)
);
CREATE INDEX IF NOT EXISTS votes_by_voter ON votes(voter, created_at);

-- "I have this too" in words. Written by visitors, so nothing renders until a
-- human approves it: `approved` is the switch, and it starts off.
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL,
  body       TEXT    NOT NULL,
  author     TEXT,
  voter      TEXT    NOT NULL,
  approved   INTEGER NOT NULL DEFAULT 0,
  synced     INTEGER NOT NULL DEFAULT 0,   -- has the NAS copied it into the ticket
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_visible ON comments(item_id, approved);
CREATE INDEX IF NOT EXISTS comments_pending ON comments(synced);

-- Something a visitor asks for that is not on the board yet. It never appears
-- publicly from here: the NAS turns each one into a Zammad ticket, the same
-- classifier and the same injection hardening apply, and it reaches the board
-- only if it comes back marked public.
CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  body       TEXT,
  email      TEXT,
  kind       TEXT,
  section    TEXT,
  voter      TEXT    NOT NULL,
  synced     INTEGER NOT NULL DEFAULT 0,
  ticket_id  INTEGER,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_pending ON submissions(synced);
CREATE INDEX IF NOT EXISTS submissions_rate ON submissions(voter, created_at);
