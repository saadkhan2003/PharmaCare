-- Speed and Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_med_created ON stock_movements(medicine_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_med_rem ON batches(medicine_id, remaining_qty);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_name_nocase ON medicines(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_debtors_customer ON debtors(customer_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_debtors_status_due ON debtors(status, due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_status ON supplier_debts(status, due_date);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
