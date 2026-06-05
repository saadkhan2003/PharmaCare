# Product Requirements Document
## PharmaCare — Pharmacy Management System
**Version:** 1.0  
**Prepared by:** Muhammad Saad Khan  
**Client:** Private Pharmacy (Single Branch)  
**Platform:** Windows Desktop Application  
**Date:** June 2026  
**Status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Tech Stack](#3-tech-stack)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Module Specifications](#5-module-specifications)
   - 5.1 Medicine Inventory
   - 5.2 Sales / POS
   - 5.3 Purchase & Supplier Records
   - 5.4 Expiry Date Tracking
   - 5.5 Returns & Refunds
   - 5.6 Tax & Discount
   - 5.7 Analytics & Reports
   - 5.8 User Management
   - 5.9 Data Backup & Recovery
   - 5.10 Settings
6. [Database Schema](#6-database-schema)
7. [UI Screens List](#7-ui-screens-list)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Development Phases & Milestones](#9-development-phases--milestones)
10. [Out of Scope (v1)](#10-out-of-scope-v1)
11. [Open Questions](#11-open-questions)

---

## 1. Project Overview

PharmaCare is a **Windows desktop application** for managing the day-to-day operations of a single-branch private pharmacy. It replaces manual registers and spreadsheets with a fast, offline-first system that tracks medicines, records sales, calculates profits, and ensures data is never lost through an automated cloud backup strategy.

The system is designed for two types of users: the **pharmacy owner** who wants full financial visibility, and the **pharmacist/cashier** who needs a fast, simple sales interface.

### Core Problems Being Solved

| Problem | Solution |
|---|---|
| No record of what medicines are in stock | Real-time inventory with low-stock alerts |
| No tracking of medicine expiry dates | Per-batch expiry with dashboard alerts |
| Manual calculation of daily earnings | Automatic daily/monthly profit reports |
| Risk of total data loss if laptop fails | SQLite + nightly Google Drive backup |
| No visibility into profit margins | Purchase price vs retail price tracking |

---

## 2. Goals & Success Metrics

### Primary Goals
- Pharmacist can process a sale in under **30 seconds**
- Owner can see today's earnings in **one click**
- Zero data loss even if the laptop is completely destroyed
- No internet required for day-to-day operation

### Success Metrics

| Metric | Target |
|---|---|
| Time to record a sale | < 30 seconds |
| Stock accuracy | 100% (auto-deducted on sale) |
| Backup reliability | Nightly, automatic, zero manual effort |
| Report generation time | < 5 seconds for any report |
| App startup time | < 3 seconds on a standard Windows laptop |

---

## 3. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Desktop Shell | Tauri 2.0 (Rust) | Lightweight, fast, native Windows app |
| Frontend UI | React + TypeScript | Component-based, fast to build |
| Styling | Tailwind CSS + shadcn/ui | Consistent, professional UI |
| Database | SQLite (via Prisma ORM) | Local, offline, zero cost, single file |
| Backup | Google Drive API (OAuth2) | Free 15GB, reliable, easy restore |
| Charts/Reports | Recharts | React-native charting library |
| PDF Export | @react-pdf/renderer | Generate printable report PDFs |

### Why SQLite + Google Drive (Not a Cloud Database)
The app runs **100% offline**. SQLite stores all data in a single `.db` file on the laptop. Every night at 11 PM, that file is automatically uploaded to the client's Google Drive. If the laptop is destroyed, the client installs the app on a new machine, signs into Google Drive, downloads the latest backup, and restores — all in under 15 minutes. No monthly server costs. No internet dependency for daily use.

---

## 4. User Roles & Permissions

| Feature | Owner | Pharmacist/Cashier |
|---|---|---|
| Process sales | ✅ | ✅ |
| View inventory | ✅ | ✅ (view only) |
| Add / edit medicines | ✅ | ❌ |
| View purchase prices / margins | ✅ | ❌ |
| Add purchase records | ✅ | ❌ |
| Process returns | ✅ | ✅ |
| View daily sales total | ✅ | ✅ |
| View full analytics & reports | ✅ | ❌ |
| Manage users | ✅ | ❌ |
| Access settings & backup | ✅ | ❌ |
| Apply discounts | ✅ | ✅ (if enabled) |

All sessions require a username and password. Every sale is tagged with the user who made it. Passwords are hashed (bcrypt) and stored locally.

---

## 5. Module Specifications

### 5.1 Medicine Inventory

**Purpose:** Central record of every medicine stocked by the pharmacy.

**Data fields per medicine:**

| Field | Type | Notes |
|---|---|---|
| Medicine ID | Auto-increment | Primary key |
| Name | Text | e.g. "Panadol 500mg" |
| Generic Name | Text | e.g. "Paracetamol" |
| Brand Name | Text | e.g. "GSK" |
| Category | Enum | Tablet, Syrup, Injection, OTC, Prescription |
| Unit | Enum | Strip, Bottle, Vial, Box, Sachet |
| Retail Price | Decimal | Price charged to customer |
| Purchase Price | Decimal | Cost price from supplier (owner only) |
| Current Stock | Integer | Auto-updated on sale / purchase |
| Reorder Level | Integer | Alert triggers when stock falls below this |
| Shelf Location | Text | e.g. "Row 3, Column B" |
| Notes | Text | Optional |
| Is Active | Boolean | Soft delete — inactive medicines hidden from POS |

**Business Rules:**
- Retail price must always be greater than or equal to purchase price
- When stock falls to or below the reorder level, show a yellow warning badge on the dashboard
- When stock reaches zero, show a red alert and block sales of that item
- Medicines are never hard-deleted — only deactivated (to preserve sales history)
- Stock is managed at the **batch level** (see Section 5.4) so expiry can be tracked per delivery

---

### 5.2 Sales / POS (Point of Sale)

**Purpose:** The primary daily screen. Used by the pharmacist to record every sale.

**Sale Flow:**

```
1. Open New Sale
2. Search medicine by name (live search, results appear instantly)
3. Select medicine → enter quantity
4. System checks stock availability
5. Apply item-level discount (optional)
6. Repeat steps 2–5 for more items
7. Apply bill-level discount (optional)
8. Select payment method: Cash / Card / Credit
9. Confirm Sale
10. Stock auto-deducted, sale recorded, daily total updated
```

**Sale Record Fields:**

| Field | Description |
|---|---|
| Sale ID | Auto-generated |
| Sale Date & Time | Auto-captured |
| Items | List of medicines, quantities, unit prices |
| Subtotal | Before discount/tax |
| Discount | Item-level + bill-level |
| Tax | If applicable |
| Total | Final amount |
| Payment Method | Cash / Card / Credit |
| Served By | Logged-in user |
| Notes | Optional (e.g. customer name) |

**Business Rules:**
- Cannot sell a medicine with zero stock
- Cannot sell more than available stock quantity
- If payment method is "Credit", prompt for customer name and amount
- Sales are final — corrections go through the Returns module (Section 5.5)
- Stock is deducted from the **oldest batch first** (FIFO)

**POS Screen Design Priority:**
- Search must return results in under 200ms
- Entire sale must be completable with keyboard only (Tab / Enter navigation)
- Font sizes must be large enough for quick visual scanning
- No unnecessary clicks — optimized for speed

---

### 5.3 Purchase & Supplier Records

**Purpose:** Record every stock delivery that arrives at the pharmacy.

**Supplier Record Fields:**

| Field | Description |
|---|---|
| Supplier ID | Auto-generated |
| Company Name | e.g. "Medipak Distributors" |
| Contact Person | Name |
| Phone Number | |
| Address | Optional |
| Payment Terms | e.g. "Net 30 days" |
| Notes | |

**Purchase Record Fields:**

| Field | Description |
|---|---|
| Purchase ID | Auto-generated |
| Supplier | Linked to supplier record |
| Invoice Number | Supplier's invoice number |
| Purchase Date | |
| Items | List: medicine, quantity, purchase price per unit, expiry date |
| Total Cost | Auto-calculated |
| Payment Status | Paid / Pending / Partial |
| Notes | |

**Business Rules:**
- Each purchased batch creates a new entry in the `batches` table with its own expiry date
- Purchasing increases stock count automatically
- Purchase price is stored per-batch (prices may vary between orders)
- Profit margin = retail price − purchase price, calculated live

---

### 5.4 Expiry Date Tracking

**Purpose:** Prevent selling expired medicines and reduce financial loss from waste.

**How It Works:**
- Every purchase creates a **batch record** with expiry date and quantity
- When selling, the system deducts from the **oldest batch first** (FIFO)
- The dashboard shows expiry alerts in two levels:

| Alert Level | Condition | Color |
|---|---|---|
| Warning | Expires within 60 days | Yellow |
| Critical | Expires within 30 days | Red |
| Expired | Past expiry date | Dark Red + blocked from sale |

**Expiry Dashboard Widget:**
- Shows a list of medicines with upcoming expiry
- Columns: Medicine Name, Batch, Quantity, Expiry Date, Days Left
- Sortable by days remaining
- Owner can mark a batch as "returned to supplier" or "written off"

**Business Rules:**
- Expired medicines are automatically blocked from sale
- Written-off stock is deducted from inventory and logged as a loss
- Supplier returns are recorded in the Purchase module as a credit note

---

### 5.5 Returns & Refunds

**Purpose:** Handle medicines returned by customers, and stock returned to suppliers.

**Customer Return Flow:**

```
1. Select "Customer Return"
2. Search original sale (by date or sale ID) — optional
3. Select medicine being returned
4. Enter quantity returned
5. Select condition: Resellable / Damaged / Expired
6. If Resellable → stock is restored to inventory
7. If Damaged/Expired → stock written off, logged as loss
8. Sale total adjusted in financial records
```

**Supplier Return Flow:**

```
1. Select "Supplier Return"
2. Select supplier and batch being returned
3. Enter quantity and reason
4. Record credit note / refund amount from supplier
5. Stock deducted from inventory
```

**Business Rules:**
- Returns cannot exceed the original quantity sold (for customer returns)
- All returns are logged with reason, date, and user who processed them
- Financial reports reflect refunds accurately (not double-counted as revenue)

---

### 5.6 Tax & Discount

**Purpose:** Flexible tax and discount application for different sale scenarios.

**Discount Types:**

| Type | Scope | Example |
|---|---|---|
| Item Discount | Single line item | 10% off Panadol only |
| Bill Discount | Entire sale total | 5% off total bill |

**Tax Configuration:**
- Owner sets default tax rate (%) in Settings (can be 0%)
- Tax can be toggled on/off per individual sale
- System stores pre-tax subtotal and tax amount separately for clean reporting

**Business Rules:**
- Discounts are capped at 100% (cannot result in negative prices)
- Tax is calculated on the post-discount subtotal
- Pharmacist can apply discounts only if the "Allow Cashier Discounts" setting is enabled by owner
- All discount amounts are logged in sale records for audit purposes

---

### 5.7 Analytics & Reports

**Purpose:** Give the owner complete financial visibility at a glance.

**Dashboard (Home Screen for Owner):**
- Today's total sales (revenue)
- Today's profit (revenue − cost of goods sold)
- Total sales this month
- Low stock alerts count (clickable)
- Expiry alerts count (clickable)
- Top 5 selling medicines this week (mini bar chart)

**Available Reports:**

| Report | Description | Export |
|---|---|---|
| Daily Sales Summary | All sales for a selected date, total revenue, total profit | PDF |
| Monthly P&L | Revenue, COGS, gross profit by month | PDF |
| Yearly Overview | Month-by-month comparison chart | PDF |
| Top Selling Medicines | By quantity and by revenue, any date range | PDF |
| Slow-Moving Stock | Items with zero/low sales in last 30/60/90 days | PDF |
| Low Stock Report | All medicines at or below reorder level | PDF |
| Expiry Report | All medicines expiring within X days | PDF |
| Supplier Purchase History | All purchases from a specific supplier | PDF |
| Sales by User | Which cashier sold how much | PDF |
| Profit Margin Report | Purchase price vs retail price vs sales volume | PDF |

**Business Rules:**
- All reports are date-range filterable
- Purchase prices and profit data visible to Owner role only
- Reports export to PDF
- Charts use bar, line, and donut formats as appropriate

---

### 5.8 User Management

**Purpose:** Control who accesses the system and what they can do.

**User Record Fields:**
- Full Name
- Username
- Password (bcrypt hashed)
- Role (Owner / Pharmacist)
- Created Date
- Is Active (toggle to disable without deleting)

**Business Rules:**
- There must always be at least one active Owner account
- Owner cannot delete their own account
- All login attempts (success and failure) are logged
- Session persists until user logs out or app closes
- Inactive users cannot log in but their historical sales records are preserved

---

### 5.9 Data Backup & Recovery

**Purpose:** Ensure zero data loss even in case of hardware failure, theft, or disaster.

**Backup Architecture:**

```
[SQLite .db file on laptop]
        │
        ▼ (every night at 11:00 PM automatically)
[Google Drive / PharmaCare Backups folder]
        │
        ├── pharmaCare_backup_2026-06-05.db
        ├── pharmaCare_backup_2026-06-04.db
        └── pharmaCare_backup_2026-06-03.db  (keeps last 30 days)
```

**Backup Features:**

| Feature | Description |
|---|---|
| Auto Backup | Runs every night at 11 PM if internet is available |
| Manual Backup Now | Owner clicks button to trigger immediately |
| Backup to Local Folder | Optional: also copy to a USB or local path |
| Backup Status | Dashboard shows "Last backup: Today 11:02 PM ✅" |
| Missed Backup Alert | If no backup in 3 days, show warning on dashboard |
| Backup History | List of all available backups in Google Drive with dates |

**Restore Flow:**

```
1. Install PharmaCare on new laptop
2. Click "Restore from Backup"
3. Sign into Google Drive (one-time OAuth)
4. Select backup file from list (shows date + file size)
5. Confirm restore (warning: replaces current data)
6. App restores database and restarts
7. All data available as of the last backup date
```

**Local Backup (Secondary):**
- Owner can optionally configure a local folder path (e.g. a USB drive)
- App copies `.db` file there every night alongside the Google Drive backup
- Provides protection even without internet

**Business Rules:**
- Backups are named with date: `pharmaCare_backup_YYYY-MM-DD.db`
- Last 30 daily backups are kept in Google Drive; older ones auto-deleted
- Restore requires Owner role and shows a clear confirmation warning
- App never auto-restores — always requires explicit owner confirmation

---

### 5.10 Settings

**Purpose:** Configure the system to match the pharmacy's specific needs.

**Settings Sections:**

**Pharmacy Info**
- Pharmacy Name
- Owner Name
- Phone Number
- Address
- Logo upload (shown on exported reports)

**Financial Settings**
- Default Tax Rate (%)
- Tax enabled by default on new sales (toggle)
- Allow cashier to apply discounts (toggle)
- Currency symbol (default: Rs.)

**Inventory Settings**
- Default reorder level for new medicines
- Expiry warning threshold: days before expiry to show yellow alert (default: 60)
- Expiry critical threshold: days before expiry to show red alert (default: 30)

**Backup Settings**
- Google Drive: connect / disconnect account
- Auto-backup time (default: 11:00 PM)
- Local backup folder path (optional)
- Manual "Backup Now" button
- Manual "Restore from Backup" button

**User Management** (shortcut to Section 5.8)

---

## 6. Database Schema

```sql
-- Core medicine catalog
CREATE TABLE medicines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  generic_name  TEXT,
  brand_name    TEXT,
  category      TEXT NOT NULL,  -- tablet|syrup|injection|otc|prescription
  unit          TEXT NOT NULL,  -- strip|bottle|vial|box|sachet
  retail_price  REAL NOT NULL,
  reorder_level INTEGER DEFAULT 10,
  shelf_location TEXT,
  notes         TEXT,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Stock batches (one per delivery, each with expiry)
CREATE TABLE batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  purchase_id     INTEGER REFERENCES purchases(id),
  purchase_price  REAL NOT NULL,
  quantity        INTEGER NOT NULL,
  remaining_qty   INTEGER NOT NULL,
  expiry_date     TEXT NOT NULL,
  received_date   TEXT DEFAULT (datetime('now'))
);

-- Suppliers
CREATE TABLE suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name   TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  address        TEXT,
  payment_terms  TEXT,
  notes          TEXT,
  is_active      INTEGER DEFAULT 1
);

-- Purchase invoices (stock received)
CREATE TABLE purchases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id     INTEGER REFERENCES suppliers(id),
  invoice_number  TEXT,
  purchase_date   TEXT NOT NULL,
  total_cost      REAL NOT NULL,
  payment_status  TEXT DEFAULT 'pending',  -- paid|pending|partial
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Line items on each purchase invoice
CREATE TABLE purchase_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id     INTEGER NOT NULL REFERENCES purchases(id),
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  quantity        INTEGER NOT NULL,
  purchase_price  REAL NOT NULL,
  expiry_date     TEXT NOT NULL,
  batch_id        INTEGER REFERENCES batches(id)
);

-- Sales transactions
CREATE TABLE sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_date       TEXT NOT NULL,
  subtotal        REAL NOT NULL,
  discount_amount REAL DEFAULT 0,
  tax_amount      REAL DEFAULT 0,
  total           REAL NOT NULL,
  payment_method  TEXT NOT NULL,  -- cash|card|credit
  customer_name   TEXT,
  notes           TEXT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT DEFAULT (datetime('now'))
);

-- Line items on each sale
CREATE TABLE sale_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id        INTEGER NOT NULL REFERENCES sales(id),
  medicine_id    INTEGER NOT NULL REFERENCES medicines(id),
  batch_id       INTEGER NOT NULL REFERENCES batches(id),
  quantity       INTEGER NOT NULL,
  unit_price     REAL NOT NULL,
  discount       REAL DEFAULT 0,
  line_total     REAL NOT NULL
);

-- Returns (customer returns and supplier returns)
CREATE TABLE returns (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  return_type    TEXT NOT NULL,  -- customer|supplier
  reference_id   INTEGER,        -- sale_id or purchase_id
  medicine_id    INTEGER NOT NULL REFERENCES medicines(id),
  batch_id       INTEGER REFERENCES batches(id),
  quantity       INTEGER NOT NULL,
  reason         TEXT,
  condition      TEXT,           -- resellable|damaged|expired
  refund_amount  REAL DEFAULT 0,
  processed_by   INTEGER REFERENCES users(id),
  return_date    TEXT DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name    TEXT NOT NULL,
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role         TEXT NOT NULL,   -- owner|pharmacist
  is_active    INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 7. UI Screens List

| Screen | Role | Priority |
|---|---|---|
| Login | All | P0 |
| Dashboard (Owner) | Owner | P0 |
| Dashboard (Cashier) | Pharmacist | P0 |
| POS / New Sale | Both | P0 |
| Medicine List | Both | P0 |
| Add / Edit Medicine | Owner | P0 |
| Batch / Stock View | Owner | P1 |
| Expiry Alert List | Owner | P1 |
| Low Stock Alert List | Owner | P1 |
| Supplier List | Owner | P1 |
| Add / Edit Supplier | Owner | P1 |
| New Purchase Record | Owner | P1 |
| Purchase History | Owner | P1 |
| Process Return | Both | P1 |
| Return History | Owner | P1 |
| Daily Sales Report | Owner | P1 |
| Monthly P&L Report | Owner | P1 |
| All Reports Screen | Owner | P2 |
| User Management | Owner | P2 |
| Settings | Owner | P2 |
| Backup & Restore | Owner | P2 |

---

## 8. Non-Functional Requirements

**Performance**
- App must launch in under 3 seconds on a mid-range Windows laptop
- POS search must return results in under 200ms
- Any report must generate in under 5 seconds

**Reliability**
- App must function 100% offline — no feature should require internet
- Google Drive backup is best-effort (retried on next night if internet unavailable)
- SQLite write-ahead logging (WAL) enabled to prevent corruption on sudden shutdown

**Security**
- All passwords stored as bcrypt hashes — never plaintext
- Owner financial data (purchase prices, margins) never visible to Pharmacist role
- Login session required — no guest access

**Usability**
- UI language: English only
- All critical alerts (low stock, expiry, missed backup) must be visible on the dashboard without navigating
- POS screen must support keyboard-only operation

**Data Integrity**
- All stock changes (sale, purchase, return, write-off) are logged with timestamp and user
- No hard deletes — all records use soft delete or status flags
- Database backed up before any restore operation

---

## 9. Development Phases & Milestones

### Phase 1 — Foundation (Week 1–2)
- Tauri 2.0 + React + SQLite project setup
- Database schema creation and migrations
- User authentication (login, roles, session)
- Medicine inventory CRUD (add, edit, view, deactivate)

**Deliverable:** Working app with login and medicine list

### Phase 2 — POS & Sales (Week 3–4)
- POS screen with live search
- Sale recording with stock deduction (FIFO)
- Payment method selection
- Basic daily sales total on dashboard

**Deliverable:** Pharmacist can record sales end-to-end

### Phase 3 — Purchasing & Batches (Week 5)
- Supplier management
- Purchase record entry
- Batch creation with expiry dates
- Stock count updates on purchase

**Deliverable:** Owner can record incoming stock with expiry dates

### Phase 4 — Alerts & Expiry (Week 6)
- Low stock alerts on dashboard
- Expiry alerts (60-day warning, 30-day critical)
- Expiry report screen
- Low stock report screen

**Deliverable:** Dashboard shows all critical alerts

### Phase 5 — Returns & Refunds (Week 7)
- Customer return flow
- Supplier return flow
- Stock restoration / write-off logic
- Financial adjustment in reports

**Deliverable:** Complete returns handling

### Phase 6 — Analytics & Reports (Week 8–9)
- Owner dashboard with charts
- Daily sales report
- Monthly P&L report
- Top-selling and slow-moving medicine reports
- PDF export for all reports

**Deliverable:** Owner has full financial visibility

### Phase 7 — Backup & Recovery (Week 10)
- Google Drive OAuth integration
- Nightly auto-backup at 11 PM
- Manual "Backup Now" button
- Backup history list
- One-click restore flow
- Missed backup dashboard warning

**Deliverable:** Data is safe from hardware failure

### Phase 8 — Polish & Handover (Week 11–12)
- Settings screen (all sections)
- User management screen
- UI refinement and bug fixes
- Performance testing
- Client training and handover documentation

**Deliverable:** Production-ready app delivered to client

---

## 10. Out of Scope (v1)

The following features are intentionally excluded from version 1 to keep scope manageable. They can be added in a future version based on client feedback.

- Multi-branch support
- Customer accounts and loyalty points
- Credit/udhaar (debt) tracking per customer
- Barcode scanner hardware integration
- WhatsApp notifications for low stock / expiry alerts
- Prescription management and doctor records
- Insurance billing
- Mobile app companion
- Online ordering or e-commerce

---

## 11. Open Questions

These items need clarification from the client before or during development:

| # | Question | Impact |
|---|---|---|
| 1 | Does the client want a credit/udhaar system — tracking customers who buy on credit? | Affects sales module and reports |
| 2 | Does the client have an existing medicine list in Excel to import at launch? | Affects Phase 1 — need an import tool |
| 3 | How many user accounts are needed at launch? | Affects user setup during handover |
| 4 | Does the client want WhatsApp alerts for low stock? | Adds Phase 9 scope |
| 5 | What is the client's Google account for Drive backup setup? | Needed for Phase 7 |
| 6 | Does the client have a UPS for power protection? | Risk advisory only |
| 7 | What is the pharmacy's legal name for report headers? | Settings configuration |

---

*Document prepared by Muhammad Saad Khan — Applied AI Engineer*  
*For client use and developer briefing*