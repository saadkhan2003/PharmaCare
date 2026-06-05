-- Make purchase_id nullable in batches table to support opening stock batches
-- that don't originate from a supplier purchase.

ALTER TABLE batches RENAME TO batches_old;

CREATE TABLE batches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    purchase_id      INTEGER REFERENCES purchases(id),
    purchase_item_id INTEGER REFERENCES purchase_items(id),
    purchase_price   REAL NOT NULL CHECK(purchase_price >= 0),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    remaining_qty    INTEGER NOT NULL CHECK(remaining_qty >= 0),
    expiry_date      TEXT NOT NULL,
    received_date    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO batches (id, medicine_id, purchase_id, purchase_item_id, purchase_price, quantity, remaining_qty, expiry_date, received_date)
SELECT id, medicine_id, purchase_id, purchase_item_id, purchase_price, quantity, remaining_qty, expiry_date, received_date
FROM batches_old;

DROP TABLE batches_old;

CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_medicine_expiry ON batches(medicine_id, expiry_date);
