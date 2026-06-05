CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('owner', 'pharmacist')),
    is_active     INTEGER DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    token      TEXT UNIQUE NOT NULL,
    role       TEXT NOT NULL,
    username   TEXT NOT NULL,
    full_name  TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE login_attempts (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT NOT NULL,
    attempted_role TEXT,
    success        INTEGER NOT NULL,
    failure_reason TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE stock_movements (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_type   TEXT NOT NULL,
    medicine_id     INTEGER,
    batch_id        INTEGER,
    quantity_delta  INTEGER NOT NULL,
    reference_type  TEXT NOT NULL,
    reference_id    INTEGER,
    reason          TEXT,
    user_id         INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed initial settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('setup_complete', 'false');
