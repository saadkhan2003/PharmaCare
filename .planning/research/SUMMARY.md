# Project Research Summary

**Project:** PharmaCare
**Domain:** Offline-first single-branch pharmacy POS/inventory/management Windows desktop application
**Researched:** 2026-06-05
**Confidence:** HIGH for architecture and pitfalls; MEDIUM for features (missing STACK.md increases stack uncertainty)

## Executive Summary

PharmaCare is a Windows desktop pharmacy management system replacing manual registers and spreadsheets for a single-branch private pharmacy. Experts build this class of application as an **offline-first, local-SQLite system with a trusted backend layer** — not a web app, not a cloud SaaS. The recommended approach is a **Tauri 2.0 shell with Rust handling all stock mutations and financial logic via intent commands, while React/TypeScript owns the UI layer only**. SQLite (via `rusqlite`/`sqlx` rather than Prisma) is the single source of truth, with Google Drive used solely for disaster-recovery backups.

The key risk is **building POS before the stock ledger is transaction-safe** — if sales, purchases, returns, and write-offs update stock through separate ad-hoc paths, quantities and profit reports will diverge irrecoverably. Mitigation requires a `stock_movements` ledger in Phase 1, a single transaction-authority service for all stock mutations, and FIFO batch allocation built into the sale confirmation path from day one. The second critical risk is **backing up a live WAL-mode SQLite database by naive file copy**, which silently loses committed transactions. SQLite's Online Backup API or `VACUUM INTO` must be used instead.

**Overall verdict: the PRD scope is well-constrained. The winning strategy is dependency-driven, not screen-driven — build the mutation spine (batches, ledger, transactions, RBAC) before any POS or reports.**

## Key Findings

### Recommended Stack

**Note: STACK.md was not produced by research agents. Stack details below are synthesized from PROJECT.md, ARCHITECTURE.md, and FEATURES.md.**

The stack is largely pre-decided by the PRD. Research validated the choices and surfaced one critical architectural decision point.

**Core technologies & recommendations:**

- **Tauri 2.0 + Rust** — Native Windows shell; provides IPC boundary that prevents React from writing SQL directly; Tauri's permission system enforces command-level access control. **Highly validated choice.**
- **React 18+ / TypeScript** — UI layer only. Owns form state, keyboard POS navigation, chart rendering (Recharts), PDF preview, and optimistic UI updates. Must never compute authoritative stock or profit. **Well-documented desktop React patterns.**
- **Tailwind CSS + shadcn/ui** — Rapid UI development for forms, tables, dialogs, and the keyboard-centric POS layout. Sufficient for the single-desktop-app use case.
- **SQLite (rusqlite/sqlx, NOT Prisma in frontend)** — **This is the critical architecture decision.** The PRD mentions Prisma, but ARCHITECTURE.md strongly recommends **not letting React write SQLite directly**. Preferred approach: use Prisma schema/migrations as design input, but implement runtime DB access in Rust via `rusqlite` or `sqlx` through Tauri commands. The Node.js sidecar approach for Prisma adds packaging, process supervision, and security complexity without proportional benefit.
- **Recharts** — Dashboard charts for sales trends, top sellers, expiry counts. Read-only, no stock authority needed.
- **@react-pdf/renderer** — PDF export for reports. Client-side only, no server involvement.
- **Google Drive API (OAuth 2.0)** — Backup destination only. Must be background/best-effort, never on critical POS path.

**Critical version constraints:**
- Tauri v2 stable (v2.x), not v1 — permissions model, plugin architecture, asset bundling are significantly improved.
- SQLite WAL mode (`PRAGMA journal_mode=WAL`) must be enabled for concurrent read/write performance. Requires `PRAGMA foreign_keys=ON` on every connection and `busy_timeout=5000`.

### Expected Features

From FEATURES.md — full detail at `.planning/research/FEATURES.md`

**Must have (table stakes):**
- Local auth + owner/pharmacist roles with bcrypt — protects prices, margins, settings, backup
- Medicine catalog with name, generic, brand, unit, price, reorder level, shelf location, active/inactive
- **Batch-level stock tracking** — purchase price, received date, expiry date, remaining quantity per batch (not medicine-level only)
- Fast keyboard-first POS with live search (<200ms), stock validation, discounts, tax, payment methods — target sale under 30 seconds
- FIFO stock deduction from oldest valid batch
- Supplier management and purchase entry that creates batches
- Low-stock and expiry alerts with configurable thresholds
- Customer returns, supplier returns, write-offs with condition tracking and loss logging
- Owner dashboard with today's sales/profit, alerts, top sellers
- Reports + PDF export (daily sales, monthly P&L, margin, top sellers, slow-moving, expiry, supplier purchases, cashier sales)
- Settings (pharmacy info, tax, discounts, expiry thresholds, reorder defaults, backup options)
- Automated Google Drive backup + explicit owner-only restore
- Audit/stock movement log for all stock-affecting events

**Should have (differentiators):**
- Offline-first Windows desktop with zero server cost — no monthly fee, no internet dependency
- Keyboard-first POS optimized for under-30-second sales — competes on speed, not feature bloat
- Owner-only profit visibility via batch purchase cost — more accurate margins than single-cost systems
- Expiry-loss prevention workflow — alerts + supplier return/write-off actions reduce real money loss
- Simple pharmacist mode — cashier sells and does basic returns without seeing margins
- Local-folder/USB backup fallback — practical for unreliable internet
- Loss-aware returns and write-offs — financial reports reflect refunds and losses, not hide them

**Defer (v2+):**
- Full credit/udhaar receivable ledger
- Barcode scanner hardware integration
- WhatsApp/SMS low-stock and expiry alerts
- Patient profiles, loyalty, refill reminders, med-sync
- Prescription management / doctor records / insurance adjudication
- Multi-branch, cloud sync, mobile companion
- Purchase order recommendations (needs sales history first)

### Architecture Approach

From ARCHITECTURE.md — full detail at `.planning/research/ARCHITECTURE.md`

Use a **local-first layered desktop architecture** where SQLite is the source of truth, Rust owns all privileged operations and stock mutations, and React is UI/client only. The architecture enforces a strict write path: React sends intent commands via Tauri IPC → Rust validates RBAC and business rules → single SQLite transaction mutates records + stock ledger + audit logs → commit → return receipt DTO.

**Major components:**
1. **React UI** — Screens, keyboard POS, forms, charts, PDF rendering. No direct stock mutation logic, no SQL.
2. **Tauri Command API** — Stable IPC surface with DTO validation, session lookup, role enforcement, structured errors. Exposes narrow intent commands (`confirm_sale`, `record_purchase`, `process_customer_return`), not raw SQL.
3. **Rust Application Services** — `AuthService`, `MedicineService`, `SaleService`/`POS`, `StockService`/`StockLedgerService`, `ReturnService`, `ReportService`, `BackupService`. Each owns domain invariants.
4. **StockLedgerService** — **The single authority for all stock-affecting mutations.** No other service may change `batches.remaining_qty`.
5. **SQLite Repository Layer** — Migrations, prepared queries, WAL mode, transaction helpers, indexes.
6. **BackupService** — Online backup API snapshots, Google Drive upload, local folder copy, restore orchestration with pre-restore backup.

**Key patterns:**
- **Intent Command Pattern** — React calls `confirm_sale(payload)` instead of SQL. Keeps audit, RBAC, stock invariants, and financial calculations in one trusted layer.
- **Transaction Script for Stock Mutations** — Every sale, purchase, return, write-off is a single SQLite transaction that mutates all related records atomically.
- **Append-Only Corrections** — Returns/write-offs add records; they do not edit or delete historical sales/purchases.
- **Role-Masked DTOs** — Owner-only data (purchase prices, COGS, margins) is masked at the Rust service layer, not just hidden in the UI.

### Critical Pitfalls

From PITFALLS.md — full detail at `.planning/research/PITFALLS.md`

1. **Building POS before stock ledger is transaction-safe** — Sales, purchases, returns, and write-offs must all route through one `StockService` with an append-only `stock_movements` ledger. Without this, quantities diverge irrecoverably. **Prevention:** add `stock_movements` table and `StockService` in Phase 1; every stock-affecting action uses the same service.

2. **FIFO/expiry logic at medicine level instead of batch level** — A medicine may have one expired batch and one valid batch. Selling from the wrong batch is both illegal (expired medicine) and financially incorrect. **Prevention:** Phase 2 sale confirmation allocates batches by `expiry_date ASC, received_date ASC, id ASC` with `remaining_qty > 0`; store COGS per deducted batch at sale time.

3. **Adding purchasing after POS creates fake stock history** — If Phase 2 POS needs stock but Phase 3 purchasing is deferred, the team seeds `current_stock` manually, creating orphan stock with no batch, expiry, or purchase cost. **Prevention:** include an opening-stock batch capture path in Phase 1; never allow positive stock without at least one batch record.

4. **Financial reports recompute history from mutable current data** — Profit reports that join to `medicines.retail_price` or `batches.purchase_price` will change when prices are edited, making past P&L unreliable. **Prevention:** capture immutable sale snapshots (unit price, discount, tax, batch cost, line COGS) at sale time in Phase 2; returns are reversal records, not edits to original totals.

5. **Cashier role leaks owner financial data through API** — Purchase prices, margins, P&L, and backup must be blocked at the Rust command/service boundary, not just hidden in navigation. **Prevention:** Phase 1 enforces RBAC at the command layer; owner-only fields never reach frontend DTOs; authorization tests for every Tauri command.

6. **Backing up a live WAL-mode SQLite file by copying only `.db`** — Committed transactions in the `-wal` file are lost, producing an inconsistent or outdated backup. **Prevention:** Phase 7 uses SQLite Online Backup API or `VACUUM INTO`; never raw file copy while DB is active.

7. **Restore flow overwrites good data without a rollback path** — **Prevention:** restore must be a staged workflow: validate backup, create pre-restore backup of current DB, require typed confirmation, replace atomically, restart app.

8. **Offline-first promise broken by hidden online dependencies** — App startup must not block on Drive OAuth, CDN fonts, or remote config. **Prevention:** define offline acceptance test in Phase 1; bundle all assets locally; backup is background best-effort only.

## Implications for Roadmap

Based on the combined research, the following dependency-driven phase structure is recommended. **The build order prioritizes the mutation spine before any screen-level features.** This is the single most important roadmap decision.

### Phase 1: Foundation & Database Runtime
**Rationale:** Every other phase depends on the Tauri shell, SQLite connection, migrations, RBAC, and the stock ledger. Auth must be first because it shapes every command and DTO. The batch/stock movement schema must be in the initial migration to prevent retrofit pain.
**Delivers:** Tauri + React shell running locally; SQLite with WAL/foreign keys/busy timeout; users table with bcrypt auth; role-based command guards; `medicines`, `batches`, `stock_movements` schema; opening-stock batch creation path; migration discipline.
**Addresses features:** Local auth + roles, medicine catalog foundation, stock movement ledger design
**Avoids pitfalls:** 1 (ledger before POS), 3 (fake stock from deferred purchasing), 6 (auth as foundation not polish), 10 (offline baseline), 13 (medicine identity), 17 (migration discipline)
**Research flag:** This phase uses well-documented patterns (Tauri, SQLite, bcrypt) — no additional research needed. The Prisma-vs-rusqlite decision must be resolved here.

### Phase 2: Stock Spine & Purchase Entry
**Rationale:** The research is unanimous: purchases and batches must exist before POS can work with real stock. This phase creates the authoritative intake path for stock, which both POS and reports depend on.
**Delivers:** Full purchase/supplier workflow; batch creation with purchase price and expiry; positive stock movement entries; supplier management CRUD; medicine catalog CRUD with soft delete.
**Addresses features:** Supplier management, purchase entry + batch creation, medicine catalog (full)
**Uses stack:** Rust `rusqlite`/`sqlx` transaction scripts, supplier + batch repository
**Implements architecture:** PurchaseService, StockLedgerService (positive movements)
**Avoids pitfalls:** 3 (no fake stock), 1 (ledger first)

### Phase 3: POS & Sales (Keyboard-First)
**Rationale:** POS is the primary daily user value, but it must operate against real batch-level stock with FIFO allocation and COGS snapshots. This phase builds the core transaction and the keyboard-first UI simultaneously.
**Delivers:** Sale confirmation with FIFO batch allocator; expired-stock blocking; no-negative-quantity enforcement; immutable sale item snapshots (price, cost, discount, tax); keyboard-first UI with <200ms search and <30s completion; offline acceptance tests.
**Addresses features:** Fast POS with FIFO, stock blocking rules, under-30-second sale
**Uses stack:** Tauri IPC intent commands, Rust sale transaction, React keyboard POS, Recharts (for live sale counter)
**Implements architecture:** SaleService, StockService (negative movements/decrement)
**Avoids pitfalls:** 2 (batch-level FIFO, not medicine-level), 11 (POS speed designed in), 4 (COGS snapshots captured), 10 (offline tested)
**Research flag:** POS keyboard UX patterns are well-documented; no additional research needed for the technical approach. Performance targets (<200ms, <30s) will need benchmarking during execution.

### Phase 4: Alerts & Expiry Management
**Rationale:** Low-stock and expiry alerts are read-only projections over the existing batch/sale data model. They provide immediate operational value without introducing new mutation complexity.
**Delivers:** Dashboard alert cards for low stock, zero stock, upcoming expiry, expired stock, missed backup; actionable lists linking to stock or return workflows; configurable thresholds from settings.
**Addresses features:** Low-stock alerts, expiry alerts, dashboard alert cards
**Avoids pitfalls:** 15 (operational alerts, not decorative)
**Research flag:** Standard patterns; no additional research needed.

### Phase 5: Returns, Write-Offs & Corrections
**Rationale:** Returns must be built before final financial reports, because they affect stock quantities, COGS, refund/credit amounts, and loss reporting. Building reports before corrections means inaccurate P&L from day one.
**Delivers:** Customer returns (resellable/damaged/expired conditions, refund adjustment); supplier returns (batch return, credit note); write-offs (expired/damaged loss logging); stock restoration to correct batches.
**Addresses features:** Customer returns, supplier returns, write-offs, loss logging
**Implements architecture:** ReturnService (append-only corrections)
**Avoids pitfalls:** 5 (separate return conditions), 12 (returns not negative-sales-only), 1 (stock movement through ledger)
**Research flag:** Additional research may be needed on the exact refund/credit note accounting model for the target pharmacy's local regulations.

### Phase 6: Reports, Analytics & PDF Export
**Rationale:** Reports aggregating over transaction facts should be built after sale snapshots and return corrections are stable. The research strongly warns against building reports before the mutation model is complete.
**Delivers:** Owner-only reports (daily sales, monthly P&L, margin analysis, top sellers, slow-moving, low stock, expiry, supplier purchases, cashier sales); date-range filtering; PDF export with pharmacy header; role-masked DTOs ensuring pharmacist sees no profit data.
**Addresses features:** Dashboard analytics, full report suite, PDF export
**Uses stack:** Recharts (dashboard charts), @react-pdf/renderer (PDF export)
**Implements architecture:** ReportService (read-only aggregates)
**Avoids pitfalls:** 4 (report from immutable facts), 5 (RBAC on financial data), 16 (report definitions gated by spec)
**Research flag:** **Needs detailed research:** Report formulas and reconciliation definitions must be specified in writing before implementation (referenced as a "spec gate" in pitfalls). Example scenarios (sale + tax + discount, return, credit sale, supplier return, write-off) must produce known expected values.

### Phase 7: Backup & Recovery
**Rationale:** Backup is a PRD success metric, but it depends on a stable SQLite schema and database location. It should be built after the schema stabilizes enough to validate versions, but before handover.
**Delivers:** Consistent SQLite snapshots (Online Backup API / VACUUM INTO); Google Drive OAuth 2.0 upload; local-folder/USB fallback; backup history with retention policy; restore workflow with pre-restore backup, integrity check, and typed confirmation; missed-backup alerts.
**Addresses features:** Automated Google Drive backup, manual backup, explicit restore, backup history
**Implements architecture:** BackupService (snapshot, upload, restore orchestration)
**Avoids pitfalls:** 7 (WAL-safe backup), 8 (safe restore with pre-restore backup), 9 (Drive unavailability handling)
**Research flag:** **Needs detailed research:** Google Drive API OAuth 2.0 flow in a Tauri desktop app (token storage via Stronghold or OS keyring, refresh token handling, offline scopes). Tauri's Stronghold plugin or OS credential store integration should be investigated.

### Phase 8: Settings, User Management, Polish & Handover
**Rationale:** Full settings screens can be completed after all core services exist. User management workflows (change password, deactivate cashier, create backup owner) are needed for handover. Polish includes performance tuning, restore drills, and training documentation.
**Delivers:** Configurable pharmacy info, tax/discount policy settings, expiry/reorder thresholds, backup config; full user management (add/disable users, password change, recovery workflow); performance audits; restore drill on test database; deployment checklist.
**Avoids pitfalls:** 6 (user management and lockout recovery), 8 (restore drill), 10 (final offline E2E tests), 18 (Windows file-location and power-loss testing)
**Research flag:** Restore drill procedure and handover documentation are standard patterns — no additional research needed.

### Phase Ordering Rationale

- **Dependency spine takes priority over screen priority.** The stock mutation chain (schema → batches → purchases → FIFO sales → returns → reports) must be built in dependency order, not in user-facing-feature order.
- **Auth/RBAC is Phase 1 infrastructure** because it shapes every command, DTO, and service — not polish to add later.
- **Reports must wait until after returns** because financial reports without correction handling will produce inaccurate P&L from the first month.
- **Backup is late** because the schema must stabilize first, but must be complete before handover.
- **Settings spans phases** — settings read paths (tax, discount, expiry thresholds) are needed early; settings UI screens can be completed last.

### Research Flags

Phases needing deeper research during planning:
- **Phase 7 — Backup & Recovery:** Google Drive OAuth 2.0 flow for Tauri desktop (token storage, refresh, offline scopes). Tauri Stronghold vs OS keyring evaluation.
- **Phase 6 — Reports:** Report formula definitions and reconciliation logic must be specified and validated before implementation. This is a process gate, not a tech gate.
- **Phase 5 — Returns:** Local pharmacy regulation around refunds, credit notes, and loss accounting may need validation.

Phases with standard patterns (skip research-phase):
- **Phase 1 — Foundation:** Tauri setup, SQLite connection, bcrypt auth, migrations — all well-documented.
- **Phase 3 — POS:** Keyboard UX, live search, sale confirmation — standard patterns.
- **Phase 4 — Alerts:** Read-only projections over existing data models.
- **Phase 8 — Polish:** Handover, user management, documentation.

**Missing research:** STACK.md was not produced. The stack recommendations above are synthesized from PROJECT.md, ARCHITECTURE.md, and FEATURES.md. No dedicated deep-dive on alternative frameworks, version comparisons, or library evaluation was performed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | STACK.md was not produced; stack details synthesized from PROJECT.md and ARCHITECTURE.md. The core decisions (Tauri + Rust + SQLite) are well-validated by the architecture research, but no formal library comparison or version audit was done. |
| Features | HIGH | FEATURES.md is thorough, grounded in the PRD and competitor ecosystem analysis. Feature dependency chain and deferral decisions are well-reasoned. The PRD scope is validated as appropriately constrained. |
| Architecture | HIGH | ARCHITECTURE.md is detailed with clear component boundaries, data flow diagrams, transaction rules, and security patterns. Tauri/Rust/SQLite architecture is documented against official sources. The Prisma-in-Tauri concern is flagged honestly. |
| Pitfalls | HIGH | PITFALLS.md identifies 18 pitfalls with concrete prevention strategies, phase mapping, and warning signs. Sources include official SQLite docs and Drive API docs. Prevention is actionable and cross-referenced to specific phases. |

**Overall confidence:** HIGH for the architecture and pitfall dimensions; MEDIUM for stack depth due to missing STACK.md.

### Gaps to Address

- **Missing STACK.md:** No formal technology comparison, version validation, or library evaluation was performed. The architecture research strongly validates Tauri + Rust + SQLite (rusqlite/sqlx) over the PRD's Prisma-in-frontend approach, but this should be confirmed during Phase 1 planning.
- **Prisma decision unresolved:** The PRD specifies Prisma; ARCHITECTURE.md recommends against using it in the frontend. This architectural decision must be resolved before Phase 1 execution. Options: (a) use Prisma only for schema design, implement runtime in Rust, (b) package a Node.js sidecar for Prisma, (c) use Prisma in Rust mode if available.
- **Credit sale scope:** The PRD mentions customer name on credit sales but is silent on receivables tracking. This should be resolved before Phase 3 to determine whether a minimal unpaid/paid field is needed on sales.
- **Report formulas undefined:** Phase 6 requires a written spec of report formulas before implementation. This should be prepared during earlier phases as data accumulates.
- **Google OAuth token storage:** Phase 7 needs research into OS-level credential storage (Windows Credential Manager via Tauri Stronghold or equivalent) for Drive OAuth tokens. Plaintext storage in SQLite is unacceptable.

## Sources

### Primary (HIGH confidence)
- PharmaCare PRD (`PRD.md`) — Project scope, requirements, constraints
- PharmaCare PROJECT.md — Validated requirements and out-of-scope decisions
- SQLite WAL docs (`sqlite.org/wal.html`) — WAL concurrency, checkpointing, file behavior
- SQLite Backup API docs (`sqlite.org/backup.html`) — Consistent online backup snapshots
- Google Drive API overview (`developers.google.com/workspace/drive/api`) — OAuth 2.0 upload/download/search
- Tauri docs — Commands, state management, permissions, SQL plugin, Node sidecar

### Secondary (MEDIUM confidence)
- PioneerRx official site — Pharmacy software ecosystem reference
- PrimeRx official site — Pharmacy software ecosystem reference (packages, features)
- Liberty Software official site — Pharmacy management feature reference

### Gaps (LOW confidence / missing)
- **STACK.md was not produced** — no formal stack research was executed. The stack conclusions in this document are derived from other research files and the PRD.

---
*Research completed: 2026-06-05*
*Ready for roadmap: yes*
