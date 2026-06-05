# Architecture Patterns: PharmaCare

**Domain:** Offline-first single-branch pharmacy POS/inventory Windows desktop app  
**Stack context:** Tauri 2 + React + TypeScript + SQLite; PRD mentions Prisma, but architecture should keep authoritative business writes in Rust/Tauri commands unless a deliberate Node sidecar is accepted.  
**Researched:** 2026-06-05  
**Overall confidence:** HIGH for Tauri/SQLite boundaries; MEDIUM for Prisma-in-Tauri recommendation because it depends on packaging appetite.

## Recommended Architecture

Use a local-first layered desktop architecture where **SQLite is the source of truth**, **Rust owns all privileged operations and stock mutations**, and **React is a UI/client only**.

```text
React UI
  - screens, forms, keyboard POS, charts, PDF rendering
  - no direct stock mutation logic
        │
        ▼ invoke(command, DTO)
Tauri Command API / IPC Boundary
  - typed commands, validation, RBAC checks, error mapping
        │
        ▼
Rust Application Services
  - AuthService, MedicineService, PurchaseService, SaleService,
    ReturnService, StockLedgerService, ReportService, BackupService
        │
        ▼
Domain Rules + Transactions
  - FIFO allocation, expired-stock blocking, soft deletes,
    stock ledger, financial snapshots, invariants
        │
        ▼
SQLite Repository Layer
  - migrations, prepared queries, transaction helpers, indexes,
    WAL/checkpoint/backup utilities
        │
        ▼
Local App Data Directory
  - pharmacare.db, WAL/SHM while open, backup snapshots,
    logs, encrypted/OS-protected OAuth token material
        │
        ▼ background/owner-triggered only
Google Drive + Optional Local Folder Backups
```

## Core Recommendation: Do Not Let React Write SQLite Directly

Tauri's SQL plugin can expose SQL to the frontend, but for PharmaCare that is too much authority at the wrong layer. POS sales, purchases, returns, write-offs, refunds, and restore operations are business-critical and role-sensitive. They should be exposed as **intent commands** like `confirm_sale`, `record_purchase`, `process_customer_return`, not raw SQL from React.

If the project keeps Prisma, use it only in one of these two controlled ways:

1. **Preferred:** use Prisma schema/migrations as design input, but implement runtime DB access in Rust with `sqlx`/`rusqlite` through Tauri commands.
2. **Fallback:** package a Node sidecar that owns Prisma Client and exposes a narrow local IPC API to Rust. This adds packaging, process supervision, and security complexity; avoid unless Prisma productivity is worth that cost.

## Component Boundaries

| Component | Responsibility | Must Not Do | Communicates With |
|---|---|---|---|
| React UI | Render screens, collect input, local form state, keyboard POS navigation, optimistic read refreshes | Bypass RBAC, calculate authoritative stock/profit, write DB directly | Tauri commands only |
| Tauri Command API | Stable IPC surface, DTO validation, session lookup, role enforcement, structured errors | Contain large business workflows inline | Application services |
| AuthService | Login, bcrypt verification, session state, active-user checks, login attempt logs | Store plaintext passwords, expose hashes to UI | Users repository, AuditLog |
| Authorization/RBAC Guard | Owner/pharmacist permission checks per command and field-level masking | Rely only on hidden UI controls | All services |
| MedicineService | Medicine CRUD, active/inactive state, price validation, search projections | Change stock quantities directly without ledger | Medicine repository, StockService |
| PurchaseService | Supplier invoices, purchase items, batch creation, stock increase | Create batches without transaction/ledger entry | Supplier, Batch, StockLedger repositories |
| SaleService/POS | Confirm sale, validate availability, allocate FIFO batches, snapshot prices/costs, write sale items | Trust client totals or preselected batch allocations | StockService, Settings, Sales repositories |
| StockService / StockLedgerService | Only authority for stock-affecting mutations; append ledger entries | Allow negative remaining_qty, skip audit user/reason | Batches, stock_movements, domain services |
| ReturnService | Customer returns, supplier returns, resellable restore, write-offs, refunds/credit notes | Mutate original sale totals destructively | Sale, Batch, StockLedger, Reports |
| ReportService | Read-only aggregates, owner-only profit/COGS/margin reports, cashier-safe totals | Mutate data, leak purchase_price to pharmacist | Repositories, Settings |
| BackupService | Online snapshot backup, Google Drive upload, local folder copy, backup history, restore orchestration | Copy live WAL DB naively or auto-restore | SQLite backup utility, Drive client, filesystem |
| SettingsService | Pharmacy info, tax/discount policy, thresholds, backup config | Store secrets unprotected | Settings repository, OS keyring/Stronghold if used |

## Data Flow Direction

### Reads

```text
Screen mounts/searches
  → React query hook calls typed Tauri command
  → command checks session + role
  → service builds read model/query
  → repository reads SQLite
  → service masks restricted fields by role
  → DTO returned to React
```

Read DTOs should be screen-specific. Example: pharmacist medicine search returns `id, name, generic_name, unit, retail_price, available_qty, shelf_location`; owner inventory view may include `purchase_price`, margins, batch costs, and supplier history.

### Writes

```text
User submits intent
  → React sends minimal command payload
  → command validates shape + session
  → service re-reads authoritative DB state
  → service validates business rules
  → single SQLite transaction mutates records + stock ledger + audit logs
  → transaction commits
  → command returns receipt/summary DTO
  → React refreshes affected queries/dashboard counters
```

Never trust client-calculated totals, available stock, margins, tax, or discount authority. React may preview them for speed, but Rust must recompute at confirmation time.

## Transaction and Stock Mutation Rules

### Single Authority Rule

Only `StockService`/`StockLedgerService` may change `batches.remaining_qty` or derived stock counts. All stock-affecting modules call it.

### Required Stock Ledger

Add a `stock_movements` table early, even though the PRD schema omits it. It is the audit spine for stock accuracy.

Recommended fields:

```sql
stock_movements(
  id INTEGER PRIMARY KEY,
  movement_type TEXT NOT NULL, -- purchase|sale|customer_return|supplier_return|write_off|adjustment|restore
  medicine_id INTEGER NOT NULL,
  batch_id INTEGER,
  quantity_delta INTEGER NOT NULL, -- positive in, negative out
  reference_type TEXT NOT NULL, -- purchase|sale|return|manual_adjustment|restore
  reference_id INTEGER,
  reason TEXT,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Sale Confirmation Transaction

All of this must happen in one SQLite transaction:

1. Load settings: tax enabled/default, discount permissions, expiry thresholds.
2. Validate user can sell and discount if discount is present.
3. For each requested item, select non-expired active batches with `remaining_qty > 0`, ordered FIFO by `expiry_date ASC, received_date ASC, id ASC`.
4. Ensure total available quantity covers requested quantity.
5. Allocate requested quantity across one or more batches.
6. Insert `sales` row with server-computed subtotal, discount, tax, total, payment method, user.
7. Insert one `sale_items` row per allocated batch, snapshotting `unit_price`, `purchase_price_at_sale`/COGS source, discount, and line total.
8. Decrement each allocated batch's `remaining_qty`.
9. Insert matching negative `stock_movements` rows.
10. Commit, then return sale receipt DTO.

### Purchase Transaction

All of this must happen in one SQLite transaction:

1. Validate owner role.
2. Insert purchase invoice.
3. For each item, validate medicine exists/active, quantity > 0, purchase price >= 0, expiry date valid.
4. Insert purchase item.
5. Insert batch with `quantity = remaining_qty = purchased quantity`.
6. Link purchase item to batch.
7. Insert positive `stock_movements` row.
8. Commit.

### Return / Write-off Transaction

All of this must happen in one SQLite transaction:

- Customer return must not exceed original sold quantity minus prior returns.
- Resellable customer return should restore to the original batch when known; if original batch is unknown, restore to a special return batch only after owner-approved policy.
- Damaged/expired customer return logs refund/loss but does not increase sellable stock.
- Supplier return/write-off decrements the selected batch and logs loss/credit-note metadata.
- Never rewrite or delete the original sale/purchase; append return/write-off records and ledger movements.

## Domain-Critical Invariants

| Invariant | Enforcement Point |
|---|---|
| No sale can create negative batch `remaining_qty` | Sale transaction + DB CHECK where possible |
| Expired batches are blocked from POS allocation | StockService FIFO query |
| Stock changes are append-logged with user, reason, reference | StockLedgerService transaction helper |
| Sales are final; corrections are returns/refunds | UI workflow + no destructive edit commands |
| Medicines, users, suppliers are soft-deleted/deactivated, not hard-deleted | Repository commands only expose deactivate |
| At least one active owner always exists | UserService transaction guard |
| Purchase prices/profit/margins never reach pharmacist DTOs | Command RBAC + output masking tests |
| Cashier discounts depend on owner setting | SaleService recomputation |
| Backup restore is owner-only and never automatic | BackupService command guard + confirmation phrase |
| Backup snapshot must be consistent with WAL state | SQLite backup API/VACUUM INTO or clean checkpoint, not naive file copy while DB is active |

## SQLite Reliability Pattern

- Enable `PRAGMA journal_mode=WAL` for concurrent reads while writes occur. SQLite documents that WAL allows readers and writers to proceed concurrently, with a single writer at a time.
- Use `PRAGMA foreign_keys=ON` on every connection.
- Use `PRAGMA busy_timeout=5000` or equivalent retry handling for occasional `SQLITE_BUSY`.
- Keep write transactions short. Do not hold a transaction open while waiting on UI, network, or PDF export.
- Use indexes for POS and reports from the first schema milestone:
  - `medicines(name)`, `medicines(generic_name)`, possibly normalized search column.
  - `batches(medicine_id, expiry_date, received_date, remaining_qty)`.
  - `sales(sale_date)`, `sale_items(medicine_id)`, `stock_movements(created_at, medicine_id, batch_id)`.
- For backups, prefer SQLite's online backup API or `VACUUM INTO` to produce a consistent snapshot. If copying files manually in WAL mode, the `-wal` and `-shm` state matters while connections are open; avoid naive DB-file-only copies.

## Security Boundaries

### Local Auth Boundary

- Store bcrypt hashes only.
- Keep active session in Rust-managed state, not just browser local storage.
- Every command receives/derives session context server-side and checks role.
- Log successful and failed login attempts.

### IPC Boundary

- Expose narrow intent commands, not generic SQL or filesystem commands.
- Use Tauri permissions/capabilities minimally. Tauri docs note plugin commands are blocked by default and must be enabled explicitly; keep file, shell, SQL, and HTTP scopes narrow.
- Do not enable broad `sql:allow-execute` to React for production PharmaCare.

### Field-Level Confidentiality

- Owner-only: purchase prices, COGS, margins, P&L, supplier payment status, backup/restore, user management, settings.
- Pharmacist-safe: POS, current sellable stock, retail price, daily non-profit sales total if allowed by PRD.
- Implement masking in backend DTO assembly; hidden UI columns are not security.

### Backup/Restore Boundary

- Backup may run in background, but restore must be foreground, owner-only, and require explicit confirmation.
- Before restore: close DB pool/connections, create pre-restore backup, verify selected backup file size/checksum/schema version, replace DB atomically, restart app.
- Google OAuth tokens should be stored in OS-protected storage/Tauri Stronghold or equivalent, not plaintext in `settings`.

## Backup Data Flow

```text
Scheduler or Owner clicks Backup Now
  → BackupService checks no restore is running
  → create consistent SQLite snapshot to temp file
  → compute checksum + metadata record
  → upload snapshot to Google Drive PharmaCare folder if online
  → copy snapshot to local folder if configured
  → prune old remote/local backups to retention policy
  → update backup_history + dashboard status
```

Restore:

```text
Owner selects backup
  → BackupService downloads/copies to temp
  → validate file opens, schema version compatible, checksum if known
  → create pre-restore snapshot of current DB
  → close DB connections and block commands
  → atomic replace database files
  → restart app and force login
```

## Suggested Build Order

Roadmap should be dependency-driven, not screen-driven. Build the mutation spine before reports and polish.

1. **Foundation and DB runtime**
   - Tauri + React shell, app data paths, SQLite connection, migrations, WAL/foreign keys/busy timeout, error conventions.
   - Decide now: Rust `sqlx`/`rusqlite` runtime vs Prisma sidecar. Do not postpone this.

2. **Security/session/RBAC foundation**
   - Users, bcrypt login, session state in Rust, command guards, login audit.
   - Seed first owner and enforce at-least-one-owner invariant.

3. **Core catalog and read models**
   - Medicines, suppliers, settings skeleton, soft delete pattern, search indexes.
   - Include role-masked DTOs from the start.

4. **Stock spine before POS**
   - Batches, stock_movements ledger, StockService transaction helper, low-level invariant tests.
   - This should precede or be merged before purchase/POS so every later mutation uses the same path.

5. **Purchasing and batch intake**
   - Supplier purchase transaction creates batches and positive ledger entries.
   - This provides real stock for POS testing.

6. **POS sale confirmation**
   - Keyboard UI can evolve iteratively, but backend sale transaction/FIFO allocation must be complete before claiming end-to-end sales.
   - Include expired-stock blocking and no-negative-stock tests.

7. **Returns, supplier returns, write-offs**
   - Append-only corrections and loss/refund handling.
   - Build before final analytics so reports reflect real adjustments.

8. **Alerts and dashboards**
   - Low stock, zero stock, expiry, missed backup are read models over the mutation spine.

9. **Reports and PDF exports**
   - Owner-only aggregates, COGS/profit from sale item cost snapshots/ledger.
   - Cashier-safe totals separately tested.

10. **Backup/restore hardening**
   - Manual backup first, then scheduler, then Drive OAuth/upload/pruning, then restore.
   - Restore should wait until schema stabilizes enough to validate versions.

11. **Settings, user management, polish, performance**
   - Full settings can be completed after core services exist, but settings read paths needed earlier for tax/discount/expiry thresholds.

## Patterns to Follow

### Intent Command Pattern

**What:** React calls `confirm_sale(payload)` instead of SQL statements.  
**Why:** keeps audit, RBAC, stock invariants, and financial calculations in one trusted layer.

```typescript
// React: preview is okay, authority is not.
await invoke<SaleReceipt>("confirm_sale", {
  cartItems: [{ medicineId: 12, quantity: 2, itemDiscount: 0 }],
  billDiscount: 0,
  paymentMethod: "cash",
});
```

```rust
// Rust command delegates immediately to service.
#[tauri::command]
async fn confirm_sale(
  state: tauri::State<'_, AppState>,
  payload: ConfirmSaleDto,
) -> Result<SaleReceiptDto, AppError> {
  let session = state.sessions.require_current()?;
  state.services.sales.confirm_sale(session, payload).await
}
```

### Transaction Script for Stock Mutations

**What:** For each stock-affecting operation, write a short, explicit transaction script.  
**Why:** Pharmacy inventory bugs are usually cross-table consistency bugs, not UI bugs.

### Append-Only Corrections

**What:** Returns, write-offs, and credit notes add records; they do not edit/delete historical sales/purchases.  
**Why:** preserves auditability and makes reports explainable.

## Anti-Patterns to Avoid

### Raw SQL From React

**Why bad:** bypasses role checks, makes stock invariants unenforceable, risks exposing purchase prices, and makes audit incomplete.  
**Instead:** Tauri intent commands + Rust services.

### `current_stock` as the Only Source of Truth

**Why bad:** denormalized stock drifts when returns/write-offs fail halfway.  
**Instead:** batch `remaining_qty` + stock ledger as authority; optional cached `current_stock` only if maintained transactionally and rebuildable.

### Copying `pharmacare.db` While WAL Is Active

**Why bad:** SQLite WAL mode may have committed data in WAL files while the DB file alone is stale.  
**Instead:** online backup API, `VACUUM INTO`, or controlled checkpoint/connection-close snapshot.

### Building Reports Before Corrections

**Why bad:** early reports will count revenue/profit incorrectly once returns and write-offs arrive.  
**Instead:** finish sale cost snapshots and return/write-off semantics before final financial reports.

## Roadmap Implications

- Move **stock ledger/batch mutation spine earlier** than the PRD's original phase order if possible. Purchases can create stock before POS, or seed/import can create initial batches; either way POS should not be implemented against a fake `current_stock` model.
- Treat **Auth/RBAC as Phase 1 infrastructure**, not polish, because it shapes every command and DTO.
- Treat **backup snapshot correctness** as architecture work, not just UI integration. Implement local/manual snapshot before Google Drive OAuth.
- Reports should be **read-only projections over stable transaction records**; do not build owner P&L until COGS snapshots and return adjustments are defined.

## Sources

- Tauri docs, “Calling Rust from the Frontend” — commands, async commands, typed invoke boundary; last updated 2025-11-19. https://v2.tauri.app/develop/calling-rust/
- Tauri docs, “State Management” — managed Rust state and mutex guidance; last updated 2025-05-07. https://v2.tauri.app/develop/state-management/
- Tauri docs, “Permissions” — plugin/command permissions and capabilities; last updated 2025-04-08. https://v2.tauri.app/security/permissions/
- Tauri SQL plugin docs — frontend SQL plugin, migrations, permissions; last updated 2025-11-04. https://v2.tauri.app/plugin/sql/
- Tauri docs, “Node.js as a sidecar” — packaging Node apps as sidecars; last updated 2026-01-07. https://v2.tauri.app/learn/sidecar-nodejs/
- SQLite docs, “Write-Ahead Logging” — WAL concurrency, checkpoints, WAL file behavior; last updated 2026-04-13. https://www.sqlite.org/wal.html
- SQLite docs, “SQLite Backup API” — consistent online backup snapshots; last updated 2025-11-13. https://www.sqlite.org/backup.html
- Prisma Client API reference — transactions/upserts and Prisma runtime model; fetched 2026-06-05. https://www.prisma.io/docs/orm/reference/prisma-client-reference
