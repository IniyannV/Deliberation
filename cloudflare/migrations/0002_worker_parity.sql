ALTER TABLE cases ADD COLUMN case_number TEXT;
ALTER TABLE cases ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN kind TEXT;
ALTER TABLE users ADD COLUMN login TEXT;
ALTER TABLE users ADD COLUMN seat INTEGER;
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN case_number TEXT;
ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE exhibits ADD COLUMN number TEXT;
ALTER TABLE exhibits ADD COLUMN title TEXT;
ALTER TABLE exhibits ADD COLUMN party TEXT;
ALTER TABLE exhibits ADD COLUMN description TEXT;
ALTER TABLE exhibits ADD COLUMN type TEXT;
ALTER TABLE exhibits ADD COLUMN status TEXT NOT NULL DEFAULT 'admitted';
ALTER TABLE exhibits ADD COLUMN lines_json TEXT;
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
