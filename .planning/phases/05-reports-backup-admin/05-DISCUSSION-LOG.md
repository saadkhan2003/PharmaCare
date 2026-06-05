# Phase 5: Reports, Backup & Administration - Discussion Log

> **Audit trail only.**

**Date:** 2026-06-05
**Phase:** 5-Reports, Backup & Administration
**Areas discussed:** Report design, PDF export, Backup strategy, Settings UI, User management completion
**Mode:** auto

---

## Report Design

| Option | Description | Selected |
|--------|-------------|----------|
| Rust aggregation + DTO | Each report = Rust query → typed DTO → frontend renders | ✓ |
| Frontend-only calculation | Pull raw data, compute in browser | |

**User's choice:** Rust aggregation service (auto — recommended)

## Backup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| VACUUM INTO + gzip + Drive upload | Consistent snapshot, simple, no Backup API | ✓ |
| SQLite Online Backup API | More complex, same result | |

**User's choice:** VACUUM INTO + gzip (auto — recommended)

## Settings UI

| Option | Description | Selected |
|--------|-------------|----------|
| Tabbed single page | Pharmacy Info, Financial, Inventory, Backup tabs | ✓ |
| Separate pages per section | More navigation, consistent with other pages | |

**User's choice:** Tabbed single page (auto — recommended)
