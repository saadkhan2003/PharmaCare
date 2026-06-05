---
phase: 02-medicine-catalog-stock-intake
plan: 01
subsystem: backend
tags: [rusqlite, sqlite, tauri, crud, inventory, stock, expiry]
requires:
  - phase: 01-foundation-access-control
    provides: Tauri shell, SQLite with rusqlite, auth/RBAC guards, AppState, CommandError,
              repository/service/command pattern, session management, settings + stock_movements tables
provides:
  - Migration 002: medicines, suppliers, purchases, purchase_items, batches tables + indexes + seed settings
  - Medicine CRUD backend with role-masked DTOs (MedicineDto vs MedicinePharmacistDto)
  - Supplier CRUD backend with search by name/phone
  - Batch/stock tracking with expiry report query (julianday)
  - Settings key-value typed reader service
  - StockLedgerService: single mutation authority for stock movements (D-22)
  - Current stock computation: SUM of non-expired batches (D-23)
  - 15 Tauri commands registered in main.rs for all Phase 2 operations
affects: 02-02 (purchase intake), 02-03 (frontend UI), Phase 3 (POS/expiry widget)

tech-stack:
  added: []
  patterns:
    - Role-masked DTOs enforced at service layer (MedicineDto vs MedicinePharmacistDto)
    - Dynamic UPDATE SQL for partial field updates (medicine_repo, supplier_repo)
    - StockLedgerService as append-only mutation authority
    - julianday() SQL for expiry day arithmetic

key-files:
  created:
    - src-tauri/migrations/002_medicine_catalog/up.sql (5 tables, 8 indexes, 6 seed settings)
    - src-tauri/src/models/medicine.rs (Medicine, MedicineDto, MedicinePharmacistDto, MedicineListItem, Create/Update DTOs)
    - src-tauri/src/models/supplier.rs (Supplier, SupplierDto, Create/Update DTOs)
    - src-tauri/src/models/batch.rs (Batch, BatchDto, ExpiryReportRow)
    - src-tauri/src/models/settings.rs (SettingsMap with Default impl)
    - src-tauri/src/repository/medicine_repo.rs (CRUD + search with prepared statements)
    - src-tauri/src/repository/supplier_repo.rs (CRUD + search by name/phone)
    - src-tauri/src/repository/batch_repo.rs (insert, get_current_stock, get_expiry_report, find_by_medicine)
    - src-tauri/src/repository/settings_repo.rs (get_string, set_value)
    - src-tauri/src/repository/stock_ledger_repo.rs (insert_movement append-only)
    - src-tauri/src/services/medicine_service.rs (CRUD with price validation, pharmacist DTO)
    - src-tauri/src/services/supplier_service.rs (CRUD with name validation)
    - src-tauri/src/services/settings_service.rs (typed get_f64/get_i64/get_bool + get_settings)
    - src-tauri/src/services/stock_ledger_service.rs (record_movement with type validation)
    - src-tauri/src/commands/medicine_commands.rs (7 commands: CRUD + search + pharmacist search + get)
    - src-tauri/src/commands/supplier_commands.rs (5 commands: CRUD + search)
    - src-tauri/src/commands/settings_commands.rs (get_settings, no auth)
    - src-tauri/src/commands/batch_commands.rs (get_expiry_report, get_current_stock)
  modified:
    - src-tauri/src/migrations.rs (added M::up for migration 002)
    - src-tauri/src/models/mod.rs (added 4 module declarations + re-exports)
    - src-tauri/src/repository/mod.rs (added 5 module declarations)
    - src-tauri/src/services/mod.rs (added 4 module declarations)
    - src-tauri/src/commands/mod.rs (added 4 module declarations)
    - src-tauri/src/main.rs (added 15 Phase 2 commands to invoke_handler)

key-decisions:
  - "Prices stored as REAL (f64) per PRD schema — float precision accepted for v1 pharmacy pricing"
  - "Dynamic UPDATE SQL with parameterized fields used for medicine/supplier partial updates"
  - "stock_ledger_service::record_movement accepts &Connection instead of &Transaction — Transaction works via Deref"
  - "Settings command has no auth guard — settings contain no sensitive data (T-02-07 accepted)"
  - "Payment status defaults to 'Pending' per pharmacy purchase convention (credit terms)"

patterns-established:
  - "Dynamic UPDATE: build SET clauses + parameter list dynamically for partial model updates"
  - "Expiry report: julianday() arithmetic with CAST to INTEGER for days_remaining; optional min/max day filters using dynamic parameterized WHERE"
  - "Stock computation: COALESCE(SUM(remaining_qty), 0) filtered by expiry_date > date('now')"
  - "Movement type validation: pattern match on known types before delegating to repo"

requirements-completed:
  - INVT-01, INVT-02, INVT-03, INVT-04, INVT-05, INVT-06, INVT-07, INVT-08
  - SUPP-01
  - BATC-01, BATC-04
  - SETT-01, SETT-02, SETT-03, SETT-04, SETT-05, SETT-06
  - D-10, D-13, D-15, D-16, D-22, D-23, D-26, D-27

duration: 4min
completed: 2026-06-05
---

# Phase 2 Plan 01: Medicine Catalog & Stock Intake Backend

**Migration 002 creates medicines/suppliers/purchases/batches tables; Rust backend CRUD with role-masked DTOs, StockLedgerService single mutation authority, and 15 Tauri commands registered**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-05T14:17:34Z
- **Completed:** 2026-06-05T14:21:34Z
- **Tasks:** 3
- **Files modified:** 24 (18 created, 6 modified)

## Accomplishments

- Migration 002 creates 5 tables (medicines, suppliers, purchases, purchase_items, batches) with CHECK constraints on category/unit/payment_status, 8 composite indexes, and 6 seed settings
- Medicine CRUD with full owner DTO (includes purchase_price) and pharmacist-safe DTO (excludes purchase_price, D-15) — enforced at service layer
- `retail_price >= purchase_price` validated in Rust service layer using integer-cent comparison (D-16)
- Supplier CRUD with search by company_name and phone
- Batch/stock tracking: current stock computed as COALESCE(SUM of non-expired batches) per D-23
- Expiry report query using julianday() with optional min/max day filters, sorted by days_remaining ASC
- StockLedgerService enforces single mutation authority (D-22) with movement_type validation
- Settings service provides typed key-value readers (get_f64, get_i64, get_bool) with default fallbacks
- All 15 Phase 2 commands registered in main.rs invoke_handler, with `require_owner()` on all mutation commands
- `search_medicines_pharmacist` command enforces role check at the command layer — owner redirected to search_medicines
- `cargo build`, `cargo test`, and `npm run build` all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 002 SQL + all Rust models** — `62d468e` (feat)
2. **Task 2: All repositories and services** — `592f6ae` (feat)
3. **Task 3: All Tauri commands + main.rs registration** — `15be69a` (feat)

## Files Created/Modified

### Migration
- `src-tauri/migrations/002_medicine_catalog/up.sql` - 5 tables (medicines, suppliers, purchases, purchase_items, batches) with CHECK constraints, 8 indexes, 6 seed settings
- `src-tauri/src/migrations.rs` - Added M::up include for migration 002

### Models (4 new files)
- `src-tauri/src/models/medicine.rs` - Medicine, MedicineDto, MedicinePharmacistDto, MedicineListItem, CreateMedicineDto, UpdateMedicineDto
- `src-tauri/src/models/supplier.rs` - Supplier, SupplierDto, CreateSupplierDto, UpdateSupplierDto
- `src-tauri/src/models/batch.rs` - Batch, BatchDto, ExpiryReportRow
- `src-tauri/src/models/settings.rs` - SettingsMap with Default impl (6 settings)
- `src-tauri/src/models/mod.rs` - Module declarations and re-exports

### Repositories (5 new files)
- `src-tauri/src/repository/medicine_repo.rs` - insert, find_by_id, find_all, search, update (dynamic), deactivate
- `src-tauri/src/repository/supplier_repo.rs` - insert, find_by_id, find_all, search, update (dynamic), deactivate
- `src-tauri/src/repository/batch_repo.rs` - insert, get_current_stock (D-23), get_expiry_report (julianday), find_by_medicine
- `src-tauri/src/repository/settings_repo.rs` - get_string, set_value
- `src-tauri/src/repository/stock_ledger_repo.rs` - insert_movement (append-only)
- `src-tauri/src/repository/mod.rs` - Module declarations

### Services (4 new files)
- `src-tauri/src/services/medicine_service.rs` - create/update/deactivate with price validation, list/search (owner), search_pharmacist (D-15), get_by_id
- `src-tauri/src/services/supplier_service.rs` - create/update/deactivate/list/search
- `src-tauri/src/services/settings_service.rs` - get_f64/get_i64/get_bool helpers, get_settings with defaults
- `src-tauri/src/services/stock_ledger_service.rs` - record_movement (validates type, D-22), get_current_stock
- `src-tauri/src/services/mod.rs` - Module declarations

### Commands (4 new files)
- `src-tauri/src/commands/medicine_commands.rs` - create_medicine (owner), update_medicine (owner), deactivate_medicine (owner), list_medicines, search_medicines, search_medicines_pharmacist, get_medicine
- `src-tauri/src/commands/supplier_commands.rs` - create_supplier (owner), update_supplier (owner), deactivate_supplier (owner), list_suppliers, search_suppliers
- `src-tauri/src/commands/settings_commands.rs` - get_settings (no auth)
- `src-tauri/src/commands/batch_commands.rs` - get_expiry_report (owner), get_current_stock
- `src-tauri/src/commands/mod.rs` - Module declarations

### Main
- `src-tauri/src/main.rs` - 15 Phase 2 commands registered in invoke_handler

## Decisions Made

- **Prices as REAL (f64):** Per PRD schema. Integer cent/paise conversion considered but deferred — pharmacy pricing (typically ending in .00/.25/.50/.75) has acceptable float precision for v1
- **Dynamic UPDATE SQL:** medicine_repo and supplier_repo build SET clauses dynamically from non-None fields, avoiding hardcoded UPDATE for every field combination
- **StockLedgerService accepts &Connection:** Using Deref pattern — rusqlite::Transaction implements Deref<Target=Connection>, so the service can be called from within a transaction (future purchase service) or standalone
- **Settings command unauthenticated:** Per T-02-07 acceptance — settings contain no sensitive data (tax rate, thresholds, currency symbol), and unauthenticated reads simplify frontend initialization
- **Payment status default 'Pending':** Matches pharmacy purchase convention where most purchases are on credit terms

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — all three tasks compiled and tested on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete backend for medicine catalog, supplier, batch/stock tracking, settings, and stock ledger services
- Ready for **Plan 02-02** (Purchase Intake with transaction orchestration) which will consume:
  - batch_repo::insert (called within purchase transaction)
  - stock_ledger_service::record_movement (positive purchase movements)
  - purchase_repo (to be created)
  - medicine_repo::find_by_id (for item validation)
- Ready for **Plan 02-03** (Frontend UI) which will consume all 15 Tauri commands for medicine list, supplier management, expiry report, and settings

## Self-Check

- [x] `cargo check` passes with zero errors
- [x] `cargo test` passes — 2 migrations validated
- [x] Migration 002 creates 5 tables with CHECK constraints, 8 indexes, 6 seed settings
- [x] `search_medicines_pharmacist` returns DTO without purchase_price field
- [x] `medicine_service::create_medicine` validates retail_price >= purchase_price
- [x] All mutation commands guarded by `require_owner()`
- [x] StockLedgerService validates movement_type before insert
- [x] `get_current_stock` uses D-23 formula filtering expired batches
- [x] Expiry report query orders by julianday() days_remaining ASC
- [x] Settings reads return correct defaults for all 6 keys
- [x] `cargo build` passes
- [x] `npm run build` passes

---

*Phase: 02-medicine-catalog-stock-intake*
*Completed: 2026-06-05*
