# Phase 3: POS & Sales Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-06-05
**Phase:** 3-POS & Sales Engine
**Areas discussed:** POS layout, Keyboard navigation, FIFO allocation timing, Dashboard design, Tax model, Credit sales, Sale snapshots
**Mode:** auto

---

## POS Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two-panel (left search, right cart) | Fast visual scanning, natural workflow | ✓ |
| Single column (form-style) | Slower, more scrolling | |

**User's choice:** Two-panel layout (auto — recommended)

## Keyboard Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Tab/Enter flow | Standard desktop UX, complete sale without mouse | ✓ |
| Custom keyboard shortcuts | Faster but harder to learn | |

**User's choice:** Tab/Enter flow (auto — recommended)

## FIFO Allocation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Allocate at confirm | Atomic transaction on confirm, picks oldest batches | ✓ |
| Allocate at add-item | Show specific batches pre-confirm, complex UI | |

**User's choice:** Allocate at confirm (auto — recommended)

## Dashboard Design

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate dashboards | Owner full financial, pharmacist daily totals + alerts | ✓ |
| Single dashboard with role widgets | Hybrid approach | |

**User's choice:** Separate owner/pharmacist dashboards (auto — recommended)

## Tax Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| Bill-level (post-discount) | Single tax rate on subtotal − discount | ✓ |
| Per-item tax | More flexible but complex for v1 | |

**User's choice:** Bill-level tax on post-discount subtotal (auto — recommended)

## Credit Sales

| Option | Description | Selected |
|--------|-------------|----------|
| Simple name prompt | Customer name field on credit, no receivable tracking | ✓ |
| Full receivable ledger | Customer balance tracking, credit limits | |

**User's choice:** Simple name prompt (auto — recommended)

## Sale Snapshots

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable price/cost/discount/tax | Accurate historical profit, survives price changes | ✓ |
| Live price reference only | Report values change when prices are edited | |

**User's choice:** Immutable line-item snapshots (auto — recommended)

---

## the agent's Discretion

- Cart column layout
- Search results display format
- Receipt/confirmation display
- Chart configuration

## Deferred Ideas

- Full receivables tracking — v2
- Receipt printing — v2
