# Phase 3: POS & Sales Engine — Research

**Researched:** 2026-06-05
**Domain:** Point of Sale, FIFO stock allocation, keyboard-first UX, dashboard aggregation
**Confidence:** HIGH

## Summary

Phase 3 builds the core daily transaction system on top of Phase 2's stock spine. The primary architectural risk is **the atomic sale transaction** — it must wrap stock validation, FIFO batch allocation, COGS snapshots, sale items insertion, batch deduction, and stock movement logging in a single SQLite transaction. The existing `purchase_service::record_purchase` pattern (validated in Phase 2) serves as the exact template.

The POS frontend requires a new two-panel page (search panel left, cart right) with keyboard-only Tab/Enter flow — this is a new UI paradigm for the project, not a variant of existing CRUD pages. Dashboards are read-only aggregation commands returning computed values; no mutable state.

**Primary recommendation:** Build backend-first: migration → models/repos → SaleService → commands → register → POS UI → dashboard commands → dashboard UI. Use the existing three-layer Rust pattern (verified in Phase 2) for all new sale and dashboard code.

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

#### POS Layout & UX
- **D-28**: Two-panel layout — search panel on left, cart panel on right. Medicine search dominates the left panel; cart with itemized list, totals, and payment form occupies the right.
- **D-29**: Keyboard-only flow: Tab/Enter to navigate fields, number keys for quantity, Enter to confirm sale. Full sale completable without mouse.
- **D-30**: Live medicine search with debounce targeting <200ms response. Search by name, generic name, brand. Results limited to top 20 for speed.
- **D-31**: Large font sizes throughout — medicine names, prices, quantities sized for quick visual scanning per PRD spec.

#### Sale Transaction Design
- **D-32**: FIFO batch allocation happens at confirm time — NOT at add-item time. On confirm, the transaction selects batches ordered by `expiry_date ASC, received_date ASC, id ASC` with `remaining_qty > 0 AND expiry_date > date('now')`, deducts from oldest first across batches as needed, and records which batch IDs were used for each line item.
- **D-33**: One atomic SQLite transaction per sale — wraps: validate stock for all items → allocate FIFO batches → insert sale header → insert sale_items with batch_id and COGS snapshot → update batches.remaining_qty → insert stock_movements (negative, movement_type='sale') → commit. Rollback entire sale on any failure.
- **D-34**: Sale line items capture immutable snapshots: unit_price, purchase_cost (from batch at time of sale), discount, tax, line_total. Future price changes do not affect historical profit calculations.
- **D-35**: Sale total is recalculated on the Rust server side (not trusted from frontend) to prevent tampering.

#### Discounts & Tax
- **D-36**: Tax calculated at bill level on post-discount subtotal. Tax rate from settings (default 0%). Tax can be toggled on/off per sale.
- **D-37**: Item-level discount (per line) and bill-level discount (on subtotal). Both appear on receipt. Discounts capped at 100%.
- **D-38**: Pharmacist can apply discounts only if `allow_cashier_discount` setting is enabled (D-26/D-27 settings read path). Owner can always apply discounts.

#### Payment & Credit
- **D-39**: Three payment methods: Cash, Card, Credit. Credit prompts for customer name.
- **D-40**: Credit sales are recorded as full sales — no receivables tracking in v1. Deferred to future phase.

#### Dashboard Design
- **D-41**: Owner dashboard: today's total sales (revenue), today's profit (revenue − COGS), total sales this month, low stock alerts count (clickable → Phase 2 report), expiry alerts count (clickable → Phase 2 report), top 5 selling medicines this week (mini bar chart via Recharts).
- **D-42**: Pharmacist dashboard: today's sales total, low stock alerts count, expiry alerts count. No profit or margin data.
- **D-43**: Dashboards compute from aggregated sale data — no mutable state.

#### Carried Forward
- **D-01**: rusqlite in Rust Tauri commands — established pattern.
- **D-02**: WAL, FK, busy_timeout — established.
- **D-03**: `stock_movements` table exists (from Phase 1) — sale writes negative movements.
- **D-07**: Sidebar — add POS, Dashboard nav items.
- **D-08**: English UI only.
- **D-22**: StockLedgerService is single authority for stock mutations.
- **D-23**: Stock = SUM(remaining_qty) of non-expired batches.

### the agent's Discretion
- Exact column layout for cart panel
- Search result display format (list vs cards)
- Receipt/confirmation display after sale
- Chart library configuration (Recharts)
- Keyboard shortcut design (specific Tab order)

### Deferred Ideas (OUT OF SCOPE)
- Full receivables/udhaar tracking — out of v1 scope
- Receipt printing — out of v1 scope
- Dashboard expiry widget (already noted in Phase 2 deferral)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POS-01 | Search medicines live (<200ms) | POS search reuses Phase 2 pattern with LIMIT 20, 200ms debounce, dedicated POS search endpoint, existing `idx_medicines_search` index |
| POS-02 | Add items to sale with quantity | Frontend cart state + Tauri command payload with medicine_id + quantity |
| POS-03 | Check stock — cannot sell more than available | Backend re-reads batch stock atomically inside confirm_sale transaction; frontend also validates at add-item time for UX |
| POS-04 | Block zero-stock and expired medicines | FIFO query filters `remaining_qty > 0 AND expiry_date > date('now')`; zero-stock = no eligible batches found |
| POS-05 | Item-level discount (optional) | `item_discount` field on each `sale_items` row; capped at 100%; amount in currency, not percentage |
| POS-06 | Bill-level discount (optional) | `bill_discount` field on `sales` applied to subtotal before tax |
| POS-07 | Tax toggle per sale on post-discount subtotal | `tax_enabled` boolean on `sales`; tax_rate read from settings at confirm time; tax = (subtotal − bill_discount) × tax_rate |
| POS-08 | Payment method: Cash, Card, Credit | `payment_method` TEXT CHECK in `sales` table |
| POS-09 | Credit sale prompts for customer name | `customer_name` optional TEXT on `sales`; frontend shows prompt when payment_method='Credit' |
| POS-10 | FIFO batch deduction at confirm | D-32: `ORDER BY expiry_date ASC, received_date ASC, id ASC WHERE remaining_qty > 0 AND expiry_date > date('now')` inside the confirm transaction |
| POS-11 | Immutable line-item snapshots | `sale_items` stores unit_price, purchase_cost (from batch), item_discount, line_total at confirm time — never recalculated |
| POS-12 | Keyboard-only sale completion | Tab order + Enter handlers + useRef focus management + custom usePOSKeyboard hook |
| POS-13 | Sale under 30 seconds | <200ms search + minimal frontend state + single confirm_sale command → fast UX |
| BATC-02 | Dashboard expiry warnings | Reuse existing `get_expiry_report` with thresholds: yellow ≤60d, red ≤30d, dark red past expiry (BATC-03 blocks past-expiry sales) |
| BATC-03 | Expired medicines blocked from sale | Guaranteed by FIFO query filter `expiry_date > date('now')` — expired batches are invisible to the allocator |
| REPT-01 | Owner dashboard KPIs | Aggregation commands: `get_owner_dashboard` returns today_sales, today_profit, month_sales, low_stock_count, expiry_count, top_5_sellers |
| REPT-02 | Pharmacist dashboard KPIs | `get_pharmacist_dashboard` returns today_sales only — no profit/margin data |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FIFO batch allocation | API / Backend (Rust) | — | Allocator selects batches inside atomic transaction; trust boundary prevents tampered allocation |
| Sale total recalculation | API / Backend (Rust) | — | D-35: Server must recompute; frontend totals are preview only |
| Stock validation at confirm | API / Backend (Rust) | — | Re-reads authoritative batch state inside the sale transaction |
| Stock validation at add-item | Browser / Client (React) | — | Quick UX feedback only; backend re-validates at confirm |
| POS search | API / Backend (Rust) | Browser / Client (React) | Rust executes SQL LIKE query; React debounces and renders results |
| Cart state management | Browser / Client (React) | — | Local React state only; never sent as authoritative |
| Keyboard event routing | Browser / Client (React) | — | React onKeyDown + tabIndex + useRef focus management |
| Dashboard aggregation | API / Backend (Rust) | — | Server-side SQL aggregation queries; no client-side computation |
| Chart rendering | Browser / Client (React) | — | Recharts renders server-computed data; read-only |
| Discount permission check | API / Backend (Rust) | — | Server checks `cashier_discount_enabled` setting + user role |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite (bundled) | 0.40 | SQLite access | Existing project dependency; atomic transactions via `Connection::transaction()` |
| rusqlite_migration | 2.6 | Schema migrations | Existing; 003_add_sales migration needed |
| @tauri-apps/api | ^2 | IPC invoke | Existing; confirm_sale command via invoke |
| Recharts | 3.8.1 | Dashboard charts | Target for top-5-selling bar chart; read-only rendering |
| lucide-react | ^0.487.0 | Icons | Existing; `ShoppingCart`, `Search`, `Plus`, `Minus`, `Percent`, `CreditCard` icons for POS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router-dom | ^7.17.0 | Routing | Existing; add /pos and /dashboard routes |
| shadcn/ui | latest | UI components | Existing; Card, Input, Badge, Table, Button, Select, Dialog for POS UI |
| class-variance-authority | ^0.7.1 | Style variants | Existing; button and card variants for POS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rusqlite Transaction | Prisma sidecar | Prisma adds Node.js packaging complexity; rusqlite transaction is validated to work (Phase 2 purchase_service) |
| Recharts | Chart.js / D3 | Recharts is already in tech stack per PROJECT.md; read-only charts don't need D3 flexibility |
| shadcn/ui cart | Custom cart | shadcn Card + Input + Badge is sufficient; custom would be faster but adds maintenance |

**Installation (new packages):**
```bash
npm install recharts
```

**Version verification:**
```bash
npm view recharts version
# → 3.8.1 (verified 2026-06-05)
```

## Architecture Patterns

### System Architecture Diagram

```
React POS Page (two-panel)
  ┌─────────────────────┐  ┌──────────────────────────────┐
  │   Search Panel      │  │        Cart Panel            │
  │  ┌─────────────┐    │  │  Item List (scrollable)      │
  │  │ Search Input │    │  │  ┌─ item 1 ──────────────┐ │
  │  │ (Tab focus 1)│    │  │  │ name | qty | price    │ │
  │  └─────────────┘    │  │  │ item discount input    │ │
  │  ┌────────────────┐ │  │  └───────────────────────┘ │
  │  │ Results (≤20)  │ │  │  ┌─ item 2 ... ─────────┐ │
  │  │ (Tab/Enter)    │ │  │  │                      │ │
  │  │ - Medicine A   │ │  │  └───────────────────────┘ │
  │  │ - Medicine B   │ │  │  ────────────────────────    │
  │  └────────────────┘ │  │  Bill Discount: [input]    │
  └─────────────────────┘  │  Tax Toggle: [  ]          │
                            │  Payment: [Cash▼]          │
                            │  Total: Rs. 1,234          │
                            │  [Confirm Sale] (Enter)    │
                            └──────┬───────────────────┘
                                   │
                                   ▼ Tauri IPC invoke("confirm_sale", payload)
                            ┌──────────────────────────────┐
                            │  Rust SaleService            │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 1: Validate cart │  │
                            │  │ - Role + discount perm │  │
                            │  │ - All items valid      │  │
                            │  └────────────────────────┘  │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 2: Open tx       │  │
                            │  │ (rusqlite Transaction) │  │
                            │  └────────────────────────┘  │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 3: Per-item FIFO │  │
                            │  │ - SELECT batches WHERE │  │
                            │  │   remaining_qty > 0    │  │
                            │  │   AND expiry > today   │  │
                            │  │   ORDER BY expiry ASC  │  │
                            │  │   received ASC, id ASC │  │
                            │  │ - Ensure total qty     │  │
                            │  │ - Allocate across      │  │
                            │  │   one or more batches  │  │
                            │  └────────────────────────┘  │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 4: Server totals │  │
                            │  │ - line_total =         │  │
                            │  │   qty*unit_price-dscnt│  │
                            │  │ - subtotal = Σ line    │  │
                            │  │ - after_discount =     │  │
                            │  │   subtotal−bill_disc   │  │
                            │  │ - tax = after_disc     │  │
                            │  │   × tax_rate(if enab)  │  │
                            │  │ - total = after_disc   │  │
                            │  │   + tax                │  │
                            │  └────────────────────────┘  │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 5: INSERT rows   │  │
                            │  │ - sale header          │  │
                            │  │ - sale_items (per batch│  │
                            │  │   with COGS snapshot)  │  │
                            │  │ - UPDATE batch.qty     │  │
                            │  │ - INSERT stock_moves   │  │
                            │  └────────────────────────┘  │
                            │  ┌────────────────────────┐  │
                            │  │ PHASE 6: COMMIT        │  │
                            │  │ → return SaleReceiptDto│  │
                            │  └────────────────────────┘  │
                            └──────────────────────────────┘
                                   │
                                   ▼ React shows receipt/confirmation
```

### Recommended Project Structure (additions to existing)

```
src-tauri/
├── migrations/
│   └── 003_sales_engine/
│       └── up.sql                           # NEW: sales + sale_items tables + indexes
├── src/
│   ├── models/
│   │   ├── sale.rs                          # NEW: Sale, SaleItem, DTOs
│   │   └── mod.rs                           # add pub mod sale
│   ├── repository/
│   │   ├── sale_repo.rs                     # NEW: insert_sale, insert_item, queries
│   │   └── mod.rs                           # add pub mod sale_repo
│   ├── services/
│   │   ├── sale_service.rs                  # NEW: confirm_sale + dashboard queries
│   │   └── mod.rs                           # add pub mod sale_service
│   ├── commands/
│   │   ├── sale_commands.rs                 # NEW: confirm_sale, get_owner_dashboard, get_pharmacist_dashboard
│   │   ├── dashboard_commands.rs            # NEW (or combine into sale_commands)
│   │   └── mod.rs                           # add pub mod sale_commands
│   └── main.rs                              # register new commands

src/
├── pages/
│   ├── POSPage.tsx                          # NEW: two-panel POS
│   └── DashboardPage.tsx                    # REPLACE: full dashboard implementation
├── components/
│   └── pos/                                 # NEW: POS-specific components
│       ├── POSSearchPanel.tsx
│       ├── POSCartPanel.tsx
│       ├── POSCartItem.tsx
│       ├── POSPaymentForm.tsx
│       └── POSReceiptDialog.tsx
├── hooks/
│   └── usePOSKeyboard.ts                    # NEW: keyboard navigation hook
├── types/
│   └── sale.ts                              # NEW: TypeScript types for sale DTOs
└── lib/
    └── tauri.ts                             # add sale + dashboard commands
```

### Pattern 1: Atomic Sale Transaction (D-32, D-33)
**What:** The exact pattern from `purchase_service::record_purchase` — validates all items first, then opens a `rusqlite::Transaction`, executes all mutations, and commits. ALL succeed or ALL roll back.

**When to use:** This is the ONLY path for confirming a sale. No other code can create sale records or deduct stock.

**Example — sale_service.rs structure:**
```rust
// Source: Pattern matches purchase_service::record_purchase [VERIFIED: Phase 2 code]
pub fn confirm_sale(
    db: &mut Connection,
    payload: &ConfirmSaleDto,
    user_id: i64,
    role: &str,
) -> Result<SaleReceiptDto, CommandError> {
    // --- PHASE 1: Validate ALL items BEFORE opening transaction ---
    if payload.items.is_empty() {
        return Err(CommandError::validation("Sale must have at least one item"));
    }
    if !["Cash", "Card", "Credit"].contains(&payload.payment_method.as_str()) {
        return Err(CommandError::validation("Invalid payment method"));
    }

    // Load settings needed for the sale
    let settings = settings_service::get_settings(db)?;

    // If pharmacist, check discount permission
    let can_discount = role == "owner" || settings.cashier_discount_enabled;
    if !can_discount && (payload.bill_discount > 0.0 || payload.items.iter().any(|i| i.item_discount > 0.0)) {
        return Err(CommandError::validation("Discounts not permitted for your role"));
    }

    // Validate each item: medicine exists, is active, is not expired, stock covers qty
    for (i, item) in payload.items.iter().enumerate() {
        if item.quantity <= 0 {
            return Err(CommandError::validation(&format!("Item {}: quantity must be positive", i + 1)));
        }
        if item.item_discount < 0.0 || item.item_discount > 100.0 {
            return Err(CommandError::validation(&format!("Item {}: discount must be between 0 and 100", i + 1)));
        }
        // Check total available stock for this medicine
        let available = stock_ledger_service::get_current_stock(db, item.medicine_id)?;
        if available < item.quantity {
            return Err(CommandError::validation(&format!(
                "Insufficient stock for medicine ID {}: requested {}, available {}",
                item.medicine_id, item.quantity, available
            )));
        }
    }

    // --- PHASE 2: Open transaction ---
    let tx = db.transaction().map_err(|e| {
        CommandError::internal(&format!("Failed to start transaction: {}", e))
    })?;

    // --- PHASE 3: Compute subtotal from line items (server-side) ---
    let mut subtotal = 0.0_f64;
    let mut sale_items_data: Vec<SaleItemAllocation> = Vec::new();

    for item in &payload.items {
        // Get medicine retail price from DB (never trust frontend)
        let medicine = medicine_repo::find_by_id(&tx, item.medicine_id)?
            .ok_or_else(|| CommandError::not_found(&format!("Medicine ID {}", item.medicine_id)))?;
        let unit_price = medicine.retail_price;

        // FIFO: Select eligible batches ordered by expiry ASC, received ASC, id ASC
        let batches = batch_repo::find_fifo_eligible(&tx, item.medicine_id, item.quantity)?;

        // Allocate quantity across batches
        let mut remaining = item.quantity;
        for batch in batches {
            if remaining <= 0 { break; }
            let take = remaining.min(batch.remaining_qty);
            sale_items_data.push(SaleItemAllocation {
                medicine_id: item.medicine_id,
                batch_id: batch.id,
                quantity: take,
                unit_price,
                purchase_cost: batch.purchase_price,
                item_discount: item.item_discount,
                line_total: (take as f64 * unit_price) - item.item_discount,
            });
            remaining -= take;
        }

        // Accumulate server-side subtotal
        let item_subtotal: f64 = sale_items_data.iter()
            .filter(|si| si.medicine_id == item.medicine_id)
            .map(|si| si.line_total)
            .sum();
        subtotal += item_subtotal;
    }

    // --- PHASE 4: Apply bill discount and tax ---
    let bill_discount = payload.bill_discount.min(subtotal).max(0.0); // capped
    let after_discount = subtotal - bill_discount;
    let tax_rate = if payload.tax_enabled { settings.default_tax_rate } else { 0.0 };
    let tax_amount = (after_discount * tax_rate / 100.0 * 100.0).round() / 100.0; // round to 2 decimals
    let total = after_discount + tax_amount;

    // --- PHASE 5: INSERT sale header ---
    let sale_id = sale_repo::insert_sale(
        &tx, user_id, subtotal, bill_discount, tax_rate, tax_amount,
        total, &payload.payment_method, payload.customer_name.as_deref(),
    )?;

    // --- PHASE 6: INSERT sale_items + UPDATE batches + INSERT stock_movements ---
    for si in &sale_items_data {
        sale_repo::insert_item(
            &tx, sale_id, si.medicine_id, si.batch_id,
            si.quantity, si.unit_price, si.purchase_cost,
            si.item_discount, si.line_total,
        )?;

        // Decrement batch
        batch_repo::decrement_remaining_qty(&tx, si.batch_id, si.quantity)?;

        // Record negative stock movement
        stock_ledger_service::record_movement(
            &tx, "sale", si.medicine_id, Some(si.batch_id),
            -si.quantity, "sale", Some(sale_id), None, user_id,
        )?;
    }

    // --- PHASE 7: COMMIT ---
    tx.commit().map_err(|e| {
        CommandError::internal(&format!("Failed to commit sale: {}", e))
    })?;

    Ok(SaleReceiptDto { sale_id, total, item_count: payload.items.len() as i64 })
}
```

### Pattern 2: POS Search (D-30, POS-01)
**What:** Dedicated POS search endpoint that returns only the fields needed for the POS flow (id, name, generic_name, retail_price, current_stock, shelf_location, unit) AND excludes purchase_price always (even for owner — POS doesn't show purchase prices). Targets <200ms.

**When to use:** Replace the generic `search_medicines` call in the POS page. The index `idx_medicines_search(name, generic_name, brand_name)` already exists.

**Example:**
```rust
// New search_medicines_pos command — always excludes purchase_price
pub fn search_medicines_pos(
    db: &Connection,
    query: &str,
) -> Result<Vec<MedicinePosDto>, CommandError> {
    let pattern = format!("%{}%", query);
    let mut stmt = db.prepare(
        "SELECT m.id, m.name, m.generic_name, m.unit, m.retail_price, \
                m.reorder_level, m.shelf_location, \
                COALESCE((SELECT SUM(b.remaining_qty) FROM batches b \
                 WHERE b.medicine_id = m.id AND b.expiry_date > date('now')), 0) AS current_stock \
         FROM medicines m \
         WHERE m.is_active = 1 \
           AND (m.name LIKE ?1 OR m.generic_name LIKE ?1 OR m.brand_name LIKE ?1) \
         ORDER BY m.name ASC \
         LIMIT 20"
    )?;

    // ... map to Vec<MedicinePosDto>
}
```

### Anti-Patterns to Avoid
- **Trusting frontend totals:** Never use `subtotal`, `line_total`, `tax_amount` from the frontend payload. Always recompute on server (D-35).
- **Deferred stock deduction:** Must deduct stock INSIDE the same transaction that creates sale records. No asynchronous "reserve then confirm" pattern.
- **Per-item discount as percentage:** All discounts should be in currency units (as integers representing cents) to avoid floating-point accumulation errors. Use `(value * 100.0).round() as i64` for comparison.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recharts bar chart | Custom SVG bar chart | `<BarChart>` from Recharts 3.8.1 | 60 lines of declarative JSX vs 200+ lines of SVG math, axis labels, tooltips |
| Keyboard focus management | Raw tabIndex everywhere | Custom `usePOSKeyboard` hook + `useRef` | Encapsulates Tab/Enter/Arrow logic; prevents focus-trap bugs |
| POS receipt display | Custom print layout | shadcn Dialog + Card | Temporary on-screen receipt; printing deferred to v2 |
| Mobile/responsive layout | CSS media queries | Single-width desktop layout | Tauri targets Windows desktop only — no responsive breakpoints needed |

**Key insight:** POS is a desktop-only, keyboard-first interface. Use shadcn/ui components (already installed) for layout. Recharts is the correct lightweight chart choice for dashboard — install the npm package, import `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`.

## Common Pitfalls

### Pitfall 1: Floating-Point Currency Accumulation
**What goes wrong:** `0.1 + 0.2 = 0.30000000000000004` causes penny-level discrepancies in sale totals that accumulate over hundreds of sales.
**Why it happens:** IEEE 754 floating-point cannot represent decimal fractions exactly.
**How to avoid:** Round ALL financial calculations to 2 decimal places using `(value * 100.0).round() / 100.0` after each arithmetic operation. Alternatively, store values as cents (i64) throughout. The purchase service uses `f64` consistently — match that pattern but round on every arithmetic step.
**Warning signs:** Sale totals off by 0.01 after a few sales; dashboard profit numbers don't reconcile.

### Pitfall 2: Batch Deadlock / Partial Deduction
**What goes wrong:** If a medicine has 5 units in batch A and 5 in batch B, and user sells 8, the transaction deducts 5 from A then 3 from B. If an error occurs mid-way, remaining_qty is partially updated.
**Why it happens:** Not using a single atomic transaction per sale (D-33 violation).
**How to avoid:** The `rusqlite::Transaction` pattern (verified in purchase_service) ensures ALL mutations commit or ALL roll back. Never update batches directly without a wrapping transaction.
**Warning signs:** Negative remaining_qty on batches; sale recorded but stock not deducted.

### Pitfall 3: Discard Cart on Search
**What goes wrong:** User has 5 items in cart, types a search character, and the cart state resets.
**Why it happens:** Cart state and search state not properly separated.
**How to avoid:** Keep cart state separate from search input state. The search `debouncedSearch` value changing should not clear cart items. Cart clear only happens on explicit "New Sale" action or after successful confirm.
**Warning signs:** Users reporting they lose their cart when searching.

### Pitfall 4: Dashboard Query Performance
**What goes wrong:** `get_owner_dashboard` runs 5 separate SQL queries sequentially, causing 200ms+ load time.
**Why it happens:** Each dashboard metric is a different aggregation query.
**How to avoid:** Batch independent queries (low_stock_count and expiry_count can run in parallel within Rust). For `month_sales`, use `strftime('%Y-%m', created_at)` index on `sales(created_at)`. Add `idx_sales_date` index.
**Warning signs:** Dashboard feels slow after 1000+ sales.

## Code Examples

### Migration 003: Sales Tables (up.sql)

```sql
-- Sales header table
CREATE TABLE sales (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    subtotal         REAL NOT NULL CHECK(subtotal >= 0),
    bill_discount    REAL NOT NULL DEFAULT 0 CHECK(bill_discount >= 0),
    tax_rate         REAL NOT NULL DEFAULT 0 CHECK(tax_rate >= 0),
    tax_amount       REAL NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
    total            REAL NOT NULL CHECK(total >= 0),
    payment_method   TEXT NOT NULL CHECK(payment_method IN ('Cash', 'Card', 'Credit')),
    customer_name    TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sale line items (one entry per batch allocation)
CREATE TABLE sale_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id          INTEGER NOT NULL REFERENCES sales(id),
    medicine_id      INTEGER NOT NULL REFERENCES medicines(id),
    batch_id         INTEGER NOT NULL REFERENCES batches(id),
    quantity         INTEGER NOT NULL CHECK(quantity > 0),
    unit_price       REAL NOT NULL CHECK(unit_price >= 0),
    purchase_cost    REAL NOT NULL CHECK(purchase_cost >= 0),
    item_discount    REAL NOT NULL DEFAULT 0 CHECK(item_discount >= 0),
    line_total       REAL NOT NULL CHECK(line_total >= 0)
);

-- Indexes
CREATE INDEX idx_sales_date ON sales(created_at);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_medicine ON sale_items(medicine_id);
CREATE INDEX idx_sale_items_batch ON sale_items(batch_id);

-- Add tax_enabled setting if not present
INSERT OR IGNORE INTO settings (key, value) VALUES ('tax_enabled_default', 'true');
```

### FIFO Batch Query (batch_repo.rs addition)

```rust
/// Finds batches eligible for FIFO allocation.
/// Ordered by expiry_date ASC, received_date ASC, id ASC.
/// Only returns batches with remaining_qty > 0 AND expiry_date > today.
/// Ensures total available qty >= needed_qty (returns error if not).
pub fn find_fifo_eligible(
    conn: &Connection,
    medicine_id: i64,
    needed_qty: i64,
) -> Result<Vec<Batch>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, medicine_id, purchase_id, purchase_item_id, purchase_price, \
                quantity, remaining_qty, expiry_date, received_date \
         FROM batches \
         WHERE medicine_id = ?1 \
           AND remaining_qty > 0 \
           AND expiry_date > date('now') \
         ORDER BY expiry_date ASC, received_date ASC, id ASC"
    )?;

    let rows = stmt.query_map(rusqlite::params![medicine_id], |row| {
        Ok(Batch {
            id: row.get(0)?,
            medicine_id: row.get(1)?,
            purchase_id: row.get(2)?,
            purchase_item_id: row.get(3)?,
            purchase_price: row.get(4)?,
            quantity: row.get(5)?,
            remaining_qty: row.get(6)?,
            expiry_date: row.get(7)?,
            received_date: row.get(8)?,
        })
    })?;

    let mut results = Vec::new();
    let mut total_available = 0_i64;
    for row in rows {
        let b = row?;
        total_available += b.remaining_qty;
        results.push(b);
    }

    // FAIL FAST: If insufficient stock, return empty vec and let caller handle
    // The caller (SaleService) checks total available before calling batch allocation,
    // but we also guard here for defense-in-depth
    if total_available < needed_qty {
        return Err(rusqlite::Error::InvalidParameterName(
            format!("Insufficient stock: needed {}, available {}", needed_qty, total_available).into()
        ));
    }

    Ok(results)
}

/// Decrements remaining_qty for a batch. Called inside a transaction.
pub fn decrement_remaining_qty(
    conn: &Connection,
    batch_id: i64,
    decrement_by: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE batches SET remaining_qty = remaining_qty - ?2 WHERE id = ?1 AND remaining_qty >= ?2",
        rusqlite::params![batch_id, decrement_by],
    )?;
    Ok(())
}
```

### Owner Dashboard Aggregation (Dashboard DTOs)

```rust
// Models/sale.rs additions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnerDashboardDto {
    pub today_sales: f64,
    pub today_profit: f64,
    pub month_sales: f64,
    pub low_stock_count: i64,
    pub expiry_warning_count: i64,  // expiry ≤ 60 days
    pub expiry_critical_count: i64, // expiry ≤ 30 days
    pub top_sellers: Vec<TopSellerDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopSellerDto {
    pub medicine_id: i64,
    pub medicine_name: String,
    pub total_qty: i64,
}

// Service query pattern
pub fn get_owner_dashboard(db: &Connection) -> Result<OwnerDashboardDto, CommandError> {
    // Today's sales revenue
    let today_sales: f64 = db.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM sales WHERE date(created_at) = date('now')",
        [], |row| row.get(0),
    )?;

    // Today's profit = Σ(line_total - purchase_cost * quantity)
    let today_profit: f64 = db.query_row(
        "SELECT COALESCE(SUM(si.line_total - (si.purchase_cost * si.quantity)), 0) \
         FROM sale_items si \
         JOIN sales s ON s.id = si.sale_id \
         WHERE date(s.created_at) = date('now')",
        [], |row| row.get(0),
    )?;

    // Monthly sales
    let month_sales: f64 = db.query_row(
        "SELECT COALESCE(SUM(total), 0) FROM sales \
         WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
        [], |row| row.get(0),
    )?;

    // Low stock: medicines where current_stock < reorder_level
    // Uses the D-23 formula (SUM of non-expired batch remaining_qty)
    let low_stock_count: i64 = db.query_row(
        "SELECT COUNT(*) FROM medicines m \
         WHERE m.is_active = 1 \
           AND (SELECT COALESCE(SUM(b.remaining_qty), 0) FROM batches b \
                WHERE b.medicine_id = m.id AND b.expiry_date > date('now')) < m.reorder_level",
        [], |row| row.get(0),
    )?;

    // Expiry warnings (batches ≤ 60 days remaining)
    let expiry_warning_count: i64 = db.query_row(
        "SELECT COUNT(*) FROM batches \
         WHERE remaining_qty > 0 \
           AND expiry_date > date('now') \
           AND julianday(expiry_date) - julianday('now') <= 60",
        [], |row| row.get(0),
    )?;

    // Top 5 selling medicines this week
    let mut stmt = db.prepare(
        "SELECT si.medicine_id, m.name, SUM(si.quantity) as total_qty \
         FROM sale_items si \
         JOIN sales s ON s.id = si.sale_id \
         JOIN medicines m ON m.id = si.medicine_id \
         WHERE s.created_at >= datetime('now', '-7 days') \
         GROUP BY si.medicine_id \
         ORDER BY total_qty DESC \
         LIMIT 5"
    )?;
    let top_sellers = stmt.query_map([], |row| {
        Ok(TopSellerDto {
            medicine_id: row.get(0)?,
            medicine_name: row.get(1)?,
            total_qty: row.get(2)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(OwnerDashboardDto {
        today_sales,
        today_profit,
        month_sales,
        low_stock_count,
        expiry_warning_count,
        expiry_critical_count: 0, // same pattern as expiry_warning but with 30 days
        top_sellers,
    })
}
```

### Keyboard Hook Pattern (usePOSKeyboard.ts)

```typescript
// Source: React keyboard event patterns [ASSUMED] — standard React pattern
// Tab order constants for the POS flow
export const TAB_ORDER = {
  SEARCH: 1,
  SEARCH_RESULTS: 2,  // dynamic: first result is tab-able
  QUANTITY: 3,
  ITEM_DISCOUNT: 4,
  BILL_DISCOUNT: 5,
  TAX_TOGGLE: 6,
  PAYMENT_METHOD: 7,
  CUSTOMER_NAME: 8,  // only for Credit sales
  CONFIRM: 9,
} as const;

// Highlights: Enter key behavior
// - In search results: Enter selects highlighted item, auto-focuses quantity
// - In quantity input: Enter adds item to cart, returns focus to search
// - On confirm button: Enter triggers confirm_sale
export function usePOSKeyboard() {
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  // ... other refs

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      // Move selection down in results list
      setSelectedResultIndex(prev => Math.min(prev + 1, results.length - 1));
      e.preventDefault();
    }
    if (e.key === 'Enter' && selectedResultIndex >= 0) {
      // Select highlighted item
      onSelectMedicine(results[selectedResultIndex]);
      // Focus quantity input
      quantityRef.current?.focus();
      e.preventDefault();
    }
  }, [results, selectedResultIndex, onSelectMedicine]);

  // More keyboard handlers follow same pattern
  return { searchRef, quantityRef, /* etc */ handleSearchKeyDown, /* etc */ };
}
```

### Recharts Dashboard Bar Chart (Top 5 Sellers)

```tsx
// Source: Recharts 3.8.1 API [VERIFIED: npm registry]
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function TopSellersChart({ data }: { data: TopSellerDto[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
          <XAxis
            dataKey="medicine_name"
            tick={{ fontSize: 11 }}
            angle={-20}
            textAnchor="end"
          />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total_qty" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stock deduction at add-item time (common in naive POS) | FIFO allocation at confirm time (D-32) | Phase 3 decision | Prevents phantom stock reservations; accurate COGS |
| Manual key-by-key navigation | Tab-order keyboard flow (D-29) | Phase 3 decision | Full sale without touching mouse; <30s target |
| Per-item tax calculation | Bill-level tax on post-discount subtotal (D-36) | Phase 3 decision | Simpler, matches pharmacy receipt convention |
| Placeholder dashboard | Realtime aggregated dashboard (REPT-01/02) | Phase 3 | Owner sees profit; pharmacist sees totals only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `idx_medicines_search(name, generic_name, brand_name)` multi-column index will keep POS search <200ms on a pharmacy dataset with ~2000 medicines | POS Search | If dataset exceeds ~10k medicines, consider FTS5 or a dedicated search table — unlikely for single-branch pharmacy |
| A2 | React's useRef + tabIndex provides sufficient keyboard-navigation behavior without a library | Keyboard Flow | If complex keyboard interactions are needed (e.g., focus trapping inside cart panel), consider `@radix-ui/react-focus-scope` or a `focus-trap-react` package |
| A3 | Recharts 3.x works with React 18 without compatibility issues | Charts | Recharts 3.x has peer dependency on React 18; verify compatibility during install |
| A4 | The frontend tax_rate display uses `useSettings` which returns settings on mount — no real-time refresh needed | Tax | Settings change rarely; reading them once on POS page mount is sufficient |

## Open Questions

1. **Discount format — currency vs percentage?**
   - What we know: D-37 says "discounts capped at 100%" (implying percentage). Both item-level and bill-level.
   - What's unclear: If bill discount is percentage or absolute amount.
   - Recommendation: Use **absolute currency amount** (e.g., Rs. 50 off) for both item and bill discounts. The 100% cap prevents discount exceeding item price. Percentage interpretation would introduce ambiguity ("100% of what?"). Using currency is simpler for the cashier to enter and avoids calculation ambiguity. Confirm with user during discuss phase.

2. **Tax application — inclusive or exclusive?**
   - What we know: D-36 says "tax calculated at bill level on post-discount subtotal".
   - What's unclear: Is the entered retail price tax-inclusive (India/GST model) or tax-exclusive?
   - Recommendation: Treat retail price as **tax-inclusive** (the displayed price is what customer pays). The tax_amount is informational for the receipt. This matches pharmacy convention — prices on shelves include tax. Confirm with user.

3. **Top sellers period — "this week"?**
   - What we know: D-41 says "top 5 selling medicines this week".
   - What's unclear: Calendar week (Mon-Sun) or rolling 7 days?
   - Recommendation: Use **rolling 7 days** (`datetime('now', '-7 days')`) — simpler to implement and understand.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Recharts | Dashboard chart | ✗ (not installed) | 3.8.1 | Install via `npm install recharts` |
| rusqlite | Backend transaction | ✓ | 0.40 | — |
| React 18 | POS UI | ✓ | ^18.3.1 | — |
| Tailwind CSS | POS layout | ✓ | ^3.4.17 | — |
| lucide-react | POS icons | ✓ | ^0.487.0 | — |

**Missing dependencies with no fallback:**
- Recharts (not installed) — must be installed before dashboard UI work

## Validation Architecture

> nyquist_validation is explicitly disabled in `.planning/config.json`. This section is skipped as per workflow configuration.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Carried forward from Phase 1 |
| V3 Session Management | no | Carried forward from Phase 1 |
| V4 Access Control | yes | `require_owner` guard on owner dashboard; role check on discount permission (D-38) |
| V5 Input Validation | yes | All Tauri command DTOs validated in sale service before transaction opens |
| V6 Cryptography | no | No new crypto |
| V8 Data Protection | yes | Immutable COGS snapshots (D-34) protect historical data integrity |
| V9 Communication | no | Offline-only |

### Known Threat Patterns for Tauri + Rust + SQLite

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered sale total from frontend | Tampering | D-35: Server recomputes all totals; frontend payload total ignored |
| Pharmacist accessing profit data | Information Disclosure | D-42: Pharmacist dashboard returns no profit/COGS; DTO-level masking enforced in Rust |
| Sale confirm during stock race | Elevation of Privilege | D-33: Atomic transaction prevents partial sale; rollback on any failure |
| Discount abuse by pharmacist | Tampering | D-38: Server checks `cashier_discount_enabled` setting + role; discounts blocked at service layer |

## Sources

### Primary (HIGH confidence)
- VERIFIED: Existing code at `src-tauri/src/services/purchase_service.rs` — atomic transaction pattern
- VERIFIED: Existing code at `src-tauri/src/repository/medicine_repo.rs` — search SQL pattern
- VERIFIED: Existing code at `src-tauri/src/repository/batch_repo.rs` — batch query patterns
- VERIFIED: Existing code at `src-tauri/src/services/stock_ledger_service.rs` — record_movement for sale type
- VERIFIED: Existing code at `src-tauri/src/services/settings_service.rs` — typed setting getters
- VERIFIED: Existing schema at `src-tauri/migrations/001_initial/up.sql` — stock_movements table
- VERIFIED: Existing schema at `src-tauri/migrations/002_medicine_catalog/up.sql` — medicines, batches, indexes
- VERIFIED: npm registry — recharts 3.8.1 available

### Secondary (MEDIUM confidence)
- ARCHITECTURE.md §"Sale Confirmation Transaction" — design docs confirm the 10-step transaction flow
- ARCHITECTURE.md §"Don't Hand-Roll" — recharts for charts recommendation
- CONTEXT.md decisions D-28 through D-43 — all locked decisions

### Confidence breakdown
- Standard stack: HIGH — rusqlite, React, shadcn/ui, Recharts all verified against project files
- Architecture: HIGH — pattern directly replicates purchase_service::record_purchase (verified in Phase 2)
- Pitfalls: HIGH — floating-point currency and transaction atomicity are well-known SQLite patterns [VERIFIED: existing code handles these in purchase_service]
- Keyboard flow: MEDIUM (A2) — React keyboard patterns are standard but not verified against a specific library

**Research date:** 2026-06-05
**Valid until:** 2026-07-05
</parameter>
