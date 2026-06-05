# Phase 2: Medicine Catalog & Stock Intake - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the complete medicine catalog management, supplier management, purchase entry with batch-level stock intake, expiry date tracking per batch, expiry report, and core settings configuration. This phase builds on the Phase 1 foundation (Tauri shell, SQLite, auth, RBAC, sidebar navigation).

This phase does NOT include: POS/sales (Phase 3), returns (Phase 4), reports/analytics (Phase 5), backup (Phase 5), or full settings UI (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Carried Forward from Phase 1
- **D-01**: rusqlite in Rust Tauri commands — no Prisma in frontend. Established pattern.
- **D-02**: WAL mode, FK, busy_timeout on every connection. Established pattern.
- **D-03**: `stock_movements` ledger table already exists in the schema (from Phase 1 migration). Phase 2 writes to it.
- **D-07**: Sidebar navigation — add nav items for Medicines, Suppliers, Purchases, Expiry Report. Owner sees all; Pharmacist sees Medicines (view-only).
- **D-08**: English UI only for v1.
- **D-10**: Soft deletes — `is_active` on medicines and suppliers tables. Medicines table already has this.
- **D-12**: Two fixed roles — `owner` and `pharmacist`.

### Medicine Catalog
- **D-13**: Category and unit type use shadcn Select dropdowns (5 categories: Tablet, Syrup, Injection, OTC, Prescription; 5 unit types: Strip, Bottle, Vial, Box, Sachet). Fixed enums are small enough for dropdowns.
- **D-14**: Medicine list uses live search with 300ms debounce — consistent with planned Phase 3 POS search pattern.
- **D-15**: Pharmacist read-only view hides: `purchase_price`, profit margin calculations, and supplier cost data. Shows: name, generic_name, brand, category, unit, retail_price, current_stock (computed from batches), reorder_level, shelf_location.
- **D-16**: `retail_price >= purchase_price` validated in Rust command layer, not just frontend.

### Supplier Management
- **D-17**: Supplier form is a single-page CRUD with fields: company_name, contact_person, phone, address, payment_terms, notes. `is_active` for soft delete.
- **D-18**: Supplier list is a searchable table (by name, phone). Suppliers can be deactivated but not hard-deleted.

### Purchase Entry
- **D-19**: Purchase entry is a single-screen form with inline item table (add/remove rows dynamically). Flow: select supplier → enter invoice number + date → add items (medicine, qty, purchase price, expiry date) → auto-calculated total cost → select payment status → confirm.
- **D-20**: Each purchase creates batch records with `expiry_date`, `purchase_price`, `quantity`, `remaining_qty = quantity`. Stock increase flows through `StockLedgerService` writing positive movements to `stock_movements`.
- **D-21**: Purchase items table stores per-item purchase price (prices may vary between orders).

### Stock & Batch Tracking
- **D-22**: `StockLedgerService` is the single authority for stock mutations. Purchases write to it; no direct batch table mutations outside this service.
- **D-23**: Current stock for a medicine is computed as `SUM(remaining_qty) FROM batches WHERE medicine_id = ? AND expiry_date > date('now')` (valid stock only). Expired batches are tracked but not counted as available stock.

### Expiry Report
- **D-24**: Expiry report is a full-page view with sortable table (columns: Medicine Name, Batch, Quantity, Expiry Date, Days Left). Sortable by days remaining. Filterable by date range.
- **D-25**: A dashboard expiry widget showing upcoming expiries (next 10 soonest) is deferred to Phase 3 (dashboard phase).

### Settings (Phase 2 scope)
- **D-26**: Settings read paths (default tax rate, cashier discount toggle, expiry thresholds, default reorder level, currency symbol) are implemented as Rust backend key-value reads from the `settings` table.
- **D-27**: Full settings UI screens are NOT built in Phase 2 — deferred to Phase 5. Accept sensible defaults for v1 (tax=0%, discount off, warning=60 days, critical=30 days, reorder=10, currency=Rs.).

### Codebase Patterns (from Phase 1)
- Repository pattern: `med_repo.rs`, `supplier_repo.rs`, `purchase_repo.rs`, `batch_repo.rs`
- Service pattern: `medicine_service.rs`, `supplier_service.rs`, `purchase_service.rs`, `stock_ledger_service.rs`
- Command pattern: `medicine_commands.rs`, `supplier_commands.rs`, `purchase_commands.rs`, `stock_commands.rs`
- `require_owner()` guard on all owner-only commands
- Role-masked DTOs: separate `MedicineDto` (full) and `MedicinePharmacistDto` (limited)
- Modules registered in `lib.rs`, commands in `main.rs`

### the agent's Discretion
- Exact column layout for medicine list table
- Purchase form layout details (supplier selector UI, item row layout)
- Specific SQL queries for stock computation
- Error message wording
- Filter/date-picker implementation for expiry report

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements INVT-01 through INVT-08, SUPP-01 through SUPP-05, BATC-01, BATC-04, SETT-01 through SETT-06
- `.planning/ROADMAP.md` §"Phase 2: Medicine Catalog & Stock Intake" — Success criteria, requirement mappings
- `.planning/PROJECT.md` — Core value, constraints, context

### Research
- `.planning/research/SUMMARY.md` — Architecture approach, stock ledger pattern, role-masked DTOs
- `.planning/research/ARCHITECTURE.md` — Component boundaries, intent command pattern
- `.planning/research/PITFALLS.md` — Pitfalls 3 (no fake stock), 5 (RBAC on financial data)

### Phase 1 Context (established patterns)
- `.planning/phases/01-foundation-access-control/01-CONTEXT.md` — All locked decisions D-01 through D-12
- `.planning/phases/01-foundation-access-control/01-RESEARCH.md` — Tauri command pattern, RBAC guards, DTO patterns
- `.planning/phases/01-foundation-access-control/01-01-SUMMARY.md` — Migration schema, state management pattern
- `.planning/phases/01-foundation-access-control/01-02-SUMMARY.md` — Service pattern, command registration

### Database Schema
- `PRD.md` §6 (Database Schema) — Reference schema for medicines, batches, suppliers, purchases tables

### Existing Code
- `src-tauri/src/lib.rs` — Module registration pattern
- `src-tauri/src/main.rs` — Command registration and state setup
- `src-tauri/src/guards.rs` — require_session() and require_owner() guard patterns
- `src-tauri/src/models/` — DTO patterns (full + role-masked variants)
- `src-tauri/src/repository/` — Repository pattern (prepared statements)
- `src-tauri/src/services/` — Service pattern (business logic)
- `src-tauri/src/commands/` — Command handler pattern with guards
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **shadcn/ui components**: Table, Dialog, Select, Badge, Input, Button, Card — all available from Phase 1
- **Sidebar component**: `src/components/layout/Sidebar.tsx` — add nav items for new Phase 2 screens
- **AppShell**: `src/components/layout/AppShell.tsx` — wrap Phase 2 pages
- **useTauriCommand**: `src/hooks/useTauriCommand.ts` — generic command wrapper for invoking Rust

### Established Patterns
- **Repository → Service → Command**: Three-layer Rust architecture established in Phase 1
- **Role-masked DTOs**: Separate full and limited DTOs for owner vs pharmacist
- **require_owner() guard**: On every owner-only Tauri command
- **CommandError**: Unified error type with From impls

### Integration Points
- Add new Rust modules to `lib.rs` (pub mod) and commands to `main.rs` (.invoke_handler)
- Add new sidebar nav items to `Sidebar.tsx`
- Add new routes to `App.tsx`
- Use `stock_movements` table (already exists from Phase 1 migration)
</code_context>

<specifics>
## Specific Ideas

- Medicine CRUD follows the same patterns as user CRUD from Phase 1 (repos, services, commands, role-masked DTOs)
- Purchase flow should be optimized for speed — pharmacists do many purchases per week
- StockLedgerService is the single mutation authority per the research findings
- Medicine list should support search by name, generic name, brand, and category

</specifics>

<deferred>
## Deferred Ideas

- Full settings UI screens — deferred to Phase 5
- Dashboard expiry widget — deferred to Phase 3 (dashboard phase)
- Barcode scanning for medicine entry — out of scope for v1

</deferred>

---

*Phase: 2-Medicine Catalog & Stock Intake*
*Context gathered: 2026-06-05*
