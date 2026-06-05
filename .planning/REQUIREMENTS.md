# Requirements: PharmaCare

**Defined:** 2026-06-05
**Core Value:** The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [-] **AUTH-01**: User can log in with username and password *(foundation: SQLite + AppState + migrations + bcrypt dep; login command in Plan 02)*
- [-] **AUTH-02**: Passwords stored as bcrypt hashes — never plaintext *(foundation: bcrypt crate dependency + password_hash field in users table; hash on creation in Plan 02)*
- [-] **AUTH-03**: Session persists until user logs out or app closes *(foundation: StoredSession model + sessions table + in-memory HashMap + guard functions; session creation in Plan 02)*
- [ ] **AUTH-04**: All login attempts (success and failure) logged
- [ ] **AUTH-05**: Inactive users cannot log in but historical records preserved

### Medicine Inventory

- [ ] **INVT-01**: Owner can add medicine with name, generic name, brand, category, unit, retail/purchase price, reorder level, shelf location, notes
- [ ] **INVT-02**: Owner can edit existing medicine details
- [ ] **INVT-03**: Owner can view searchable medicine list
- [ ] **INVT-04**: Owner can deactivate medicine (soft delete — preserves sales history)
- [ ] **INVT-05**: Retail price must always be >= purchase price
- [ ] **INVT-06**: Pharmacist can view medicine list (read-only, purchase prices/margins hidden)
- [ ] **INVT-07**: Medicines categorized as Tablet, Syrup, Injection, OTC, Prescription
- [ ] **INVT-08**: Medicines assigned unit type: Strip, Bottle, Vial, Box, Sachet

### Point of Sale

- [ ] **POS-01**: User can search medicines by name with live results (<200ms)
- [ ] **POS-02**: User can add items to sale with quantity
- [ ] **POS-03**: System checks stock — cannot sell more than available
- [ ] **POS-04**: System blocks sale of zero-stock and expired medicines
- [ ] **POS-05**: User can apply item-level discount (optional)
- [ ] **POS-06**: User can apply bill-level discount (optional)
- [ ] **POS-07**: Tax toggle per sale; calculated on post-discount subtotal
- [ ] **POS-08**: Payment method selection: Cash, Card, Credit
- [ ] **POS-09**: Credit sale prompts for customer name
- [ ] **POS-10**: On confirm, stock deducted FIFO from oldest batch first
- [ ] **POS-11**: Sale recorded with immutable line-item snapshots (price, cost, discount, tax)
- [ ] **POS-12**: Entire sale completable with keyboard only
- [ ] **POS-13**: Sale completable in under 30 seconds

### Suppliers & Purchases

- [ ] **SUPP-01**: Owner can add/edit/view suppliers (company name, contact person, phone, address, payment terms, notes)
- [ ] **SUPP-02**: Owner can record purchase with supplier, invoice number, date, items, total cost, payment status
- [ ] **SUPP-03**: Each purchase creates batch records with expiry dates
- [ ] **SUPP-04**: Purchase automatically increases stock counts
- [ ] **SUPP-05**: Purchase price stored per-batch (prices may vary between orders)

### Batch & Expiry Tracking

- [ ] **BATC-01**: Stock tracked at batch level with expiry date per batch
- [ ] **BATC-02**: Dashboard shows expiry warnings — yellow at 60 days, red at 30 days, dark red (blocked) past expiry
- [ ] **BATC-03**: Expired medicines automatically blocked from sale
- [ ] **BATC-04**: Owner can view expiry report sorted by days remaining
- [ ] **BATC-05**: Owner can mark batch as returned to supplier or written off
- [ ] **BATC-06**: Written-off stock deducted from inventory and logged as loss

### Returns & Refunds

- [ ] **RETN-01**: User can process customer return by searching original sale
- [ ] **RETN-02**: Customer return records condition: resellable, damaged, expired
- [ ] **RETN-03**: Resellable returns restore stock to inventory
- [ ] **RETN-04**: Damaged/expired returns write off stock and log as loss
- [ ] **RETN-05**: Owner can process supplier return with credit note
- [ ] **RETN-06**: Returns cannot exceed original quantity sold
- [ ] **RETN-07**: All returns logged with reason, date, processing user
- [ ] **RETN-08**: Financial reports reflect refunds accurately (not double-counted)

### Analytics & Reports

- [ ] **REPT-01**: Owner dashboard shows today's sales, today's profit, monthly sales, low stock count, expiry count, top 5 selling medicines
- [ ] **REPT-02**: Pharmacist dashboard shows today's sales total and low stock alerts
- [ ] **REPT-03**: Owner can view Daily Sales Summary report (date-filterable, PDF export)
- [ ] **REPT-04**: Owner can view Monthly P&L report (PDF export)
- [ ] **REPT-05**: Owner can view Top Selling Medicines report (PDF export)
- [ ] **REPT-06**: Owner can view Slow-Moving Stock report (PDF export)
- [ ] **REPT-07**: Owner can view Low Stock report (PDF export)
- [ ] **REPT-08**: Owner can view Expiry report (PDF export)
- [ ] **REPT-09**: Owner can view Supplier Purchase History report (PDF export)
- [ ] **REPT-10**: Owner can view Sales by User report (PDF export)
- [ ] **REPT-11**: Owner can view Profit Margin report (PDF export)
- [ ] **REPT-12**: All reports date-range filterable
- [ ] **REPT-13**: Purchase prices and profit data visible to Owner role only

### User Management

- [ ] **USER-01**: Owner can add user (full name, username, password, role)
- [ ] **USER-02**: Owner can deactivate user (preserves sales history)
- [ ] **USER-03**: Owner cannot delete their own account
- [ ] **USER-04**: System requires at least one active Owner account

### Backup & Recovery

- [ ] **BAKP-01**: Nightly auto-backup at 11 PM (if internet available)
- [ ] **BAKP-02**: Owner can trigger manual backup anytime
- [ ] **BAKP-03**: Backups named pharmaCare_backup_YYYY-MM-DD.db; last 30 kept
- [ ] **BAKP-04**: Dashboard shows last backup status
- [ ] **BAKP-05**: Missed-backup warning after 3 days without backup
- [ ] **BAKP-06**: Owner can restore from backup with confirmation warning
- [ ] **BAKP-07**: Optional local-folder/USB backup alongside Drive upload
- [ ] **BAKP-08**: Pre-restore backup created before any restore
- [ ] **BAKP-09**: Backup uses SQLite-safe snapshot (Online Backup API / VACUUM INTO)

### Settings

- [ ] **SETT-01**: Owner configures pharmacy info (name, owner name, phone, address, logo)
- [ ] **SETT-02**: Owner configures default tax rate and tax-enabled default
- [ ] **SETT-03**: Owner configures cashier discount permission (toggle)
- [ ] **SETT-04**: Owner configures expiry warning/critical thresholds (default 60/30 days)
- [ ] **SETT-05**: Owner configures default reorder level for new medicines
- [ ] **SETT-06**: Owner configures currency symbol (default Rs.)
- [ ] **SETT-07**: Owner connects/disconnects Google Drive for backup
- [ ] **SETT-08**: Owner configures auto-backup time

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Credit/Receivables

- **CRED-01**: Owner can track customer credit/debt balances
- **CRED-02**: Owner can view receivable report

### Additional Features

- **IMPR-01**: Excel import tool for existing medicine list
- **ALRT-01**: WhatsApp notifications for low stock / expiry
- **AUDT-01**: Barcode scanner hardware integration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-branch support | v1 is single-branch only |
| Full credit/udhaar ledger per customer | PRD only prompts for customer name on credit sales; complete receivables deferred to v2 |
| Barcode scanner hardware | Keyboard/search-driven is sufficient for v1 |
| WhatsApp notifications | Possible future enhancement; backup and in-app alerts sufficient for v1 |
| Prescription management / doctor records | Outside core inventory/POS scope |
| Insurance billing | Not required for this private pharmacy |
| Mobile app companion | Windows desktop is target platform |
| Online ordering / e-commerce | Offline-first for in-store operations |
| Customer accounts / loyalty points | Not needed for v1 operational value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Foundation (Plan 01) |
| AUTH-02 | Phase 1 | Foundation (Plan 01) |
| AUTH-03 | Phase 1 | Foundation (Plan 01) |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| INVT-01 | Phase 2 | Pending |
| INVT-02 | Phase 2 | Pending |
| INVT-03 | Phase 2 | Pending |
| INVT-04 | Phase 2 | Pending |
| INVT-05 | Phase 2 | Pending |
| INVT-06 | Phase 2 | Pending |
| INVT-07 | Phase 2 | Pending |
| INVT-08 | Phase 2 | Pending |
| POS-01 | Phase 3 | Pending |
| POS-02 | Phase 3 | Pending |
| POS-03 | Phase 3 | Pending |
| POS-04 | Phase 3 | Pending |
| POS-05 | Phase 3 | Pending |
| POS-06 | Phase 3 | Pending |
| POS-07 | Phase 3 | Pending |
| POS-08 | Phase 3 | Pending |
| POS-09 | Phase 3 | Pending |
| POS-10 | Phase 3 | Pending |
| POS-11 | Phase 3 | Pending |
| POS-12 | Phase 3 | Pending |
| POS-13 | Phase 3 | Pending |
| SUPP-01 | Phase 2 | Pending |
| SUPP-02 | Phase 2 | Pending |
| SUPP-03 | Phase 2 | Pending |
| SUPP-04 | Phase 2 | Pending |
| SUPP-05 | Phase 2 | Pending |
| BATC-01 | Phase 2 | Pending |
| BATC-02 | Phase 3 | Pending |
| BATC-03 | Phase 3 | Pending |
| BATC-04 | Phase 2 | Pending |
| BATC-05 | Phase 4 | Pending |
| BATC-06 | Phase 4 | Pending |
| RETN-01 | Phase 4 | Pending |
| RETN-02 | Phase 4 | Pending |
| RETN-03 | Phase 4 | Pending |
| RETN-04 | Phase 4 | Pending |
| RETN-05 | Phase 4 | Pending |
| RETN-06 | Phase 4 | Pending |
| RETN-07 | Phase 4 | Pending |
| RETN-08 | Phase 4 | Pending |
| REPT-01 | Phase 3 | Pending |
| REPT-02 | Phase 3 | Pending |
| REPT-03 | Phase 5 | Pending |
| REPT-04 | Phase 5 | Pending |
| REPT-05 | Phase 5 | Pending |
| REPT-06 | Phase 5 | Pending |
| REPT-07 | Phase 5 | Pending |
| REPT-08 | Phase 5 | Pending |
| REPT-09 | Phase 5 | Pending |
| REPT-10 | Phase 5 | Pending |
| REPT-11 | Phase 5 | Pending |
| REPT-12 | Phase 5 | Pending |
| REPT-13 | Phase 5 | Pending |
| USER-01 | Phase 1 | Pending |
| USER-02 | Phase 1 | Pending |
| USER-03 | Phase 1 | Pending |
| USER-04 | Phase 1 | Pending |
| BAKP-01 | Phase 5 | Pending |
| BAKP-02 | Phase 5 | Pending |
| BAKP-03 | Phase 5 | Pending |
| BAKP-04 | Phase 5 | Pending |
| BAKP-05 | Phase 5 | Pending |
| BAKP-06 | Phase 5 | Pending |
| BAKP-07 | Phase 5 | Pending |
| BAKP-08 | Phase 5 | Pending |
| BAKP-09 | Phase 5 | Pending |
| SETT-01 | Phase 2 | Pending |
| SETT-02 | Phase 2 | Pending |
| SETT-03 | Phase 2 | Pending |
| SETT-04 | Phase 2 | Pending |
| SETT-05 | Phase 2 | Pending |
| SETT-06 | Phase 2 | Pending |
| SETT-07 | Phase 5 | Pending |
| SETT-08 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 79 total
- Mapped to phases: 79
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 after roadmap creation (5-phase coarse granularity)*
