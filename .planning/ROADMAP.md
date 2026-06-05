# Roadmap: PharmaCare

**Project Code:** PHARMA
**Defined:** 2026-06-05
**Granularity:** Coarse (3-5 phases)
**Total v1 Requirements:** 79

## Overview

PharmaCare is built as a dependency-driven Windows desktop application where the mutation spine (auth → stock intake → sales → returns → reports) determines the build order — not screen priority. Phase 1 delivers the secure app foundation with authentication, RBAC, and user management. Phase 2 adds the medicine catalog, supplier workflow, and batch-level stock intake. Phase 3 builds the keyboard-first POS engine with FIFO deduction and operational dashboards. Phase 4 adds correction workflows for returns, write-offs, and loss logging. Phase 5 completes the system with full analytics, PDF reports, backup/recovery, and administration.

## Phases

- [ ] **Phase 1: Foundation & Access Control** - Tauri/React shell, SQLite, bcrypt auth, RBAC, user management
- [ ] **Phase 2: Medicine Catalog & Stock Intake** - Medicine CRUD, suppliers, purchases, batch tracking, core settings
- [/] **Phase 3: POS & Sales Engine** - Keyboard-first POS, FIFO stock deduction, expiry blocking, operational dashboards
- [x] **Phase 4: Returns & Operational Corrections** - Customer/supplier returns, write-offs, stock restoration, loss logging, return history
- [/] **Phase 5: Reports, Backup & Administration** - Analytics reports with PDF export, Google Drive backup, restore, settings UI

## Phase Details

### Phase 1: Foundation & Access Control
**Goal**: Users can securely authenticate and the owner can manage user accounts within a running Tauri/React desktop shell with SQLite persistence
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, USER-01, USER-02, USER-03, USER-04
**Success Criteria** (what must be TRUE):
  1. User can log in with username and password; passwords stored as bcrypt hashes
  2. Session persists across screens until user logs out or app closes
  3. All login attempts (success and failure) are logged to an audit table
  4. Owner can add, view, and deactivate user accounts; deactivated users cannot log in
  5. System blocks deletion of the last active Owner account; at least one Owner always exists
**Plans**: 3 plans (2 autonomous, 1 with checkpoint)
**UI hint**: yes

Plans:
- [x] 01-01-PLAN.md — Tauri scaffold + SQLite + models + guards + migration
- [x] 01-02-PLAN.md — Auth/User/Audit services + commands + login/setup UI
- [ ] 01-03-PLAN.md — Sidebar layout + user management + audit viewer

### Phase 2: Medicine Catalog & Stock Intake
**Goal**: Owner can manage the complete medicine catalog, record supplier purchases with batch-level tracking, and configure core pharmacy settings
**Depends on**: Phase 1
**Requirements**: INVT-01, INVT-02, INVT-03, INVT-04, INVT-05, INVT-06, INVT-07, INVT-08, SUPP-01, SUPP-02, SUPP-03, SUPP-04, SUPP-05, BATC-01, BATC-04, SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06
**Success Criteria** (what must be TRUE):
  1. Owner can add, edit, view, and deactivate medicines with name, generic name, brand, category, unit, retail/purchase price, reorder level, shelf location, and notes
  2. Retail price is validated to be >= purchase price; pharmacist sees a read-only view with purchase prices and profit margins hidden
  3. Medicines are classified by category (Tablet, Syrup, Injection, OTC, Prescription) and unit type (Strip, Bottle, Vial, Box, Sachet)
  4. Owner can add/edit/view suppliers with company name, contact, phone, address, payment terms, and notes
  5. Owner can record purchases with supplier, invoice number, date, items, total cost, and payment status; each purchase creates batch records with expiry dates and automatically increases stock
  6. Owner can view expiry report sorted by days remaining and configure pharmacy info, tax rate, discount permissions, expiry thresholds, reorder defaults, and currency symbol
**Plans**: 3 plans (2 autonomous, 1 with checkpoint)
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md — Backend CRUD infrastructure (migration 002 + models + repos + services + commands for medicines, suppliers, settings, batches, StockLedgerService, expiry report query)
- [x] 02-02-PLAN.md — Purchase intake backend (atomic transaction for purchase + items + batches + stock movements)
- [ ] 02-03-PLAN.md — Frontend UI (medicine catalog, supplier management, purchase form with inline item table, expiry report, sidebar nav)

### Phase 3: POS & Sales Engine
**Goal**: Pharmacist can process medicine sales in under 30 seconds with keyboard-first flow, live search, FIFO stock deduction, and role-appropriate dashboards showing operational data
**Depends on**: Phase 2
**Requirements**: POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08, POS-09, POS-10, POS-11, POS-12, POS-13, BATC-02, BATC-03, REPT-01, REPT-02
**Success Criteria** (what must be TRUE):
  1. User can search medicines by name with live results in under 200ms and complete a sale using keyboard-only input in under 30 seconds
  2. System validates stock availability — blocks sale of zero-stock, over-quantity, and expired medicines at add-item and confirm time
  3. User can apply optional item-level and bill-level discounts, toggle tax on post-discount subtotal, and select payment method (Cash, Card, Credit); credit sales prompt for customer name
  4. On sale confirmation, stock is deducted FIFO from the oldest valid batch first and the sale is recorded with immutable line-item snapshots of price, cost, discount, and tax
  5. Owner dashboard shows today's sales, today's profit, monthly sales, low stock count, expiry count, and top 5 selling medicines
  6. Pharmacist dashboard shows today's sales total and low stock alerts; expiry warnings display yellow at 60 days, red at 30 days, dark red past expiry
**Plans**: 3 plans (2 autonomous, 1 with checkpoint)
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Sale backend (migration 003, models, repos, services, commands)
- [x] 03-02-PLAN.md — POS UI (two-panel keyboard-first interface)
- [ ] 03-03-PLAN.md — Dashboards (owner + pharmacist with Recharts)

### Phase 4: Returns & Operational Corrections
**Goal**: Users can process customer and supplier returns with condition-based stock handling, write off damaged/expired stock, and log all corrections for financial accuracy
**Depends on**: Phase 3
**Requirements**: RETN-01, RETN-02, RETN-03, RETN-04, RETN-05, RETN-06, RETN-07, RETN-08, BATC-05, BATC-06
**Success Criteria** (what must be TRUE):
  1. User can process a customer return by searching the original sale and selecting items to return
  2. Customer return records condition (resellable, damaged, expired); resellable items restore stock to inventory, damaged/expired items write off stock and log as loss
  3. Owner can process a supplier return with credit note; batches can be marked as returned to supplier or written off
  4. System enforces that returns cannot exceed the original quantity sold; all returns logged with reason, date, and processing user
  5. Financial reports accurately reflect refunds (not double-counted); written-off stock is deducted from inventory and logged as a loss record
**Plans**: 3 plans (3 autonomous)
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md — Backend returns infrastructure (migration, models, repos, return_service)
- [x] 04-02-PLAN.md — Return commands + TypeScript bindings + Tauri registration
- [x] 04-03-PLAN.md — Frontend UI (CustomerReturn, SupplierReturn, WriteOff forms)

### Phase 5: Reports, Backup & Administration
**Goal**: Owner can access comprehensive analytics with PDF export, configure automated backup and restore, and manage all remaining settings and administration
**Depends on**: Phase 3 (needs sales data), Phase 4 (needs return correction data)
**Requirements**: REPT-03, REPT-04, REPT-05, REPT-06, REPT-07, REPT-08, REPT-09, REPT-10, REPT-11, REPT-12, REPT-13, BAKP-01, BAKP-02, BAKP-03, BAKP-04, BAKP-05, BAKP-06, BAKP-07, BAKP-08, BAKP-09, SETT-07, SETT-08
**Success Criteria** (what must be TRUE):
  1. Owner can view, filter by date range, and export to PDF the following reports: Daily Sales Summary, Monthly P&L, Top Selling Medicines, Slow-Moving Stock, Low Stock, Expiry, Supplier Purchase History, Sales by User, and Profit Margin
  2. All purchase prices and profit data are visible to Owner role only — blocked at the service/DTO layer, not just hidden in navigation
  3. Database backs up automatically at the configured time (default 11 PM) when internet is available; owner can trigger manual backup anytime
  4. Backups are named `pharmaCare_backup_YYYY-MM-DD.db`, last 30 are preserved, dashboard shows last backup status, and a missed-backup warning fires after 3 days without backup
  5. Owner can restore from a backup with confirmation warning; a pre-restore backup is automatically created before any restore operation
  6. Optional local-folder/USB backup path works alongside Google Drive upload; all backups use SQLite Online Backup API or VACUUM INTO for consistent snapshots
  7. Owner can connect/disconnect Google Drive for backup and configure the auto-backup time
**Plans**: 3 plans (3 autonomous)
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md — Backend infrastructure: report DTOs + 9 aggregation services + backup service (VACUUM INTO + gzip + Drive upload + restore) + settings write + password change + commands + main.rs registration + TypeScript contracts
- [ ] 05-02-PLAN.md — Frontend Reports page: 9 report components with Recharts charts + @react-pdf/renderer PDF export + master-detail layout + date-range filtering + route
- [ ] 05-03-PLAN.md — Settings UI + Admin: tabbed settings page (Pharmacy, Financial, Inventory, Backup) + ChangePasswordDialog + dashboard backup widget + missed-backup warning + sidebar nav + routing

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Access Control | 2/3 | Executing | - |
| 2. Medicine Catalog & Stock Intake | 1/3 | Executing (Wave 1 done) | - |
| 3. POS & Sales Engine | 2/3 | Executing (Wave 2 — POS UI done) | - |
| 4. Returns & Operational Corrections | 3/3 | Complete | 2026-06-05 |
| 5. Reports, Backup & Administration | 1/3 | Executing (Wave 1 — backend done) | - |

---

*Roadmap defined: 2026-06-05*
