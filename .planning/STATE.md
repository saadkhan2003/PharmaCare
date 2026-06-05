# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05)

**Core value:** The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.
**Current focus:** Phase 4 — Returns & Operational Corrections

## Current Position

Phase: 4 of 5 (Returns & Operational Corrections)
Plan: 3/3 in current phase
Status: Ready to execute
Last activity: 2026-06-05 — Plan 04-02 complete (Tauri commands + frontend types)

Progress: [██████████] 100% (Phase 3), [████████░░] 67% (Phase 4)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: ~15m
- Total execution time: ~140m

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Access Control | 3 | 3 | ~27m |
| 2. Medicine Catalog & Stock Intake | 3 | 6 | ~10m |
| 3. POS & Sales Engine | 3 | 9 | ~13m |
| 4. Returns & Operational Corrections | 2 | 11 | ~6m |

**Recent Trend:**
- Last 5 plans: 02-03 ✓ 03-01 ✓ 03-02 ✓ 03-03 ✓ (1 in Phase 3)
- Trend: Accelerating (faster avg time)

*Updated after Phase 3 Plan 02 execution*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- [Initial]: Roadmap structured into 5 coarse phases following dependency spine: Foundation → Stock Intake → POS → Returns → Reports/Admin
- [Plan 01]: Use rusqlite 0.40 instead of Prisma — all DB access through Rust commands
- [Plan 01]: In-memory HashMap for sessions, backed by sessions table for crash recovery
- [Plan 01]: CommandError as unified error type with code/message pattern
- [Plan 01]: Lock order: db Mutex first, sessions Mutex second throughout
- [Plan 01]: All PRAGMAs (WAL, foreign_keys, busy_timeout) set before migration execution
- [Plan 02]: Module-level functions (not service structs) for repos and services
- [Plan 02]: AuthError enum with From<CommandError> conversion for ? propagation
- [Plan 02]: Generic 'Invalid credentials' error for both wrong username and wrong password (T-01-06)
- [Plan 02-01]: Prices stored as REAL (f64) per PRD schema — float precision accepted for v1
- [Plan 02-01]: Dynamic UPDATE SQL used for medicine/supplier partial field updates
- [Plan 02-01]: StockLedgerService accepts &Connection — Transaction works via Deref
- [Plan 02-01]: Settings command has no auth guard (T-02-07 accepted — no sensitive data)
- [Plan 02-01]: Payment status defaults to 'Pending' per pharmacy purchase credit convention
- [Plan 02-02]: record_purchase takes &mut Connection — rusqlite::Connection::transaction() requires &mut self
- [Plan 02-02]: Server-side total_cost recalculation: sum(qty × purchase_price), never trust frontend value (T-02-08)
- [Plan 02-02]: Transaction auto-rollback via Transaction::Drop — no explicit rollback needed
- [Plan 03-01]: FIFO allocation uses expiry_date ASC, received_date ASC, id ASC (D-32)
- [Plan 03-01]: Sale wrapped in single atomic rusqlite::Transaction (D-33)
- [Plan 03-01]: COGS (purchase_cost) captured immutably per allocation at confirm time (D-34)
- [Plan 03-01]: Server-side total recalculation: unit_price from DB, subtotal/discount/tax/total computed server-side (D-35)
- [Plan 03-01]: Tax on post-discount subtotal with per-sale tax_enabled toggle (D-36)
- [Plan 03-01]: Discount gated by role: owner always allowed, pharmacist requires cashier_discount_enabled setting (D-38)
- [Plan 03-01]: Payment methods validated via CHECK constraint; Credit requires customer_name (D-39/D-40)
- [Plan 03-01]: Owner dashboard includes profit (require_owner); Pharmacist dashboard excludes profit fields (D-41/D-42)
- [Plan 03-02]: Dashboard DTOs (OwnerDashboardDto, PharmacistDashboardDto, TopSellerDto) defined in sale.ts as cross-plan contract for Plan 03-03
- [Plan 03-02]: paymentRef typed as HTMLButtonElement (shadcn SelectTrigger uses @base-ui/react, forwards ButtonElement ref)
- [Plan 03-02]: Tax toggle uses custom accessible Switch implementation (no shadcn Switch component installed)
- [Plan 04-02]: return_commands.rs follows existing command patterns (purchase_commands, sale_commands)
- [Plan 04-02]: Customer return commands use require_session (both roles) per D-44
- [Plan 04-02]: Supplier return + write-off commands use require_owner per D-50/D-53
- [Plan 04-02]: Frontend types in return.ts match Rust DTOs field-for-field (snake_case)
- [Plan 04-02]: tauri.ts returns object provides 5 typed invoke wrappers
- [Plan 04-02]: return_service.rs follows atomic transaction pattern (validate → open tx → mutate → commit)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-05
Stopped at: Phase 4 Plan 02 complete — Tauri commands + frontend types
Resume file: .planning/phases/04-returns-corrections/04-02-SUMMARY.md
