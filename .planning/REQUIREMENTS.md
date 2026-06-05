# Requirements: PharmaCare

**Defined:** 2026-06-05
**Core Value:** The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can log in with username and password *(Plan 01: foundation; Plan 02: auth_service.login with bcrypt verify, UUID session, auth_login command)*
- [x] **AUTH-02**: Passwords stored as bcrypt hashes — never plaintext *(Plan 01: bcrypt dep + password_hash field; Plan 02: bcrypt::hash with cost 12 in user_service.create_user)*
- [x] **AUTH-03**: Session persists until user logs out or app closes *(Plan 01: StoredSession model + sessions table + in-memory HashMap + guards; Plan 02: session creation/clear in auth_service)*
- [x] **AUTH-04**: All login attempts (success and failure) logged *(Plan 02: audit_repo.log_attempt called before auth_service.login returns per T-01-10)*
- [x] **AUTH-05**: Inactive users cannot log in but historical records preserved *(Plan 02: auth_service.login checks is_active flag; user_repo.deactivate sets is_active=0)*

### Medicine Inventory

- [x] **INVT-01**: Owner can add medicine with name, generic name, brand, category, unit, retail/purchase price, reorder level, shelf location, notes *(Plan 02-01: medicine_service + medicine_commands)*
- [x] **INVT-02**: Owner can edit existing medicine details *(Plan 02-01: update_medicine with dynamic UPDATE)*
- [x] **INVT-03**: Owner can view searchable medicine list *(Plan 02-01: list_medicines + search command)*
- [x] **INVT-04**: Owner can deactivate medicine (soft delete — preserves sales history) *(Plan 02-01: deactivate_medicine command)*
- [x] **INVT-05**: Retail price must always be >= purchase price *(Plan 02-01: validated in medicine_service)*
- [x] **INVT-06**: Pharmacist can view medicine list (read-only, purchase prices/margins hidden) *(Plan 02-01: MedicinePharmacistDto in search_medicines_pharmacist)*
- [x] **INVT-07**: Medicines categorized as Tablet, Syrup, Injection, OTC, Prescription *(Plan 02-01: CHECK constraint + shadcn Select)*
- [x] **INVT-08**: Medicines assigned unit type: Strip, Bottle, Vial, Box, Sachet *(Plan 02-01: CHECK constraint + shadcn Select)*

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

- [x] **SUPP-01**: Owner can add/edit/view suppliers (company name, contact person, phone, address, payment terms, notes) *(Plan 02-01: supplier_service + supplier_commands)*
- [x] **SUPP-02**: Owner can record purchase with supplier, invoice number, date, items, total cost, payment status *(Plan 02-02: record_purchase atomic transaction)*
- [x] **SUPP-03**: Each purchase creates batch records with expiry dates *(Plan 02-02: batch_repo::insert inside purchase transaction)*
- [x] **SUPP-04**: Purchase automatically increases stock counts *(Plan 02-02: stock_ledger_service::record_movement inside transaction, D-22)*
- [x] **SUPP-05**: Purchase price stored per-batch (prices may vary between orders) *(Plan 02-02: batches.purchase_price per order)*

### Batch & Expiry Tracking

- [x] **BATC-01**: Stock tracked at batch level with expiry date per batch *(Plan 02-01: batches table; Plan 02-02: purchase creates batches with remaining_qty=quantity)*
- [ ] **BATC-02**: Dashboard shows expiry warnings — yellow at 60 days, red at 30 days, dark red (blocked) past expiry *(deferred to Phase 3)*
- [ ] **BATC-03**: Expired medicines automatically blocked from sale *(deferred to Phase 3 POS)*
- [x] **BATC-04**: Owner can view expiry report sorted by days remaining *(Plan 02-01: batch_commands::get_expiry_report with julianday)*
- [x] **BATC-05**: Owner can mark batch as returned to supplier or written off *(Plan 04-01/02: return_service + return_commands for supplier_return and write_off)*
- [x] **BATC-06**: Written-off stock deducted from inventory and logged as loss *(Plan 04-01/02: write_off logic decrements batch + logs stock_movement)*

### Returns & Refunds

- [x] **RETN-01**: User can process customer return by searching original sale *(Plan 04-01/02: search_sale_for_return service + command)*
- [x] **RETN-02**: Customer return records condition: resellable, damaged, expired *(Plan 04-01/02: condition field with CHECK constraint + validation)*
- [x] **RETN-03**: Resellable returns restore stock to inventory *(Plan 04-01/02: increment_remaining_qty + positive stock_movement)*
- [x] **RETN-04**: Damaged/expired returns write off stock and log as loss *(Plan 04-01/02: loss-only path with write_off stock_movement)*
- [x] **RETN-05**: Owner can process supplier return with credit note *(Plan 04-01/02: require_owner guarded supplier_return command)*
- [x] **RETN-06**: Returns cannot exceed original quantity sold *(Plan 04-01/02: server-side validation in return_service)*
- [x] **RETN-07**: All returns logged with reason, date, processing user *(Plan 04-01/02: returns table with reason, return_date, processed_by)*
- [ ] **RETN-08**: Financial reports reflect refunds accurately (not double-counted) *(deferred to Phase 5 reports)*

### Analytics & Reports

- [ ] **REPT-01**: Owner dashboard shows today's sales, today's profit, monthly sales, low stock count, expiry count, top 5 selling medicines
- [ ] **REPT-02**: Pharmacist dashboard shows today's sales total and low stock alerts
- [ ] **REPT-03**: Owner can view Daily Sales Summary report (date-filterable, PDF export) *(Plan 05-01: backend — report_service + command with require_owner; UI deferred to Plan 05-02)*
- [ ] **REPT-04**: Owner can view Monthly P&L report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-05**: Owner can view Top Selling Medicines report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-06**: Owner can view Slow-Moving Stock report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-07**: Owner can view Low Stock report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-08**: Owner can view Expiry report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-09**: Owner can view Supplier Purchase History report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-10**: Owner can view Sales by User report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-11**: Owner can view Profit Margin report (PDF export) *(Plan 05-01: backend; UI deferred to Plan 05-02)*
- [ ] **REPT-12**: All reports date-range filterable *(Plan 05-01: all 9 report services accept start_date/end_date params)*
- [ ] **REPT-13**: Purchase prices and profit data visible to Owner role only *(Plan 05-01: require_owner on all 9 report commands)*

### User Management

- [x] **USER-01**: Owner can add user (full name, username, password, role) *(Plan 02: create_user command with require_owner guard + user_service.create_user)*
- [x] **USER-02**: Owner can deactivate user (preserves sales history) *(Plan 02: deactivate_user command with user_service.deactivate_user, sets is_active=0)*
- [x] **USER-03**: Owner cannot delete their own account *(Plan 02: deactivate_user rejects if target_user_id == current_user_id)*
- [x] **USER-04**: System requires at least one active Owner account *(Plan 02: deactivate_user checks count_active_owners before deactivation)*

### Backup & Recovery

- [ ] **BAKP-01**: Nightly auto-backup at 11 PM (if internet available) *(Plan 05-01: is_backup_due + start_backup_timer; auto-trigger on schedule)*
- [ ] **BAKP-02**: Owner can trigger manual backup anytime *(Plan 05-01: trigger_backup command with require_owner)*
- [ ] **BAKP-03**: Backups named pharmaCare_backup_YYYY-MM-DD.db; last 30 kept *(Plan 05-01: naming convention + cleanup_old_backups)*
- [ ] **BAKP-04**: Dashboard shows last backup status *(deferred to Plan 05-03 frontend backup widget)*
- [ ] **BAKP-05**: Missed-backup warning after 3 days without backup *(deferred to Plan 05-03 frontend)*
- [ ] **BAKP-06**: Owner can restore from backup with confirmation warning *(Plan 05-01: restore_backup command with require_owner; frontend deferred)*
- [ ] **BAKP-07**: Optional local-folder/USB backup alongside Drive upload *(Plan 05-01: copy_to_local + run_backup with local_path param)*
- [ ] **BAKP-08**: Pre-restore backup created before any restore *(Plan 05-01: VACUUM INTO pre-restore in restore_from_local/restore_from_drive)*
- [ ] **BAKP-09**: Backup uses SQLite-safe snapshot (VACUUM INTO) *(Plan 05-01: create_snapshot uses VACUUM INTO for atomic snapshot)*

### Settings

- [ ] **SETT-01**: Owner configures pharmacy info (name, owner name, phone, address, logo) *(backend reads from settings table; full UI deferred to Phase 5)*
- [x] **SETT-02**: Owner configures default tax rate and tax-enabled default *(Plan 02-01: backend key-value read from settings table)*
- [x] **SETT-03**: Owner configures cashier discount permission (toggle) *(Plan 02-01: backend key-value read)*
- [x] **SETT-04**: Owner configures expiry warning/critical thresholds (default 60/30 days) *(Plan 02-01: backend key-value read)*
- [x] **SETT-05**: Owner configures default reorder level for new medicines *(Plan 02-01: backend key-value read)*
- [x] **SETT-06**: Owner configures currency symbol (default Rs.) *(Plan 02-01: backend key-value read)*
- [ ] **SETT-07**: Owner connects/disconnects Google Drive for backup *(Plan 05-01: connect_drive/disconnect_drive commands with require_owner + OAuth flow; frontend deferred to Plan 05-03)*
- [ ] **SETT-08**: Owner configures auto-backup time *(Plan 05-01: auto_backup_time in update_settings payload; frontend deferred to Plan 05-03)*

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
| AUTH-01 | Phase 1 | Complete (Plan 02) |
| AUTH-02 | Phase 1 | Complete (Plan 02) |
| AUTH-03 | Phase 1 | Complete (Plan 02) |
| AUTH-04 | Phase 1 | Complete (Plan 02) |
| AUTH-05 | Phase 1 | Complete (Plan 02) |
| INVT-01 | Phase 2 | Complete (Plan 02-01) |
| INVT-02 | Phase 2 | Complete (Plan 02-01) |
| INVT-03 | Phase 2 | Complete (Plan 02-01) |
| INVT-04 | Phase 2 | Complete (Plan 02-01) |
| INVT-05 | Phase 2 | Complete (Plan 02-01) |
| INVT-06 | Phase 2 | Complete (Plan 02-01) |
| INVT-07 | Phase 2 | Complete (Plan 02-01) |
| INVT-08 | Phase 2 | Complete (Plan 02-01) |
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
| SUPP-01 | Phase 2 | Complete (Plan 02-01) |
| SUPP-02 | Phase 2 | Complete (Plan 02-02) |
| SUPP-03 | Phase 2 | Complete (Plan 02-02) |
| SUPP-04 | Phase 2 | Complete (Plan 02-02) |
| SUPP-05 | Phase 2 | Complete (Plan 02-02) |
| BATC-01 | Phase 2 | Complete (Plan 02-02) |
| BATC-02 | Phase 3 | Pending |
| BATC-03 | Phase 3 | Pending |
| BATC-04 | Phase 2 | Pending |
| BATC-05 | Phase 4 | Complete (Plan 04-02) |
| BATC-06 | Phase 4 | Complete (Plan 04-02) |
| RETN-01 | Phase 4 | Complete (Plan 04-02) |
| RETN-02 | Phase 4 | Complete (Plan 04-02) |
| RETN-03 | Phase 4 | Complete (Plan 04-02) |
| RETN-04 | Phase 4 | Complete (Plan 04-02) |
| RETN-05 | Phase 4 | Complete (Plan 04-02) |
| RETN-06 | Phase 4 | Complete (Plan 04-02) |
| RETN-07 | Phase 4 | Complete (Plan 04-02) |
| RETN-08 | Phase 4 | Pending (Phase 5) |
| REPT-01 | Phase 3 | Pending |
| REPT-02 | Phase 3 | Pending |
| REPT-03 | Phase 5 | Backend done (Plan 05-01) |
| REPT-04 | Phase 5 | Backend done (Plan 05-01) |
| REPT-05 | Phase 5 | Backend done (Plan 05-01) |
| REPT-06 | Phase 5 | Backend done (Plan 05-01) |
| REPT-07 | Phase 5 | Backend done (Plan 05-01) |
| REPT-08 | Phase 5 | Backend done (Plan 05-01) |
| REPT-09 | Phase 5 | Backend done (Plan 05-01) |
| REPT-10 | Phase 5 | Backend done (Plan 05-01) |
| REPT-11 | Phase 5 | Backend done (Plan 05-01) |
| REPT-12 | Phase 5 | Backend done (Plan 05-01) |
| REPT-13 | Phase 5 | Backend done (Plan 05-01) |
| USER-01 | Phase 1 | Complete (Plan 02) |
| USER-02 | Phase 1 | Complete (Plan 02) |
| USER-03 | Phase 1 | Complete (Plan 02) |
| USER-04 | Phase 1 | Complete (Plan 02) |
| BAKP-01 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-02 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-03 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-04 | Phase 5 | Pending (Plan 05-03 frontend) |
| BAKP-05 | Phase 5 | Pending (Plan 05-03 frontend) |
| BAKP-06 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-07 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-08 | Phase 5 | Backend done (Plan 05-01) |
| BAKP-09 | Phase 5 | Backend done (Plan 05-01) |
| SETT-01 | Phase 2 | Pending (UI deferred to Phase 5) |
| SETT-02 | Phase 2 | Complete (Plan 02-01) |
| SETT-03 | Phase 2 | Complete (Plan 02-01) |
| SETT-04 | Phase 2 | Complete (Plan 02-01) |
| SETT-05 | Phase 2 | Complete (Plan 02-01) |
| SETT-06 | Phase 2 | Complete (Plan 02-01) |
| SETT-07 | Phase 5 | Backend done (Plan 05-01) |
| SETT-08 | Phase 5 | Backend done (Plan 05-01) |

**Coverage:**
- v1 requirements: 79 total
- Mapped to phases: 79
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 after roadmap creation (5-phase coarse granularity)*
