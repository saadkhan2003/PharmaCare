---
phase: 03-pos-sales-engine
plan: 02
type: execute
subsystem: frontend
tags:
  - pos
  - keyboard-first
  - cart
  - payment
  - receipt
requires:
  - 03-01 (Sale backend types, IPC commands)
provides:
  - Sale TypeScript interfaces (including dashboard DTOs for Plan 03-03 cross-plan contract)
  - POS keyboard navigation hook
  - IPC wrappers for sales commands
  - Two-panel POS page layout
  - Live medicine search with 200ms debounce
  - Cart with itemized list, discounts, tax toggle
  - Payment form (Cash/Card/Credit) with customer name for Credit
  - Receipt dialog with sale details
affects:
  - Plan 03-03 (Dashboard page requires dashboard DTOs — now available from sale.ts)
tech-stack:
  added:
    - usePOSKeyboard custom hook
    - POS component set (5 components)
  patterns:
    - Keyboard-first Tab/Enter navigation via ref forwarding
    - Display-only client-side totals (D-35)
    - Cart state decoupled from search state
key-files:
  created:
    - src/types/sale.ts
    - src/hooks/usePOSKeyboard.ts
    - src/components/pos/POSSearchPanel.tsx
    - src/components/pos/POSCartPanel.tsx
    - src/components/pos/POSCartItem.tsx
    - src/components/pos/POSPaymentForm.tsx
    - src/components/pos/POSReceiptDialog.tsx
    - src/pages/POSPage.tsx
  modified:
    - src/lib/tauri.ts
    - src/components/layout/Sidebar.tsx
    - src/App.tsx
decisions:
  - Cross-plan contract: OwnerDashboardDto, PharmacistDashboardDto, TopSellerDto defined in sale.ts to unblock Plan 03-03
  - Payment ref typed as HTMLButtonElement (shadcn SelectTrigger forwards ButtonElement ref)
  - Custom tax toggle switch (no shadcn Switch component installed)
  - Manual Switch component for tax toggle (shadcn Switch not available — uses HTML role=switch with CSS)
metrics:
  duration: ~15 minutes
  completed: 2026-06-05T19:35:00Z
  tasks: 3
  commits: 3
  files_changed: 11
---
# Phase 3 Plan 02: POS Frontend — Keyboard-First Two-Panel POS Interface

**One-liner:** Keyboard-first two-panel POS interface with live medicine search (<200ms debounce), cart with item/cart-level discounts, tax toggle, Cash/Card/Credit payment, and receipt dialog — all built for keyboard-only Tab/Enter sale completion.

---

## Summary

Plan 03-02 delivers the complete POS frontend for PharmaCare's fast-paced pharmacy workflow:

- **Sale types (sale.ts):** `MedicinePosDto`, `ConfirmSaleDto`/`ConfirmSaleItemDto`, `SaleReceiptDto`/`SaleReceiptItemDto`, and cross-plan dashboard types (`OwnerDashboardDto`, `PharmacistDashboardDto`, `TopSellerDto`) to unblock Plan 03-03.
- **usePOSKeyboard hook:** Tab order constants (SEARCH → QUANTITY → ITEM_DISCOUNT → BILL_DISCOUNT → TAX_TOGGLE → PAYMENT → CUSTOMER_NAME → CONFIRM) and refs/handlers for keyboard-driven field navigation.
- **IPC wrappers (tauri.ts):** `sales.searchMedicinesPos`, `sales.confirmSale`, `sales.getOwnerDashboard`, `sales.getPharmacistDashboard` in the `tauri.sales` namespace.
- **Sidebar + routing:** POS nav item (ShoppingCart icon, both roles) in Sidebar, `/pos` route in App.tsx before dashboard.
- **POSSearchPanel:** Large search input with 200ms debounce (useDebounce), results as styled cards showing name/generic_name, retail_price, stock badges (green/yellow/destructive). Arrow key selection, Enter to add to cart. Empty/no-results/loading states.
- **POSPage:** Two-panel flex layout (search left, cart right at 480px). Manages cart as `CartItem[]` with add/update/remove/clear. Keyboard flow via `usePOSKeyboard` refs.
- **POSCartItem:** Row with quantity input (min=1, max=stock), item discount input, line total display, Trash2 remove button.
- **POSPaymentForm:** Bill discount, tax toggle (custom switch), Select for Cash/Card/Credit, customer name text input (shown only for Credit), display-only totals breakdown (D-35), Confirm Sale button.
- **POSCartPanel:** Scrollable item list (empty state when no items), composes POSCartItem + POSPaymentForm. Uses `useTauriCommand` to call `confirmSale` with all cart data. Handles loading/error states.
- **POSReceiptDialog:** shadcn Dialog showing sale_id, item breakdown, totals, payment method, customer name (if Credit). "New Sale" button to close and clear cart.

## Deviations from Plan

**1. [Rule 2 — Missing Critical Functionality] Cross-plan dashboard DTOs added to sale.ts**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 instructions listed `OwnerDashboardDto`, `PharmacistDashboardDto`, `TopSellerDto` as imports for tauri.ts but these interfaces were not defined yet (they belong to Plan 03-03). Without them, tauri.ts would fail with missing-type errors after Plan 03-02.
- **Fix:** Defined `OwnerDashboardDto`, `PharmacistDashboardDto`, and `TopSellerDto` in `src/types/sale.ts` during Task 1, as instructed by the cross-plan blocker fix in the plan preamble.
- **Files modified:** `src/types/sale.ts`
- **Commit:** 89c859e

**2. [Own context — Type adaptation] paymentRef typed as HTMLButtonElement**
- **Details:** The plan specified `paymentRef` as `React.RefObject<HTMLSelectElement>`, but shadcn's `SelectTrigger` component uses `@base-ui/react/select` which forwards a `HTMLButtonElement` ref, not `HTMLSelectElement`. Changed the ref type to `HTMLButtonElement` across all components.
- **Files modified:** `src/hooks/usePOSKeyboard.ts`, `src/components/pos/POSPaymentForm.tsx`, `src/components/pos/POSCartPanel.tsx`

**3. [Own context — Dependency] No shadcn Switch component installed**
- **Details:** The plan referenced a shadcn Switch component for the tax toggle, but the component is not installed in the project. Implemented a custom accessible switch using `<button role="switch">` with CSS transitions instead.
- **Files modified:** `src/components/pos/POSPaymentForm.tsx`

## Threat Model Verification

| Threat ID | Disposition | Verification |
|-----------|-------------|-------------|
| T-03-07 (Tampering — frontend totals) | Accepted | Display-only client-side estimates; `POSPaymentForm` shows computed values but server recalculates at confirm (D-35) |
| T-03-08 (Tampering — discount abuse) | Mitigated via backend | Frontend sends `item_discount`/`bill_discount` as-is; server validates permissions and caps (D-38, D-37) |
| T-03-09 (Spoofing — credit without name) | Mitigated | `customer_name` input shown and required when `payment_method === 'Credit'`; backend also validates |
| T-03-10 (Info Disclosure — purchase price) | Accepted | `MedicinePosDto` excludes `purchase_price`; only `retail_price` sent to frontend |

## Stub Tracking

No functional stubs identified. All components have real implementations with proper state management.

## Threat Flags

None — all new surface is within the POS UI with no exposed network endpoints or auth paths.

## Self-Check: PASSED

| Check | Status |
|-------|--------|
| src/types/sale.ts created with all sale interfaces | ✅ |
| src/hooks/usePOSKeyboard.ts created | ✅ |
| src/lib/tauri.ts has sales namespace with 4 IPC wrappers | ✅ |
| Sidebar.tsx has POS nav item for both roles | ✅ |
| App.tsx has /pos route | ✅ |
| POSSearchPanel.tsx — debounced search, stock badges, keyboard nav | ✅ |
| POSPage.tsx — two-panel layout, cart state, keyboard refs | ✅ |
| POSCartItem.tsx — quantity/discount editing, remove | ✅ |
| POSPaymentForm.tsx — bill discount, tax toggle, payment select, credit name | ✅ |
| POSCartPanel.tsx — scrollable items, confirm action | ✅ |
| POSReceiptDialog.tsx — sale receipt, New Sale button | ✅ |
| npm run build passes with zero errors | ✅ |
| 3 commits with proper format | ✅ |
