# PharmaCare — User Manual

**Version:** 1.0  
**Platform:** Desktop (Windows / macOS / Linux)  
**Tech Stack:** Tauri 2.0 · React · SQLite (local, offline-first)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
   - 2.1 Setup Wizard
   - 2.2 Login
   - 2.3 Password Recovery
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Dashboard](#4-dashboard)
5. [Point of Sale (POS)](#5-point-of-sale-pos)
   - 5.1 Searching Medicines
   - 5.2 Cart Operations
   - 5.3 Payment
6. [Medicine Catalog](#6-medicine-catalog)
   - 6.1 Adding Medicines
   - 6.2 Opening Stock
7. [Suppliers](#7-suppliers)
8. [Purchases](#8-purchases)
9. [Returns](#9-returns)
   - 9.1 Customer Return
   - 9.2 Supplier Return
   - 9.3 Write-Off
   - 9.4 Return History
10. [Debts](#10-debts)
11. [Reports](#11-reports)
    - 11.1 Available Reports
    - 11.2 PDF Export
    - 11.3 Expiry Report
12. [Settings](#12-settings)
13. [Backup & Restore](#13-backup--restore)
14. [Audit Log](#14-audit-log)
15. [Keyboard Shortcuts](#15-keyboard-shortcuts)
16. [Troubleshooting](#16-troubleshooting)
17. [FAQ](#17-faq)

---

## 1. Introduction

PharmaCare is a **desktop pharmacy management system** designed for independent pharmacies operating without internet. All data is stored locally on your machine using SQLite — you never need an internet connection to process sales, manage stock, or run reports.

**Core capabilities:**
- Manage medicine inventory with batch-level tracking
- Process sales using FIFO (First-Expiry-First-Out) inventory valuation
- Record purchases from suppliers with automatic batch creation
- Track customer credit (debts) with payment recording
- Process customer returns, supplier returns, and stock write-offs
- Generate 9 analytical reports with PDF export
- Automatic and manual backup with optional Google Drive sync
- Password recovery via email OTP (requires SMTP configuration)

---

## 2. Getting Started

### 2.1 Setup Wizard

The first time you launch PharmaCare, the **Setup Wizard** appears. This creates the initial Owner account.

1. Enter your **Full Name**
2. Choose a **Username** (must be unique)
3. Set a **Password** (minimum 6 characters)
4. Optionally provide an **Email** — used only for password recovery (OTP via SMTP)

After setup, you are automatically logged in as the Owner.

### 2.2 Login

1. Enter your **Username** and **Password**
2. Click **Login** (or press Enter)

Login attempts are logged for security. The error message is intentionally generic ("Invalid credentials") to prevent username enumeration.

**Password rules:** Minimum 6 characters.

### 2.3 Password Recovery

If you forget your password:

1. Click **Forgot Password?** on the login screen
2. An email OTP (6-digit code) is sent to the configured owner email
3. Enter the code and click **Verify**
4. Set a new password

**Requirements:** SMTP credentials must be configured via environment variables — contact your system administrator.

---

## 3. User Roles & Permissions

PharmaCare has two roles:

| Feature | Owner | Pharmacist |
|---------|-------|------------|
| POS (Point of Sale) | ✓ | ✓ |
| Dashboard | ✓ (with profit) | ✓ (no profit) |
| Medicine Catalog (view) | ✓ | ✓ |
| Medicines (create/edit/delete) | ✓ | ✗ |
| Customer Returns | ✓ | ✓ |
| Suppliers | ✓ | ✗ |
| Purchases | ✓ | ✗ |
| Supplier Returns | ✓ | ✗ |
| Write-Off | ✓ | ✗ |
| Return History | ✓ | ✗ |
| Expiry Report | ✓ | ✗ |
| All Reports | ✓ | ✗ |
| Settings | ✓ | ✗ |
| Debts | ✓ | ✗ |
| User Management | ✓ | ✗ |
| Audit Log | ✓ | ✗ |
| Backup & Restore | ✓ | ✗ |

**Pharmacist-specific restrictions:**
- Medicine search results **hide purchase price** (cost data)
- Dashboard **hides profit/margin** figures
- Discount application requires the `cashier_discount_enabled` setting
- Cannot see or access owner-only sidebar items

---

## 4. Dashboard

The dashboard gives you a quick overview of your pharmacy's health.

**Owner view:**
- **Today's Sales** — total revenue for the current day
- **Today's Profit** — gross profit (sales minus COGS)
- **This Month's Sales** — cumulative monthly revenue
- **Low Stock Items** — count of medicines below reorder level
- **Expiry Warnings/Critical** — batches expiring within warning/critical days
- **Top 5 Sellers (7 days)** — highest-selling medicines
- **Debts Due Soon (≤3 days)** — debts due in the next 3 days; click to view all debts

**Pharmacist view:** Same as owner but **without profit data**.

---

## 5. Point of Sale (POS)

The POS module is designed for fast, keyboard-navigable checkout.

### 5.1 Searching Medicines

1. Type in the search box — results update as you type
2. Results show: name, category, unit, retail price, available stock
3. **Pharmacist view hides purchase price**
4. Select a medicine to add it to the cart

### 5.2 Cart Operations

For each cart item you can:
- **Adjust quantity** (default: 1)
- **Set item discount** (flat amount, capped at line total)
- **Remove item** from cart

Cart totals update in real-time:
- **Subtotal** before discounts and tax
- **Bill Discount** — applied on the entire order
- **Tax** — calculated on post-discount subtotal at configured rate
- **Total** — final amount

### 5.3 Payment

1. Choose a **Payment Method**:
   - **Cash** — immediate payment
   - **Card** — card payment
   - **Credit** — requires customer name (effectively creates an off-platform IOU; use Debt Tracking for formal credit)
2. If errors occur (insufficient stock, validation failures), an error message appears inline below the confirm button
3. Click **Confirm Sale** to process
4. A **receipt dialog** shows the sale summary

**Key business rules:**
- Stock is allocated via **FIFO** — oldest-expiry batches are consumed first
- Prices are always read from the database (not from the frontend)
- Expired batches are excluded from available stock
- Pharmacist discounts only apply if enabled in Settings

**Keyboard navigation:** Tab moves through search → quantity → discount → bill discount → tax → payment → customer name → confirm.

---

## 6. Medicine Catalog

### 6.1 Adding Medicines

1. Click **Add Medicine**
2. Fill in:
   - **Name** (required)
   - **Generic Name** — active ingredient
   - **Brand Name** — manufacturer brand
   - **Category** — Tablet / Syrup / Injection / OTC / Prescription
   - **Unit** — Strip / Bottle / Vial / Box / Sachet
   - **Retail Price** — selling price (must be ≥ purchase price)
   - **Purchase Price** — cost price (hidden from pharmacists)
   - **Reorder Level** — minimum stock threshold
   - **Shelf Location** — where it's stored
   - **Notes** — any additional information
3. Click **Save**

### 6.2 Opening Stock

When creating a medicine, you can optionally set **initial stock**:
- **Initial Quantity** — starting stock count
- **Expiry Date** — expiry of the opening stock batch
- A batch is created with code `OPEN-{medicine_id}`

You can also **Edit**, **Deactivate**, or **Delete** medicines. Medicines with existing batches cannot be hard-deleted — use Deactivate instead.

---

## 7. Suppliers

Manage your list of suppliers:

1. Click **Add Supplier**
2. Fill in:
   - **Company Name** (required)
   - **Contact Person**
   - **Phone**
   - **Address**
   - **Payment Terms**
   - **Notes**
3. Click **Save**

You can **Edit**, **Deactivate**, or **Delete** suppliers. Suppliers with purchase records cannot be hard-deleted.

---

## 8. Purchases

Record stock received from suppliers:

1. Click **Record Purchase**
2. Select a **Supplier**
3. Enter **Invoice Number** and **Purchase Date**
4. Set **Payment Status**: Paid / Pending / Partial
5. Add line items:
   - Select **Medicine**
   - Enter **Quantity**, **Expiry Date**, **Unit Price**
   - The **Line Cost** is auto-calculated (qty × unit price)
6. Click **Save**

**What happens when you record a purchase:**
- A purchase header is created
- For each item: a **purchase line** is inserted and a **batch** is created with code `B-{item_id}`
- **Stock movement** is recorded (positive delta)
- All steps are wrapped in a single **atomic transaction** — if anything fails, nothing is saved

---

## 9. Returns

PharmaCare supports three types of returns, each updating stock accordingly.

### 9.1 Customer Return

Process a return from a customer sale:

1. Enter the **Sale ID** to look up
2. For each returned item:
   - Set the **Condition**: Resellable / Damaged / Expired
   - Enter the **Quantity** (cannot exceed sold amount minus already returned)
   - Resellable items → stock is restored to the original batch
   - Damaged/Expired items → marked as loss (no stock restored)
3. Click **Process Return**

### 9.2 Supplier Return

Return stock to a supplier:

1. Enter the **Purchase ID** to look up
2. Select items and enter quantities
3. Stock is deducted from the batch
4. Click **Process Return**

### 9.3 Write-Off

Write off expired or damaged stock not tied to a sale or purchase:

1. Search for a **Medicine**
2. Select a batch with available stock
3. Choose condition: **Expired** or **Damaged**
4. Enter quantity
5. Click **Write Off**

### 9.4 Return History

View all return activity (customer returns, supplier returns, write-offs) in chronological order.

---

## 10. Debts

Track customer credit/debt separately from POS credit payments:

1. **Create Debt:**
   - Enter **Customer Name** (required)
   - Add items with **Medicine Name**, **Quantity**, **Amount**
   - Set **Due Date** and optional **Notes**
   - **Total Amount** is auto-calculated

2. **Record Payment:**
   - Enter payment amount (cannot exceed remaining balance)
   - Status updates automatically: fully paid → "paid", overdue past due date → "overdue"
   - Dashboard shows counts for **overdue** and **due-soon (≤3 days)** debts

---

## 11. Reports

### 11.1 Available Reports

All reports are owner-only and can be filtered by date range (where applicable):

| # | Report | Description | Date Filter |
|---|--------|-------------|-------------|
| 1 | **Daily Sales Summary** | Sales per day: count, items, gross, discounts, tax, net, profit | ✓ |
| 2 | **Monthly P&L** | Revenue, COGS, gross profit, refunds, write-offs, net profit | ✓ |
| 3 | **Top Selling Medicines** | Top 50 medicines by quantity with revenue and profit | ✓ |
| 4 | **Slow-Moving Stock** | Active medicines with zero sales in the selected period | ✓ |
| 5 | **Low Stock** | Items at or below reorder level (no date filter — current state) | ✗ |
| 6 | **Expiry Report** | Detailed batch-level expiry with status, potential loss | ✗ (uses warning/critical days) |
| 7 | **Supplier Purchases** | Per-supplier totals: spend, order count, last purchase | ✓ |
| 8 | **Sales by User** | Per-cashier: sales count, items, revenue, profit, avg profit | ✓ |
| 9 | **Profit Margin** | Per-medicine: margin percentage, avg prices, total profit | ✓ |

### 11.2 PDF Export

Every report has a **Export PDF** button. Generated PDFs are styled with pharmacy branding and formatted currency.

### 11.3 Expiry Report

The expiry report is also available as a dedicated page in the sidebar (not just within Reports):

- Shows batch code, medicine name, quantities, unit cost, expiry date
- **Days remaining** and **status** color-coded:
  - **OK** (green) — more than warning days left
  - **Warning** (amber) — within warning window
  - **Critical** (red) — within critical window
  - **Expired** (dark red) — already past expiry
- **Potential loss** column shows financial exposure
- Monthly expiry bar chart visualizes upcoming expiries

The warning days (default 60) and critical days (default 30) are configurable in Settings → Inventory.

---

## 12. Settings

Settings are organized into four tabs:

**Pharmacy Info:**
- Pharmacy Name, Owner Name, Phone, Address
- Currency Symbol (default: Rs.)
- Logo Path

**Financial:**
- Default Tax Rate (%)
- Tax Enabled by Default
- Cashier Discount Enabled — allows pharmacists to apply discounts
- Owner Email — used for password recovery OTP

**Inventory:**
- Default Reorder Level
- Expiry Warning Days (default: 60 days)
- Expiry Critical Days (default: 30 days)

**Backup:**
- Auto Backup Time (24h format, default: 23:00)
- Local Backup Path
- Google Drive Connection
- Backup Status / Last Backup Info

---

## 13. Backup & Restore

### Creating Backups

- **Manual:** Click **Backup Now** on the Backup tab in Settings
- **Automatic:** Set a time in Backup Settings — backup runs daily at that time (app must be running)

Backup creates a compressed `.db.gz` file named `pharmaCare_backup_YYYY-MM-DD.db.gz`.

### Google Drive Backup

1. Click **Connect Google Drive**
2. Enter your **Google Drive Client ID** and **Client Secret**
3. Click **Connect** — your browser opens for OAuth authorization
4. Complete the authorization in your browser
5. Backups are uploaded to a `PharmaCareBackups` folder

### Restoring a Backup

1. Go to Settings → Backup
2. Choose source: **Local** or **Google Drive**
3. Select the backup file
4. Click **Restore**

**Safety:** PharmaCare always creates a pre-restore backup before restoring, so you can recover if something goes wrong.

---

## 14. Audit Log

View the last 100 login attempts:

- Timestamp of each attempt
- Username attempted
- Success or Failure
- Failure reason (wrong password, inactive account, etc.)

Owner only.

---

## 15. Keyboard Shortcuts

**POS:**
- `Tab` — navigate through fields in order: search → quantity → discount → bill discount → tax → payment method → customer name → confirm
- Type in search box — results filter as you type

**General:**
- `Enter` on Login page — submit login
- Close button on dialogs — cancel/close

---

## 16. Troubleshooting

### "An error occurred"
This means the backend returned an error that the frontend couldn't parse into a readable message. Check the console for the full error details. Common causes:
- Database constraint violation
- Missing column in a query (should not occur in production)
- Serialization error

### Application won't start
1. Ensure no other instance is running
2. Delete the database file (last resort — restore from backup)
3. Check the Rust backend logs in the terminal

### Google Drive backup fails
1. Verify your Client ID and Client Secret are correct
2. Ensure you've granted offline access during OAuth
3. Check internet connectivity
4. Try disconnecting and reconnecting Drive

### Email OTP not sending
1. Verify SMTP credentials are configured in environment variables
2. Check SMTP server is reachable
3. Verify the owner email address in Settings

### Stock shows negative
Stock should never go negative — all mutations go through StockLedgerService which validates qty. If this occurs, restore from backup.

---

## 17. FAQ

**Q: Do I need internet to use PharmaCare?**  
A: No. Everything runs locally. Internet is only needed for Google Drive backup and email OTP recovery.

**Q: Where is my data stored?**  
A: In a local SQLite database file in the application data directory. The exact path depends on your OS.

**Q: Can I have multiple owner accounts?**  
A: Yes. Any user with the `owner` role has full access. However, the first-run wizard creates the first owner.

**Q: What happens if power fails during a sale?**  
A: Sales use atomic SQLite transactions — either the entire sale is saved or nothing is saved. Sessions are persisted to SQLite and reloaded on restart, so you won't need to re-login.

**Q: How does FIFO work?**  
A: When a sale deducts stock, it consumes from batches in order of expiry date (earliest first). Within the same expiry date, older received batches are consumed first.

**Q: Can a pharmacist see purchase prices?**  
A: No. The pharmacist's medicine search results and POS search exclude purchase_price and hide profit data on the dashboard.

**Q: How many backups are kept?**  
A: A maximum of 30. The oldest backup is removed when creating a new one beyond the limit.

**Q: Can I restore a backup from a different version?**  
A: Backups are version-dependent due to schema migrations. Restoring a backup from a different version may not work correctly. Version migration is not supported in restore.

**Q: What payment methods are supported?**  
A: Cash, Card, and Credit. For credit sales, a customer name is required. For formal credit tracking, use the Debts module.
