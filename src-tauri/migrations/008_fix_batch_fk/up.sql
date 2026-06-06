-- Migration 008: Fix FK references to batches table
--
-- Migration 005 renamed `batches` to `batches_old`, created a new `batches`,
-- copied data, then dropped `batches_old`. SQLite does NOT auto-rewrite
-- foreign-key references when a referenced table is renamed, so three child
-- tables still declare their FK against the dropped name:
--   - purchase_items.batch_id REFERENCES batches_old(id)
--   - sale_items.batch_id     REFERENCES batches_old(id)
--   - returns.batch_id        REFERENCES batches_old(id)
--
-- This was masked as long as `batch_id` was NULL (FK check skipped for NULL).
-- As soon as `update_item_batch_id` SETs a real id, the FK check fires
-- against the missing table and the purchase transaction fails with
-- "no such table: main.batches_old".
--
-- Fix: rebuild the three child tables with FK pointing at `batches`.
-- SQLite has no ALTER CONSTRAINT, so we use the rename-copy-drop pattern.
-- `PRAGMA foreign_keys=OFF` is required during the rebuild so that the
-- temporary NOT NULL / FK shape of the new table does not collide with
-- the data we are about to copy in (PRAGMA deferred-foreign-keys is OFF
-- by default in this app, so each ALTER triggers immediate validation).
--
-- Pre-flight (verified manually before writing this migration):
--   0 orphan batch_id rows across the three child tables.

PRAGMA foreign_keys = OFF;

-- =========================================================================
-- purchase_items
-- =========================================================================
CREATE TABLE purchase_items_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id      INTEGER NOT NULL REFERENCES purchases(id),
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    purchase_price   REAL    NOT NULL CHECK(purchase_price >= 0),
    expiry_date      TEXT    NOT NULL,
    batch_id         INTEGER          REFERENCES batches(id),
    line_cost        REAL    NOT NULL
);

INSERT INTO purchase_items_new
    (id, purchase_id, medicine_id, quantity, purchase_price, expiry_date, batch_id, line_cost)
SELECT id, purchase_id, medicine_id, quantity, purchase_price, expiry_date, batch_id, line_cost
FROM purchase_items;

DROP TABLE purchase_items;
ALTER TABLE purchase_items_new RENAME TO purchase_items;

CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_medicine ON purchase_items(medicine_id);

-- =========================================================================
-- sale_items
-- =========================================================================
CREATE TABLE sale_items_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id          INTEGER NOT NULL REFERENCES sales(id),
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    batch_id         INTEGER NOT NULL REFERENCES batches(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    unit_price       REAL    NOT NULL CHECK(unit_price >= 0),
    purchase_cost    REAL    NOT NULL CHECK(purchase_cost >= 0),
    item_discount    INTEGER NOT NULL DEFAULT 0 CHECK(item_discount >= 0),
    line_total       REAL    NOT NULL CHECK(line_total >= 0)
);

INSERT INTO sale_items_new
    (id, sale_id, medicine_id, batch_id, quantity, unit_price, purchase_cost, item_discount, line_total)
SELECT id, sale_id, medicine_id, batch_id, quantity, unit_price, purchase_cost, item_discount, line_total
FROM sale_items;

DROP TABLE sale_items;
ALTER TABLE sale_items_new RENAME TO sale_items;

CREATE INDEX idx_sale_items_sale    ON sale_items(sale_id);
CREATE INDEX idx_sale_items_medicine ON sale_items(medicine_id);
CREATE INDEX idx_sale_items_batch   ON sale_items(batch_id);

-- =========================================================================
-- returns
-- =========================================================================
CREATE TABLE returns_new (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    return_type    TEXT    NOT NULL CHECK(return_type IN ('customer', 'supplier', 'write_off')),
    reference_id   INTEGER,
    medicine_id    INTEGER NOT NULL REFERENCES medicines(id),
    batch_id       INTEGER          REFERENCES batches(id),
    quantity       INTEGER NOT NULL CHECK(quantity > 0),
    reason         TEXT,
    condition      TEXT    CHECK(condition IN ('resellable', 'damaged', 'expired') OR condition IS NULL),
    refund_amount  REAL    NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
    processed_by   INTEGER NOT NULL REFERENCES users(id),
    return_date    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO returns_new
    (id, return_type, reference_id, medicine_id, batch_id, quantity, reason, condition, refund_amount, processed_by, return_date)
SELECT id, return_type, reference_id, medicine_id, batch_id, quantity, reason, condition, refund_amount, processed_by, return_date
FROM returns;

DROP TABLE returns;
ALTER TABLE returns_new RENAME TO returns;

CREATE INDEX idx_returns_reference ON returns(return_type, reference_id);
CREATE INDEX idx_returns_date     ON returns(return_date);
CREATE INDEX idx_returns_medicine ON returns(medicine_id);

PRAGMA foreign_keys = ON;
