-- Local Community Event Planning Platform - SQLite schema (local development & tests)
-- Mirrors schema.mssql.sql (Azure SQL Database) column-for-column.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','organizer','admin')),
  bio           TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  organizer_id TEXT NOT NULL REFERENCES users(id),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL,
  location     TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  end_time     TEXT NOT NULL,
  capacity     INTEGER NOT NULL CHECK (capacity > 0),
  image_url    TEXT,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','cancelled')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS ix_events_start     ON events(start_time);
CREATE INDEX IF NOT EXISTS ix_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS ix_events_category  ON events(category);

CREATE TABLE IF NOT EXISTS registrations (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_registrations_user ON registrations(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_comments_event ON comments(event_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  event_id   TEXT REFERENCES events(id),
  type       TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id, is_read);
