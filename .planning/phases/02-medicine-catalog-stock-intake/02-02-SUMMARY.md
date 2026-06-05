---
phase: 02-medicine-catalog-stock-intake
plan: 02
subsystem: backend
tags: [rusqlite, tauri, purchase, transaction, stock, atomic]
requires:
  - phase: 02-medicine-catalog-stock-intake
    plan: 01
    provides: Purchase/PurchaseItem DB rows, medicine_repo::find_by_id, batch_repo::insert,
              stock_ledger_service::record_movement, supplier_repo::find_by_id,
              002 migration tables (purchases, purchase_items, batches)
provides:
  - Purchase intake transaction (purchase + items + batches + stock_movements — atomic)
  - Purchase models: CreatePurchaseDto, PurchaseReceiptDto, PurchaseDetailDto, PurchaseListDto, PurchaseItemDto
  - Purchase repository: insert_purchase, insert_item, update_item_batch_id, update_purchase_total, find_by_id, find_items_by_purchase_id, find_all, get_item_count
  - Purchase service: record_purchase (atomic orchestrator), list_purchases, get_purchase_detail
  - Purchase commands: record_purchase (owner), list_purchases (owner), get_purchase_detail (owner)
affects: 02-03 (frontend UI for purchase intake form)
tech-stack:
  added: []
  patterns:
    - Transaction orchestrator pattern: validate → open tx → insert header → for each item: insert item + batch + movement → update total → commit
    - &mut Connection for transaction creation (rusqlite::Connection::transaction() requires &mut self)
    - StockLedgerService called inside the transaction via Deref (Transaction impls Deref<Target=Connection>)
    - Server-side total_cost recalculation (never trust frontend, T-02-08)
    - Auto-rollback via Transaction::Drop impl (T-02-09)
key-files:
  created:
    - src-tauri/src/models/purchase.rs (10 data types: Purchase, PurchaseItem, CreatePurchaseDto, CreatePurchaseItemDto, PurchaseReceiptDto, PurchaseItemDto, PurchaseDetailDto, PurchaseListDto)
    - src-tauri/src/repository/purchase_repo.rs (8 functions: insert_purchase, insert_item, update_item_batch_id, update_purchase_total, find_by_id, find_items_by_purchase_id, find_all, get_item_count)
    - src-tauri/src/services/purchase_service.rs (3 functions: record_purchase, list_purchases, get_purchase_detail)
    - src-tauri/src/commands/purchase_commands.rs (3 commands: record_purchase, list_purchases, get_purchase_detail)
  modified:
    - src-tauri/src/models/mod.rs (added pub mod purchase + re-export)
    - src-tauri/src/repository/mod.rs (added pub mod purchase_repo)
    - src-tauri/src/services/mod.rs (added pub mod purchase_service)
    - src-tauri/src/commands/mod.rs (added pub mod purchase_commands)
    - src-tauri/src/main.rs (added 3 purchase commands to invoke_handler)
key-decisions:
  - "record_purchase takes &mut Connection not &Connection — rusqlite::Connection::transaction() requires &mut self; command handlers pass &mut *db from their MutexGuard"
  - "batch_repo::insert takes purchase_item_id: Option<i64> — passes Some(item_id) from purchase_service for traceability"
  - "created_by field uses 'User {N}' format — no user_repo::find_by_id exists yet"
  - "StockLedgerService::record_movement called with &tx inside transaction — works because Transaction: Deref<Target=Connection>"
  - "All purchase commands guarded by require_owner() per T-02-11 (purchases affect stock and cost data)"
duration: ~8min
completed: 2026-06-05
---

# Phase 2 Plan 02: Purchase Intake — Atomic Transaction Backend

**Atomic purchase intake transaction processing engine: validates items, creates purchase + items + batches + stock movements in a single rusqlite transaction, all-or-nothing**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

### Task 1: Purchase models + repository
- Created 8 DTO types in `models/purchase.rs`: Purchase (DB row), PurchaseItem, CreatePurchaseDto, CreatePurchaseItemDto, PurchaseReceiptDto, PurchaseItemDto, PurchaseDetailDto, PurchaseListDto
- All types derive Debug, Clone, Serialize, Deserialize for Tauri IPC
- Created 8 repository functions in `repository/purchase_repo.rs`:
  - `insert_purchase`, `insert_item`, `update_item_batch_id`, `update_purchase_total` — write operations
  - `find_by_id`, `find_items_by_purchase_id`, `find_all` (with supplier join), `get_item_count` — read operations
- All repo functions accept `&Connection` — compatible with `Transaction` via `Deref`

### Task 2: Purchase service (critical atomic transaction)
- `record_purchase` implements the full 7-phase atomic transaction pattern:
  1. **Validate ALL items** before opening transaction (medicine exists, is_active, qty > 0, price >= 0, valid payment_status, non-empty items)
  2. **Open transaction** via `db.transaction()?` (requires `&mut Connection`)
  3. **Calculate total_cost** server-side from qty × purchase_price (T-02-08)
  4. **Insert purchase header** with recalculated total_cost
  5. **For each item:** INSERT purchase_item → INSERT batch (remaining_qty = quantity) → UPDATE purchase_item.batch_id → record_stock_movement via StockLedgerService
  6. **Update purchase total_cost** from actual inserts
  7. **Commit** — all or nothing (auto-rollback via Drop if commit fails, T-02-09)
- `list_purchases` returns items with supplier name and item count
- `get_purchase_detail` returns full detail with medicine names, batch IDs, supplier info
- `record_purchase` takes `&mut Connection` because `rusqlite::Connection::transaction()` requires `&mut self`
- StockLedgerService called inside the transaction with `&tx` parameter (Deref pattern)

### Task 3: Purchase commands + main.rs registration
- Created 3 Tauri commands, all guarded by `require_owner()` (T-02-11):
  - `record_purchase` — atomic purchase intake
  - `list_purchases` — purchase listing with supplier name
  - `get_purchase_detail` — full purchase detail with items
- `record_purchase` command handler passes `&mut *db` to support transaction creation
- All 3 commands registered in `main.rs` invoke_handler

### Threat Mitigations Verified
| Threat | ID | Mitigation | Status |
|--------|----|-----------|--------|
| Tampering — manipulated total_cost | T-02-08 | Server-side recalculation from qty × purchase_price | ✅ |
| Tampering — partial transaction | T-02-09 | Single db.transaction() + auto-rollback via Drop | ✅ |
| Tampering — direct batch mutation | T-02-10 | batch_repo::insert only called from purchase_service | ✅ |
| Elevation — pharmacist records purchase | T-02-11 | require_owner() on all purchase commands | ✅ |
| Tampering — deactivated medicine purchase | T-02-12 | Validation loop checks medicine.is_active per item | ✅ |
| Repudiation — stock without user attribution | T-02-13 | user_id from session passed to record_movement | ✅ |
| DoS — mutex held during long tx | T-02-14 | Accepted risk for v1 | ✅ |

## Task Commits

Each task was committed atomically:

1. **Task 1: Purchase models + repository** — `fc654ff` (feat)
2. **Task 2: Purchase service (atomic transaction)** — `3c56b98` (feat)
3. **Task 3: Purchase commands + main.rs** — `c2af5b1` (feat)

## Files Created/Modified

### Models (1 new file)
- `src-tauri/src/models/purchase.rs` — Purchase, PurchaseItem, CreatePurchaseDto, CreatePurchaseItemDto, PurchaseReceiptDto, PurchaseItemDto, PurchaseDetailDto, PurchaseListDto
- `src-tauri/src/models/mod.rs` — Module declaration + re-export

### Repository (1 new file)
- `src-tauri/src/repository/purchase_repo.rs` — 8 functions for purchase CRUD + query
- `src-tauri/src/repository/mod.rs` — Module declaration

### Services (1 new file)
- `src-tauri/src/services/purchase_service.rs` — record_purchase (atomic tx), list_purchases, get_purchase_detail
- `src-tauri/src/services/mod.rs` — Module declaration

### Commands (1 new file)
- `src-tauri/src/commands/purchase_commands.rs` — record_purchase, list_purchases, get_purchase_detail (all require_owner)
- `src-tauri/src/commands/mod.rs` — Module declaration

### Main
- `src-tauri/src/main.rs` — 3 purchase commands registered in invoke_handler

## Decisions Made

- **`&mut Connection` for purchase service:** `rusqlite::Connection::transaction()` requires `&mut self`. The service takes `&mut Connection` and command handlers pass `&mut *db` from their `MutexGuard<Connection>`. Read-only service functions (`list_purchases`, `get_purchase_detail`) continue taking `&Connection`.
- **Server-side total_cost recalculation:** Frontend-provided total_cost is never read. The service computes `sum(qty × purchase_price)` for every item, preventing manipulated totals (T-02-08).
- **created_by field:** Uses format `"User {id}"` since no `user_repo::find_by_id` exists yet. Can be upgraded when user lookup is available.
- **Transaction rollback via Drop:** If `tx.commit()` is never called (e.g., due to an early `?` operator), the `Transaction::Drop` impl automatically rolls back the SQLite transaction (T-02-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `&mut Connection` required for transaction creation**
- **Found during:** Task 2 (cargo check compilation)
- **Issue:** The plan's code sample used `db: &Connection` but `rusqlite::Connection::transaction()` requires `&mut self`. This would not compile.
- **Fix:** Changed `record_purchase` signature to take `&mut Connection`. In command handlers, pass `&mut *db` from the `MutexGuard<Connection>` (which implements `DerefMut`). Read-only service methods (`list_purchases`, `get_purchase_detail`) still take `&Connection`.
- **Files modified:** `src-tauri/src/services/purchase_service.rs`, `src-tauri/src/commands/purchase_commands.rs`
- **Commit:** `3c56b98`

## Issues Encountered

- **Transaction creation needs mutable ref:** The plan's code assumed `db.transaction()` works with `&Connection`, but rusqlite requires `&mut self`. Fixed by changing the service signature to `&mut Connection`. This is a correct deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete backend for purchase intake with atomic transaction
- Ready for **Plan 02-03** (Frontend UI) which will consume:
  - `record_purchase` command for purchase form submission
  - `list_purchases` command for purchase history view
  - `get_purchase_detail` command for purchase detail page
  - Existing Plan 01 commands for medicine/supplier selection in purchase form

## Self-Check

- [x] `cargo check` passes with zero errors (only dead_code warnings for pre-existing unused items)
- [x] `cargo test` passes — 2 migrations validated
- [x] `record_purchase` validates all items before opening transaction
- [x] Server recalculates total_cost (never trusts frontend, T-02-08)
- [x] Transaction wraps 6+ operations: insert purchase → for each item: insert item → insert batch → update batch_id link → record stock movement → update total → commit
- [x] Transaction auto-rolls back via Drop if commit fails (T-02-09)
- [x] All purchase commands guarded by `require_owner()` (T-02-11)
- [x] StockLedgerService::record_movement called with user_id from session (T-02-13)
- [x] All DTOs derive Serialize/Deserialize for IPC
- [x] `batch_repo::insert` called with `Some(item_id)` for purchase_item_id traceability
- [x] CreatePurchaseDto has supplier_id, invoice_number, purchase_date, payment_status, notes, items (Vec<CreatePurchaseItemDto>)

---

*Phase: 02-medicine-catalog-stock-intake*
*Completed: 2026-06-05*
