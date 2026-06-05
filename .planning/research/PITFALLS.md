# Domain Pitfalls: PharmaCare Pharmacy Management

**Domain:** Offline-first single-branch pharmacy POS, inventory, reporting, and backup  
**Researched:** 2026-06-05  
**Overall confidence:** HIGH for SQLite/backup risks from official docs; MEDIUM for pharmacy workflow risks from PRD/domain analysis.

## Critical Pitfalls

### 1. Building POS before the stock ledger is transaction-safe
**What goes wrong:** Sales deduct stock, but purchases, returns, write-offs, and corrections update quantities through separate ad-hoc code paths. Over time, `medicines.current_stock`, `batches.remaining_qty`, and reports disagree.

**Warning signs:**
- Code directly updates `current_stock` without a stock movement/audit row.
- Sale creation and batch deduction are not in the same database transaction.
- Returns restore stock without linking to original sale/batch.
- Inventory screens show totals computed differently from reports.

**Prevention strategy:**
- In **Phase 1**, add a `stock_movements` ledger before POS: `medicine_id`, `batch_id`, `type`, `quantity_delta`, `source_type`, `source_id`, `user_id`, timestamp, reason.
- Treat batch quantities as the source of truth; derive medicine stock from batch sums or update both only inside one transaction.
- Every stock-affecting action must use one service: purchase receive, sale deduction, customer return, supplier return, write-off, manual correction.
- Add invariant tests: `sum(active batch remaining_qty) == medicine current_stock`; no negative batch quantity; every stock movement has a source.

**Phase mapping:** Phase 1 must design the ledger and invariants; Phase 2, 3, and 5 must use it rather than inventing separate update logic.

---

### 2. FIFO/expiry logic implemented at medicine level instead of batch level
**What goes wrong:** The app blocks zero-stock medicines but still sells from an expired or wrong-cost batch, causing illegal/unsafe sales and incorrect profit.

**Warning signs:**
- POS checks only `medicines.current_stock`.
- `sale_items.batch_id` is optional or guessed after sale confirmation.
- FIFO means oldest `received_date`, not earliest usable expiry/purchase batch policy.
- Expired batches remain selectable in sale deduction queries.

**Prevention strategy:**
- In **Phase 2**, implement sale confirmation as a batch allocator: select non-expired batches with `remaining_qty > 0`, ordered by expiry date then received date, and split one sale item across multiple batch allocations if needed.
- Consider replacing single `sale_items.batch_id` with `sale_item_batches` if one line can consume multiple batches.
- Store COGS per deducted batch at sale time so later purchase price edits do not rewrite historical profit.
- Test edge cases: one sale consumes two batches; oldest batch expired; partial quantities; same medicine with different purchase prices.

**Phase mapping:** Phase 2 must solve allocator and sale item schema; Phase 4 validates expiry blocking; Phase 6 depends on stored COGS for accurate profit.

---

### 3. Adding purchasing after POS creates fake stock history
**What goes wrong:** Phase 2 needs saleable stock, but Phase 3 creates the real purchase/batch model later. Teams often seed `current_stock` manually, then retrofit batches, producing orphan stock with no expiry or purchase cost.

**Warning signs:**
- Phase 1 inventory form includes stock count but no opening batch record.
- Test sales are possible before any batch exists.
- Medicines can be active in POS with stock but no expiry date.

**Prevention strategy:**
- In **Phase 1**, include an explicit opening-stock path that creates an opening batch with quantity, purchase/cost price, and expiry date.
- Do not allow positive stock without at least one batch.
- If Phase 3 purchase UI is deferred, still implement minimal batch table and batch CRUD in Phase 1/2.

**Phase mapping:** Phase 1 should include opening-stock batch capture; Phase 2 should refuse stock without batches; Phase 3 adds full supplier invoice workflow.

---

### 4. Financial reports recompute history from mutable current data
**What goes wrong:** Profit reports use current purchase price, current retail price, or edited medicine records instead of values captured at transaction time. Past P&L changes when prices are edited.

**Warning signs:**
- Reports join sales to current `medicines.retail_price` or `batches.purchase_price` only.
- Sale item does not store unit price, discount, tax, and COGS snapshots.
- Refunds are subtracted inconsistently from revenue but not from COGS/profit.

**Prevention strategy:**
- In **Phase 2**, persist immutable sale snapshots: unit price, discount, tax, batch cost, line COGS, final line total.
- In **Phase 5**, model returns as reversal/adjustment records, not edits to original sale totals.
- In **Phase 6**, reports should aggregate transaction facts, not current product settings.
- Add reconciliation tests for daily revenue, refunds, COGS, gross profit, and cashier totals.

**Phase mapping:** Phase 2 captures sale economics; Phase 5 captures refund adjustments; Phase 6 only reports over immutable facts.

---

### 5. Cashier role leaks owner financial data through UI, API, or exports
**What goes wrong:** Purchase prices, margins, supplier payments, P&L, backup/restore, and settings are hidden in navigation but still accessible through direct routes, local commands, report exports, or cached frontend state.

**Warning signs:**
- Role checks are only in React components.
- Tauri/Rust commands return purchase price fields to cashier screens.
- PDF export endpoint accepts arbitrary report type without role validation.
- User management and backup buttons are hidden but commands are callable.

**Prevention strategy:**
- In **Phase 1**, enforce RBAC at command/service boundary, not only in UI.
- Define owner-only data fields and command allowlist: purchase price, profit, margin, supplier payments, reports, settings, users, backup, restore.
- Add authorization tests for every Tauri command and report export.
- Sanitize cashier inventory DTOs so forbidden fields are never sent to frontend.

**Phase mapping:** Phase 1 establishes RBAC service and tests; Phase 6 protects financial reports/PDFs; Phase 7 protects backup/restore; Phase 8 audits UI route access.

---

### 6. Local authentication treated like a simple settings table
**What goes wrong:** Password hashes, sessions, failed login attempts, and owner account recovery are underdesigned. A cashier can stay logged in indefinitely, disabled users retain active sessions, or the pharmacy locks itself out.

**Warning signs:**
- No rule guaranteeing at least one active owner.
- Session persists after role/user deactivation.
- Failed attempts are logged but never reviewed or rate-limited.
- Password reset/recovery plan is not documented for handover.

**Prevention strategy:**
- In **Phase 1**, implement login attempts, bcrypt hashing, session invalidation on app close, and owner-preservation constraints.
- In **Phase 8**, add owner user-management workflows: change password, deactivate cashier, create backup owner, and document lockout recovery.
- Never allow deleting/deactivating the last active owner or the current owner without another active owner.

**Phase mapping:** Phase 1 for auth invariants; Phase 8 for full user management and training.

---

### 7. Backing up a live WAL-mode SQLite file by copying only `.db`
**What goes wrong:** Backups miss committed transactions in the `-wal` file or capture an inconsistent copy. Restore appears successful but loses recent sales or corrupts the database.

**Warning signs:**
- Backup implementation just copies `pharmacare.db` while the app is running.
- No checkpoint/backup API/VACUUM INTO step before upload.
- Backup file size is suspiciously constant while business activity changes.
- Restore tests are manual or absent.

**Prevention strategy:**
- In **Phase 7**, create backups using SQLite Online Backup API or `VACUUM INTO` style snapshot, not a raw file copy of an open database.
- If using WAL, understand that `-wal` is part of persistent database state; do not separate it from `.db` during raw copy.
- Record backup metadata: source DB version, created_at, file size, checksum, app version, success/failure, uploaded file ID.
- Run automated restore verification on every backup path: open restored DB, run `PRAGMA integrity_check`, verify core table counts and latest sale timestamp.

**Phase mapping:** Phase 7 must implement snapshot backup, checksums, restore tests, and missed-backup alerts before claiming “zero data loss.”

---

### 8. Restore flow overwrites good data without a rollback path
**What goes wrong:** Owner restores an old/corrupt backup over current data, losing sales since the backup date. The app has no pre-restore backup, dry-run validation, or clear timestamp warning.

**Warning signs:**
- Restore button replaces the DB immediately after selecting a file.
- Backup list shows filename only, not timestamp, size, checksum, or latest sale date.
- No “backup current database before restore” requirement in implementation tasks.
- No restore drill during handover.

**Prevention strategy:**
- In **Phase 7**, restore must be a staged workflow: download to temp, verify checksum/integrity, show metadata, create pre-restore backup of current DB, require typed confirmation, replace atomically, restart app.
- Keep pre-restore backups separately and never auto-delete them in the daily retention job.
- Add handover checklist: perform one full restore drill on a test database.

**Phase mapping:** Phase 7 owns restore safety; Phase 8 documents and trains restore procedure.

---

### 9. Treating Google Drive backup as always available
**What goes wrong:** OAuth tokens expire, network is unavailable, Drive quota is full, folder permissions change, or upload fails silently. The owner discovers backup failure only after laptop loss.

**Warning signs:**
- Backup status stores only last scheduled time, not last successful upload.
- No retry queue for missed backups.
- No visible alert until many days have passed.
- App assumes one Google account without reconnect flow.

**Prevention strategy:**
- In **Phase 7**, model backup jobs with explicit states: pending, running, success, failed, retrying, skipped_offline.
- Show last successful backup, last failure reason, next retry, Drive account email, and local fallback status on owner dashboard.
- Implement manual “Backup Now” and local-folder/USB fallback before relying on cloud.
- Use Drive API uploads/downloads through OAuth 2.0 and handle auth/authorization errors as first-class user-visible states.

**Phase mapping:** Phase 7 for job state/retry/Drive account UX; Phase 4 or dashboard phase should reserve alert space for missed backups; Phase 8 trains client to check status.

---

### 10. Offline-first promise broken by hidden online dependencies
**What goes wrong:** Login, reports, POS, medicine search, or settings accidentally depend on Google Drive availability, web assets, CDN fonts, remote config, or cloud APIs. Pharmacy cannot sell when internet is down.

**Warning signs:**
- App startup initializes Drive OAuth before opening POS.
- UI assets loaded from CDN.
- Backup failures block normal app use.
- “Sync” or backup code shares transaction paths with sales.

**Prevention strategy:**
- In **Phase 1**, define offline acceptance test: disconnect internet and complete login, sale, purchase/opening stock, return, report view, and app restart.
- Keep backup as background best-effort, never on the critical POS path.
- Bundle all frontend assets locally.
- Add network-off E2E tests before handover.

**Phase mapping:** Phase 1 establishes offline baseline; every phase must pass offline regression; Phase 7 backup must not block POS.

---

### 11. POS speed optimized late instead of designed into data model and UI
**What goes wrong:** Live search, keyboard flow, and sale confirmation are bolted on after CRUD screens. The system is functionally correct but too slow for counter use.

**Warning signs:**
- POS search queries scan unindexed medicine names/generic names.
- Mouse-only flows are accepted in early demos.
- Sale confirmation performs many sequential queries per item without transaction planning.
- No timing test for <200ms search and <30s sale.

**Prevention strategy:**
- In **Phase 2**, build POS as the primary workflow, not a generic form.
- Add indexes for medicine name, generic name, brand, active status, and searchable normalized text.
- Use keyboard shortcuts, default focus, Enter-to-add, and clear validation errors.
- Add performance checks with realistic medicine count and multi-item sales.

**Phase mapping:** Phase 2 must include performance acceptance tests; Phase 8 only polishes, not fixes fundamental POS design.

---

### 12. Returns treated as negative sales only
**What goes wrong:** Refunds reduce revenue but stock, batch, expiry condition, COGS, and losses are not adjusted correctly. Damaged/expired returns may re-enter saleable stock.

**Warning signs:**
- Return record has medicine ID but no batch ID/condition.
- Customer returns do not check original sold quantity.
- Supplier returns and customer refunds share one simplistic code path.
- Reports subtract refund amount but ignore inventory loss.

**Prevention strategy:**
- In **Phase 5**, separate customer return, supplier return, and write-off flows with explicit conditions.
- Resellable customer returns must restore to an appropriate batch or a new return batch with expiry validation.
- Damaged/expired returns create write-off/loss movements, not saleable stock.
- Reports distinguish refund, credit note, inventory loss, and supplier reimbursement.

**Phase mapping:** Phase 5 owns return semantics; Phase 6 reports must aggregate them correctly.

---

## Moderate Pitfalls

### 13. Medicine identity and units are too loose
**Warning signs:** Duplicate medicines differ only by spelling; units like strip/tablet/box are mixed; same product has multiple active rows; search results confuse cashiers.

**Prevention strategy:** Phase 1 should define duplicate detection, normalized search fields, clear unit choices, and optional barcode/SKU placeholder even if scanner support is out of scope. Do not allow silent duplicate creation without warning.

**Phase mapping:** Phase 1 inventory; Phase 8 data cleanup/import handover.

### 14. Credit sales are partially implemented without receivables scope
**Warning signs:** Payment method `Credit` captures customer name but reports treat it as cash revenue; no settlement status; owner asks “who owes me money?” after launch.

**Prevention strategy:** For v1, label credit clearly as “recorded sale paid by credit marker only, no ledger.” Either exclude credit from cash-in-hand reports or add a minimal unpaid/paid field. Resolve PRD open question before Phase 2.

**Phase mapping:** Phase 2 product decision; Phase 6 reporting definitions.

### 15. Alerts become decorative, not operational
**Warning signs:** Low-stock/expiry alerts show counts but no actionable list, no sorting, no return/write-off action, no dismissed/resolved state.

**Prevention strategy:** Phase 4 alerts must link to actionable filtered lists and owner workflows. Expiry alerts must use batch remaining quantity, not medicine totals.

**Phase mapping:** Phase 4 alerts; Phase 5 supplier return/write-off actions.

### 16. Reports lack reconciliation definitions
**Warning signs:** “Today’s earnings,” revenue, cash, card, credit, tax, discounts, refunds, and profit mean different things on dashboard vs PDFs.

**Prevention strategy:** Before Phase 6, define report formulas in writing. Include examples: sale with discount/tax, return, credit sale, supplier return, expired write-off.

**Phase mapping:** Phase 6 spec gate before implementation.

### 17. Database migrations and app upgrades are ignored
**Warning signs:** Greenfield schema changes manually reset dev DB; no migration backup; no app version stored; restore from older backup not tested.

**Prevention strategy:** Phase 1 must establish migration discipline and seed/demo data. Phase 7 backups include schema/app version; restore path handles older versions through migrations.

**Phase mapping:** Phase 1 migrations; Phase 7 restore compatibility; Phase 8 installer/handover.

### 18. Power-loss and Windows file-location risks are under-tested
**Warning signs:** Database stored in install directory; app needs admin rights; no sudden shutdown test; no UPS advisory; no disk-space alert.

**Prevention strategy:** Store DB in per-user/per-app data directory, enable WAL intentionally, use safe transactions, surface disk/backup failures, and run crash-restart tests. Ask client about UPS as already listed in open questions.

**Phase mapping:** Phase 1 data directory/WAL; Phase 7 backup resilience; Phase 8 deployment checklist.

## Phase-Specific Warnings

| Phase | Likely pitfall | Prevention gate |
|---|---|---|
| Phase 1 — Foundation | Inventory CRUD without batch/ledger invariants | Schema includes batches, stock movements, transactions, RBAC tests, migration discipline |
| Phase 2 — POS & Sales | Fast-looking POS with unsafe stock/profit logic | Atomic sale transaction, batch allocator, COGS snapshot, offline/performance tests |
| Phase 3 — Purchasing & Batches | Purchase records not reconciled with existing stock | All incoming stock creates batches and stock movements; no positive stock without batch |
| Phase 4 — Alerts & Expiry | Alerts based on medicine totals, not batch reality | Batch-level low/expiry lists with actionable owner workflows |
| Phase 5 — Returns & Refunds | Refund-only returns corrupt inventory/profit | Separate customer/supplier/write-off flows; condition and batch required |
| Phase 6 — Analytics & Reports | Reports recompute from mutable current data | Formula spec and transaction-fact aggregation only |
| Phase 7 — Backup & Recovery | Raw `.db` copy and unsafe restore | SQLite snapshot backup, checksum, integrity check, pre-restore backup, restore drill |
| Phase 8 — Polish & Handover | Security/performance/restore issues discovered too late | Final audit: RBAC, offline mode, POS timing, backup status, restore training |

## Roadmap Prevention Summary

1. Move **batch and stock ledger foundations into Phase 1**, even if full purchasing UI remains Phase 3.
2. Make **Phase 2 POS acceptance** include atomic FIFO allocation, COGS snapshot, multi-batch sale tests, and offline performance timing.
3. Add a **Phase 6 reporting formula spec gate** before charts/PDF work.
4. Treat **Phase 7 backup/restore as data-safety engineering**, not just Google Drive upload UI.
5. Run **cross-phase regression checks** after every stock-affecting phase: stock invariant, financial reconciliation, cashier RBAC, offline operation, backup status.

## Sources

- Project context: `/media/saad/Data/Pharmacy/.planning/PROJECT.md` and `/media/saad/Data/Pharmacy/PRD.md`.
- SQLite Backup API official docs — online backups avoid live-file copy consistency issues and support snapshot backup: https://www.sqlite.org/backup.html (last updated 2025-11-13). Confidence: HIGH.
- SQLite WAL official docs — WAL has `-wal`/`-shm` files, checkpointing, concurrency, and copy/restore implications: https://www.sqlite.org/wal.html (last updated 2026-04-13). Confidence: HIGH.
- Google Drive API official overview — Drive API supports upload/download/search via OAuth 2.0 and should be treated as cloud storage integration, not local source of truth: https://developers.google.com/workspace/drive/api/guides/about-sdk (last updated 2026-04-20). Confidence: HIGH.
