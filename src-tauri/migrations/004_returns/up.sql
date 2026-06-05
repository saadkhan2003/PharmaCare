-- Migration 004: Returns table (Phase 4)
--
-- Creates the returns table for customer returns, supplier returns, and
-- write-offs. Every return is an append-only correction record that never
-- edits original sales or purchases (D-34).

CREATE TABLE IF NOT EXISTS returns (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    return_type    TEXT NOT NULL CHECK(return_type IN ('customer', 'supplier', 'write_off')),
    reference_id   INTEGER,
    medicine_id    INTEGER NOT NULL REFERENCES medicines(id),
    batch_id       INTEGER REFERENCES batches(id),
    quantity       INTEGER NOT NULL CHECK(quantity > 0),
    reason         TEXT,
    condition      TEXT CHECK(condition IN ('resellable', 'damaged', 'expired') OR condition IS NULL),
    refund_amount  REAL NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
    processed_by   INTEGER NOT NULL REFERENCES users(id),
    return_date    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for looking up returns by reference (sale/purchase ID)
CREATE INDEX IF NOT EXISTS idx_returns_reference ON returns(return_type, reference_id);

-- Index for date-range filtering and reporting
CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date);

-- Index for medicine-level loss queries
CREATE INDEX IF NOT EXISTS idx_returns_medicine ON returns(medicine_id);
