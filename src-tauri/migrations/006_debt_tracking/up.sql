CREATE TABLE debtors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name   TEXT NOT NULL,
    phone           TEXT,
    total_amount    REAL NOT NULL CHECK(total_amount > 0),
    paid_amount     REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
    due_date        TEXT NOT NULL,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'overdue')),
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE debt_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id         INTEGER NOT NULL REFERENCES debtors(id),
    sale_id         INTEGER,
    medicine_name   TEXT NOT NULL,
    quantity        INTEGER NOT NULL CHECK(quantity > 0),
    amount          REAL NOT NULL CHECK(amount > 0)
);

CREATE INDEX idx_debtors_status ON debtors(status);
CREATE INDEX idx_debtors_due_date ON debtors(due_date);
CREATE INDEX idx_debt_items_debt ON debt_items(debt_id);
