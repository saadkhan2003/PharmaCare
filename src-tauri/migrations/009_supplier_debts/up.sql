CREATE TABLE IF NOT EXISTS supplier_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_id INTEGER,
    total_amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Paid','Pending','Partial')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL DEFAULT (date('now')),
    notes TEXT,
    recorded_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (debt_id) REFERENCES supplier_debts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_supplier_debts_supplier ON supplier_debts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_status ON supplier_debts(status);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_due_date ON supplier_debts(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_debt ON supplier_payments(debt_id);
