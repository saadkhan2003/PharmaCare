# Phase 4: Returns & Operational Corrections - Research

**Researched:** 2026-06-05
**Domain:** Returns processing, stock corrections, loss logging, append-only financial adjustments
**Confidence:** HIGH

## Summary

Phase 4 delivers three return/correction workflows — customer returns (sale lookup, condition-based stock handling), supplier returns (batch selection, credit note), and write-offs (expired/damaged loss logging) — plus the append-only `returns` table that feeds into financial reporting. The implementation follows the same established Rust three-layer pattern (repository → service → commands) with atomic transactions, StockLedgerService as the single stock mutation authority, and role-based guards (customer return for both roles, supplier return/write-off for owner only).

The key architectural insight is that `StockLedgerService::record_movement` already validates `customer_return`, `supplier_return`, and `write_off` movement types — no changes needed there. The work is: create Migration 004 (`returns` table), `increment_remaining_qty` in batch_repo, `return_repo`, `return_service` (three atomic transaction orchestration functions), `return_commands`, and the React UI pages.

**Primary recommendation:** Build backend first (migration → repo → service → commands → register in main.rs), then frontend (types → page components → sidebar nav → App routing). The three transaction patterns are nearly identical in structure, differing only in validation rules and stock handling logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Customer return (sale lookup) | API / Backend | Client (UI) | Backend owns validation logic (D-46: qty <= original), sale search query, atomic tx. Client only renders search results and collects form input. |
| Condition-based stock handling | API / Backend | — | StockLedgerService is single authority (D-22). Decision to restore vs write-off is backend business logic based on condition field — client never decides stock mutations. |
| Supplier return (batch select) | API / Backend | — | Supplier lookup and batch ownership validated server-side. Credit note recorded in atomic tx with stock deduction. |
| Write-off logging | API / Backend | — | Pure backend operation — loss records and stock deduction atomic one-shot. |
| Return form UI | Client | — | Three forms (customer return search, supplier batch return, write-off) are stateless data collection. All validation returns server errors. |
| Financial adjustment for reports | API / Backend | — | Refund totals and loss aggregates computed server-side in query. Reports in Phase 5 will consume `returns` table aggregates. |

## Standard Stack

### Core — Same established stack, no new libraries needed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | (established) | SQLite for returns table, transactional atomicity | Existing D-01 pattern |
| serde / serde_json | (established) | DTO serialization for return commands | Existing pattern in all commands |
| tauri | 2.x | IPC surface for return commands | Already registered as all existing commands |

### Supporting — No new supporting libraries needed.

**Installation:**
```bash
# No new npm/cargo packages needed — all dependencies are already in the project.
```

**Version verification:** All packages are already in `Cargo.toml` and `package.json`. No new package additions required for this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        REACT UI LAYER                           │
│                                                                 │
│  ┌─────────────────────┐  ┌──────────────────────┐              │
│  │ CustomerReturnPage   │  │ SupplierReturnPage    │  WriteOff  │
│  │  ┌─────────────────┐ │  │  ┌──────────────────┐│  Page      │
│  │  │ SaleSearchPanel  │ │  │  │ SupplierBatchList ││            │
│  │  │ (by ID / date)   │ │  │  │ (unsold batches) ││            │
│  │  └────────┬────────┘ │  │  └────────┬─────────┘│            │
│  │           │           │  │           │           │            │
│  │  ┌────────▼────────┐ │  │  ┌────────▼─────────┐│            │
│  │  │ ItemSelectPanel  │ │  │  │ CreditNoteForm    ││            │
│  │  │ (qty ≤ original) │ │  │  │ (refund amount)   ││            │
│  │  │ + condition ddl  │ │  │  └──────────────────┘│            │
│  │  └────────┬────────┘ │  └──────────┬───────────┘            │
│  │           │           │             │                         │
│  │  ┌────────▼────────┐ │  ┌──────────▼───────────┐             │
│  │  │ ConfirmReturn    │ │  │ ConfirmReturn         │            │
│  │  │ (refund amount)  │ │  │ (credit note total)   │            │
│  │  └────────┬────────┘ │  └──────────┬───────────┘             │
│  └───────────┼─────────┘  └──────────┼──────────────────────────┘
│              │                        │                           
│              │  Tauri IPC (invoke)    │                           
│              ▼                        ▼                           
└──────────────────────────────────────────────────────────────────┘
                         │                ▲
                         ▼                │
┌──────────────────────────────────────────────────────────────────┐
│                      RUST BACKEND LAYER                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 return_commands.rs                        │    │
│  │  process_customer_return(search + confirm)                │    │
│  │  process_supplier_return(batch select + confirm)          │    │
│  │  process_write_off(batch + confirm)                       │    │
│  │  search_sales_for_return(sale lookup)                     │    │
│  │  list_returnable_batches(supplier batch list)             │    │
│  │  get_return_history()                                     │    │
│  └──────────────────────┬───────────────────────────────────┘    │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐    │
│  │                  return_service.rs                        │    │
│  │                                                          │    │
│  │  process_customer_return(db, payload, user_id)           │    │
│  │    │ 1. Validate: sale exists, items match, qty ≤ orig   │    │
│  │    │ 2. Open atomic Transaction                          │    │
│  │    │ 3. INSERT returns row                                │    │
│  │    │ 4. IF resellable: batch_repo::increment_remaining   │    │
│  │    │    (positive stock_movement, "customer_return")      │    │
│  │    │ 5. IF damaged/expired: ("write_off" movement)        │    │
│  │    │ 6. COMMIT                                            │    │
│  │    │ 7. Return ReturnReceiptDto                           │    │
│  │                                                          │    │
│  │  process_supplier_return(db, payload, user_id)           │    │
│  │    │ 1. Validate: batch exists, qty ≤ remaining_qty      │    │
│  │    │ 2. Open atomic Transaction                          │    │
│  │    │ 3. INSERT returns row (return_type='supplier')       │    │
│  │    │ 4. batch_repo::decrement_remaining_qty              │    │
│  │    │    (negative stock_movement, "supplier_return")      │    │
│  │    │ 5. COMMIT                                            │    │
│  │                                                          │    │
│  │  process_write_off(db, payload, user_id)                 │    │
│  │    │ 1. Validate: batch exists, qty ≤ remaining_qty      │    │
│  │    │ 2. Open atomic Transaction                          │    │
│  │    │ 3. INSERT returns row (return_type='write_off')      │    │
│  │    │ 4. batch_repo::decrement_remaining_qty              │    │
│  │    │    (negative stock_movement, "write_off")            │    │
│  │    │ 5. COMMIT                                            │    │
│  └──────────────────────┬───────────────────────────────────┘    │
│                         │                                        │
│  ┌──────────────────────▼───────────────────────────────────┐    │
│  │               return_repo.rs                             │    │
│  │  insert_return(conn, return_type, reference_id, ...)     │    │
│  │  find_returns_by_reference(conn, reference_type, id)     │    │
│  │  find_all_returns(conn, filters)                         │    │
│  └──────────────────────┬───────────────────────────────────┘    │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐    │
│  │  stock_ledger_repo (unchanged)    batch_repo (+increment)  │    │
│  │  sale_repo (sale lookup queries)  purchase_repo (lookup)   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│                    SQLite (wal_mode=WAL)                         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  returns table  (new, Migration 004)                      │    │
│  │  stock_movements (append)                                 │    │
│  │  batches (remaining_qty updated)                          │    │
│  │  sales / sale_items (read-only — immutable reference)     │    │
│  │  purchases / purchase_items (read-only — supplier ref)    │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
# New backend files:
src-tauri/src/
├── migrations/
│   └── 004_returns/
│       └── up.sql                          # returns table + indexes
├── models/
│   └── return_.rs (or add to mod.rs)       # Return, ReturnItem DTOs
├── repository/
│   ├── mod.rs (+ pub mod return_repo;)     # + return_repo
│   └── return_repo.rs                      # insert_return, query functions
├── services/
│   ├── mod.rs (+ pub mod return_service;)  # + return_service
│   └── return_service.rs                   # 3 atomic transaction orchestrators
├── commands/
│   ├── mod.rs (+ pub mod return_commands;)
│   └── return_commands.rs                  # 5-6 Tauri commands
├── main.rs                                 # register new commands in generate_handler![]

# New frontend files:
src/
├── types/
│   └── return.ts                           # Return DTOs, process payloads
├── lib/
│   └── tauri.ts (+ returns: { ... })       # Tauri API wrappers
├── pages/
│   ├── CustomerReturnPage.tsx              # Customer return flow (3-step)
│   ├── SupplierReturnPage.tsx              # Supplier return flow (2-step)
│   ├── WriteOffPage.tsx                    # Write-off page
│   └── ReturnHistoryPage.tsx               # Return history view (owner only)
├── components/
│   └── returns/
│       ├── SaleSearchPanel.tsx             # Sale search reused from POS pattern
│       ├── CustomerReturnForm.tsx          # Item select + condition + refund
│       ├── SupplierBatchSelect.tsx         # Supplier + batch selection
│       └── ReturnReceiptDialog.tsx         # Return confirmation receipt
├── App.tsx                                 # Add return routes
└── components/layout/
    └── Sidebar.tsx                         # Add Returns nav item
```

### Pattern 1: Atomic Return Transaction — Customer Return
**What:** Three-phase validation + atomic transaction with conditional stock handling.
**When to use:** Every return operation (customer, supplier, write-off) uses this pattern — only the validation rules and stock mutation differ.
**Example:**
```rust
// Source: [VERIFIED: existing purchase_service.rs pattern — D-33 atomic pattern]

/// Customer return: atomic transaction with conditional stock handling (D-44, D-45).
///
/// PHASES:
/// 1. Validate ALL items BEFORE opening transaction
///    - Sale exists, items belong to sale
///    - Return qty <= original qty per item (D-46)
/// 2. Open rusqlite::Transaction
/// 3. For each return item:
///    a. INSERT returns record
///    b. IF condition == "resellable":
///       - batch_repo::increment_remaining_qty (stock restore to original batch)
///       - record_movement("customer_return", +qty)
///    c. IF condition == "damaged" || condition == "expired":
///       - record_movement("write_off", -qty) (stock already gone, log as loss)
/// 4. COMMIT — ALL or NOTHING
/// 5. Return ReturnReceiptDto
pub fn process_customer_return(
    db: &mut Connection,
    payload: &ProcessCustomerReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // --- PHASE 1: Pre-transaction validation ---
    let sale = sale_repo::find_by_id(db, payload.sale_id)?
        .ok_or_else(|| CommandError::not_found("Sale"))?;

    let sale_items = sale_repo::find_items_by_sale(db, payload.sale_id)?;

    // Validate that sale has items
    if sale_items.is_empty() {
        return Err(CommandError::validation("Sale has no items"));
    }

    // Validate each return item against original sale items
    let mut refund_total = 0.0_f64;
    for item in &payload.items {
        // Find matching original sale item
        let original = sale_items.iter()
            .find(|si| si.batch_id == item.batch_id && si.medicine_id == item.medicine_id)
            .ok_or_else(|| CommandError::validation(&format!(
                "Item (medicine {}, batch {}) not found in sale",
                item.medicine_id, item.batch_id
            )))?;

        // D-46: Cannot exceed original quantity
        if item.quantity > original.quantity {
            return Err(CommandError::validation(&format!(
                "Return quantity {} exceeds original quantity {} for item",
                item.quantity, original.quantity
            )));
        }

        // Validate condition
        match item.condition.as_str() {
            "resellable" | "damaged" | "expired" => {}
            _ => return Err(CommandError::validation(&format!(
                "Invalid condition: {}", item.condition
            ))),
        }

        // Accumulate refund total (D-47: refund amount can differ from original price)
        if item.refund_amount < 0.0 {
            return Err(CommandError::validation("Refund amount cannot be negative"));
        }
        refund_total += item.refund_amount;
    }

    // --- PHASE 2: Open atomic transaction ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Process each return item ---
    for item in &payload.items {
        // D-48: INSERT returns record
        return_repo::insert_return(
            &tx,
            "customer",                 // return_type
            Some(payload.sale_id),      // reference_id
            item.medicine_id,
            Some(item.batch_id),
            item.quantity,
            &item.reason,
            &item.condition,
            item.refund_amount,
            user_id,
        )?;

        // D-45: Condition-based stock handling
        match item.condition.as_str() {
            "resellable" => {
                // Restore stock to original batch
                batch_repo::increment_remaining_qty(&tx, item.batch_id, item.quantity)?;

                // Positive stock movement (D-22)
                stock_ledger_service::record_movement(
                    &tx,
                    "customer_return",
                    item.medicine_id,
                    Some(item.batch_id),
                    item.quantity,  // positive delta
                    "return",
                    Some(payload.sale_id),
                    Some(&format!("Customer return: {}", item.reason)),
                    user_id,
                )?;
            }
            "damaged" | "expired" => {
                // No stock restoration — log as write-off movement (D-45)
                // Items are already sold, so stock isn't in inventory.
                // We record a zero-impact write-off movement to log the loss.
                stock_ledger_service::record_movement(
                    &tx,
                    "write_off",
                    item.medicine_id,
                    Some(item.batch_id),
                    -(item.quantity),  // negative delta (loss)
                    "return",
                    Some(payload.sale_id),
                    Some(&format!("{} customer return: {}", item.condition, item.reason)),
                    user_id,
                )?;
            }
            _ => unreachable!(),
        }
    }

    // --- PHASE 4: COMMIT ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit return transaction: {}", e))
    })?;

    Ok(ReturnReceiptDto {
        return_id: /* last insert id from repo */,
        return_type: "customer".into(),
        reference_id: payload.sale_id,
        refund_total,
        item_count: payload.items.len() as i64,
    })
}
```

### Pattern 2: Supplier Return / Write-off Atomic Transaction
**What:** Stock deduction from inventory with credit note or loss recording.
**When to use:** Both supplier returns and write-offs follow this simpler pattern (no sale lookup needed).
**Example:**
```rust
// Source: [VERIFIED: supplier_return and write_off both decrement from existing batch stock]

pub fn process_supplier_return(
    db: &mut Connection,
    payload: &ProcessSupplierReturnDto,
    user_id: i64,
) -> Result<ReturnReceiptDto, CommandError> {
    // Validate batch exists and has sufficient stock
    let batch = batch_repo::find_by_id(db, payload.batch_id)?
        .ok_or_else(|| CommandError::not_found("Batch"))?;

    // D-51: Only unsold quantity can be returned
    let unsold = batch.remaining_qty;
    if payload.quantity > unsold {
        return Err(CommandError::validation(&format!(
            "Cannot return {} units — only {} unsold units available",
            payload.quantity, unsold
        )));
    }

    let tx = db.transaction()?;

    return_repo::insert_return(
        &tx,
        "supplier",
        Some(batch.purchase_id),  // reference to purchase
        batch.medicine_id,
        Some(payload.batch_id),
        payload.quantity,
        &payload.reason,
        "",                       // no condition for supplier return
        payload.credit_amount,
        user_id,
    )?;

    // D-50: Decrement stock
    batch_repo::decrement_remaining_qty(&tx, payload.batch_id, payload.quantity)?;

    // Negative stock movement (D-22)
    stock_ledger_service::record_movement(
        &tx,
        "supplier_return",
        batch.medicine_id,
        Some(payload.batch_id),
        -(payload.quantity as i64),
        "return",
        Some(payload.batch_id),
        Some(&payload.reason),
        user_id,
    )?;

    tx.commit()?;

    Ok(ReturnReceiptDto { ... })
}
```

### Anti-Patterns to Avoid
- **Editing sale totals instead of appending returns:** Returns are correction records, never reduce the original sale total. Reports compute `revenue - refunds`.
- **Hard-deleting or zeroing return records:** All returns are append-only. The `returns` table stores the full audit trail.
- **Dual-path stock mutations:** Never directly update `batches.remaining_qty` from a return command — always go through `StockLedgerService::record_movement` + `batch_repo::increment/decrement` inside a transaction.
- **Letting React compute refund amounts:** Server-side always recomputes totals from validated inputs (same D-35 pattern as sale_service).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite transactions | Manual BEGIN/COMMIT without error handling | `rusqlite::Transaction` with `tx.commit()` / automatic rollback on drop | Handles guard dropping, nested errors, and automatic rollback on panic. Already used in purchase_service and sale_service. |
| Session/auth validation | Ad-hoc token checking per command | `require_session()` / `require_owner()` guards | Already implemented in guards.rs. Consistent RBAC across all commands. |
| Stock mutations | Direct SQL UPDATE batches.remaining_qty | `batch_repo::decrement_remaining_qty` / new `increment_remaining_qty` | Both include CHECK constraints preventing over-deduction. Single authority pattern. |

**Key insight:** This phase introduces zero new technology. Every pattern (atomic transaction, repo/service/command layers, StockLedgerService, role guards, immutable receipts) is already established. The only new Rust code is `increment_remaining_qty` in batch_repo and the three service orchestrator functions.

## Common Pitfalls

### Pitfall 1: Restoring to Wrong Batch
**What goes wrong:** On customer return with `resellable` condition, the stock is restored to a random batch instead of the original batch it was sold from.
**Why it happens:** The return form doesn't capture which batch was sold — just the medicine.
**How to avoid:**
- The customer return payload uses `item.batch_id` (the batch it was deducted from at sale time) — stock restores to that EXACT batch (D-45).
- The `ProcessCustomerReturnItemDto` includes `batch_id: i64` and `medicine_id: i64`.
- The batch_id is displayed in the return form from the sale_items lookup.
```rust
// D-45: Resellable restores to original batch
// batch_id here is the batch_id from sale_items — NOT user-selected
batch_repo::increment_remaining_qty(&tx, item.batch_id, item.quantity)?;
```

### Pitfall 2: Over-Restoring Stock
**What goes wrong:** If a customer returns the same item twice, the system restores stock both times, exceeding the original quantity.
**Why it happens:** No guard against duplicate customer return processing for the same sale items.
**How to avoid:**
- Validate against cumulative returns per sale item (query `returns` table SUM for the sale_id/item before allowing).
- Alternatively, trust that the pharmacist won't process the same sale twice (pragmatic for v1). The D-46 check prevents returning more than original quantity per invocation, but across multiple invocations it could exceed. Document as v1 limitation; flag for Phase 5 reporting.

### Pitfall 3: Refunds Counted as Sales (Double-Counting Revenue)
**What goes wrong:** Sales reports sum `sales.total` and this includes returns as revenue, inflating reported earnings.
**Why it happens:** The report query doesn't subtract refunds.
**How to avoid:**
- In Phase 5 (Reports), sales queries must use `sales.total - COALESCE(SUM(returns.refund_amount), 0)` for net revenue.
- Phase 4 stores refund amounts correctly in `returns.refund_amount` for this purpose. Write-off losses are tracked separately via `stock_movements WHERE movement_type = 'write_off'`.

### Pitfall 4: Supplier Credit Note Amount NOT Validated
**What goes wrong:** Owner enters a negative or zero credit note amount.
**Why it happens:** No validation on the credit_amount field.
**How to avoid:** Validate `credit_amount > 0` before opening the transaction. Return a `VALIDATION` error.

## Code Examples

### Migration 004: returns table
```sql
-- Source: [VERIFIED: PRD §6 + decisions D-48, D-52, D-53]

-- Returns: customer returns, supplier returns, and write-offs
CREATE TABLE returns (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    return_type      TEXT NOT NULL CHECK(return_type IN ('customer', 'supplier', 'write_off')),
    reference_id     INTEGER,             -- sale_id (customer), purchase_id (supplier), NULL (write_off)
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    batch_id         INTEGER REFERENCES batches(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    reason           TEXT NOT NULL,
    condition        TEXT,                -- 'resellable' | 'damaged' | 'expired' (NULL for supplier returns)
    refund_amount    REAL NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
    processed_by     INTEGER NOT NULL REFERENCES users(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_returns_type ON returns(return_type);
CREATE INDEX idx_returns_reference ON returns(reference_id);
CREATE INDEX idx_returns_batch ON returns(batch_id);
CREATE INDEX idx_returns_date ON returns(created_at);
```

### batch_repo: increment_remaining_qty
```rust
// Source: [VERIFIED: mirrors existing decrement_remaining_qty pattern in batch_repo.rs]
/// Increments remaining_qty on a batch (for customer returns — stock restoration).
/// Uses CHECK constraint: remaining_qty <= quantity to prevent exceeding original batch qty.
pub fn increment_remaining_qty(conn: &Connection, batch_id: i64, increment_by: i64) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE batches SET remaining_qty = remaining_qty + ?2 WHERE id = ?1 AND remaining_qty + ?2 <= quantity",
        rusqlite::params![batch_id, increment_by],
    )?;
    Ok(())
}
```

### DTO: ProcessCustomerReturnDto (Rust models)
```rust
// Source: [VERIFIED: follows ConfirmSaleDto pattern in models/sale.rs]

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerReturnItemDto {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub quantity: i64,
    pub condition: String,    // "resellable" | "damaged" | "expired"
    pub reason: String,
    pub refund_amount: f64,   // D-47: can differ from original price
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessCustomerReturnDto {
    pub sale_id: i64,
    pub items: Vec<CustomerReturnItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSupplierReturnDto {
    pub batch_id: i64,
    pub quantity: i64,
    pub reason: String,
    pub credit_amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessWriteOffDto {
    pub batch_id: i64,
    pub quantity: i64,
    pub condition: String,    // "expired" | "damaged"
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnReceiptDto {
    pub return_id: i64,
    pub return_type: String,
    pub reference_id: Option<i64>,
    pub refund_total: f64,
    pub item_count: i64,
    pub created_at: String,
}

// Sale search result for customer return (D-44)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReturnSearchDto {
    pub id: i64,
    pub subtotal: f64,
    pub total: f64,
    pub payment_method: String,
    pub customer_name: Option<String>,
    pub created_at: String,
    pub items: Vec<SaleReturnItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaleReturnItemDto {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub medicine_name: String,
    pub quantity: i64,          // original quantity sold — the max that can be returned
    pub unit_price: f64,
    pub line_total: f64,
    pub already_returned: i64,  // sum of quantities already returned for this item
    pub returnable_qty: i64,    // quantity - already_returned (D-46 enforcement)
}
```

### return_repo: Return table operations
```rust
// Source: [VERIFIED: follows purchase_repo.rs / sale_repo.rs insert pattern]
pub fn insert_return(
    conn: &Connection,
    return_type: &str,
    reference_id: Option<i64>,
    medicine_id: i64,
    batch_id: Option<i64>,
    quantity: i64,
    reason: &str,
    condition: Option<&str>,
    refund_amount: f64,
    user_id: i64,
) -> Result<i64, rusqlite::Error> {
    conn.execute(
        "INSERT INTO returns (return_type, reference_id, medicine_id, batch_id, \
         quantity, reason, condition, refund_amount, processed_by) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            return_type,
            reference_id,
            medicine_id,
            batch_id,
            quantity,
            reason,
            condition,
            refund_amount,
            user_id,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Returns total quantity already returned for a specific sale item (medicine + batch).
/// Used for D-46 enforcement across multiple returns of the same sale.
pub fn get_returned_qty_for_sale_item(
    conn: &Connection,
    sale_id: i64,
    medicine_id: i64,
    batch_id: i64,
) -> Result<i64, rusqlite::Error> {
    conn.query_row(
        "SELECT COALESCE(SUM(quantity), 0) FROM returns \
         WHERE return_type = 'customer' AND reference_id = ?1 \
           AND medicine_id = ?2 AND batch_id = ?3",
        rusqlite::params![sale_id, medicine_id, batch_id],
        |row| row.get(0),
    )
}

pub fn find_returns_by_type(
    conn: &Connection,
    return_type: &str,
) -> Result<Vec<...>, rusqlite::Error> {
    // Returns list with joined medicine name, user name
}
```

### ReturnService: process_customer_return signature and orchestration
Complete function already shown in Pattern 1 above.

### Frontend: CustomerReturnPage skeleton pattern
```typescript
// Source: [VERIFIED: matches PurchaseForm.tsx pattern]
// The three-step UI follows the form pattern: search → select → confirm

// Step 1: Search sale by ID or date range
// Pattern matches POSSearchPanel — debounced input, returned results list
// Uses: tauri.returns.searchSalesForReturn(sessionToken, query)

// Step 2: Select items, set condition, enter refund amount
// Shows sale_items with quantity, unit_price, returnable_qty (quantity - already_returned)
// Condition dropdown: "resellable" | "damaged" | "expired" (RETN-02)
// Quantity input limited to returnable_qty (RETN-06)
// Refund amount defaults to unit_price but is editable (D-47)

// Step 3: Confirm with reason
// Calls: tauri.returns.processCustomerReturn(sessionToken, payload)
// Shows ReturnReceiptDialog with refund total
```

### Frontend: Sidebar navigation addition
```typescript
// Add to sidebar nav items when user has owner role OR for customer return when any role
// Returns groups: customer return (both roles), supplier return (owner), write-off (owner)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual corrections (edit sale totals) | Append-only returns table with transactions | Phase 4 implementation | Financial reports compute revenue - refunds; sale totals are immutable |
| Paper-based supplier credits | Returns table with credit amount, linked to purchase | Phase 4 implementation | Full audit trail, loss tracking for P&L reports |

**Deprecated/outdated:**
- **Direct stock adjustment as "catch-all":** The existing `adjustment` movement_type in StockLedgerService is for unsupported edge cases. Returns and write-offs each have their own typed movement for audit traceability.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stock restoration via `increment_remaining_qty` with `remaining_qty + increment_by <= quantity` CHECK constraint is sufficient for customer resellable returns | batch_repo increment | If batches can be partially sold and partially returned, the returned stock might exceed original `quantity`, which the CHECK prevents. Acceptable — the batch's `quantity` records the original receipt, so it's correct to cap there. |
| A2 | Supplier returns reference `purchase_id` via `batches.purchase_id` (batch knows its purchase) | return_service | Verified: batches table has `purchase_id` NOT NULL. Supplier return does NOT need a separate purchase lookup — batch already links back. |
| A3 | Owner-only commands for supplier return and write-off use `require_owner` guard | commands | CONTEXT.md states "customer return for both roles, supplier return/write-off for owner only". Verify with user during discuss-phase. |
| A4 | Returns are not editable after creation — no "reverse return" feature in v1 | architecture | If the user later needs to undo a return, Phase 5 could add a correction mechanism. For v1, returns are final. |

## Open Questions

1. **Should "already_returned" cumulative check be implemented in v1?**
   - What we know: D-46 says "returns cannot exceed original quantity". A single invocation is validated server-side. Cross-invocation (returning the same sale items on two separate days) could exceed the limit.
   - What's unclear: Whether the pharmacist would actually do this, and whether the validation complexity is worth the edge case protection.
   - Recommendation: Implement the cumulative check via `get_returned_qty_for_sale_item()` in the service layer. It adds ~5 lines of SQL and prevents an audit inconsistency. LOW cost, HIGH integrity value.

2. **Refund amount — what is the default?**
   - What we know: D-47 says "refund amount can differ from original price". The UI needs a sensible default.
   - What's unclear: Should the default refund be the full unit_price (from sale_items) or line_total (after discount)?
   - Recommendation: Default to `line_total / quantity` (per-unit post-discount price) in the frontend, but allow the user to override. The server doesn't enforce any relationship between refund_amount and the original price — it just validates > 0.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Compilation | ✓ (from prior phases) | — | — |
| Tauri CLI | Build | ✓ (from prior phases) | 2.x | — |
| SQLite (rusqlite) | Runtime | ✓ (existing) | — | — |

**Missing dependencies with no fallback:** None — all dependencies are already established in the project.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

Phase 4 adds no new test framework. The project already uses Rust's built-in `#[cfg(test)]` module tests (or similar pattern from prior phases). Unit test patterns follow the established style in existing services.

| Property | Value |
|----------|-------|
| Framework | Rust `#[cfg(test)]` module tests + cargo test |
| Config file | Cargo.toml (existing) |
| Quick run command | `cargo test --package pharmacare` |
| Full suite command | `cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETN-01 | Customer return by sale search | integration | test in return_service | ❌ Wave 0 |
| RETN-02 | Return condition recorded (resellable, damaged, expired) | unit | test in return_service | ❌ Wave 0 |
| RETN-03 | Resellable restores stock | integration | test in return_service | ❌ Wave 0 |
| RETN-04 | Damaged/expired writes off + loss log | integration | test in return_service | ❌ Wave 0 |
| RETN-05 | Supplier return with credit note | integration | test in return_service | ❌ Wave 0 |
| RETN-06 | Return qty <= original qty | unit | test in return_service | ❌ Wave 0 |
| RETN-07 | Returns logged with reason, date, user | unit | test in return_repo | ❌ Wave 0 |
| RETN-08 | Refund recorded correctly for financial reports | integration | test in return_service | ❌ Wave 0 |
| BATC-05 | Batch mark as returned/written off | integration | test in return_service | ❌ Wave 0 |
| BATC-06 | Written-off stock deducted + loss logged | integration | test in return_service | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo build` (compilation check)
- **Per wave merge:** `cargo test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/return_service_tests.rs` — covers RETN-01 through RETN-08, BATC-05, BATC-06
- [ ] Framework install: none needed — Rust test framework is built-in

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `require_session()` guard on all return commands |
| V4 Access Control | yes | `require_owner()` for supplier return and write-off; both roles for customer return |
| V5 Input Validation | yes | Server-side quantity, condition, refund amount validation in return_service |
| V8 Data Protection | yes | Refund amounts and credit notes stored but not editable; append-only pattern |

### Known Threat Patterns for Tauri + Rust

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Quantity manipulation (user sends qty > original) | Tampering | D-46 validation in service layer re-checks against DB values — never trusts frontend payload |
| Condition bypass (user sends unexpected condition) | Tampering | Match arm validates permitted conditions; unknown conditions return VALIDATION error |
| Refund amount fraud (user sends excessive refund) | Tampering | Server validates refund_amount >= 0 but does NOT cap at original price (D-47 allows differential). Owner audits via ReturnHistoryPage. |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: existing codebase] — `purchase_service.rs`, `sale_service.rs` — atomic transaction pattern, StockLedgerService interface
- [VERIFIED: existing codebase] — `stock_ledger_service.rs` — validates movement_type: "customer_return", "supplier_return", "write_off"
- [VERIFIED: existing codebase] — `batch_repo.rs` — `decrement_remaining_qty` pattern for `increment_remaining_qty`
- [VERIFIED: PRD.md §6] — returns table schema design from PRD
- [VERIFIED: 04-CONTEXT.md] — All D-44 through D-56 decisions

### Secondary (MEDIUM confidence)
- [CITED: 04-CONTEXT.md] — Return flow specs, role-based access rules, quantity limits
- [CITED: ROADMAP.md] — Phase 4 success criteria
- [CITED: .planning/research/SUMMARY.md] — Append-only corrections pattern, Pitfall 5

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified in existing code
- Architecture: HIGH — atomic transaction pattern is the third iteration (purchase, sale, now return)
- Pitfalls: HIGH — all documented patterns have concrete prevention verified in existing code

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable codebase — no fast-moving dependencies)
