---
phase: 03-pos-sales-engine
plan: 01
type: execute
subsystem: backend
tags:
  - sales-engine
  - FIFO
  - migrations
  - dashboard
  - atomic-transaction
requires:
  - Phase 2 (medicine catalog, batches, stock ledger, settings)
provides:
  - Sales tables (sales, sale_items)
  - Sale models and DTOs
  - FIFO batch allocation engine
  - Atomic confirm_sale transaction
  - Dashboard aggregation (owner + pharmacist)
  - POS medicine search
affects:
  - Frontend Plan 03-02 (requires SaleReceiptDto, MedicinePosDto)
  - Frontend Plan 03-03 (requires OwnerDashboardDto, PharmacistDashboardDto)
tech-stack:
  added:
    - rusqlite_migration 003
    - Atomic SQLite transaction pattern (confirm_sale)
  patterns:
    - FIFO allocation: expiry ASC, received ASC, id ASC
    - Server-side total recalculation (D-35)
    - COGS immutable snapshot (D-34)
    - Discount permission check by role (D-38)
key-files:
  created:
    - src-tauri/migrations/003_sales_engine/up.sql
    - src-tauri/src/models/sale.rs
    - src-tauri/src/repository/sale_repo.rs
    - src-tauri/src/services/sale_service.rs
    - src-tauri/src/commands/sale_commands.rs
  modified:
    - src-tauri/src/models/mod.rs
    - src-tauri/src/migrations.rs
    - src-tauri/src/repository/batch_repo.rs
    - src-tauri/src/repository/mod.rs
    - src-tauri/src/services/mod.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/main.rs
decisions:
  - D-32: FIFO allocation uses expiry_date ASC, received_date ASC, id ASC
  - D-33: Entire sale wrapped in single atomic SQLite transaction
  - D-34: COGS (purchase_cost) captured immutably at confirm time
  - D-35: Server-side subtotal/tax/total recalculation (frontend values never trusted)
  - D-36: Tax calculated on post-discount subtotal with per-sale toggle
  - D-37: Item-level and bill-level discounts capped at 100%
  - D-38: Pharmacist discounts gated by cashier_discount_enabled setting
  - D-39: Payment methods Cash/Card/Credit validated with CHECK constraint
  - D-40: Credit payment requires customer_name
  - D-41: Owner dashboard includes profit data (require_owner guard)
  - D-42: Pharmacist dashboard excludes profit/COGS fields
metrics:
  duration: 5 minutes
  completed: 2026-06-05T19:17:00Z
  tasks: 3
  commits: 3
  files_changed: 12
---

# Phase 3 Plan 01: POS Backend Engine — Migration, Sale Service, Dashboard Commands

**One-liner:** Atomic FIFO sale engine with server-side total recalculation, COGS snapshots, role-gated dashboard aggregation, and Tauri command registration — processing sales as a single SQLite transaction with complete rollback on failure.

---

## Summary

Plan 03-01 delivers the complete backend infrastructure for PharmaCare's POS and sales engine:

- **Migration 003** (`003_sales_engine/up.sql`): Creates `sales` and `sale_items` tables with CHECK constraints on all financial columns, payment_method validation, and 5 covering indexes. Seeds the `tax_enabled_default` setting.
- **Sale models** (13 DTOs): `MedicinePosDto`, `ConfirmSaleDto`, `ConfirmSaleItemDto`, `Sale`, `SaleItem`, `SaleReceiptDto`, `SaleReceiptItemDto`, `OwnerDashboardDto`, `PharmacistDashboardDto`, `TopSellerDto`, `SaleItemAllocation`.
- **FIFO batch allocation**: `batch_repo::find_fifo_eligible` orders batches by `expiry_date ASC, received_date ASC, id ASC`, filtering `remaining_qty > 0 AND expiry_date > date('now')`. `decrement_remaining_qty` uses safe CHECK guard.
- **Atomic confirm_sale transaction** (7 phases):
  1. Validate ALL items BEFORE opening transaction (stock, existence, discounts, credit name)
  2. Open `rusqlite::Transaction`
  3. Server-side FIFO allocation across batches with unit_price from DB (never frontend)
  4. Apply capped bill discount, compute tax on post-discount subtotal
  5. INSERT sale header
  6. For each allocation: INSERT sale_item → UPDATE batch.remaining_qty → record_movement('sale', -qty)
  7. COMMIT — ALL succeed or ALL roll back
- **Dashboard aggregation**: `get_owner_dashboard` returns today_sales, today_profit, month_sales, low_stock/expiry counts, top 5 sellers. `get_pharmacist_dashboard` returns only sales and alert counts (no profit).
- **POS search**: `search_medicines_pos` returns medicines with live stock, excluding purchase_price — optimized for <200ms response.
- **4 Tauri commands**: `confirm_sale` (both roles), `search_medicines_pos` (both roles), `get_owner_dashboard` (require_owner), `get_pharmacist_dashboard` (both roles).

## Deviations from Plan

### Pattern Adaptation
**1. [Own context - Pattern] Guards API follows codebase convention**
- **Details:** The plan's code template showed `guards::require_owner(&session)` with a `SessionInfo` argument, but the existing `guards.rs` exports `require_owner(&state, &session_token)`. Sale commands use the established pattern from `purchase_commands.rs`.

No other deviations — plan executed exactly as written.

## Threat Model Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|-------------|
| T-03-01 (Tampering - frontend totals) | Mitigated | `confirm_sale` retrieves `retail_price` from DB via `medicine_repo::find_by_id`, computes subtotal server-side. Frontend `ConfirmSaleDto` only carries `medicine_id`, `quantity`, `item_discount`, `bill_discount`, `tax_enabled`, `payment_method`. |
| T-03-02 (Tampering - discount abuse) | Mitigated | Discount permission checked both at item and bill level: `role == "owner" || settings.cashier_discount_enabled`. Pharmacist without permission gets `VALIDATION` error. |
| T-03-03 (Info Disclosure - profit data) | Mitigated | `get_owner_dashboard` guarded by `require_owner`. `PharmacistDashboardDto` has no profit/COGS fields. |
| T-03-04 (Elevation - partial stock deduction) | Mitigated | Single atomic `rusqlite::Transaction` wraps all mutations. `tx.commit()` is the final step; prior failure triggers auto-rollback via Drop. |
| T-03-05 (Elevation - credit without name) | Mitigated | Validation checks `payment_method == "Credit"` requires `customer_name` to be Some and non-empty. |
| T-03-06 (DoS - Mutex held during tx) | Accepted | v1 risk accepted; transaction completes in <1s on pharmacy-scale dataset. |

## Auth Gates

None — no external API authentication needed for SQLite backend.

## Self-Check

| Check | Status |
|-------|--------|
| Migration 003 file exists | ✅ `src-tauri/migrations/003_sales_engine/up.sql` |
| sale.rs model file exists with all DTO types | ✅ 13 types defined |
| models/mod.rs declares pub mod sale + re-exports | ✅ |
| migrations.rs includes 003 migration | ✅ |
| batch_repo.rs has find_fifo_eligible and decrement_remaining_qty | ✅ |
| sale_repo.rs exists with all functions | ✅ 10 functions |
| sale_service.rs exists with confirm_sale (7-phase transaction) | ✅ |
| mod.rs files updated (repo + services) | ✅ |
| sale_commands.rs exists with 4 Tauri commands | ✅ |
| main.rs invoke_handler includes all 4 Phase 3 commands | ✅ |
| confirm_sale does NOT have require_owner | ✅ |
| get_owner_dashboard has require_owner guard | ✅ |
| cargo build passes | ✅ |
| cargo test passes | ✅ (migrations_are_valid with 3 migrations) |
| Server-side recalculation (D-35) | ✅ retail_price from DB, totals computed server-side |
| FIFO query filters expiry_date > date('now') | ✅ |
| Discount permission check for pharmacist | ✅ |
| COGS snapshot captured at confirm time | ✅ purchase_cost from batch |
| Financial values rounded to 2 decimal places | ✅ `round2()` helper used throughout |
