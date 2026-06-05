# Phase 4: Returns & Operational Corrections - Discussion Log

> **Audit trail only.**

**Date:** 2026-06-05
**Phase:** 4-Returns & Operational Corrections
**Areas discussed:** Customer return flow, Stock restoration logic, Supplier return flow, Write-off handling, Financial correction
**Mode:** auto

---

## Customer Return Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Search by sale ID or date | Select sale, see items, choose return qty | ✓ |
| Direct item selection without sale | Simpler but loses audit trail | |

**User's choice:** Search by sale ID or date (auto — recommended)

## Stock Restoration Logic

| Option | Description | Selected |
|--------|-------------|----------|
| Restore to original batch | Increment remaining_qty on original batch | ✓ |
| Create new batch for returns | Cleaner tracking but more complex | |

**User's choice:** Restore to original batch (auto — recommended)

## Supplier Return Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Select batch → enter credit note | Simple, track credit amounts | ✓ |
| Full purchase reversal | Complex, unnecessary for v1 | |

**User's choice:** Select batch → enter credit note (auto — recommended)

## Write-off Handling

| Option | Description | Selected |
|--------|-------------|----------|
| returns table with loss logging | Separate loss records for P&L | ✓ |
| Just decrement stock | Simpler but no loss tracking | |

**User's choice:** returns table with loss records (auto — recommended)

## Financial Correction

| Option | Description | Selected |
|--------|-------------|----------|
| Append refund records | Reports aggregate refunds separately | ✓ |
| Edit original sale amount | Destructive, no audit trail | |

**User's choice:** Append refund records (auto — recommended)
