---
phase: 04-returns-corrections
plan: 01
subsystem: backend
tags:
  - returns
  - migration
  - atomic-transactions
  - stock-ledger
requires: []
provides:
  - returns table (migration 004)
  - Return models + DTOs
  - ReturnsRepo
  - batch_repo extensions (increment_remaining_qty, find_by_purchase_id)
  - ReturnService (customer return, supplier return, write-off)
affects:
  - src-tauri/src/repository/batch_repo.rs (added 2 functions)
  - src-tauri/src/services/stock_ledger_service.rs (movement types already validated)
  - src-tauri/src/commands/return_commands.rs (consumes ReturnService)
tech-stack:
  added:
    - rusqlite atomic transactions via Transaction
    - StockLedgerService customer_return/write_off movement types
  patterns:
    - Validate-before-Transaction (purchase_service.rs/sale_service.rs pattern)
    - Append-only correction records (D-34)
key-files:
  created:
    - src-tauri/migrations/004_returns/up.sql
    - src-tauri/src/models/return.rs
    - src-tauri/src/repository/returns_repo.rs
    - src-tauri/src/services/return_service.rs
  modified:
    - src-tauri/src/migrations.rs
    - src-tauri/src/models/mod.rs
    - src-tauri/src/repository/batch_repo.rs
    - src-tauri/src/repository/mod.rs
    - src-tauri/src/services/mod.rs
decisions: []
metrics:
  duration: ~25 min
  completed_date: 2026-06-05
---

# Phase 04 Plan 01: Returns Backend — Migration, Models, Repository, Service

**One-liner:** Complete backend infrastructure for returns — returns table with CHECK constraints, typed DTOs, ReturnsRepo CRUD, batch_repo increment/find_by_purchase_id extensions, and ReturnService with atomic transaction orchestration for all three return types (customer, supplier, write-off).

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create migration 004 — returns table | `53fde4f` |
| 2 | Add return models, ReturnsRepo, batch_repo extensions | `d3cff9b` |
| 3 | Create ReturnService with atomic transaction orchestrators | `9dd45f4` |

## Artifacts

### Migration 004 (`src-tauri/migrations/004_returns/up.sql`)
- Creates `returns` table with:
  - `return_type TEXT NOT NULL CHECK(return_type IN ('customer', 'supplier', 'write_off'))`
  - `condition TEXT CHECK(condition IN ('resellable', 'damaged', 'expired') OR condition IS NULL)` — nullable for supplier returns (D-52)
  - `quantity INTEGER NOT NULL CHECK(quantity > 0)`
  - `refund_amount REAL NOT NULL DEFAULT 0 CHECK(refund_amount >= 0)`
  - Foreign keys: `medicine_id`, `batch_id`, `processed_by`
  - Indexes on `(return_type, reference_id)`, `return_date`, `medicine_id`

### Models (`src-tauri/src/models/return.rs`)
- `Return` (DB row), `CustomerReturnDto`, `CustomerReturnItemDto`, `SupplierReturnDto`, `SupplierReturnItemDto`, `WriteOffDto`, `WriteOffItemDto`, `ReturnReceiptDto`, `SaleForReturnDto`, `SaleItemForReturnDto`, `PurchaseForReturnDto`, `PurchaseItemForReturnDto`
- All derive `Debug, Clone, Serialize, Deserialize`
- Registered as `pub mod r#return;` (raw identifier avoids Rust keyword conflict)

### ReturnsRepo (`src-tauri/src/repository/returns_repo.rs`)
- `insert()` — returns new row ID, accepts `&Connection` or `&Transaction`
- `find_by_sale_item()` — computes already_returned_qty for customer return validation
- `find_by_id()` — single return lookup

### batch_repo Extensions
- `increment_remaining_qty(conn, batch_id, increment_by)` — stock restoration for resellable returns (D-45)
- `find_by_purchase_id(conn, purchase_id)` — batch lookup for supplier return (D-49)

### ReturnService (`src-tauri/src/services/return_service.rs`)
All three orchestrators follow the validate → open transaction → mutate → commit pattern:

**`process_customer_return`** (D-44 through D-48):
1. Validates: sale exists, items match sale_item_ids, condition is valid, qty <= sold_qty - already_returned (D-46)
2. Resellable items: `increment_remaining_qty` + positive `customer_return` stock movement
3. Damaged/expired items: zero-delta `write_off` stock movement (loss tracking)
4. Atomic transaction — all succeed or all roll back

**`process_supplier_return`** (D-49 through D-52):
1. Validates: purchase exists, batch exists with enough stock (D-51), batch belongs to purchase
2. `decrement_remaining_qty` + negative `supplier_return` stock movement
3. Condition is NULL in return record (D-52)

**`process_write_off`** (D-53, D-54):
1. Validates: batch exists with enough stock, condition is expired/damaged
2. `decrement_remaining_qty` + negative `write_off` stock movement
3. Reference ID is NULL (standalone write-off)

**Query helpers:**
- `search_sale_for_return` — loads sale with per-item `already_returned_qty` and `returnable_qty`
- `search_purchase_for_return` — loads purchase with batch `remaining_qty`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

| Check | Status |
|-------|--------|
| `cargo build` compiles | ✅ |
| Migration validation test passes | ✅ |
| Returns table with CHECK constraints | ✅ |
| `batch_repo::increment_remaining_qty` | ✅ |
| `batch_repo::find_by_purchase_id` | ✅ |
| Customer return validates D-46 (qty <= sold - prior_returns) | ✅ |
| Supplier return validates D-51 (qty <= batch.remaining_qty) | ✅ |
| Write-off validates qty <= batch.remaining_qty | ✅ |
| All stock mutations go through StockLedgerService | ✅ |

## File Audit

| File | Status | Lines |
|------|--------|-------|
| `src-tauri/migrations/004_returns/up.sql` | Created | 29 |
| `src-tauri/src/migrations.rs` | Modified (+1 line) | — |
| `src-tauri/src/models/return.rs` | Created | 163 |
| `src-tauri/src/models/mod.rs` | Modified (+2 lines) | — |
| `src-tauri/src/repository/returns_repo.rs` | Created | 117 |
| `src-tauri/src/repository/batch_repo.rs` | Modified (+57 lines) | — |
| `src-tauri/src/repository/mod.rs` | Modified (+1 line) | — |
| `src-tauri/src/services/return_service.rs` | Created | 248 |
| `src-tauri/src/services/mod.rs` | Modified (+1 line) | — |

## Self-Check: PASSED

All created files exist with expected content. All commits are present in git history. Migration test passes. `cargo build` compiles with zero warnings.
