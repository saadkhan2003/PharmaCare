# PharmaCare

## What This Is

PharmaCare is a Windows desktop application for managing the day-to-day operations of a single-branch private pharmacy. It replaces manual registers and spreadsheets with a fast, offline-first system for inventory, sales, purchasing, expiry tracking, returns, reports, user access, and automated backup. The product serves two primary users: the pharmacy owner, who needs full financial and operational visibility, and the pharmacist/cashier, who needs a fast, simple point-of-sale workflow.

## Core Value

The pharmacist can reliably process medicine sales while stock, profit, expiry, and backup data stay accurate without requiring internet access.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Build a Tauri 2.0 Windows desktop application with React, TypeScript, Tailwind CSS, shadcn/ui, SQLite, Prisma, Recharts, and PDF export.
- [ ] Support owner and pharmacist/cashier login with local password hashing and role-based access control.
- [ ] Let owners create, edit, view, deactivate, and organize medicines with prices, categories, units, reorder levels, shelf locations, and notes.
- [ ] Track stock at batch level with purchase price, received date, remaining quantity, and expiry date.
- [ ] Let pharmacists process sales in under 30 seconds with live medicine search, keyboard-friendly flow, stock validation, discounts, tax, payment methods, and FIFO stock deduction.
- [ ] Let owners manage suppliers, purchases, purchase items, and payment status while automatically increasing stock and creating batches.
- [ ] Show low-stock, zero-stock, upcoming-expiry, expired-stock, and missed-backup alerts on dashboards.
- [ ] Prevent sales of zero-stock, over-quantity, and expired medicines.
- [ ] Handle customer returns, supplier returns, resellable stock restoration, stock write-offs, refunds, credit notes, and loss logging.
- [ ] Provide owner-only analytics and reports for sales, profit, P&L, top sellers, slow-moving stock, low stock, expiry, supplier purchases, cashier sales, and profit margins.
- [ ] Export reports to PDF and keep financial data hidden from pharmacist/cashier users.
- [ ] Provide configurable pharmacy info, financial settings, inventory thresholds, backup settings, user management, and currency display.
- [ ] Back up the local SQLite database automatically to Google Drive nightly, support manual backup, keep backup history, preserve 30 daily backups, and support explicit owner-only restore.
- [ ] Support optional local-folder backup for offline or USB fallback.
- [ ] Preserve data integrity with soft deletes, logged stock changes, logged login attempts, WAL-mode reliability, and database backup before restore.

### Out of Scope

- Multi-branch support - v1 is scoped to a single private pharmacy branch.
- Customer accounts and loyalty points - not needed for core inventory and POS value.
- Full credit/udhaar ledger per customer - current PRD only prompts for customer name on credit sales; complete receivables tracking is deferred.
- Barcode scanner hardware integration - excluded to keep v1 simple and keyboard/search driven.
- WhatsApp notifications for low stock or expiry - possible future enhancement, not required for v1.
- Prescription management and doctor records - outside the operational inventory/POS scope.
- Insurance billing - not needed for the target private pharmacy v1.
- Mobile app companion - Windows desktop is the target platform.
- Online ordering or e-commerce - the app is offline-first for in-store operations.

## Context

- PharmaCare is for a private single-branch pharmacy operating from a Windows laptop.
- The app must replace manual registers and spreadsheets while remaining fast enough for daily counter use.
- The business has two user classes: owner and pharmacist/cashier.
- The owner needs one-click visibility into today's earnings and profit, monthly reports, purchase costs, margins, alerts, backups, and settings.
- The pharmacist/cashier needs a large, fast, keyboard-friendly POS screen and limited visibility into inventory and daily totals.
- The PRD already specifies an intended stack: Tauri 2.0, Rust, React, TypeScript, Tailwind CSS, shadcn/ui, SQLite via Prisma, Google Drive API OAuth2, Recharts, and @react-pdf/renderer.
- The PRD specifies a local SQLite database as the source of truth and Google Drive backup as disaster recovery, not as a cloud database.
- The first release should prioritize the existing PRD modules over open-question enhancements.
- Open client questions remain: credit/udhaar depth, initial Excel import, number of launch users, WhatsApp alerts, Google account for Drive backup, UPS/power risk, and legal pharmacy name for report headers.

## Constraints

- **Platform**: Windows desktop application - the client needs a local pharmacy system, not a web or mobile app.
- **Offline-first**: Day-to-day operation must not require internet - sales, inventory, returns, reports, and authentication must work locally.
- **Persistence**: SQLite is the local database - single-file storage keeps the deployment low-cost and easy to back up.
- **Backup**: Google Drive backup is best-effort and automatic - uploads happen when internet is available and retry after missed runs.
- **Performance**: App launch must be under 3 seconds, POS search under 200ms, reports under 5 seconds, and sale entry under 30 seconds.
- **Security**: Passwords must be bcrypt hashed locally, owner-only financial data must not leak to pharmacist/cashier users, and every session requires login.
- **Data integrity**: No hard deletes for historical records, all stock-affecting events must be logged, and stock must be deducted FIFO by batch.
- **Usability**: POS must support keyboard-only operation with clear typography and minimal clicks.
- **Language**: UI language is English only for v1.
- **Cost**: No monthly server cost; Google Drive free storage and local SQLite are preferred.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a Windows desktop app with Tauri 2.0 | Lightweight native shell and good fit for offline local database workflows | - Pending |
| Use SQLite as source of truth | Offline operation, zero server cost, single-file backup/restore | - Pending |
| Use Google Drive for nightly disaster-recovery backups | Familiar, free, and sufficient for single-branch backup needs | - Pending |
| Keep v1 single-branch only | Reduces scope and avoids multi-location inventory complexity | - Pending |
| Optimize POS for keyboard speed | Pharmacist sale speed is a primary success metric | - Pending |
| Use owner/pharmacist roles | Protects purchase prices, margins, reports, backup, settings, and user management | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-05 after initialization*
