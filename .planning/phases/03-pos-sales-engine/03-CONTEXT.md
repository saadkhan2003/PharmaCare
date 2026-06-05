# Phase 3: POS & Sales Engine - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the keyboard-first Point of Sale engine: live medicine search (<200ms), cart-based sale flow with discounts/tax/payment, FIFO batch allocation on confirm, stock validation (zero-stock/expired blocking), immutable line-item snapshots, credit sale prompt, and role-appropriate dashboards (Owner: full financial; Pharmacist: daily totals + alerts).

Depends on Phase 2 (medicines, batches, purchase costs, StockLedgerService, settings).

This phase does NOT include: customer returns (Phase 4), supplier returns (Phase 4), full analytics/reports (Phase 5), or backup (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Carried Forward
- **D-01**: rusqlite in Rust Tauri commands — established pattern.
- **D-02**: WAL, FK, busy_timeout — established.
- **D-03**: `stock_movements` table exists (from Phase 1) — sale writes negative movements.
- **D-07**: Sidebar — add POS, Dashboard nav items.
- **D-08**: English UI only.
- **D-22**: StockLedgerService is single authority for stock mutations.
- **D-23**: Stock = SUM(remaining_qty) of non-expired batches.

### POS Layout & UX
- **D-28**: Two-panel layout — search panel on left, cart panel on right. Medicine search dominates the left panel; cart with itemized list, totals, and payment form occupies the right.
- **D-29**: Keyboard-only flow: Tab/Enter to navigate fields, number keys for quantity, Enter to confirm sale. Full sale completable without mouse.
- **D-30**: Live medicine search with debounce targeting <200ms response. Search by name, generic name, brand. Results limited to top 20 for speed.
- **D-31**: Large font sizes throughout — medicine names, prices, quantities sized for quick visual scanning per PRD spec.

### Sale Transaction Design
- **D-32**: FIFO batch allocation happens at confirm time — NOT at add-item time. On confirm, the transaction selects batches ordered by `expiry_date ASC, received_date ASC, id ASC` with `remaining_qty > 0 AND expiry_date > date('now')`, deducts from oldest first across batches as needed, and records which batch IDs were used for each line item.
- **D-33**: One atomic SQLite transaction per sale — wraps: validate stock for all items → allocate FIFO batches → insert sale header → insert sale_items with batch_id and COGS snapshot → update batches.remaining_qty → insert stock_movements (negative, movement_type='sale') → commit. Rollback entire sale on any failure.
- **D-34**: Sale line items capture immutable snapshots: unit_price, purchase_cost (from batch at time of sale), discount, tax, line_total. Future price changes do not affect historical profit calculations.
- **D-35**: Sale total is recalculated on the Rust server side (not trusted from frontend) to prevent tampering.

### Discounts & Tax
- **D-36**: Tax calculated at bill level on post-discount subtotal. Tax rate from settings (default 0%). Tax can be toggled on/off per sale.
- **D-37**: Item-level discount (per line) and bill-level discount (on subtotal). Both appear on receipt. Discounts capped at 100%.
- **D-38**: Pharmacist can apply discounts only if `allow_cashier_discount` setting is enabled (D-26/D-27 settings read path). Owner can always apply discounts.

### Payment & Credit
- **D-39**: Three payment methods: Cash, Card, Credit. Credit prompts for customer name.
- **D-40**: Credit sales are recorded as full sales — no receivables tracking in v1. Deferred to future phase.

### Dashboard Design
- **D-41**: Owner dashboard: today's total sales (revenue), today's profit (revenue − COGS), total sales this month, low stock alerts count (clickable → Phase 2 report), expiry alerts count (clickable → Phase 2 report), top 5 selling medicines this week (mini bar chart via Recharts).
- **D-42**: Pharmacist dashboard: today's sales total, low stock alerts count, expiry alerts count. No profit or margin data.
- **D-43**: Dashboards compute from aggregated sale data — no mutable state.

### the agent's Discretion
- Exact column layout for cart panel
- Search result display format (list vs cards)
- Receipt/confirmation display after sale
- Chart library configuration (Recharts)
- Keyboard shortcut design (specific Tab order)
</decisions>

<canonical_refs>
## Canonical References

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — POS-01 through POS-13, BATC-02/03, REPT-01/02
- `.planning/ROADMAP.md` §"Phase 3: POS & Sales Engine" — Success criteria
- `.planning/PROJECT.md` — Core value, performance targets

### Research
- `.planning/research/SUMMARY.md` — FIFO architecture, COGS snapshot pattern
- `.planning/research/ARCHITECTURE.md` — SaleService intent command design
- `.planning/research/PITFALLS.md` — Pitfalls 2 (batch-level FIFO), 4 (immutable COGS snapshots)

### Phase 2 Context
- `.planning/phases/02-medicine-catalog-stock-intake/02-CONTEXT.md` — D-22 (StockLedgerService), D-23 (stock computation), D-26/D-27 (settings)
- `.planning/phases/02-medicine-catalog-stock-intake/02-RESEARCH.md` — StockLedgerService pattern

### Existing Code
- `src-tauri/src/services/stock_ledger_service.rs` — record_movement for sale type
- `src-tauri/src/repository/batch_repo.rs` — query batches by medicine for FIFO
- `src-tauri/src/services/settings_service.rs` — Read tax rate, discount permission
- `src/pages/` — Page component pattern from Phase 2
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Sidebar**: `src/components/layout/Sidebar.tsx` — add POS, Dashboard routes
- **AppShell**: Layout wrapper
- **useDebounce**: `src/hooks/useDebounce.ts` — for POS search
- **useTauriCommand**: Generic Tauri invoke wrapper
- **shadcn/ui**: Dialog, Input, Badge, Table, Button, Card, Select — all available
- **Recharts**: Available from tech stack (not yet imported)

### Established Patterns
- **Three-layer Rust**: Repository → Service → Command
- **Role-masked DTOs**: Separate DTOs for owner/pharmacist
- **require_owner() guard**: For owner-only commands
- **CommandError**: Unified error type

### Integration Points
- StockLedgerService: add `movement_type = 'sale'` support
- Batch repo: FIFO query (ORDER BY expiry, received, id)
- Settings: read tax rate, discount toggle
- Sidebar: add POS and Dashboard items
- App.tsx: add /pos, /dashboard routes
</code_context>

<specifics>
## Specific Ideas

- POS search reuses the same search pattern as Phase 2 medicine list (D-14) but targets <200ms instead of 300ms
- Sale confirmation uses the same atomic transaction pattern as Phase 2 purchase intake (validated pattern)
- Dashboard Recharts bar chart for top 5 selling medicines
</specifics>

<deferred>
## Deferred Ideas

- Full receivables/udhaar tracking — out of v1 scope
- Receipt printing — out of v1 scope
- Dashboard expiry widget (already noted in Phase 2 deferral)
</deferred>

---

*Phase: 3-POS & Sales Engine*
*Context gathered: 2026-06-05*
