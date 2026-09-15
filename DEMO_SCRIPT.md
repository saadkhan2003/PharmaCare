# PharmaCare — Full System Video Demo Script & Presentation Guide

> **Target Audience:** Pharmacy Owners, Cashiers, Investors, and System Evaluators  
> **Estimated Duration:** 8 – 11 minutes (or shorter 5-minute version using the Quick Cuts)  
> **Theme:** Lightning Fast, 100% Offline-Capable, Modern UI, Complete Pharmacy Workflow  

---

## 🎬 Pre-Recording Checklist

Before hitting record:
1. **Screen Resolution:** 1920x1080 (1080p) or 2560x1440 (1440p) at 60fps.
2. **App State:**
   - Launch app via `npm run tauri dev` or installable desktop bundle.
   - Start at the **Login Screen** (logged out).
   - Ensure dummy/sample data exists (medicines, batches, recent sales, debtor record).
3. **Display:** Clean desktop, no background notification banners or clutter.
4. **Theme:** Start in Light Mode (or Dark Mode according to preference), demo the live toggle during the video.

---

## 📋 Scene-by-Scene Script

---

### Scene 1: Introduction & High-Level Architecture
**Timestamp:** `0:00 – 0:45`  
**Location:** Login Page & Hero Branding  

#### 🖥️ What to Show on Screen:
- Open the application. Point cursor to the custom **PharmaCare** brand cross & shield logo and crisp modern **Geist typography**.
- Toggle Dark Mode and Light Mode once in the top right to show instant theme switching.

#### 🎙️ Voiceover / Script:
> *"Welcome to the complete demonstration of **PharmaCare** — a modern, ultra-fast, offline-first pharmacy management desktop application built with **Tauri 2.0, Rust, and React**.*
> 
> *Unlike slow browser-based web portals, PharmaCare is installed directly on the cashier's computer. It runs completely offline with an embedded, optimized SQLite database engine. If your internet cuts out or your server goes down, your counter never stops selling. Stock, profit, customer debts, expiry dates, and receipt printing continue working seamlessly."*

---

### Scene 2: Authentication & Role-Based Access Control (RBAC)
**Timestamp:** `0:45 – 1:15`  
**Location:** Login Card (`/login`)  

#### 🖥️ What to Show on Screen:
- Click into the Username field: type `admin` (or owner username).
- Click into the Password field: type password, click the **Eye icon** to toggle password visibility.
- Click **"Sign In"**. App transitions immediately with zero lag.
- Highlight the current user badge in the sidebar: shows **Role: Owner**.

#### 🎙️ Voiceover / Script:
> *"Let's log in. PharmaCare features strict role-based access control. Owners have full access to business reports, profit margins, user accounts, and database backups. Pharmacists and cashiers get a focused, secure interface tailored for lightning-fast sales and returns without sensitive financial leaks.*
> 
> *Notice how fast the login transition is — thanks to our local Rust backend and cached session tokens, screen navigation is instantaneous."*

---

### Scene 3: Categorized Navigation & Dashboard
**Timestamp:** `1:15 – 1:45`  
**Location:** Sidebar & Dashboard (`/`)  

#### 🖥️ What to Show on Screen:
- Hover over the **Sidebar**: Show the 4 organized categories:
  1. **Sales & Checkout** (POS, Sales History, Customer Returns)
  2. **Inventory & Stock** (Medicines, Stock Batches, Purchases, Suppliers, Supplier Returns, Write-Offs, Return History)
  3. **Finance & Reports** (Customer Debt, Supplier Debt, Reports, Expiry Report, Audit Logs)
  4. **Administration** (Users, Settings)
- Show Dashboard KPIs: Today's Sales, Profit, Low Stock Alerts, and Expiring Batches summary cards.

#### 🎙️ Voiceover / Script:
> *"Here is our newly organized navigation bar, grouped into Sales, Inventory, Finance, and Administration. Everything a pharmacist needs is at most one click away.*
> 
> *On the dashboard, we get immediate situational awareness: daily revenue, gross profit, urgent low-stock warnings, and expiring batches."*

---

### Scene 4: Point of Sale (POS) — Lightning-Fast Checkout
**Timestamp:** `1:45 – 3:15`  
**Location:** POS Page (`/pos`)  

#### 🖥️ What to Show on Screen:
1. Click **"POS"** in the sidebar. Notice zero lag and full-screen view without ugly nested scrollbars.
2. In the Search bar: type a medicine name (e.g., `Panadol` or `Amoxil`).
3. **Keyboard navigation**: Use `ArrowDown` to highlight a result, then hit **`Enter`**. Show that it immediately adds to cart and auto-focuses the quantity input!
4. Type quantity (e.g., `3`). Notice batch details: FEFO (First-Expired, First-Out) automatically assigns the batch expiring earliest.
5. Add a 2nd medicine.
6. Optional: enter a discount amount (e.g. `50`).
7. In the Payment section, select **"Cash"**.
8. Show the **Cash Tendered & Live Change Calculator**:
   - Total might be Rs. 350. Click the quick preset button **`+500`** or type `500`.
   - The UI immediately shows **"Change Due: Rs. 150.00"** in clear emerald highlight.
9. Click **"Complete Sale & Print"**.
10. The **Sale Receipt Dialog** opens:
    - Click **"Print Receipt"** to show the 80mm thermal slip print layout.
    - Show the store name, invoice number, items list, subtotal, tax, cash tendered, and change due.
11. Hit **Done / Close**. Cart resets, cursor is immediately back on the search bar ready for the next customer!

#### 🎙️ Voiceover / Script:
> *"Now let's look at the heart of the application: the **Point of Sale**. In a busy pharmacy, speed at the checkout counter is everything. Every second saved prevents queues.*
> 
> *Our search works with barcode scanners or keyboard typing. Notice I don't even have to touch the mouse: I type, press the Down Arrow, hit Enter, and the medicine is in the cart with the quantity input focused.*
> 
> *Notice the batch assignment: PharmaCare uses automated **FEFO** — First Expired, First Out. The system always dispenses the closest-to-expire batch first to prevent inventory deadstock.*
> 
> *When checking out with cash, cashiers often do mental math. PharmaCare has a built-in change calculator with quick-cash presets like +50, +100, +500, and +1000. It instantly shows the exact change due.*
> 
> *When we complete the sale, stock is instantly decremented in SQLite through our atomic stock transaction engine, and a thermal receipt is ready to print on standard 80mm receipt printers."*

---

### Scene 5: Sales History & Thermal Slip Reprinting
**Timestamp:** `3:15 – 4:00`  
**Location:** Sales History (`/sales-history`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Sales History**.
2. Notice the instant rendering (zero 300ms artificial delay).
3. Type in the search box to find a sale by invoice # or customer.
4. Click **"View Details"** on the most recent sale.
5. In the modal dialog, show the line items and click the **"Reprint Thermal Slip"** button.
6. Show that historical sales can be reprinted anytime if the receipt printer jams or a customer asks for a duplicate invoice.

#### 🎙️ Voiceover / Script:
> *"In **Sales History**, we have real-time lookup across all completed sales. Previously, if a printer jammed or a customer requested a duplicate receipt an hour later, cashiers were stuck.*
> 
> *Now, simply open the sale and click **Reprint Thermal Slip**. It opens the exact 80mm slip format with original invoice number, timestamp, and pricing."*

---

### Scene 6: Customer Returns with "Browse Recent Sales"
**Timestamp:** `4:00 – 4:45`  
**Location:** Customer Returns (`/returns/customer`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Customer Returns**.
2. Point out the new **"Browse Recent Sales"** button next to the Sale ID input.
3. Click **"Browse Recent Sales"**: a modal appears displaying the most recent transactions with Sale ID, Date, Items Count, and Total Amount.
4. Click **"Select"** on any sale.
5. The sale automatically populates! Eligible medicines and quantities purchased appear with return checkboxes.
6. Select 1 unit to return, choose reason: "Customer Changed Mind", and refund method: "Cash".
7. Click **"Process Return"**. Show the instant confirmation and return receipt dialog.

#### 🎙️ Voiceover / Script:
> *"Customer returns are often frustrating because cashiers have to search for lost sale IDs. In PharmaCare, we have a dedicated **Browse Recent Sales** picker.*
> 
> *With one click, cashiers can see today's transactions, pick the customer's purchase, select which medicines are being returned, and choose whether returned goods go back into sellable inventory or are quarantined for disposal.*
> 
> *Refunds and stock adjustments are calculated automatically with complete audit traceability."*

---

### Scene 7: Medicine Catalog & Inventory Management
**Timestamp:** `4:45 – 5:30`  
**Location:** Medicines Page (`/medicines`)  

#### 🖥️ What to Show on Screen:
1. Click **Medicines** in the sidebar.
2. Filter by Category (e.g. Tablets, Syrups, Injections).
3. Search for a medicine (e.g. `Augmentin`).
4. Click **"Add Medicine"** button:
   - Show the fields: Generic Name, Brand Name, Category, Dosage Form, Unit (strip, box, bottle), Reorder Threshold, and Default Markup Percentage.
5. Show how pagination updates smoothly without empty page traps.

#### 🎙️ Voiceover / Script:
> *"The **Medicine Catalog** organizes all pharmaceutical inventory. You can track generic vs brand names, therapeutic categories, reorder levels for automatic low-stock alerts, and pricing formulas.*
> 
> *The search bar and category filters are backed by our new composite SQLite indexes, returning queries across thousands of items in less than 5 milliseconds."*

---

### Scene 8: Stock Batches, Expiry Tracking & FEFO
**Timestamp:** `5:30 – 6:15`  
**Location:** Stock Batches (`/batches`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Stock Batches**.
2. Point out the status tabs:
   - Click **"In Stock"**
   - Click **"Due Soon (≤60d)"** (notice amber and rose warning badges)
   - Click **"Expired"** (notice clear red badges)
   - Click **"Zero Qty"**
3. Type in the search box to filter by Lot Code or Medicine Name.
4. Highlight that background refreshes happen seamlessly without any full-screen loading spinner flicker.

#### 🎙️ Voiceover / Script:
> *"Managing expiry dates is the single biggest operational challenge in a pharmacy. One expired box sold can cause legal and health consequences.*
> 
> *The **Batches** screen gives full visibility into lot numbers, supplier source, quantity remaining, and exact expiry dates. Notice our color-coded badges: green for healthy stock, amber for 60 days, rose for 30 days, and red for expired items.*
> 
> *You can filter directly by status tabs to identify batches that need immediate return to supplier or promotional clearance."*

---

### Scene 9: Purchases & Supplier Invoicing
**Timestamp:** `6:15 – 7:00`  
**Location:** Purchases Page (`/purchases`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Purchases**.
2. Notice the clean top bar with **"New Purchase Invoice"** toggle button.
3. Click **"New Purchase Invoice"** to expand the invoice entry form.
4. Show how easy it is to select a supplier, enter their invoice number, add medicines with new batch numbers, expiry dates, purchase cost, and retail price.
5. Click **"Close Form"** to show how the screen collapses to prioritize the purchase history table.

#### 🎙️ Voiceover / Script:
> *"When new stock arrives from pharmaceutical distributors, the **Purchases** module handles invoice intake. You select the supplier, type their invoice reference, and add items with their batch codes and expiry dates.*
> 
> *Submitting a purchase automatically creates new stock batches, recalculates weighted average costs, and records payable balances if the invoice was on credit.*
> 
> *The form collapses neatly so you can review historical purchase orders with full supplier breakdowns."*

---

### Scene 10: Suppliers & Supplier Debt Management
**Timestamp:** `7:00 – 7:45`  
**Location:** Suppliers (`/suppliers`) & Supplier Debts (`/debts/suppliers`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Suppliers**: Show supplier directory (contact person, phone, address).
2. Navigate to **Supplier Debts**:
   - Point out supplier balances, due dates, and paid vs unpaid amounts.
   - Highlight overdue rows with dark-mode safe contrast.
   - Click the **"Export CSV"** button to show instant statement generation for accounting.
   - Click **"Record Payment"** to show the payment modal.

#### 🎙️ Voiceover / Script:
> *"Managing distributor credit is critical for cash flow. On the **Supplier Debts** page, you see every outstanding supplier bill, due date, and payment status.*
> 
> *Overdue payments are clearly highlighted, and with one click of **Export CSV**, you can download complete vendor statements for reconciliation with your distributor or accountant."*

---

### Scene 11: Customer Debts & Ledger (Khata System)
**Timestamp:** `7:45 – 8:30`  
**Location:** Customer Debts (`/debts/customers`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Customer Debt**.
2. Show the real-time search bar: type a customer name or phone.
3. Click through the filter tabs: **All**, **Overdue**, **Due Soon**, and **Paid**.
4. Point out the new **Payment icon** (`CircleDollarSign`) on the "Record Payment" button.
5. Click **"Record Payment"**:
   - Enter partial or full payment amount.
   - Select method (Cash / Card / Bank Transfer).
   - Save payment. Show balance updating immediately.
6. Click **"Export CSV"** to demonstrate customer debt reports.

#### 🎙️ Voiceover / Script:
> *"In many local pharmacies, loyal customers buy medications on credit (Khata). PharmaCare makes tracking customer debt painless.*
> 
> *You can search by customer name or phone number, filter by overdue accounts, and record partial or full cash payments in seconds.*
> 
> *You can also export customer debt ledgers to CSV for audits or customer reminders, and the UI has full dark-mode contrast for long night shifts."*

---

### Scene 12: Write-Offs & Supplier Returns
**Timestamp:** `8:30 – 9:00`  
**Location:** Stock Write-Offs (`/inventory/write-off`) & Supplier Returns (`/returns/supplier`)  

#### 🖥️ What to Show on Screen:
1. Briefly open **Write-Offs**: Show reason codes (Damaged, Expired, Stolen, Broken Seal).
2. Briefly open **Supplier Returns**: Show items staged for return credit to distributors.
3. Open **Return History**: Show unified audit tracking of customer returns, supplier returns, and write-offs with filter tabs.

#### 🎙️ Voiceover / Script:
> *"If medicines break or expire on shelves, cashiers can record a **Write-Off** or initiate a **Supplier Return** to claim credit. Every single unit removed from stock is recorded in our non-destructive audit log with an exact reason and authorizing user."*

---

### Scene 13: Financial Reports, Analytics & Expiry PDF
**Timestamp:** `9:00 – 9:45`  
**Location:** Reports (`/reports`) & Expiry Report (`/reports/expiry`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Reports**:
   - Show the responsive layout (`flex-col md:flex-row`).
   - Select date range: Today, This Week, This Month.
   - Show the interactive charts: Sales revenue, Net Profit, Top 10 Selling Drugs.
2. Navigate to **Expiry Report**:
   - Show batch expiry forecast table.
   - Click the **"Export PDF"** button (or view preview) to demonstrate executive printable reports.

#### 🎙️ Voiceover / Script:
> *"On the **Reports** page, pharmacy owners get clear financial intelligence. Interactive Recharts show sales volume trends, gross margins, net profit, and top-moving medicines.*
> 
> *Our **Expiry Report** generates professional PDF documentation via `@react-pdf/renderer` so staff can physically walk the aisles with a checklist of items to rotate or pull."*

---

### Scene 14: Settings, Database Optimization & Cloud Backup
**Timestamp:** `9:45 – 10:30`  
**Location:** Settings (`/settings`)  

#### 🖥️ What to Show on Screen:
1. Navigate to **Settings**.
2. Show Pharmacy Profile configuration: Name, Phone, Address, Currency (`Rs.`), Receipt Header/Footer text.
3. Scroll to **Database Status & Optimization**:
   - Show database file size and path.
   - Click **"Optimize DB"**: Show success toast confirming `PRAGMA optimize; VACUUM;` executed.
4. Show **Google Drive Cloud Backup**:
   - Show backup status, last backup timestamp, and manual "Backup Now" button.

#### 🎙️ Voiceover / Script:
> *"Under **Settings**, you customize your pharmacy receipt headers, currency, and tax rates.*
> 
> *In the **Database Panel**, you have direct control over your SQLite storage. Clicking **Optimize DB** runs database vacuuming and query-planner defragmentation directly from Rust, keeping the software lightning-fast even after years of sales.*
> 
> *Best of all: even though PharmaCare is 100% offline, it includes automated **Google Drive Cloud Backup**. When an internet connection is available, encrypted database snapshots are backed up to the owner's Google Drive, protecting your business against hardware failure or laptop theft."*

---

### Scene 15: Wrap-up & Outro
**Timestamp:** `10:30 – 11:00`  
**Location:** Dashboard or POS screen in Dark Mode  

#### 🖥️ What to Show on Screen:
- Switch to Dark Mode.
- Show smooth transition across POS and Dashboard.
- Display GitHub project link or contact slide.

#### 🎙️ Voiceover / Script:
> *"PharmaCare combines the speed and security of a compiled desktop application with the clean aesthetics of modern web design. Zero recurring cloud fees, zero downtime during internet outages, automated FEFO inventory, thermal printing, and comprehensive debt tracking.*
> 
> *Available as cross-platform native binaries for Windows, Linux, and macOS. Thank you for watching!"*

---

## ⚡ 5-Minute "Speedrun" Video Outline (Alternative Short Version)

If you need a punchy, 3-to-5 minute video for quick demos or social media, follow this condensed flow:

| # | Time | Module | Key Action to Demonstrate |
|---|---|---|---|
| **1** | 0:00 – 0:30 | **Intro & Dark Mode** | Open app, show instant dark/light switch, explain offline Tauri 2.0 desktop architecture. |
| **2** | 0:30 – 1:45 | **POS & Thermal Slip** | Type medicine, `ArrowDown` + `Enter`, cash tendered with `+500` preset, live change due, click "Print Receipt" (show 80mm slip). |
| **3** | 1:45 – 2:30 | **History & Returns** | Open Sales History, click "Reprint Thermal Slip". Go to Returns, click "Browse Recent Sales" modal, select and refund. |
| **4** | 2:30 – 3:30 | **Batches & Expiry (FEFO)** | Show Batches page status tabs (`Expired`, `Due Soon ≤60d`), color-coded badges, show automated FEFO batch selection. |
| **5** | 3:30 – 4:15 | **Debts & Statements** | Open Customer & Supplier debts, filter by overdue, export CSV, record cash payment. |
| **6** | 4:15 – 5:00 | **Reports & Cloud Backup** | Show profit charts, Settings DB optimize button, and Google Drive backup summary. |

---

## 💡 Top 5 Pro-Tips for Recording

1. **Use Smooth Mouse Movements:** Avoid jittery cursor movements. Move purposefully toward buttons.
2. **Keyboard Sounds:** If your microphone captures keyboard typing, highlight the keyboard shortcuts (like typing medicine name and hitting Enter). Cashiers love keyboard-first workflows.
3. **Zoom Level:** If text looks small on 1440p or 4K monitors, press `Ctrl + +` in the app to scale UI to 110% or 125% for crystal-clear readability on mobile viewers.
4. **Pause 1 Second Between Screens:** Let each screen settle before talking about the next feature so viewers can digest the layout.
5. **Keep Test Data Realistic:** Use realistic Pakistani/international medicine names (`Panadol 500mg`, `Augmentin 625mg`, `Brufen 400mg`, `Flagyl 400mg`) and realistic prices (`Rs. 250`, `Rs. 450`) to make the demo immediately relatable.
