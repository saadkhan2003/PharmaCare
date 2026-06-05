# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05)

**Core value:** The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.
**Current focus:** Phase 2 — Medicine Catalog & Stock Intake

## Current Position

Phase: 2 of 5 (Medicine Catalog & Stock Intake)
Plan: 3/3 in current phase (Plan 02-02 complete)
Status: Partially executed
Last activity: 2026-06-05 — Plan 02-02 (Wave 2) executed

Progress: [████▒▒▒▒▒▒] 67% (Phase 2 — 2/3 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~17m
- Total execution time: ~92m

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation & Access Control | 3 | 3 | ~27m |
| 2. Medicine Catalog & Stock Intake | 2 | 5 | ~6m |

**Recent Trend:**
- Last 5 plans: 01-03 ✓ 01-02 ✓ 01-01 ✓ 02-01 ✓ 02-02 ✓
- Trend: Consistent completion

*Updated after Phase 2, Plan 02 completion*

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
Stopped at: Phase 2 Plan 02 (Wave 2) complete — purchase intake atomic transaction
Resume file: .planning/phases/02-medicine-catalog-stock-intake/02-02-SUMMARY.md
