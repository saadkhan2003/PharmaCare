-- Sales header table
CREATE TABLE sales (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    subtotal         REAL NOT NULL CHECK(subtotal >= 0),
    bill_discount    REAL NOT NULL DEFAULT 0 CHECK(bill_discount >= 0),
    tax_rate         REAL NOT NULL DEFAULT 0 CHECK(tax_rate >= 0),
    tax_amount       REAL NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
    total            REAL NOT NULL CHECK(total >= 0),
    payment_method   TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Card', 'Credit')),
    customer_name    TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sale line items (one entry per batch allocation, NOT per medicine)
CREATE TABLE sale_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id          INTEGER NOT NULL REFERENCES sales(id),
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    batch_id         INTEGER NOT NULL REFERENCES batches(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    unit_price       REAL NOT NULL CHECK(unit_price >= 0),
    purchase_cost    REAL NOT NULL CHECK(purchase_cost >= 0),
    item_discount    REAL NOT NULL DEFAULT 0 CHECK(item_discount >= 0),
    line_total       REAL NOT NULL CHECK(line_total >= 0)
);

-- Indexes
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_medicine ON sale_items(medicine_id);
CREATE INDEX idx_sale_items_batch ON sale_items(batch_id);

-- Add tax_enabled setting if not present
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled_default', 'true');
