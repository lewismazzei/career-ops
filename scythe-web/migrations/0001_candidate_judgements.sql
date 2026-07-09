CREATE TABLE IF NOT EXISTS candidate_judgements (
  url TEXT PRIMARY KEY,
  vote TEXT CHECK (vote IN ('up', 'down') OR vote IS NULL),
  saved INTEGER NOT NULL DEFAULT 0 CHECK (saved IN (0, 1)),
  company TEXT NOT NULL DEFAULT '',
  opportunity TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS candidate_judgements_saved_idx ON candidate_judgements(saved, updated_at);
CREATE INDEX IF NOT EXISTS candidate_judgements_vote_idx ON candidate_judgements(vote, updated_at);

CREATE TABLE IF NOT EXISTS candidate_judgement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  action TEXT NOT NULL,
  value TEXT,
  company TEXT NOT NULL DEFAULT '',
  opportunity TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS candidate_judgement_events_url_idx ON candidate_judgement_events(url, created_at);
