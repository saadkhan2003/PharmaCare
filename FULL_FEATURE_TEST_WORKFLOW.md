# PharmaCare Full Feature Test Workflow

Use this workflow to test the full project from an empty database through setup, stock intake, POS sales, returns, reports, backup, and restore.

## Step 1: First App Setup

Start here if the database is empty.

1. Open PharmaCare.
2. Create the Owner account.

Use this data:

| Field | Value |
|---|---|
| Full Name | Saad Khan |
| Username | owner |
| Password | owner123 |
| Role | Owner |
| Email | owner@test.com |

Expected result:

- Owner account is created.
- You are logged in.
- Dashboard opens.

## Step 2: Add Pharmacy Settings

Go to `Settings`.

Fill basic settings:

| Setting | Value |
|---|---|
| Pharmacy Name | Al-Shifa Pharmacy |
| Owner Name | Saad Khan |
| Phone | 03001234567 |
| Address | Main Bazaar Lahore |
| Currency | Rs. |
| Tax Rate | 5 |
| Cashier Discount Enabled | Yes |
| Default Reorder Level | 10 |
| Expiry Warning Days | 60 |
| Expiry Critical Days | 30 |
| Auto Backup Time | 23:00 |

Expected result:

- Settings save successfully.
- Currency, tax, expiry alerts, and discount rules are used later.

## Step 3: Add Pharmacist User

Go to `Users` or `User Management`.

Add:

| Field | Value |
|---|---|
| Full Name | Ali Pharmacist |
| Username | ali |
| Password | ali123 |
| Role | Pharmacist |

Expected result:

- Pharmacist user is created.
- You can later test limited access.

Do not log out yet. Continue as Owner.

## Step 4: Add Suppliers

Go to `Suppliers`.

Add supplier 1:

| Field | Value |
|---|---|
| Company Name | MedLife Distributors |
| Contact Person | Ahmed |
| Phone | 03001112222 |
| Address | Lahore |
| Payment Terms | 30 days |
| Notes | Main supplier |

Add supplier 2:

| Field | Value |
|---|---|
| Company Name | Cure Pharma Supply |
| Contact Person | Bilal |
| Phone | 03003334444 |
| Address | Karachi |
| Payment Terms | Cash |
| Notes | Backup supplier |

Expected result:

- Suppliers appear in supplier list.
- You can select them during purchase.

## Step 5: Add Medicines

Go to `Medicine Catalog`.

Add medicine 1:

| Field | Value |
|---|---|
| Name | Panadol 500mg |
| Generic Name | Paracetamol |
| Brand | GSK |
| Category | Tablet |
| Unit | Strip |
| Retail Price | 50 |
| Purchase Price | 38 |
| Reorder Level | 20 |
| Shelf Location | Rack A1 |
| Notes | Fast moving medicine |

Add medicine 2:

| Field | Value |
|---|---|
| Name | Augmentin 625mg |
| Generic Name | Amoxicillin Clavulanate |
| Brand | GSK |
| Category | Prescription |
| Unit | Box |
| Retail Price | 450 |
| Purchase Price | 360 |
| Reorder Level | 5 |
| Shelf Location | Rack B2 |
| Notes | Antibiotic |

Add medicine 3:

| Field | Value |
|---|---|
| Name | Cough Syrup |
| Generic Name | Dextromethorphan |
| Brand | Local |
| Category | Syrup |
| Unit | Bottle |
| Retail Price | 180 |
| Purchase Price | 120 |
| Reorder Level | 8 |
| Shelf Location | Rack C1 |
| Notes | Seasonal |

Add medicine 4 for expiry testing:

| Field | Value |
|---|---|
| Name | Eye Drops |
| Generic Name | Lubricant Drops |
| Brand | VisionCare |
| Category | OTC |
| Unit | Bottle |
| Retail Price | 220 |
| Purchase Price | 150 |
| Reorder Level | 5 |
| Shelf Location | Rack D1 |
| Notes | Use for expiry test |

Expected result:

- Medicines appear in catalog.
- Search works.
- Owner can see purchase price.
- Retail price lower than purchase price should be rejected if you test it.

## Step 6: Record Purchases To Create Batches

Now medicines exist, but stock may still be zero. You need purchases to create batches.

Go to `Purchases`.

Create purchase 1:

| Field | Value |
|---|---|
| Supplier | MedLife Distributors |
| Invoice No | INV-1001 |
| Date | Today |
| Payment Status | Paid |

Add items:

| Medicine | Quantity | Expiry Date | Unit Purchase Price |
|---|---:|---|---:|
| Panadol 500mg | 50 | 2026-08-30 | 38 |
| Augmentin 625mg | 20 | 2026-12-20 | 360 |
| Cough Syrup | 15 | 2026-09-15 | 120 |

Save purchase.

Create purchase 2 for FIFO test:

| Field | Value |
|---|---|
| Supplier | Cure Pharma Supply |
| Invoice No | INV-1002 |
| Date | Today |
| Payment Status | Pending |

Add item:

| Medicine | Quantity | Expiry Date | Unit Purchase Price |
|---|---:|---|---:|
| Panadol 500mg | 100 | 2027-01-15 | 40 |

Save purchase.

Create purchase 3 for expiry test:

| Field | Value |
|---|---|
| Supplier | MedLife Distributors |
| Invoice No | INV-1003 |
| Date | Today |
| Payment Status | Paid |

Add item:

| Medicine | Quantity | Expiry Date | Unit Purchase Price |
|---|---:|---|---:|
| Eye Drops | 10 | Use a near-expiry or expired date | 150 |

Expected result:

- Stock increases.
- Batches are created.
- Panadol now has two batches.
- FIFO can now be tested.
- Expiry report has data.

## Step 7: Test Medicine Search And Stock

Go to `Medicine Catalog` or `POS`.

Search:

- `Panadol`
- `Augmentin`
- `Cough`
- `Eye`

Expected result:

- Medicines appear.
- Stock quantity is visible.
- Owner sees cost data where allowed.
- Pharmacist should not see purchase price later.

## Step 8: Test POS Sale

Go to `POS`.

Create sale:

| Medicine | Quantity |
|---|---:|
| Panadol 500mg | 2 |
| Cough Syrup | 1 |

Then:

1. Add item discount on Panadol: `5`.
2. Add bill discount: `10`.
3. Keep tax enabled.
4. Payment method: `Cash`.
5. Confirm sale.

Expected result:

- Sale succeeds.
- Receipt appears.
- Panadol stock decreases by 2.
- Cough Syrup stock decreases by 1.
- Dashboard sales update.

## Step 9: Test Credit Sale

Still in `POS`.

Create sale:

| Medicine | Quantity |
|---|---:|
| Augmentin 625mg | 1 |

Then:

1. Payment method: `Credit`.
2. Customer name: `Rashid`.
3. Confirm sale.

Expected result:

- Sale succeeds only if customer name is entered.
- If customer name is empty, sale should be blocked.
- Stock decreases.

## Step 10: Test FIFO Deduction

You already created two Panadol batches:

| Batch | Expiry | Quantity |
|---|---|---:|
| Old batch | 2026-08-30 | 50 |
| New batch | 2027-01-15 | 100 |

Now sell:

| Medicine | Quantity |
|---|---:|
| Panadol 500mg | 55 |

Expected result:

- System uses old batch first.
- Old batch becomes 0.
- New batch decreases by 5.
- This confirms FIFO.

If 55 is too much for your test, sell a smaller quantity but make sure it crosses the first batch quantity.

## Step 11: Test Sale Blocking

Test these cases in POS.

Case 1: Over-quantity

1. Try selling `Panadol 500mg` quantity `9999`.
2. Confirm sale.

Expected:

- Sale is blocked.

Case 2: Expired medicine

1. Try selling `Eye Drops` if its batch is expired.
2. Confirm sale.

Expected:

- Sale is blocked or expired batch is excluded from available stock.

Case 3: Zero stock

1. Use a medicine with no valid stock.
2. Try selling it.

Expected:

- Sale is blocked.

## Step 12: Test Customer Return

Use the Sale ID from Step 8.

Go to `Customer Return`.

Workflow:

1. Search original sale.
2. Select `Panadol 500mg`.
3. Return quantity: `1`.
4. Condition: `Resellable`.
5. Reason: `Customer returned sealed strip`.
6. Process return.

Expected result:

- Return succeeds.
- Panadol stock increases by 1.
- Return history records it.

Now test damaged return:

1. Search another sale.
2. Select item.
3. Return quantity: `1`.
4. Condition: `Damaged`.
5. Reason: `Opened or damaged`.
6. Process return.

Expected result:

- Stock does not increase.
- Loss is logged.
- Return history records damaged return.

## Step 13: Test Supplier Return

Go to `Supplier Return`.

Use purchase from Step 6.

Workflow:

1. Search purchase `INV-1001` or purchase ID.
2. Select `Augmentin 625mg`.
3. Return quantity: `2`.
4. Reason: `Near expiry stock returned`.
5. Credit note: `CN-001`.
6. Process supplier return.

Expected result:

- Augmentin stock decreases by 2.
- Supplier return is recorded.
- Return history shows it.

## Step 14: Test Write-Off

Go to `Write-Off`.

Use:

| Field | Value |
|---|---|
| Medicine | Cough Syrup |
| Batch | Select available batch |
| Quantity | 2 |
| Condition | Damaged |
| Reason | Broken bottles |

Expected result:

- Cough Syrup stock decreases by 2.
- Loss is recorded.
- Return history shows write-off.

## Step 15: Test Return History

Go to `Return History`.

Expected records:

- Resellable customer return.
- Damaged customer return.
- Supplier return.
- Write-off.

Check:

- Date.
- Medicine.
- Quantity.
- Type.
- Reason.
- User.

## Step 16: Test Debt Tracking

Go to `Debts`.

Create debt:

| Field | Value |
|---|---|
| Customer Name | Rashid |
| Due Date | 3 days from today |
| Notes | Regular customer |

Add items:

| Item | Quantity | Amount |
|---|---:|---:|
| Panadol 500mg | 2 | 100 |
| ORS Sachet | 5 | 150 |

Total should be `Rs. 250`.

Save debt.

Then record payment:

| Payment | Value |
|---|---:|
| Amount Paid | 100 |

Expected result:

- Remaining amount becomes `Rs. 150`.
- Status becomes partial or unpaid.
- If due date is near, dashboard shows due-soon.

## Step 17: Test Reports

Go to `Reports`.

Test each report after you have sales, purchases, returns, and write-offs.

Open:

1. Daily Sales Summary.
2. Monthly P&L.
3. Top Selling Medicines.
4. Slow-Moving Stock.
5. Low Stock.
6. Expiry Report.
7. Supplier Purchases.
8. Sales by User.
9. Profit Margin.

Use date range:

| Start Date | End Date |
|---|---|
| Today minus 7 days | Today |

Expected result:

- Reports show data.
- Sales report shows POS sales.
- P&L shows profit, refunds, and write-offs.
- Supplier report shows purchases.
- Top selling includes Panadol.
- Expiry report includes Eye Drops.
- Low stock shows medicines below reorder level.

## Step 18: Test PDF Export

From Reports:

1. Open Daily Sales Summary.
2. Click Export PDF.
3. Save or download PDF.
4. Repeat for Monthly P&L or Expiry Report.

Expected result:

- PDF is generated.
- Pharmacy name appears.
- Report table or chart appears.
- Owner-only financial data is included only for owner.

## Step 19: Test Expiry Report

Go to `Expiry Report`.

Expected:

- Eye Drops appears if near expiry or expired.
- Status color is based on days remaining.
- Expired stock should not be sellable.
- Potential loss appears if implemented.

Then try:

1. Write off expired Eye Drops.
2. Return to Expiry Report.
3. Confirm stock changed.

## Step 20: Test Pharmacist Restrictions

Log out.

Log in as:

| Username | Password |
|---|---|
| ali | ali123 |

Test:

1. Open POS.
2. Search Panadol.
3. Make a small sale.
4. Check Dashboard.
5. Try opening Reports.
6. Try opening Settings.
7. Try seeing purchase price.

Expected result:

- POS works.
- Customer return may work.
- Reports are blocked or hidden.
- Settings are blocked or hidden.
- Purchase price is hidden.
- Profit is hidden.

## Step 21: Test Audit Log

Log out and log in as Owner again.

Go to `Audit Log`.

Expected:

- Successful owner login is recorded.
- Successful pharmacist login is recorded.

Now test failed login:

1. Log out.
2. Enter username `ali`.
3. Enter wrong password `wrong123`.
4. Try login.
5. Log in as owner.
6. Open Audit Log.

Expected:

- Failed login appears.
- Reason or status appears.

## Step 22: Test Backup

Go to `Settings -> Backup`.

Local backup test:

1. Set local backup path.
2. Click Backup Now.
3. Confirm backup is created.

Expected:

- Backup status updates.
- Backup file is created.

Google Drive test, if configured:

1. Enter Google Drive credentials.
2. Connect Drive.
3. Complete browser authorization.
4. Click Backup Now.

Expected:

- Backup uploads to Drive.
- Last backup status updates.

## Step 23: Test Restore

Only do this after you have a backup.

Workflow:

1. Create manual backup.
2. Add a test medicine named `Restore Test Medicine`.
3. Confirm it exists.
4. Go to Restore.
5. Restore previous backup.
6. Reopen medicine catalog.

Expected result:

- System creates pre-restore backup.
- Data returns to previous state.
- `Restore Test Medicine` should disappear if it was added after backup.

## Best Full Test Order

Follow exactly this order:

1. Setup Owner.
2. Configure Settings.
3. Add Pharmacist user.
4. Add Suppliers.
5. Add Medicines.
6. Record Purchases to create batches.
7. Check medicine stock.
8. Run normal POS sale.
9. Run credit sale.
10. Test FIFO sale.
11. Test blocked sale cases.
12. Process customer return.
13. Process supplier return.
14. Process write-off.
15. Check return history.
16. Create debt.
17. Record debt payment.
18. Check dashboard.
19. Check reports.
20. Export PDF.
21. Check expiry report.
22. Test pharmacist restrictions.
23. Check audit log.
24. Run backup.
25. Test restore.

This order lets you test every feature because each later feature has the required data from earlier steps.
