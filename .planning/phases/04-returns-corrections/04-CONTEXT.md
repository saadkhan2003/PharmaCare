# Phase 4: Returns & Operational Corrections - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers customer and supplier returns handling: customer return by sale search, condition-based stock handling (resellable restores stock, damaged/expired writes off), supplier returns with credit notes, batch write-offs, loss logging, and refund financial adjustments. Returns append correction records — they never edit or delete historical sales/purchases.

Depends on Phase 3 (sales data, batch allocations, StockLedgerService with sale movements).

This phase does NOT include: full analytics/reports (Phase 5), backup (Phase 5), or settings UI (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Carried Forward
- **D-01**: rusqlite in Rust Tauri commands — established pattern.
- **D-22**: StockLedgerService is single authority for stock mutations. Returns write `customer_return` and `supplier_return` movement types.
- **D-33**: Atomic transaction pattern — use `rusqlite::Transaction` for each return operation.
- **D-34**: Immutable snapshots — returns are append-only correction records, never edits to original sale/purchase.

### Customer Returns
- **D-44**: Customer return starts by searching for the original sale (by sale ID or date range). The user selects the sale, sees its items, and selects which items to return.
- **D-45**: Return condition determines stock handling — `resellable` restores stock to the original batch (increment `remaining_qty`, write positive stock_movement), `damaged` or `expired` write off with no stock restoration (zero-quantity stock_movement logged as loss).
- **D-46**: Returns cannot exceed the original quantity per item sold. Validated in the Rust service layer.
- **D-47**: Refund amount can differ from original price (partial refund). Recorded as a negative financial entry — reports subtract refunds from revenue.
- **D-48**: Returns create records in a `returns` table with `return_type='customer'`, `reference_id=sale_id`, condition, reason, refund_amount, processed_by.

### Supplier Returns
- **D-49**: Supplier return starts by selecting the supplier and batch. The user sees batches purchased from that supplier and selects which to return.
- **D-50**: Supplier return records a credit note (refund amount from supplier). Stock is deducted (decrement `remaining_qty`, negative stock_movement `supplier_return`).
- **D-51**: If the batch was partially sold, only the unsold quantity can be returned to supplier.
- **D-52**: Supplier returns create records in `returns` table with `return_type='supplier'`, `reference_id=purchase_id`.

### Write-offs
- **D-53**: Write-offs (expired/damaged stock not returned to supplier) are logged via `returns` table with `condition='expired'` or `condition='damaged'`, `return_type='write_off'`. Stock deducted, loss logged.
- **D-54**: Written-off stock is deducted from `batches.remaining_qty` and logged as a financial loss in `stock_movements` with `movement_type='write_off'`.

### Financial Correction
- **D-55**: Returns create refund/adjustment records that are queryable by reports. Refunds are not edits to the original sale — they are separate records linked by `reference_id`.
- **D-56**: Reports subtract refund totals from revenue. Loss write-offs are tracked separately for P&L reporting.

### Codebase Patterns (from prior phases)
- Same three-layer architecture: repository → service → commands
- StockLedgerService gets `movement_type` variants: `customer_return`, `supplier_return`, `write_off`
- Atomic transaction per return (validate → open tx → mutate → commit)
- require_owner() on supplier returns and write-offs; both roles can process customer returns
- `returns` table already defined in PRD schema — use it

### the agent's Discretion
- Return form UI layout (sale search, item selection, condition dropdown)
- Credit note input format (free text amount)
- Loss logging detail level
- Error message wording

</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — RETN-01 through RETN-08, BATC-05, BATC-06
- `.planning/ROADMAP.md` §"Phase 4: Returns & Operational Corrections" — Success criteria
- `PRD.md` §5.5 (Returns & Refunds) — Return flow specs, business rules

### Research
- `.planning/research/SUMMARY.md` — Append-only corrections pattern
- `.planning/research/PITFALLS.md` — Pitfall 5 (returns as corrections, not edits)
- `.planning/research/ARCHITECTURE.md` — ReturnService design

### Existing Code
- `src-tauri/src/services/stock_ledger_service.rs` — Add movement types for returns
- `src-tauri/src/repository/batch_repo.rs` — increment/decrement remaining_qty
- `src-tauri/src/commands/sale_commands.rs` — Sale search pattern for return lookup
- `src/pages/` — Page component patterns
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **POSSearchPanel pattern**: Sale search for customer returns (search by ID or date)
- **StockLedgerService**: Already handles purchase and sale movement types — extend
- **Atomic transaction pattern**: Same as purchase_service and sale_service
- **Dashboard alert cards**: Clickable alerts for expiring/write-off batches

### Established Patterns
- **Three-layer Rust**: Repository → Service → Command
- **useTauriCommand hook**: Generic invoke wrapper
- **Server-side validation**: Return quantities validated in Rust
- **Role-based commands**: Customer return for both roles, supplier return/write-off for owner only

### Integration Points
- StockLedgerService: add `customer_return`, `supplier_return`, `write_off` movement types
- Sidebar: add Returns nav item (both roles), only customer return for pharmacist
- App.tsx: add return routes
</code_context>

<specifics>
## Specific Ideas

- Customer return reuses the same atomic transaction pattern as purchase and sale services
- Return UI follows purchase form pattern (search → select → confirm)
- Returns table already defined in PRD schema — use as reference

</specifics>

<deferred>
## Deferred Ideas

- Full receivable/udhaar credit tracking — out of v1 scope
- Automated return-to-supplier workflow — manual entry sufficient for v1

</deferred>

---

*Phase: 4-Returns & Operational Corrections*
*Context gathered: 2026-06-05*
