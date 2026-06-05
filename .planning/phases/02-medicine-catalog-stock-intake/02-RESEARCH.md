# Phase 2: Medicine Catalog & Stock Intake - Research

**Researched:** 2026-06-05
**Domain:** Medicine catalog CRUD, supplier management, purchase entry with batch-level stock intake, stock ledger, expiry reporting, settings key-value reads
**Confidence:** HIGH (all patterns directly extend Phase 1 established code; rusqlite transactions, role-masked DTOs, and free-function service pattern already proven)

## Summary

Phase 2 extends the Phase 1 three-layer Rust architecture (Repository → Service → Command) to add five new domains: medicines, suppliers, purchases, batches, and stock movements. The established pattern — free functions in repos/services, `require_owner()` guard, `state.db.lock()` → call service → return DTO — is proven and directly extensible. The critical new complexity is the **purchase-intake transaction**: a single SQLite transaction that must atomically insert a purchase, its items, create batch records, log stock_movements, and commit. Phase 1's `stock_movements` table (already migrated) and the free-function `StockLedgerService` provide the single mutation authority required by D-22. The role-masked DTO pattern from Phase 1 (`User` → `UserDto`) extends naturally to `MedicineDto` vs `MedicinePharmacistDto`. Settings reads are the simplest addition — the `settings` table already exists in the schema.

**Primary recommendation:** Build in strict dependency order: migration → settings reads → medicines CRUD → suppliers CRUD → StockLedgerService → purchases (the complex transaction) → expiry report → frontend wiring. Use `rusqlite::Transaction` wrappers around the purchase intake; free-function services throughout; reuse every guard/error/state pattern exactly as Phase 1 established them.

### Key Architectural Decisions to Resolve in Planning

1. **Medicine model**: purchase_price stored ON the medicine record (simpler, matches PRD schema) vs. computed from batches (more accurate but more complex). Decision: **store purchase_price on medicines table** per PRD schema — it's the default/current cost. Per-batch purchase_price on `batches` is the actual acquisition cost. The medicine's purchase_price is a reference/suggestion field.
2. **Purchase item → batch linkage**: Purchase item row gets a `batch_id` FK after the batch is created in the same transaction. This is critical for traceability.
3. **Stock computation**: Current stock = `COALESCE(SUM(remaining_qty), 0)` across all batches for a medicine, filtering out expired batches (per D-23).
4. **Settings seeding**: Phase 2 seeds default settings values on migration 002.

## User Constraints (from CONTEXT.md)

<user_constraints>
### Locked Decisions

| ID | Decision |
|----|----------|
| D-01 | Use rusqlite in Rust Tauri commands — NOT Prisma in the frontend. |
| D-02 | WAL mode, FK, busy_timeout on every connection. |
| D-03 | `stock_movements` table already exists from Phase 1 migration. |
| D-07 | Sidebar nav items for Medicines, Suppliers, Purchases, Expiry Report. Owner sees all; Pharmacist sees Medicines (view-only). |
| D-08 | English UI only for v1. |
| D-10 | Soft deletes — `is_active` on medicines and suppliers tables. |
| D-12 | Two fixed roles: `owner` and `pharmacist`. |
| D-13 | Category and unit type use shadcn Select dropdowns (5 categories, 5 unit types). Fixed enums. |
| D-14 | Medicine list uses live search with 300ms debounce. |
| D-15 | Pharmacist read-only view hides purchase_price, profit margins, supplier cost data. |
| D-16 | `retail_price >= purchase_price` validated in Rust command layer, not just frontend. |
| D-17 | Supplier form is single-page CRUD with company_name, contact_person, phone, address, payment_terms, notes. `is_active` for soft delete. |
| D-18 | Supplier list is searchable table (by name, phone). Suppliers deactivated, not hard-deleted. |
| D-19 | Purchase entry is single-screen form with inline item table. Flow: select supplier → enter invoice + date → add items → auto-calculated total → select payment status → confirm. |
| D-20 | Each purchase creates batch records with expiry_date, purchase_price, quantity, remaining_qty = quantity. Stock increase through StockLedgerService writing positive movements to stock_movements. |
| D-21 | Purchase items table stores per-item purchase price (prices may vary between orders). |
| D-22 | `StockLedgerService` is the single authority for stock mutations. Purchases write to it; no direct batch table mutations outside this service. |
| D-23 | Current stock = `SUM(remaining_qty) FROM batches WHERE medicine_id = ? AND expiry_date > date('now')`. Expired batches tracked but not counted as available stock. |
| D-24 | Expiry report is full-page view with sortable table. Columns: Medicine Name, Batch, Quantity, Expiry Date, Days Left. Sortable by days remaining, filterable by date range. |
| D-25 | Dashboard expiry widget deferred to Phase 3. |
| D-26 | Settings read paths (default tax rate, cashier discount toggle, expiry thresholds, default reorder level, currency symbol) implemented as Rust backend key-value reads from settings table. |
| D-27 | Full settings UI screens NOT built in Phase 2 — deferred to Phase 5. Accept sensible defaults. |

### the agent's Discretion
- Exact column layout for medicine list table
- Purchase form layout details (supplier selector UI, item row layout)
- Specific SQL queries for stock computation
- Error message wording
- Filter/date-picker implementation for expiry report

### Deferred Ideas (OUT OF SCOPE)
- Full settings UI screens — deferred to Phase 5
- Dashboard expiry widget — deferred to Phase 3 (dashboard phase)
- Barcode scanning for medicine entry — out of scope for v1
</user_constraints>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INVT-01 | Owner can add medicine with name, generic name, brand, category, unit, retail/purchase price, reorder level, shelf location, notes | `create_medicine` command with `require_owner` guard; `medicine_service::create_medicine` validates role + `retail_price >= purchase_price` [DERIVED: D-15, D-16] |
| INVT-02 | Owner can edit existing medicine details | `update_medicine` command; `medicine_service::update_medicine` re-validates price invariant [DERIVED: D-16] |
| INVT-03 | Owner can view searchable medicine list | `list_medicines` / `search_medicines` commands; SQL `LIKE` on name/generic/brand with indexes [VERIFIED: sqlite.org/docs] |
| INVT-04 | Owner can deactivate medicine (soft delete) | `deactivate_medicine` command sets `is_active=0` following D-10 pattern from Phase 1 [DERIVED: D-10] |
| INVT-05 | Retail price >= purchase price | Validated in `medicine_service` before INSERT/UPDATE — same pattern as password length check in `user_service` [DERIVED: D-16] |
| INVT-06 | Pharmacist can view medicine list (read-only, purchase prices hidden) | `MedicinePharmacistDto` excludes `purchase_price`; `list_medicines` service checks session role and returns appropriate DTO — extends Phase 1 role-masked pattern [DERIVED: D-15] |
| INVT-07 | Medicines categorized as Tablet, Syrup, Injection, OTC, Prescription | SQL `CHECK(category IN ('Tablet','Syrup','Injection','OTC','Prescription'))` + DB-level constraint [DERIVED: D-13] |
| INVT-08 | Medicines assigned unit type: Strip, Bottle, Vial, Box, Sachet | SQL `CHECK(unit IN ('Strip','Bottle','Vial','Box','Sachet'))` + DB-level constraint [DERIVED: D-13] |
| SUPP-01 | Owner can add/edit/view suppliers | `supplier_service` CRUD following `user_service` pattern exactly; `require_owner` on all mutations [DERIVED: D-17] |
| SUPP-02 | Owner can record purchase with supplier, invoice, date, items, total, payment status | `purchase_service::record_purchase` in single transaction; validates all items before writing [VERIFIED: docs.rs/rusqlite transactions] |
| SUPP-03 | Each purchase creates batch records with expiry dates | Purchase transaction inserts batch rows with `remaining_qty = quantity`; each item gets its own batch [DERIVED: D-20] |
| SUPP-04 | Purchase automatically increases stock counts | `StockLedgerService::record_purchase_movement` writes positive `quantity_delta` to `stock_movements` inside the same transaction [DERIVED: D-22] |
| SUPP-05 | Purchase price stored per-batch (prices may vary) | `batches.purchase_price` stores the per-order cost; `medicines.purchase_price` is the reference/default [DERIVED: D-21] |
| BATC-01 | Stock tracked at batch level with expiry date per batch | `batches` table with `expiry_date, quantity, remaining_qty`; stock computed per D-23 [VERIFIED: PRD schema §6] |
| BATC-04 | Owner can view expiry report sorted by days remaining | SQL: `julianday(expiry_date) - julianday('now')` for days_remaining; `ORDER BY days_remaining ASC` [VERIFIED: sqlite.org/docs date functions] |
| SETT-01 | Owner configures pharmacy info | Backend read from `settings` table (key-value); no Phase 2 UI per D-27 [DERIVED: D-26] |
| SETT-02 | Owner configures default tax rate | Setting key `default_tax_rate` seeded as `'0'`; backend read via `settings_service::get_string(key)` [DERIVED: D-26] |
| SETT-03 | Owner configures cashier discount permission | Setting key `cashier_discount_enabled` seeded as `'false'`; backend read [DERIVED: D-26] |
| SETT-04 | Owner configures expiry warning/critical thresholds | Setting keys `expiry_warning_days='60'`, `expiry_critical_days='30'`; backend read [DERIVED: D-26] |
| SETT-05 | Owner configures default reorder level | Setting key `default_reorder_level='10'`; backend read [DERIVED: D-26] |
| SETT-06 | Owner configures currency symbol (default Rs.) | Setting key `currency_symbol='Rs.'`; backend read [DERIVED: D-26] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Medicine CRUD | Rust backend (service + repo) | React UI (forms) | D-01 mandates all DB access through Rust; `require_owner` guard enforced at command layer |
| Supplier CRUD | Rust backend (service + repo) | React UI (forms) | Same pattern as medicines; owner-only mutations |
| Purchase intake | Rust backend (transaction service) | React UI (form + inline table) | D-19 requires single-screen form; Rust owns the atomic transaction (D-20) |
| Stock mutation authority | Rust backend (StockLedgerService) | — | D-22: single authority; no other service may change batch quantities |
| Medicine search | Rust backend (SQL LIKE queries) | React UI (300ms debounce input) | D-14: debounce on frontend; SQL query with indexes on backend |
| Role-masked DTOs | Rust backend (DTO selection by role) | React UI (conditional render) | D-15: field masking at service layer, not just UI hiding |
| Expiry report | Rust backend (read query) | React UI (sortable table + filters) | D-24: full-page view; SQL `julianday()` for days calculation |
| Settings reads | Rust backend (key-value query) | React UI (read on component mount) | D-26: backend reads only; no Phase 2 UI (D-27) |
| Category/unit selection | React UI (shadcn Select) | Rust backend (CHECK constraints) | D-13: dropdown on frontend, DB constraint on backend |

## Standard Stack

### Core (extending Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | 0.40.0 | SQLite from Rust | Proved in Phase 1; transactions, prepared statements, WAL [VERIFIED: src-tauri/Cargo.toml] |
| serde | 1.0 | DTO serialization | Proved in Phase 1; required for all Tauri command DTOs [VERIFIED: src-tauri/Cargo.toml] |
| chrono | 0.4 | Timestamps, date arithmetic | Used for `julianday()` date calculations in expiry report; also for DTO generation [VERIFIED: src-tauri/Cargo.toml] |
| rusqlite_migration | 2.6 | Schema versioning | Proved in Phase 1; 002_medicine_catalog migration [VERIFIED: src-tauri/Cargo.toml] |
| shadcn/ui | 2.4.0 | UI components | Table, Dialog, Select, Input, Badge, Button — all from Phase 1 [VERIFIED: node_modules] |
| lucide-react | latest | Icons | Medicine (Pill), Truck, Package, AlertTriangle icons for nav |

### New Modules (Rust — extend Phase 1 patterns)

| Module | File | Pattern Follows |
|--------|------|-----------------|
| `medicine_repo` | `repository/medicine_repo.rs` | `user_repo.rs` — free functions, prepared statements, DTO return |
| `supplier_repo` | `repository/supplier_repo.rs` | `user_repo.rs` — CRUD + search by name/phone |
| `purchase_repo` | `repository/purchase_repo.rs` | Insert purchase + items; uses transactions |
| `batch_repo` | `repository/batch_repo.rs` | Insert batch, search by medicine_id, expiry report query |
| `stock_ledger_repo` | `repository/stock_ledger_repo.rs` | Insert into `stock_movements` table only |
| `settings_repo` | `repository/settings_repo.rs` | Key-value get/set on `settings` table |
| `medicine_service` | `services/medicine_service.rs` | `user_service.rs` — free functions with validation |
| `supplier_service` | `services/supplier_service.rs` | `user_service.rs` — free functions |
| `purchase_service` | `services/purchase_service.rs` | New — transaction orchestration |
| `stock_ledger_service` | `services/stock_ledger_service.rs` | New — append-only mutation authority |
| `settings_service` | `services/settings_service.rs` | Simple key-value read functions |
| `medicine_commands` | `commands/medicine_commands.rs` | `user_commands.rs` — guard + lock + service |
| `supplier_commands` | `commands/supplier_commands.rs` | `user_commands.rs` — guard + lock + service |
| `purchase_commands` | `commands/purchase_commands.rs` | New — complex command with transaction |
| `stock_commands` | `commands/stock_commands.rs` | Thin wrapper around StockLedgerService |
| `settings_commands` | `commands/settings_commands.rs` | Simple read commands |
| `medicine` model | `models/medicine.rs` | `user.rs` — full struct + DTO + From impl |
| `supplier` model | `models/supplier.rs` | `user.rs` pattern |
| `purchase` model | `models/purchase.rs` | Multiple DTOs for nested purchase data |
| `batch` model | `models/batch.rs` | Batch + expiry DTOs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Free-function services | Struct-based services with DI | Phase 1 established free functions; struct DI adds complexity without benefit for single-connection desktop app |
| Separate `StockLedgerService` | Inline stock_movements INSERT in purchase_service | D-22 mandates single authority; inlining would weaken the pattern when returns/write-offs need the same service in Phase 4+ |
| `julianday()` for expiry SQL | Rust-side date comparison | SQL `julianday()` is simpler, works with SQLite date functions, avoids loading all batches into Rust |

**Installation:** No new npm/cargo dependencies needed beyond Phase 1. All required crates already in `Cargo.toml`.

## Architecture Patterns

### System Architecture Diagram

```text
 ┌──────────────────────────────────────────────────┐
 │                React UI (TypeScript)              │
 │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
 │  │Medicine  │ │Supplier  │ │ Purchase Form     │  │
 │  │Pages     │ │Pages     │ │ (inline item tbl) │  │
 │  └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
 │       │            │                │             │
 │  ┌────▼────────────▼────────────────▼─────────┐  │
 │  │     shadcn/ui Table, Dialog, Select, Badge  │  │
 │  │     useTauriCommand hook (from Phase 1)     │  │
 │  │     300ms debounce search (medicine)        │  │
 │  └────────────────┬──────────────────────────┘  │
 │                   │ invoke() via @tauri-apps/api │
 └───────────────────┬──────────────────────────────┘
                     │  Tauri IPC Boundary
 ┌───────────────────▼──────────────────────────────┐
 │           Rust Backend (Tauri Commands)            │
 │                                                    │
 │  ┌─────────────────────────────────────────────┐  │
 │  │ Command Handlers          (FILES)           │  │
 │  │  medicine_commands.rs  — CRUD + search     │  │
 │  │  supplier_commands.rs  — CRUD + search     │  │
 │  │  purchase_commands.rs  — record_purchase   │  │
 │  │  stock_commands.rs     — get_stock/ledger  │  │
 │  │  settings_commands.rs  — get_settings      │  │
 │  └──────────┬──────────────────────────────────┘  │
 │             │                                     │
 │  ┌──────────▼──────────────────────────────────┐  │
 │  │ Services (free functions, business logic)    │  │
 │  │  medicine_service.rs    — validation + DTO   │  │
 │  │  supplier_service.rs    — CRUD logic         │  │
 │  │  purchase_service.rs    — TX orchestration   │  │
 │  │  stock_ledger_service.rs — append movements  │  │
 │  │  settings_service.rs    — key-value reads    │  │
 │  └──────────┬──────────────────────────────────┘  │
 │             │                                     │
 │  ┌──────────▼──────────────────────────────────┐  │
 │  │ Repository Layer (free functions, SQL)      │  │
 │  │  medicine_repo, supplier_repo, batch_repo,  │  │
 │  │  purchase_repo: CRUD + search              │  │
 │  │  stock_ledger_repo: insert_movement        │  │
 │  │  settings_repo: get/set                    │  │
 │  └──────────┬──────────────────────────────────┘  │
 │             │                                     │
 │  ┌──────────▼──────────────────────────────────┐  │
 │  │  rusqlite::Connection (Mutex-wrapped)       │  │
 │  │  + rusqlite_migration (Phase 1 + 002)       │  │
 │  │  + WAL / foreign_keys / busy_timeout        │  │
 │  └─────────────────────────────────────────────┘  │
 └───────────────────────────────────────────────────┘
```

**Flow: Purchase intake (primary new use case):**
```
User fills purchase form (supplier, invoice, items)
  → React validates form locally (qty > 0, price >= 0, expiry valid)
  → React invokes `record_purchase` command via Tauri IPC
  → Command handler: require_owner() guard
  → Command handler: db.lock() acquires Mutex
  → purchase_service::record_purchase(&db, &payload, session.user_id)
  → Opens SQLite transaction: let tx = db.transaction()?
  → Inserts purchase row
  → For each item:
      → Validates medicine exists + is_active
      → Inserts purchase_item row
      → Inserts batch row (quantity = remaining_qty)
      → Calls stock_ledger_service::record_movement(&tx, ...)
  → Calculates total_cost from all items
  → Updates purchase.total_cost
  → tx.commit() — ALL or NOTHING
  → Returns PurchaseReceiptDto to React
  → React shows success + stock count refresh
```

### Migration 002: Medicine Catalog Schema

```sql
-- 002_medicine_catalog/up.sql
CREATE TABLE medicines (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    generic_name   TEXT,
    brand_name     TEXT,
    category       TEXT NOT NULL CHECK(category IN ('Tablet','Syrup','Injection','OTC','Prescription')),
    unit           TEXT NOT NULL CHECK(unit IN ('Strip','Bottle','Vial','Box','Sachet')),
    retail_price   REAL NOT NULL CHECK(retail_price >= 0),
    purchase_price REAL NOT NULL CHECK(purchase_price >= 0),
    reorder_level  INTEGER DEFAULT 10,
    shelf_location TEXT,
    notes          TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE suppliers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name   TEXT NOT NULL,
    contact_person TEXT,
    phone          TEXT,
    address        TEXT,
    payment_terms  TEXT,
    notes          TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchases (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
    invoice_number  TEXT,
    purchase_date   TEXT NOT NULL,
    total_cost      REAL,
    payment_status  TEXT NOT NULL DEFAULT 'Pending' CHECK(payment_status IN ('Paid','Pending','Partial')),
    notes           TEXT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchase_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id     INTEGER NOT NULL REFERENCES purchases(id),
    medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
    quantity        INTEGER NOT NULL CHECK(quantity > 0),
    purchase_price  REAL NOT NULL CHECK(purchase_price >= 0),
    expiry_date     TEXT NOT NULL,
    batch_id        INTEGER REFERENCES batches(id),
    line_cost       REAL NOT NULL
);

CREATE TABLE batches (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
    purchase_id     INTEGER NOT NULL REFERENCES purchases(id),
    purchase_item_id INTEGER REFERENCES purchase_items(id),
    purchase_price  REAL NOT NULL CHECK(purchase_price >= 0),
    quantity        INTEGER NOT NULL CHECK(quantity > 0),
    remaining_qty   INTEGER NOT NULL CHECK(remaining_qty >= 0),
    expiry_date     TEXT NOT NULL,
    received_date   TEXT NOT NULL DEFAULT (datetime('now'))
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

-- Seed default settings (Phase 2 scope — D-26)
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_tax_rate', '0');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cashier_discount_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('expiry_warning_days', '60');
INSERT OR IGNORE INTO settings (key, value) VALUES ('expiry_critical_days', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_reorder_level', '10');
INSERT OR IGNORE INTO settings (key, value) VALUES ('currency_symbol', 'Rs.');
```

### Recommended Project Structure

```
src/
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx          # ADD nav items: Medicines, Suppliers, Purchases, Expiry Report
│   ├── medicines/
│   │   ├── MedicineList.tsx     # Searchable table with 300ms debounce
│   │   ├── MedicineForm.tsx     # Add/edit dialog with category/unit selects
│   │   └── MedicineDetail.tsx   # Read-only detail for pharmacist (D-15)
│   ├── suppliers/
│   │   ├── SupplierList.tsx     # Searchable table
│   │   └── SupplierForm.tsx     # Add/edit dialog
│   ├── purchases/
│   │   ├── PurchaseForm.tsx     # Single-screen with inline item table (D-19)
│   │   └── PurchaseList.tsx     # Purchase history table
│   └── reports/
│       └── ExpiryReport.tsx     # Sortable expiry table (D-24)
├── hooks/
│   └── useDebounce.ts           # 300ms debounce hook for medicine search
├── pages/
│   ├── MedicinesPage.tsx        # Routes to MedicineList + conditional MedicineForm
│   ├── SuppliersPage.tsx        # Routes to SupplierList + SupplierForm
│   ├── PurchasesPage.tsx        # Routes to PurchaseForm + PurchaseList
│   └── ExpiryReportPage.tsx     # Full-page expiry report
├── types/
│   ├── medicine.ts              # MedicineDto, MedicinePharmacistDto
│   ├── supplier.ts              # SupplierDto
│   ├── purchase.ts              # PurchaseDto, PurchaseItemDto, CreatePurchaseDto
│   └── settings.ts              # SettingsMap
├── lib/
│   └── tauri.ts                 # ADD typed wrappers for all Phase 2 commands
├── App.tsx                      # ADD Phase 2 routes
└── main.tsx

src-tauri/
├── migrations/
│   └── 002_medicine_catalog/
│       └── up.sql               # New tables + indexes + seed settings
├── src/
│   ├── lib.rs                   # ADD pub mod for new modules
│   ├── main.rs                  # ADD new commands to invoke_handler
│   ├── migrations.rs            # ADD M::up(include_str!("../migrations/002_medicine_catalog/up.sql"))
│   ├── models/
│   │   ├── mod.rs               # ADD pub mod + re-exports
│   │   ├── medicine.rs          # Medicine, MedicineDto, MedicinePharmacistDto, CreateMedicineDto, UpdateMedicineDto
│   │   ├── supplier.rs          # Supplier, SupplierDto, CreateSupplierDto, UpdateSupplierDto
│   │   ├── purchase.rs          # Purchase, PurchaseDto, PurchaseItemDto, CreatePurchaseDto, PurchaseReceiptDto
│   │   ├── batch.rs             # Batch, BatchDto, ExpiryReportRow
│   │   └── settings.rs          # Optional: typed settings structs
│   ├── repository/
│   │   ├── mod.rs               # ADD pub mod
│   │   ├── medicine_repo.rs     # insert, find_by_id, find_all, search, update, deactivate
│   │   ├── supplier_repo.rs     # insert, find_by_id, find_all, search, update, deactivate
│   │   ├── purchase_repo.rs     # insert_purchase, insert_item, find_by_id
│   │   ├── batch_repo.rs        # insert, find_by_medicine, find_expiring, get_current_stock
│   │   ├── stock_ledger_repo.rs # insert_movement
│   │   └── settings_repo.rs     # get_string, get_int, get_bool, set_value
│   ├── services/
│   │   ├── mod.rs               # ADD pub mod
│   │   ├── medicine_service.rs  # create, update, deactivate, list, search (returns role-appropriate DTO)
│   │   ├── supplier_service.rs  # create, update, deactivate, list, search
│   │   ├── purchase_service.rs  # record_purchase (transaction orchestrator)
│   │   ├── stock_ledger_service.rs # record_movement (append-only)
│   │   └── settings_service.rs  # get_default_tax_rate, get_expiry_thresholds, etc.
│   ├── commands/
│   │   ├── mod.rs               # ADD pub mod
│   │   ├── medicine_commands.rs # create_medicine, update_medicine, deactivate_medicine, list_medicines, search_medicines
│   │   ├── supplier_commands.rs # create_supplier, update_supplier, deactivate_supplier, list_suppliers, search_suppliers
│   │   ├── purchase_commands.rs # record_purchase, list_purchases, get_purchase_detail
│   │   ├── stock_commands.rs    # get_current_stock, get_stock_movements
│   │   └── settings_commands.rs # get_settings
```

### Pattern 1: Role-Masked DTO (extends Phase 1)

**What:** Service returns different DTOs depending on caller role. This is the same pattern as Phase 1's `User` → `UserDto` separation, but adds a second variant for the pharmacist role.

**When to use:** Every medicine list/search endpoint; potentially for purchase data (purchase_price hidden from pharmacist).

**Source:** Phase 1 established pattern in `models/user.rs`; D-15 mandates it for medicines.

```rust
// src-tauri/src/models/medicine.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Medicine {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

/// Full view — for Owner role only. Includes purchase_price.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicineDto {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub current_stock: i64,      // computed from batches
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
}

/// Pharmacist-safe view — purchase_price REMOVED by design.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicinePharmacistDto {
    pub id: i64,
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub current_stock: i64,
    pub reorder_level: i64,
    pub shelf_location: Option<String>,
    pub is_active: bool,
}

impl From<Medicine> for MedicineDto { ... }
impl From<Medicine> for MedicinePharmacistDto { ... }
```

```rust
// src-tauri/src/services/medicine_service.rs
pub fn list_medicines(
    db: &Connection,
    role: &str,
) -> Result<Vec<MedicineDto>, CommandError> {
    let medicines = medicine_repo::find_all(db)?;
    // Always return MedicineDto for list (purchase_price is the differentiator).
    // The role check happens at the command layer for which command is called,
    // OR the service itself can filter. Phase 1 pattern: separate commands.
    Ok(medicines.into_iter().map(MedicineDto::from).collect())
}

// Pharmacist calls a DIFFERENT command that returns pharmacist DTOs:
pub fn list_medicines_pharmacist(
    db: &Connection,
) -> Result<Vec<MedicinePharmacistDto>, CommandError> {
    let medicines = medicine_repo::find_all(db)?;
    Ok(medicines.into_iter().map(MedicinePharmacistDto::from).collect())
}
```

### Pattern 2: Purchase Intake Transaction

**What:** A single rusqlite transaction that atomically creates purchase, items, batches, AND stock movements.

**When to use:** Every purchase confirmation. Never skip the transaction — missing a stock_movement is a data integrity bug.

**Source:** [VERIFIED: docs.rs/rusqlite/0.40.0 — Transaction methods]

```rust
// src-tauri/src/services/purchase_service.rs
use rusqlite::Connection;
use crate::errors::CommandError;
use crate::models::{CreatePurchaseDto, PurchaseReceiptDto};
use crate::repository::{purchase_repo, batch_repo, stock_ledger_repo, medicine_repo};

pub fn record_purchase(
    db: &Connection,
    payload: &CreatePurchaseDto,
    user_id: i64,
) -> Result<PurchaseReceiptDto, CommandError> {
    // 1. Validate all items before opening transaction
    for item in &payload.items {
        if item.quantity <= 0 {
            return Err(CommandError::validation("Item quantity must be positive"));
        }
        if item.purchase_price < 0.0 {
            return Err(CommandError::validation("Purchase price cannot be negative"));
        }
        // Validate medicine exists and is active
        let medicine = medicine_repo::find_by_id(db, item.medicine_id)?
            .ok_or_else(|| CommandError::not_found("Medicine"))?;
        if !medicine.is_active {
            return Err(CommandError::validation(
                &format!("Medicine '{}' is inactive and cannot be purchased", medicine.name)
            ));
        }
    }

    // 2. Open transaction — atomic: ALL succeed or ALL roll back
    let tx = db.transaction().map_err(|e| CommandError::from(e))?;

    // 3. Calculate total cost
    let total_cost: f64 = payload.items.iter()
        .map(|i| i.quantity as f64 * i.purchase_price)
        .sum();

    // 4. Insert purchase
    let purchase_id = purchase_repo::insert_purchase(&tx,
        payload.supplier_id,
        &payload.invoice_number,
        &payload.purchase_date,
        total_cost,
        &payload.payment_status,
        &payload.notes,
        user_id,
    )?;

    // 5. For each item: insert purchase_item + batch + stock_movement
    for item in &payload.items {
        let line_cost = item.quantity as f64 * item.purchase_price;

        let item_id = purchase_repo::insert_item(&tx,
            purchase_id,
            item.medicine_id,
            item.quantity,
            item.purchase_price,
            &item.expiry_date,
            line_cost,
        )?;

        let batch_id = batch_repo::insert(&tx,
            item.medicine_id,
            purchase_id,
            item_id,
            item.purchase_price,
            item.quantity,
            item.quantity,  // remaining_qty = quantity initially
            &item.expiry_date,
        )?;

        // Link purchase_item to batch
        purchase_repo::update_item_batch_id(&tx, item_id, batch_id)?;

        // Record positive stock movement (D-22: StockLedgerService as authority)
        stock_ledger_repo::insert_movement(&tx,
            "purchase",     // movement_type
            item.medicine_id,
            Some(batch_id),
            item.quantity,  // positive delta
            "purchase",     // reference_type
            Some(purchase_id),
            None,           // reason
            user_id,
        )?;
    }

    // 6. Commit — all or nothing
    tx.commit().map_err(|e| CommandError::from(e))?;

    Ok(PurchaseReceiptDto {
        purchase_id,
        total_cost,
        item_count: payload.items.len() as i64,
    })
}
```

**Critical note:** The `db.transaction()` creates a nested transaction on the same connection. The Mutex lock is held by the caller (command handler) so this is safe. Within the transaction, pass `&tx` (which implements `Connection`-like methods) to all repo functions.

### Pattern 3: StockLedgerService (Append-Only Mutation Authority)

**What:** A thin service layer that enforces the append-only pattern. It validates that stock movements have a `movement_type`, `reference_type`, and `user_id`. It NEVER reads or updates batches directly — it only appends to `stock_movements`.

**When to use:** Every stock-affecting operation (purchases now, sales/returns/write-offs in later phases).

**Source:** D-22; ARCHITECTURE.md §"StockService / StockLedgerService"

```rust
// src-tauri/src/services/stock_ledger_service.rs
use crate::errors::CommandError;
use crate::repository::stock_ledger_repo;

/// Records an append-only stock movement entry.
///
/// This is the single authority for stock mutation records.
/// No other service or repository should INSERT into stock_movements
/// except through this service (D-22 enforcement).
///
/// `conn` can be either a `&Connection` or `&Transaction` (both implement
/// the same methods needed by the repo layer).
///
/// `quantity_delta` is positive for stock increases (purchases, returns)
/// and negative for decreases (sales, write-offs, supplier returns).
pub fn record_movement(
    conn: &rusqlite::Connection,
    movement_type: &str,
    medicine_id: i64,
    batch_id: Option<i64>,
    quantity_delta: i64,
    reference_type: &str,
    reference_id: Option<i64>,
    reason: Option<&str>,
    user_id: i64,
) -> Result<(), CommandError> {
    // Validate movement_type is known
    match movement_type {
        "purchase" | "sale" | "customer_return" | "supplier_return"
        | "write_off" | "adjustment" => {},
        _ => return Err(CommandError::validation(
            &format!("Unknown movement_type: {}", movement_type)
        )),
    }

    stock_ledger_repo::insert_movement(
        conn, movement_type, medicine_id, batch_id,
        quantity_delta, reference_type, reference_id, reason, user_id,
    )
}
```

### Pattern 4: Medicine Search with 300ms Debounce

**What:** Frontend debounces search input, Rust backend uses SQL `LIKE` on name/generic/brand with an index.

**When to use:** Medicine list page and eventually POS search (Phase 3).

**Source:** D-14; `idx_medicines_search` index covers `(name, generic_name, brand_name)`

```rust
// src-tauri/src/commands/medicine_commands.rs
#[tauri::command]
pub fn search_medicines(
    state: State<'_, AppState>,
    session_token: String,
    query: String,
) -> Result<Vec<MedicineListItem>, CommandError> {
    let session = require_session(&state, &session_token)?;
    let db = state.db.lock()?;

    // Build search pattern — search across name, generic_name, brand, category
    let pattern = format!("%{}%", query);
    let medicines = medicine_repo::search(&db, &pattern)?;

    // Return role-appropriate DTOs
    if session.role == "owner" {
        Ok(medicines.into_iter().map(MedicineDto::from).collect())
    } else {
        Ok(medicines.into_iter().map(MedicinePharmacistDto::from).collect())
    }
}
```

```rust
// src-tauri/src/repository/medicine_repo.rs
pub fn search(db: &Connection, pattern: &str) -> Result<Vec<Medicine>, rusqlite::Error> {
    let mut stmt = db.prepare(
        "SELECT id, name, generic_name, brand_name, category, unit,
                retail_price, purchase_price, reorder_level,
                shelf_location, notes, is_active, created_at
         FROM medicines
         WHERE is_active = 1
           AND (name LIKE ?1 OR generic_name LIKE ?1 OR brand_name LIKE ?1 OR category LIKE ?1)
         ORDER BY name ASC
         LIMIT 50"
    )?;

    let rows = stmt.query_map(rusqlite::params![pattern], |row| {
        Ok(Medicine {
            id: row.get(0)?,
            name: row.get(1)?,
            generic_name: row.get(2)?,
            brand_name: row.get(3)?,
            category: row.get(4)?,
            unit: row.get(5)?,
            retail_price: row.get(6)?,
            purchase_price: row.get(7)?,
            reorder_level: row.get(8)?,
            shelf_location: row.get(9)?,
            notes: row.get(10)?,
            is_active: row.get::<_, i32>(11)? != 0,
            created_at: row.get(12)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
```

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in MedicineList.tsx:
// const [searchTerm, setSearchTerm] = useState('');
// const debouncedSearch = useDebounce(searchTerm, 300);
// useEffect(() => {
//   if (debouncedSearch) invoke('search_medicines', { sessionToken, query: debouncedSearch });
// }, [debouncedSearch]);
```

### Pattern 5: Expiry Report Query

**What:** Full SQL query that returns expiry data sorted by days remaining. No complex joins — just batches + medicines.

**When to use:** Expiry report page (D-24).

**Source:** [VERIFIED: sqlite.org/lang_datefunc.html — julianday()]

```rust
// src-tauri/src/models/batch.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpiryReportRow {
    pub batch_id: i64,
    pub medicine_id: i64,
    pub medicine_name: String,
    pub generic_name: Option<String>,
    pub quantity: i64,
    pub remaining_qty: i64,
    pub purchase_price: f64,
    pub expiry_date: String,
    pub days_remaining: i64,  // computed via julianday()
}

// src-tauri/src/repository/batch_repo.rs
pub fn get_expiry_report(
    db: &Connection,
    min_days: Option<i64>,   // optional filter: only show <= N days
    max_days: Option<i64>,   // optional filter: only show >= N days
) -> Result<Vec<ExpiryReportRow>, rusqlite::Error> {
    let mut sql = String::from(
        "SELECT b.id, m.id, m.name, m.generic_name, b.quantity, b.remaining_qty,
                b.purchase_price, b.expiry_date,
                CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_remaining
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         WHERE m.is_active = 1
           AND b.remaining_qty > 0"
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(min) = min_days {
        sql.push_str(&format!(" AND days_remaining <= ?{}", params.len() + 1));
        params.push(Box::new(min));
    }
    if let Some(max) = max_days {
        sql.push_str(&format!(" AND days_remaining >= ?{}", params.len() + 1));
        params.push(Box::new(max));
    }

    sql.push_str(" ORDER BY days_remaining ASC");

    let mut stmt = db.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(ExpiryReportRow {
            batch_id: row.get(0)?,
            medicine_id: row.get(1)?,
            medicine_name: row.get(2)?,
            generic_name: row.get(3)?,
            quantity: row.get(4)?,
            remaining_qty: row.get(5)?,
            purchase_price: row.get(6)?,
            expiry_date: row.get(7)?,
            days_remaining: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }
    Ok(results)
}
```

### Pattern 6: Settings Key-Value Read

**What:** Simple `SELECT value FROM settings WHERE key = ?` with typed parsers. The `settings` table already exists from Phase 1 migration.

**When to use:** Any feature that needs configuration (tax rate, thresholds, defaults).

**Source:** D-26; `settings` table already in 001_initial migration

```rust
// src-tauri/src/repository/settings_repo.rs
pub fn get_string(db: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = db.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(rusqlite::params![key], |row| {
        row.get::<_, String>(0)
    })?;
    match rows.next() {
        Some(Ok(val)) => Ok(Some(val)),
        Some(Err(e)) => Err(e),
        None => Ok(None),
    }
}

// src-tauri/src/services/settings_service.rs
pub fn get_f64(db: &Connection, key: &str, default: f64) -> Result<f64, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => val.parse::<f64>().or(Ok(default)),
        None => Ok(default),
    }
}

pub fn get_i64(db: &Connection, key: &str, default: i64) -> Result<i64, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => val.parse::<i64>().or(Ok(default)),
        None => Ok(default),
    }
}

pub fn get_bool(db: &Connection, key: &str, default: bool) -> Result<bool, CommandError> {
    match settings_repo::get_string(db, key)? {
        Some(val) => Ok(val == "true" || val == "1"),
        None => Ok(default),
    }
}

// Convenience accessors used by other services:
pub fn get_default_tax_rate(db: &Connection) -> Result<f64, CommandError> {
    get_f64(db, "default_tax_rate", 0.0)
}

pub fn get_expiry_warning_days(db: &Connection) -> Result<i64, CommandError> {
    get_i64(db, "expiry_warning_days", 60)
}
```

### Anti-Patterns to Avoid

- **Direct batch mutations outside StockLedgerService:** D-22 mandates single authority. If a command updates `batches.remaining_qty` directly, stock movements lose auditability. Always go through `stock_ledger_service::record_movement`.
- **Computing stock totals without filtering expired batches:** D-23 requires `expiry_date > date('now')` in the SUM. A medicine with 100 qty in expired batches should show 0 current stock.
- **Float comparison for `retail_price >= purchase_price`:** Use `(retail_price + 0.001) >= purchase_price` instead of direct float comparison to avoid precision errors, or better: store prices as integers (paise/cents). Discussion decision needed.
- **Frontend-only purchase validation:** Never trust the frontend's `total_cost`. Recompute in Rust during the transaction to prevent manipulation.
- **Mixing price decimals across currencies:** All prices in the same currency (Rs.). No conversion needed for v1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction orchestration | Manual begin/commit/rollback | `rusqlite::Transaction` via `db.transaction()` | RAII guard: rollback on Drop if not committed; prevents orphaned transactions [VERIFIED: docs.rs/rusqlite/0.40.0] |
| Date arithmetic | Rust-side date comparison | `julianday()` SQL function | Simpler, server-side, handles all edge cases [VERIFIED: sqlite.org/lang_datefunc.html] |
| Search indexing | Full-text search engine | SQL `LIKE '%term%'` with index on `(name, generic_name, brand_name)` | FTS5 is overkill for <1000 medicines; LIKE with index covers Phase 2 needs [ASSUMED] |
| Category/unit validation | Frontend-only enum check | SQL `CHECK` constraints + shadcn Select | Defense in depth: DB rejects invalid values even if frontend bypass works |

## Common Pitfalls

### Pitfall 1: Purchase transaction partially applied
**What goes wrong:** Insert succeeds for items 1-3 but fails on item 4, leaving orphan purchase with missing items/batches.
**Why it happens:** Not wrapping the entire purchase flow in a transaction, or catching errors and only rolling back partially.
**How to avoid:** Use a single `db.transaction()?` and call `tx.commit()` only after ALL inserts succeed. The `Transaction` struct's Drop impl calls `rollback()` if not committed. Validate ALL items BEFORE opening the transaction.
**Warning signs:** Purchase shows `total_cost = 0` or items count doesn't match input. Viewing a purchase shows fewer items than expected.

### Pitfall 2: Mutex deadlock from holding db lock across a long transaction
**What goes wrong:** The purchase command acquires `state.db.lock()`, then starts a transaction that takes 2+ seconds. Meanwhile, a search-while-typing command tries to acquire the same lock and blocks the UI.
**Why it happens:** Tauri commands are handled by a threadpool. If one thread holds the Mutex for a long transaction, all other commands queue up.
**How to avoid:** Purchase transactions are fast (< 50ms for typical 5-10 items). The risk is low for v1. If it becomes a problem in production, split reads to a separate readonly connection.
**Warning signs:** UI freezes during purchase confirmation.

### Pitfall 3: Failing to mask purchase_price in pharmacist search results
**What goes wrong:** Pharmacist calls `search_medicines` and gets a result containing `purchase_price`, exposing cost data.
**Why it happens:** Using a single `list_medicines` command that always returns the full DTO, relying on the frontend to hide the column.
**How to avoid:** The service layer MUST return a different DTO based on role. Phase 1 established this pattern with separate frontend routes; Phase 2 must enforce it at the service level.
**Warning signs:** `MedicineDto` includes `purchase_price`; no `MedicinePharmacistDto` exists.

### Pitfall 4: Expired batches counted as available stock
**What goes wrong:** Medicine shows current_stock of 50, but all 50 are in expired batches. POS (Phase 3) would need to block sales but the count wrongly suggests availability.
**Why it happens:** `SUM(remaining_qty)` without filtering `expiry_date > date('now')`.
**How to avoid:** Always use D-23's formula: `SELECT COALESCE(SUM(remaining_qty), 0) FROM batches WHERE medicine_id = ? AND expiry_date > date('now')`.
**Warning signs:** Expired medicines show positive stock in the list view.

## Code Examples

### Full command handler for owner-only medicine creation

```rust
// src-tauri/src/commands/medicine_commands.rs
#[derive(Deserialize)]
pub struct CreateMedicineDto {
    pub name: String,
    pub generic_name: Option<String>,
    pub brand_name: Option<String>,
    pub category: String,
    pub unit: String,
    pub retail_price: f64,
    pub purchase_price: f64,
    pub reorder_level: Option<i64>,
    pub shelf_location: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub fn create_medicine(
    state: State<'_, AppState>,
    session_token: String,
    payload: CreateMedicineDto,
) -> Result<MedicineDto, CommandError> {
    let _session = require_owner(&state, &session_token)?;
    let db = state.db.lock()?;

    // Validate retail_price >= purchase_price (D-16)
    if payload.retail_price < payload.purchase_price {
        return Err(CommandError::validation(
            "Retail price must be greater than or equal to purchase price"
        ));
    }

    // Validate category and unit are in allowed sets
    if !["Tablet", "Syrup", "Injection", "OTC", "Prescription"].contains(&payload.category.as_str()) {
        return Err(CommandError::validation("Invalid category"));
    }
    if !["Strip", "Bottle", "Vial", "Box", "Sachet"].contains(&payload.unit.as_str()) {
        return Err(CommandError::validation("Invalid unit type"));
    }

    medicine_service::create_medicine(&db, &payload)
}
```

### Medicine service with role-masked list

```rust
// src-tauri/src/services/medicine_service.rs
pub fn list_medicines(
    db: &Connection,
    role: &str,
) -> Result<Vec<MedicineDto>, CommandError> {
    let medicines = medicine_repo::find_all(db)?;

    if role == "owner" {
        // Enrich with current stock computed from batches
        let mut dtos: Vec<MedicineDto> = Vec::new();
        for m in medicines {
            let current_stock = stock_ledger_service::get_current_stock(db, m.id)?;
            let mut dto = MedicineDto::from(m);
            dto.current_stock = current_stock;
            dtos.push(dto);
        }
        Ok(dtos)
    } else {
        // Pharmacist gets empty list — no medicine list view for them per D-07 sidebar.
        // This path exists for future pharmacist views.
        Err(CommandError::forbidden())
    }
}

/// Pharmacist-specific search — returns only public fields
pub fn search_medicines_pharmacist(
    db: &Connection,
    query: &str,
) -> Result<Vec<MedicinePharmacistDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let medicines = medicine_repo::search(db, &pattern)?;

    let mut dtos: Vec<MedicinePharmacistDto> = Vec::new();
    for m in medicines {
        let current_stock = stock_ledger_service::get_current_stock(db, m.id)?;
        let mut dto = MedicinePharmacistDto::from(m);
        dto.current_stock = current_stock;
        dtos.push(dto);
    }
    Ok(dtos)
}
```

### Frontend medicine list with debounced search

```typescript
// src/pages/MedicinesPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDebounce } from '../hooks/useDebounce';
import type { MedicineDto, MedicinePharmacistDto } from '../types/medicine';
import type { SessionDto } from '../types/session';
import { MedicineList } from '../components/medicines/MedicineList';

interface MedicinesPageProps {
  session: SessionDto;
}

export function MedicinesPage({ session }: MedicinesPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [medicines, setMedicines] = useState<MedicineDto[] | MedicinePharmacistDto[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearch) {
      // Load all (or empty) when no search term
      setMedicines([]);
      return;
    }

    setLoading(true);
    if (session.role === 'owner') {
      invoke<MedicineDto[]>('search_medicines', {
        sessionToken: session.token,
        query: debouncedSearch,
      }).then(setMedicines).finally(() => setLoading(false));
    } else {
      invoke<MedicinePharmacistDto[]>('search_medicines_pharmacist', {
        sessionToken: session.token,
        query: debouncedSearch,
      }).then(setMedicines).finally(() => setLoading(false));
    }
  }, [debouncedSearch, session]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Medicines</h1>
        {/* Search input with debounce */}
        <input
          type="text"
          placeholder="Search by name, generic, brand..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="..."
        />
      </div>

      <MedicineList
        medicines={medicines}
        loading={loading}
        role={session.role}
      />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 1: User CRUD (single role-free DTO + command) | Phase 2: Role-masked DTO variants (MedicineDto vs MedicinePharmacistDto) | Phase 2 | Extends the pattern to enforce field-level RBAC at the service layer |
| Phase 1: Single-table operations (insert user, update user) | Phase 2: Multi-table transaction (purchase + items + batches + stock_movements) | Phase 2 | New complexity: must use rusqlite::Transaction with proper error handling |
| Phase 1: Repo functions take `&Connection` | Phase 2: Some repo functions must accept `&Transaction` (which implements the same traits) | Phase 2 | `&Transaction` can be used wherever `&Connection` is used for query methods — they share `Methods` trait |

**Deprecated/outdated:**
- Do NOT use `INSERT INTO batches` directly from services other than purchase_service and (future) return_service. Always use StockLedgerService as the authority gate.
- Do NOT store `current_stock` as a denormalized field on medicines. Compute from batches per D-23.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `rusqlite::Transaction` can be passed to repo functions that currently take `&Connection` | Architecture Patterns | Low risk — `Transaction` implements `Deref<Target=Connection>`; all repo functions use `Connection` methods. If type mismatch occurs, use `&*tx` to deref. |
| A2 | `LIKE '%term%'` with a column index on `(name, generic_name, brand_name)` provides acceptable performance for <1000 medicines | Don't Hand-Roll | MEDIUM risk — SQLite cannot use a B-tree index for a leading-wildcard LIKE. For <1000 records, a full table scan is fast enough. If performance is an issue for POS search (Phase 3), add a dedicated FTS5 index. |
| A3 | `julianday()` subtraction returns correct integer days_remaining | Expiry Report | julianday returns fractional days; CAST to INTEGER truncates. For same-time-of-day comparisons this is correct. Edge case: a batch expiring "today" gets days_remaining = 0. |
| A4 | Prices can be stored as `REAL` (f64) without precision issues for pharmacy pricing | Standard Stack | MEDIUM risk — float precision can cause issues at scale (0.1 + 0.2 != 0.3). For v1 pharmacy pricing (typically ending in .00, .25, .50, .75), REAL is acceptable. Consider switching to INTEGER paise/cents storage in a future schema migration. |

## Open Questions

1. **Price storage: REAL vs. INTEGER paise/cents**
   - What we know: PRD uses REAL for prices. Phase 1 Cargo.toml has no decimal crate.
   - What's unclear: Float precision for financial values is a known issue. Thousands of transactions with small rounding errors accumulate.
   - Recommendation: Use REAL for v1 (matching PRD schema). Add `CHECK(retail_price >= 0)` to prevent negative prices. Accept the minor float imprecision for v1 speed. If the client reports rounding issues after go-live, migrate to INTEGER paise/cents storage.

2. **Buy/sell price validation tolerance**
   - What we know: D-16 requires `retail_price >= purchase_price`.
   - What's unclear: Should the validation be strict (`>=`) or have a tolerance for "loss leader" scenarios where a pharmacy sells below cost?
   - Recommendation: Strict `>=` per D-16. The owner controls both prices and can set them equal if needed.

3. **Payment status for purchases: default**
   - What we know: `payment_status` can be 'Paid', 'Pending', 'Partial'.
   - What's unclear: Should the default be 'Pending' (optimistic, expecting to pay later) or 'Paid' (assuming immediate payment)?
   - Recommendation: Default to 'Pending' — most pharmacy purchases in developing markets are on credit terms. The owner explicitly marks as 'Paid' when payment is completed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust (rustc) | Tauri backend | ✓ | 1.96.0 | — |
| Cargo | Rust build system | ✓ | 1.96.0 | — |
| Node.js | Frontend build | ✓ | 24.13.1 | — |
| npm | Package management | ✓ | 11.8.0 | — |
| SQLite (via rusqlite bundled) | Database | ✓ (bundled) | rusqlite bundles SQLite 3.x | — |

**Missing dependencies with no fallback:** None — all core tooling is available and verified.

**Missing dependencies with fallback:** None.

## Validation Architecture

> SKIPPED — `workflow.nyquist_validation` is explicitly set to `false` in `.planning/config.json`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `require_owner()` guard on all mutation commands (medicine CRUD, supplier CRUD, purchase entry); `require_session()` guard on all read commands; pharmacist view returns `MedicinePharmacistDto` without `purchase_price` |
| V5 Input Validation | yes | Prepared statements (rusqlite) for all SQL; `CHECK` constraints in DDL for category, unit, payment_status; Rust-side validation for `retail_price >= purchase_price` |
| V8 Data Protection | yes | Role-masked DTOs ensure purchase prices never reach pharmacist frontend; soft deletes (`is_active`) preserve referential integrity for sales history |
| V7 Business Logic | yes | Purchase intake transaction ensures atomicity — no partial state; StockLedgerService is the single authority for stock mutations preventing inconsistent stock counts |

### Known Threat Patterns for Phase 2 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Pharmacist accessing purchase prices via search API | Information Disclosure | Service returns `MedicinePharmacistDto` (no purchase_price) when role != "owner"; separate command `search_medicines_pharmacist` with no purchase_price field in DTO [DERIVED: D-15] |
| Purchase injection (creating orphan or phantom batches) | Tampering | All mutations gated by `require_owner()`; purchase transaction validates all items before writing; `batches.purchase_id` FK prevents orphan batches |
| Price manipulation by modifying retail_price < purchase_price | Tampering | `retail_price >= purchase_price` validated in Rust service layer on every create/update — not just frontend [DERIVED: D-16] |
| Deactivated medicine being purchased | Business Logic | Purchase service validates `medicines.is_active = 1` before creating batch; FK from purchase_items to medicines enforces referential integrity |
| Stock movement without audit trail | Repudiation | StockLedgerService requires `user_id` parameter; every stock_movement has movement_type, reference_type, reference_id — purchase movements are traceable back to purchase ID |

## Sources

### Primary (HIGH confidence)
- Phase 1 source code (`src-tauri/src/`) — Established patterns for commands, guards, services, repos, models, errors, migrations [VERIFIED: codebase inspection 2026-06-05]
- Phase 1 migration (`src-tauri/migrations/001_initial/up.sql`) — Existing `settings` and `stock_movements` table schemas [VERIFIED: codebase inspection]
- `PRD.md` §6 — Database schema for medicines, batches, suppliers, purchases, purchase_items tables [VERIFIED: source document]
- CONTEXT.md — All locked decisions D-13 through D-27 [VERIFIED: 02-CONTEXT.md]
- rusqlite docs — Transaction API (`db.transaction()`, `tx.commit()`) [CITED: docs.rs/rusqlite/0.40.0]
- SQLite date functions — `julianday()` for date arithmetic [CITED: sqlite.org/lang_datefunc.html]

### Secondary (MEDIUM confidence)
- ARCHITECTURE.md — Stock ledger pattern, purchase transaction description, role-masked DTOs [VERIFIED: .planning/research/ARCHITECTURE.md]
- REQUIREMENTS.md — Requirement IDs INVT-01 through INVT-08, SUPP-01 through SUPP-05, BATC-01, BATC-04, SETT-01 through SETT-06 [VERIFIED: .planning/REQUIREMENTS.md]
- ROADMAP.md — Phase 2 success criteria [VERIFIED: .planning/ROADMAP.md]

### Tertiary (LOW confidence)
- A1: `rusqlite::Transaction` can be passed interchangeably with `&Connection` — needs verification during implementation [ASSUMED]
- A2: `LIKE '%term%'` performance for ~1000 medicines is acceptable without FTS5 [ASSUMED]
- A4: REAL (f64) prices adequate for pharmacy v1 without integer conversion [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All patterns directly extend Phase 1 established code. No new crates needed. Transaction pattern documented in rusqlite official docs.
- Architecture: HIGH — Purchase transaction pattern, role-masked DTOs, and StockLedgerService all derived from ARCHITECTURE.md and verified against Phase 1 codebase.
- Pitfalls: HIGH — Derived from known SQLite transaction pitfalls, RBAC masking requirements, and stock computation edge cases. Each has concrete guard in the design.

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (30 days — ecosystem moves slowly for embedded Rust/SQLite stack)

### Build Order (Recommended)

For the planner: Build in this exact dependency order to minimize rework:

| Step | What | Depends On | Delivers |
|------|------|------------|----------|
| 1 | Migration 002: create medicines, suppliers, purchases, purchase_items, batches, indexes, seed settings | Phase 1 schema | Tables ready for all subsequent steps |
| 2 | Settings read backend (`settings_repo`, `settings_service`, `settings_commands`) | Step 1 | Settings read commands consumed by frontend (read-only, no UI) |
| 3 | Medicine repo + service + commands + DTOs | Step 1 | Full medicine CRUD backend |
| 4 | Medicine frontend (pages, components, types, tauri.ts wrappers, sidebar nav) | Step 3 | Owner can manage medicines; pharmacist can view |
| 5 | Supplier repo + service + commands + DTOs | Step 1 | Full supplier CRUD backend |
| 6 | Supplier frontend (pages, components, sidebar nav) | Step 5 | Owner can manage suppliers |
| 7 | StockLedgerService + stock_ledger_repo + get_current_stock helper | Step 1 | Single mutation authority (backend only, no UI) |
| 8 | Purchase repo + service (complex transaction) + commands + DTOs | Steps 3, 5, 7 | Purchase intake backend |
| 9 | Purchase frontend (single-screen form with inline item table, tauri.ts wrappers) | Step 8 | Owner can record purchases with batches |
| 10 | Expiry report backend (batch_repo expiry query) + command | Step 3 | Expiry report query |
| 11 | Expiry report frontend (sortable table, optional date filter) | Step 10 | Owner can view expiry report |
