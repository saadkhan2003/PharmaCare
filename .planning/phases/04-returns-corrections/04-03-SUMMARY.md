---
phase: 04-returns-corrections
plan: 03
subsystem: returns
tags: [frontend-ui, customer-return, supplier-return, write-off, return-history, sidebar-navigation]
requires:
  - 04-02 (Tauri commands, TypeScript types, IPC bindings)
provides:
  - Customer return form with sale search → item selection → condition → refund
  - Supplier return form with purchase search → batch selection → credit note
  - Write-off form with medicine search → batch selection → condition → reason
  - Return history table listing all returns
  - Sidebar navigation and route registration
affects:
  - src/components/layout/Sidebar.tsx
  - src/App.tsx
tech-stack:
  added:
    - React components for all three return workflows
    - Tauri command: list_returns (backend addition for return history)
    - ReturnsRepository: list_all query (LEFT JOIN with medicines)
    - TypeScript interface: ReturnListItemDto
  patterns:
    - Card + CardContent + CardHeader layout from PurchaseForm.tsx
    - Inline Table with per-row state management (crypto.randomUUID pattern)
    - Debounced medicine search with dropdown results
    - Role-guarded routes: Customer Return outside owner block
key-files:
  created:
    - src/components/returns/CustomerReturnForm.tsx (423 lines)
    - src/pages/CustomerReturnsPage.tsx (15 lines)
    - src/components/returns/SupplierReturnForm.tsx (331 lines)
    - src/pages/SupplierReturnsPage.tsx (15 lines)
    - src/components/returns/WriteOffForm.tsx (398 lines)
    - src/pages/WriteOffPage.tsx (15 lines)
    - src/pages/ReturnHistoryPage.tsx (148 lines)
  modified:
    - src-tauri/src/models/return.rs (added ReturnListItemDto)
    - src-tauri/src/repository/returns_repo.rs (added list_all)
    - src-tauri/src/commands/return_commands.rs (added list_returns)
    - src-tauri/src/main.rs (registered list_returns)
    - src/types/return.ts (added ReturnListItemDto)
    - src/lib/tauri.ts (added listReturns IPC wrapper)
    - src/components/layout/Sidebar.tsx (added 4 nav items)
    - src/App.tsx (added 4 routes)
decisions:
  - Added list_returns backend command (Rule 2) to support ReturnHistoryPage — the plan's 04-02 backend didn't include this, so it was added as missing critical functionality
  - ReturnHistoryPage is owner-only, matching the list_returns command guard (requires require_owner)
  - Customer Return route is placed outside the owner-only block in App.tsx so both owner and pharmacist can access
metrics:
  duration: ~25 minutes
  completed_date: 2026-06-05
---

# Phase 4 Plan 03: Returns & Operational Corrections Summary

**One-liner:** Complete frontend UI for customer returns (sale search → item selection → condition dropdown → refund), supplier returns (purchase search → batch selection → credit note), write-offs (medicine search → batch selection → condition → reason), and return history — with role-based sidebar navigation and route registration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CustomerReturnForm + CustomerReturnsPage | `5415d9f` | CustomerReturnForm.tsx, CustomerReturnsPage.tsx |
| 2 | SupplierReturnForm, WriteOffForm, ReturnHistoryPage + pages | `56cea27` | SupplierReturnForm.tsx, WriteOffForm.tsx, ReturnHistoryPage.tsx, SupplierReturnsPage.tsx, WriteOffPage.tsx |
| 3 | Sidebar navigation + App.tsx routes | `b60e9df` | Sidebar.tsx, App.tsx |
| — | Backend: list_returns command (Rule 2) | `a5fc780` | return.rs, returns_repo.rs, return_commands.rs, main.rs, return.ts, tauri.ts |

## Deviations from Plan

### Rule 2: Auto-added missing critical functionality

**1. [Rule 2 - Missing Feature] Added `list_returns` backend command**

- **Found during:** Creating ReturnHistoryPage (Task 2)
- **Issue:** The plan specifies a ReturnHistoryPage showing a table of all returns with type/date/medicine/condition/amount, but Plan 04-02 did not include a `list_returns` Tauri command. Without this, the page would have no data source.
- **Fix:** Added `ReturnListItemDto` to models, `list_all()` query in returns_repo.rs (LEFT JOIN with medicines for display name), `list_returns` Tauri command (owner-only via require_owner), TypeScript interface, and IPC wrapper.
- **Files created:** (none — all modifications to existing files)
- **Files modified:** `src-tauri/src/models/return.rs`, `src-tauri/src/repository/returns_repo.rs`, `src-tauri/src/commands/return_commands.rs`, `src-tauri/src/main.rs`, `src/types/return.ts`, `src/lib/tauri.ts`
- **Commit:** `a5fc780`

## Role Guard Verification

| Command / Route | Guard / Visibility | Access Level |
|----------------|-------------------|--------------|
| `process_customer_return` | `require_session` | Owner + Pharmacist |
| `search_sale_for_return` | `require_session` | Owner + Pharmacist |
| Customer Return sidebar | `roles: ['owner', 'pharmacist']` | Both roles |
| `/returns/customer` route | Outside owner block | Both roles |
| `process_supplier_return` | `require_owner` | Owner only |
| `process_write_off` | `require_owner` | Owner only |
| `search_purchase_for_return` | `require_owner` | Owner only |
| `list_returns` | `require_owner` | Owner only |
| Supplier Return / Write Off / Return History sidebar | `roles: ['owner']` | Owner only |

## Verification Results

- [x] CustomerReturnForm searches sale by ID, displays items with returnable_qty
- [x] Customer return submit calls process_customer_return Tauri command
- [x] SupplierReturnForm searches purchase by ID, displays batches with remaining_qty
- [x] Supplier return submit calls process_supplier_return Tauri command
- [x] WriteOffForm allows medicine search, batch selection, condition selection
- [x] Write-off submit calls process_write_off Tauri command
- [x] ReturnHistoryPage loads data from list_returns Tauri command
- [x] Sidebar shows Customer Return for both roles
- [x] Sidebar shows Supplier Return and Write Off for owner only
- [x] Sidebar shows Return History for owner only
- [x] App.tsx routes Customer Return outside owner-only block
- [x] App.tsx routes Supplier Return, Write Off, Return History inside owner-only block
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `cargo check` passes
- [x] `npm run build` passes

## Threat Surface Scan

No new threat flags — `list_returns` uses `require_owner` guard matching the existing pattern (T-04-08, T-04-09 mitigation pattern). Route guards match threat model expectations.

## Known Stubs

None — all forms are fully wired to real Tauri commands with no mock data.

## Self-Check: PASSED

- [x] src/components/returns/CustomerReturnForm.tsx exists (423 lines)
- [x] src/pages/CustomerReturnsPage.tsx exists (15 lines)
- [x] src/components/returns/SupplierReturnForm.tsx exists (331 lines)
- [x] src/pages/SupplierReturnsPage.tsx exists (15 lines)
- [x] src/components/returns/WriteOffForm.tsx exists (398 lines)
- [x] src/pages/WriteOffPage.tsx exists (15 lines)
- [x] src/pages/ReturnHistoryPage.tsx exists (148 lines)
- [x] Commit `5415d9f` exists (Customer Return)
- [x] Commit `56cea27` exists (Supplier Return + Write Off + History)
- [x] Commit `b60e9df` exists (Sidebar + Routes)
- [x] Commit `a5fc780` exists (list_returns backend)
- [x] `npx tsc --noEmit` passes
- [x] `cargo check` passes
- [x] `npm run build` passes
