# PharmaCare — Testing Guide

## How to Run

```bash
npm run tauri dev
```

This starts the app in dev mode. The SQLite database is created at `%APPDATA%/com.pharmacare.app/pharmacare.db` (Windows) or `~/.local/share/com.pharmacare.app/pharmacare.db` (Linux).

---

## 1. First Launch & Setup

| Step | Action | Expected Result |
|------|--------|----------------|
| 1.1 | Launch the app fresh (no database) | **Setup Wizard** appears — not the login screen |
| 1.2 | Fill in: Full Name, Username, Password (≥6 chars), confirm password | Fields accept input |
| 1.3 | Click "Create Owner Account" | Loading spinner shows. On success, redirected to app |
| 1.4 | Log out (click Sign Out in header) | Returns to login screen |
| 1.5 | Log back in with the created Owner credentials | Dashboard loads |

---

## 2. Sidebar & Navigation

| Step | Action | Expected Result |
|------|--------|----------------|
| 2.1 | **Desktop: Collapse sidebar** | Click the `PanelLeftClose` icon at the bottom of sidebar or the toggle in the header. Sidebar shrinks to icons-only (3rem width) with smooth animation |
| 2.2 | **Desktop: Expand sidebar** | Click `PanelLeft` icon. Sidebar expands back to full width (16rem) |
| 2.3 | **Mobile: Open sidebar** | Shrink browser to mobile width (<768px). Hamburger `Menu` icon appears in header. Click it → sidebar slides in as a drawer overlay |
| 2.4 | **Mobile: Close sidebar** | Click the X on the drawer or tap outside. Sidebar closes |
| 2.5 | Navigate to each page | Click each nav item → page loads with fade-in animation |

---

## 3. User Management (Owner only)

| Step | Action | Expected Result |
|------|--------|----------------|
| 3.1 | Go to Users page | Lists all users. At least one Owner shows |
| 3.2 | Click "Add User" | Dialog opens with Full Name, Username, Password, Role fields |
| 3.3 | Create a Pharmacist user | Fill details → Click "Create User" → spinner shows → user appears in list → success |
| 3.4 | Deactivate a user | Click `EyeOff` icon on a user → confirmation dialog → confirm → user badge changes to Inactive |
| 3.5 | Try deactivating yourself | Button should be disabled (cannot deactivate own account) |
| 3.6 | **Delete** a user (with no sales) | Click `Trash2` icon → confirmation → user permanently deleted |
| 3.7 | Try deleting self | Button disabled (cannot delete own account) |
| 3.8 | Login as Pharmacist | Sign out → log in with pharmacist credentials → sidebar shows limited items |
| 3.9 | Change password | Go to Users → Change Password → enter current + new password → submit |

---

## 4. Medicine Inventory

| Step | Action | Expected Result |
|------|--------|----------------|
| 4.1 | Go to Medicines | Shows empty list with "No medicines found" message |
| 4.2 | Click "Add Medicine" | Form dialog opens with all fields |
| 4.3 | Fill required fields | Name, Category (dropdown: Tablet/Syrup/Injection/OTC/Prescription), Unit (dropdown: Strip/Bottle/Vial/Box/Sachet), Retail Price (≥ Purchase Price) |
| 4.4 | Set Opening Stock (optional) | Enter Quantity (e.g., 100) and Expiry Date → batch created automatically |
| 4.5 | Submit | Loading spinner → medicine appears in list with stock count |
| 4.6 | Edit medicine | Click pencil icon → form pre-populates → change price → save |
| 4.7 | Search medicines | Type in search bar → results filter live with 300ms debounce |
| 4.8 | Deactivate medicine | Click `EyeOff` icon → confirm → medicine shows as Inactive |
| 4.9 | Check pharmacist view | Login as Pharmacist → Medicines page → purchase_price column hidden, no add/edit buttons |
| 4.10 | **Delete** medicine (no batches) | Click `Trash2` icon → confirm → permanently removed. If batches exist → error message "Deactivate instead" |

---

## 5. Suppliers

| Step | Action | Expected Result |
|------|--------|----------------|
| 5.1 | Go to Suppliers | Empty list with "No suppliers found" |
| 5.2 | Add supplier | Fill: Company Name, Contact Person, Phone, Address, Payment Terms → Submit |
| 5.3 | Edit supplier | Pencil icon → edit → save |
| 5.4 | Search suppliers | Search by name or phone |
| 5.5 | Deactivate supplier | `EyeOff` icon → confirm → shows Inactive |
| 5.6 | **Delete** supplier (no purchases) | `Trash2` → confirm → removed. If has purchases → error |

---

## 6. Purchases (Record Stock Intake)

| Step | Action | Expected Result |
|------|--------|----------------|
| 6.1 | Go to Purchases | Shows existing purchase records |
| 6.2 | Click "New Purchase" | Purchase form opens with: Supplier selector, Invoice Number, Date, Items table |
| 6.3 | Select supplier | Dropdown lists all active suppliers |
| 6.4 | Add items | Click "Add Item" → search medicine → enter Quantity, Purchase Price, Expiry Date → line total auto-calculates |
| 6.5 | Submit | Loading spinner → success receipt shows with total cost → stock increases on medicine list |
| 6.6 | Verify stock increased | Go to Medicines → the purchased medicine shows increased stock |
| 6.7 | View purchase history | Purchase list shows date, supplier, items count, total, payment status |
| 6.8 | Check batch created | Go to Expiry Report → new batch appears with expiry date |

---

## 7. Point of Sale (POS)

| Step | Action | Expected Result |
|------|--------|----------------|
| 7.1 | Go to POS | Two-panel layout: search bar on left, empty cart on right |
| 7.2 | Search medicine | Type name → live results in <200ms with stock badges (green=in stock, red=zero) |
| 7.3 | Select medicine | Click → added to cart with quantity 1. Can change quantity inline |
| 7.4 | Add multiple items | Search and add 2-3 different medicines |
| 7.5 | Apply item discount | Click discount field on a line item → enter amount → line total updates |
| 7.6 | Apply bill discount | Enter discount in payment form → total updates |
| 7.7 | Toggle tax | Toggle tax switch → total recalculates with tax |
| 7.8 | Select payment method | Cash / Card / Credit. If Credit → customer name field appears |
| 7.9 | Confirm sale | Press Enter or click "Confirm Sale" → loading spinner → receipt dialog shows with sale_id, items, totals |
| 7.10 | Verify stock deducted | Go to Medicines → stock decreased by sold quantity |
| 7.11 | **Edge case: sell expired medicine** | Should be blocked — error message shown |
| 7.12 | **Edge case: sell more than stock** | Should be blocked — error at confirm |
| 7.13 | **Keyboard flow** | Tab through: search → results → quantity → discount → bill discount → tax → payment → confirm. Entire sale without mouse |

---

## 8. Dashboard

| Step | Action | Expected Result |
|------|--------|----------------|
| 8.1 | **Owner dashboard** | Shows KPI cards: Today's Sales (💰), Today's Profit (green text +📈), Monthly Sales (📅) |
| 8.2 | Alert cards | Low Stock count (clickable → /medicines), Expiry Warnings (≤60d amber, ≤30d red) |
| 8.3 | Top sellers chart | Recharts BarChart showing top 5 medicines by quantity |
| 8.4 | Backup widget | Shows last backup status and time (if configured) |
| 8.5 | Missed backup warning | If no backup in 3+ days → amber warning banner (clickable → /settings) |
| 8.6 | **Pharmacist dashboard** | Login as Pharmacist → only Today's Sales KPI, Low Stock and Expiry alerts. No profit data |
| 8.7 | Cards have hover effect | Hover any KPI card → lifts up with shadow |

---

## 9. Expiry Report

| Step | Action | Expected Result |
|------|--------|----------------|
| 9.1 | Go to Expiry Report | Table with: Medicine Name, Batch, Quantity, Expiry Date, Days Left |
| 9.2 | Color coding | Green (>60d), Amber (31-60d), Red (1-30d), Dark Red (expired) |
| 9.3 | Filters | Filter by: All, ≤30 days, ≤60 days, ≤90 days, Expired |
| 9.4 | Sort by clicking column header | Table sorted by days remaining |

---

## 10. Returns

### 10.1 Customer Return

| Step | Action | Expected Result |
|------|--------|----------------|
| 10.1 | Go to Returns → Customer Return | Form with sale search |
| 10.2 | Search sale by ID | Enter sale ID → sale details load with items and quantities |
| 10.3 | Select items to return | Choose condition: Resellable / Damaged / Expired |
| 10.4 | Enter refund amount | Defaults to unit price × qty (can change for partial refund) |
| 10.5 | Process return | Loading spinner → stock restored (if resellable) or written off (if damaged/expired) |
| 10.6 | Verify | Go to Medicines → stock increased (resellable) or decreased (write-off) |

### 10.2 Supplier Return

| Step | Action | Expected Result |
|------|--------|----------------|
| 10.7 | Go to Returns → Supplier Return | Form with purchase search |
| 10.8 | Search purchase by ID | Purchase loads with its batches |
| 10.9 | Select batch, enter quantity | Only unsold qty can be returned |
| 10.10 | Enter credit note amount | Amount from supplier |
| 10.11 | Process | Stock deducted, credit logged |

### 10.3 Write-Off

| Step | Action | Expected Result |
|------|--------|----------------|
| 10.12 | Go to Returns → Write Off | Medicine search + batch selection |
| 10.13 | Select batch + reason | Expired / Damaged → enter qty → confirm |
| 10.14 | Process | Stock deducted, loss logged |

### 10.4 Return History

| Step | Action | Expected Result |
|------|--------|----------------|
| 10.15 | Go to Returns → History | Table of all returns with type badge, date, medicine, condition, amount |

---

## 11. Reports (Owner only)

| Step | Action | Expected Result |
|------|--------|----------------|
| 11.1 | Go to Reports | Master list of 9 report types grouped by category |
| 11.2 | Select report | Click any report → detail view loads with date range picker |
| 11.3 | Daily Sales Summary | LineChart + table of daily sales. Date filter works |
| 11.4 | Monthly P&L | BarChart (revenue vs profit by month) |
| 11.5 | Top Selling Medicines | Horizontal BarChart + table |
| 11.6 | Slow-Moving Stock | Table of items with zero sales in date range |
| 11.7 | Low Stock Report | Table with alert badges |
| 11.8 | Expiry Report | Color-coded days remaining |
| 11.9 | Supplier Purchase History | Table |
| 11.10 | Sales by User | BarChart |
| 11.11 | Profit Margin | Table + per-medicine margin analysis |
| 11.12 | Export to PDF | Click "Export PDF" → downloads a formatted PDF with pharmacy name header |
| 11.13 | **Pharmacist access blocked** | Login as Pharmacist → Reports nav item not visible |

---

## 12. Settings (Owner only)

| Step | Action | Expected Result |
|------|--------|----------------|
| 12.1 | Go to Settings | Tabbed page: Pharmacy Info, Financial, Inventory, Backup |
| 12.2 | **Pharmacy Info** | Edit name, owner, phone, address, logo path → Save → success message |
| 12.3 | **Financial** | Set default tax rate (%), toggle tax default, toggle cashier discount, set currency → Save |
| 12.4 | **Inventory** | Set reorder level, expiry warning/critical days → Save |
| 12.5 | **Backup** | See connection status. Configure Drive, set auto-backup time, set local folder path |
| 12.6 | Manual backup | Click "Backup Now" → processes (VACUUM INTO + gzip) |
| 12.7 | Restore | Click "Restore" → confirmation → pre-restore backup → restore |

---

## 13. Backup & Restore

| Step | Action | Expected Result |
|------|--------|----------------|
| 13.1 | Google Drive connection | In Settings → Backup → "Connect Google Drive" → opens browser for OAuth |
| 13.2 | Auto-backup | At configured time (default 11 PM), app backs up if open. On next launch if time passed |
| 13.3 | Local backup | Configure local folder path → backups also saved there |
| 13.4 | Backup file format | `pharmaCare_backup_YYYY-MM-DD.db.gz` — gzip compressed |
| 13.5 | Restore flow | Select backup → warning confirmation → pre-restore backup created → database replaced → app restarts |
| 13.6 | Dashboard status | Shows "Last backup: Today HH:MM PM ✅" |
| 13.7 | Missed backup warning | If 3+ days without backup → amber warning banner appears |

---

## 14. Soft Delete vs Hard Delete

| Action | Icon | Behavior | Restriction |
|--------|------|----------|-------------|
| **Deactivate** (`EyeOff`) | 👁️‍🗨️ | Sets `is_active = false`. Item hidden but data preserved | None |
| **Delete** (`Trash2`) | 🗑️ | Permanently removes from database | Blocked if entity has related records |

| Entity | Deactivation keeps... | Deletion blocked if... |
|--------|----------------------|----------------------|
| Medicine | Sales history in reports | Has stock batches |
| Supplier | Purchase records | Has purchases |
| User | Sales records assigned to them | Has sales transactions |

---

## 15. Toast Notifications

| Action | Toast Type | Duration |
|--------|-----------|----------|
| Successful save | ✅ Success (green) | 4s auto-dismiss |
| Failed operation | ❌ Error (red) | 4s auto-dismiss |
| Informational | ℹ️ Info (blue) | 4s auto-dismiss |
| Warning | ⚠️ Warning (amber) | 4s auto-dismiss |

Toasts appear in the bottom-right corner with a slide-in animation and close button.

---

## 16. Build for Production

```bash
# Linux (deb/rpm)
npx @tauri-apps/cli@2 build

# Windows (MSI) — run on Windows
npx @tauri-apps/cli@2 build
```

Output is in `src-tauri/target/release/bundle/`.

---

## 17. Quick Smoke Test (5 min)

```
1. Launch app → Setup Wizard creates Owner ✓
2. Settings → set pharmacy name, tax 10%, currency Rs. ✓
3. Medicines → Add "Panadol 500mg" (Tablet, Strip, 10.00 retail, 5.00 purchase) with stock 50 ✓
4. Medicines → Add "Augmentin 1g" (Tablet, Strip, 50.00 retail, 30.00 purchase) with stock 20 ✓
5. Suppliers → Add "MediDist" ✓
6. Purchases → Record purchase of 20 Panadol from MediDist ✓
7. POS → Sell 2 Panadol, 1 Augmentin → confirm ✓
8. Dashboard → See today's sales, profit ✓
9. Reports → Daily Sales Summary → Export PDF ✓
10. Users → Add pharmacist user → login as pharmacist → limited view ✓
11. Returns → Process customer return for 1 Panadol (resellable) ✓
12. Settings → Backup → "Backup Now" ✓
```
