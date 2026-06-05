-- Medicines catalog
CREATE TABLE medicines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    generic_name     TEXT,
    brand_name       TEXT,
    category         TEXT NOT NULL CHECK(category IN ('Tablet','Syrup','Injection','OTC','Prescription')),
    unit             TEXT NOT NULL CHECK(unit IN ('Strip','Bottle','Vial','Box','Sachet')),
    retail_price     REAL NOT NULL CHECK(retail_price >= 0),
    purchase_price   REAL NOT NULL CHECK(purchase_price >= 0),
    reorder_level    INTEGER DEFAULT 10,
    shelf_location   TEXT,
    notes            TEXT,
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Suppliers
CREATE TABLE suppliers (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name     TEXT NOT NULL,
    contact_person   TEXT,
    phone            TEXT,
    address          TEXT,
    payment_terms    TEXT,
    notes            TEXT,
    is_active        INTEGER DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Purchases (header)
CREATE TABLE purchases (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id      INTEGER NOT NULL REFERENCES suppliers(id),
    invoice_number   TEXT,
    purchase_date    TEXT NOT NULL,
    total_cost       REAL,
    payment_status   TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Paid','Pending','Partial')),
    notes            TEXT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Purchase line items
CREATE TABLE purchase_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id      INTEGER NOT NULL REFERENCES purchases(id),
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    purchase_price   REAL NOT NULL CHECK(purchase_price >= 0),
    expiry_date      TEXT NOT NULL,
    batch_id         INTEGER REFERENCES batches(id),
    line_cost        REAL NOT NULL
);

-- Batch-level stock tracking
CREATE TABLE batches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    purchase_id      INTEGER NOT NULL REFERENCES purchases(id),
    purchase_item_id INTEGER REFERENCES purchase_items(id),
    purchase_price   REAL NOT NULL CHECK(purchase_price >= 0),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    remaining_qty    INTEGER NOT NULL CHECK(remaining_qty >= 0),
    expiry_date      TEXT NOT NULL,
    received_date    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for search and reporting
CREATE INDEX idx_medicines_search ON medicines(name, generic_name, brand_name);
CREATE INDEX idx_medicines_active ON medicines(is_active);
CREATE INDEX idx_suppliers_search ON suppliers(company_name, phone);
CREATE INDEX idx_batches_medicine ON batches(medicine_id, expiry_date, remaining_qty);
CREATE INDEX idx_batches_expiry ON batches(expiry_date);
CREATE INDEX idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_medicine ON purchase_items(medicine_id);

-- Seed default settings (D-26, D-27)
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_tax_rate', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cashier_discount_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('expiry_warning_days', '60');
INSERT OR IGNORE INTO settings (key, value) VALUES ('expiry_critical_days', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_reorder_level', '10');
INSERT OR IGNORE INTO settings (key, value) VALUES ('currency_symbol', 'Rs.');
