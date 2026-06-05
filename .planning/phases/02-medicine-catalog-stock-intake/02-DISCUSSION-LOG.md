# Phase 2: Medicine Catalog & Stock Intake - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 2-Medicine Catalog & Stock Intake
**Areas discussed:** Medicine form UX, Supplier-purchase-batch flow, Stock movement integration, Expiry report design, Settings scope, Pharmacist inventory view, Search/filter pattern
**Mode:** auto (auto-selected all areas, recommended defaults chosen)

---

## Medicine Form UX

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Select dropdowns | Simple dropdown for 5 categories/5 units | ✓ |
| Searchable combobox | Better for many options, overkill here | |
| Tab-based category selector | Visual but more complex | |

**User's choice:** shadcn Select dropdowns (auto — recommended)
**Notes:** Small enum sizes make dropdowns the right choice.

## Supplier-Purchase-Batch Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single-screen purchase form | Inline item table, add/remove rows | ✓ |
| Multi-step wizard | Separate steps for supplier, items, confirm | |

**User's choice:** Single-screen purchase form (auto — recommended)
**Notes:** Fastest for regular purchase entry.

## Stock Movement Integration

| Option | Description | Selected |
|--------|-------------|----------|
| PurchaseService → StockLedgerService | Positive movements via single authority | ✓ |
| Direct batch table mutation | Simpler but risks inconsistency | |

**User's choice:** StockLedgerService single authority (auto — recommended)
**Notes:** Consistent with research finding Pitfall 1.

## Expiry Report Design

| Option | Description | Selected |
|--------|-------------|----------|
| Full page + dashboard widget | Report page + widget on dashboard | ✓ (widget deferred) |
| Standalone page only | Just the report page | |

**User's choice:** Full page with sort/filter (auto — recommended)
**Notes:** Dashboard widget deferred to Phase 3.

## Settings Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Backend reads only | Key-value reads, default values, no settings UI | ✓ |
| Full settings UI | Build settings screens now | |

**User's choice:** Backend reads only (auto — recommended)
**Notes:** Full settings UI deferred to Phase 5.

## Pharmacist Inventory View

| Option | Description | Selected |
|--------|-------------|----------|
| Hide prices, show stock info | Purchase price hidden, retail visible | ✓ |
| Full read-only | Show everything but no edit | |

**User's choice:** Hide purchase prices and margins (auto — recommended)

## Search/Filter Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Live search with debounce | Results update as user types | ✓ |
| Search button only | Manual search trigger | |

**User's choice:** Live search with 300ms debounce (auto — recommended)

---

## the agent's Discretion

- Table column layout for medicine list
- Purchase form item row layout
- Error message wording
- Date-picker implementation

## Deferred Ideas

- Full settings UI screens — Phase 5
- Dashboard expiry widget — Phase 3
