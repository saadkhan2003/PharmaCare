# Feature Landscape: PharmaCare Pharmacy Management

**Domain:** Single-branch private pharmacy management, Windows desktop, offline-first  
**Researched:** 2026-06-05  
**Feature confidence:** HIGH for PRD-aligned v1 scope; MEDIUM for broader competitor ecosystem patterns

## Ecosystem Snapshot

Pharmacy management products commonly cluster around six feature families:

1. **Counter workflow / POS** — fast sale entry, payment capture, discounts, receipts, user attribution.
2. **Inventory control** — medicine catalog, stock quantities, reorder levels, supplier purchases, batch/lot tracking, expiry handling.
3. **Financial visibility** — daily sales, gross profit, purchase costs, margin reports, cashier performance, exportable reports.
4. **Safety / compliance workflow** — sale blocking, stock validation, controlled substance reporting, prescription checks, audit trails.
5. **Patient engagement** — refills, SMS, loyalty, med-sync, reminders, mobile apps.
6. **Enterprise / specialty modules** — multi-store, insurance adjudication, e-prescribing, compounding, long-term-care, delivery, centralized reporting.

For **PharmaCare v1**, the winning scope is not “full US-style pharmacy dispensing software.” It is a **fast, local, low-cost operating system for a single private pharmacy**: inventory + POS + purchase batches + expiry + owner reports + backup. The PRD correctly excludes many advanced ecosystem features that would add months of complexity without improving the core daily workflow.

---

## Table Stakes

Features users will expect from a credible pharmacy management system. Missing these means the product fails its stated purpose or users fall back to registers/spreadsheets.

| Feature Group | Required Capabilities | Why Expected | Complexity | Dependencies / Notes |
|---|---|---|---|---|
| **Local authentication + roles** | Login, bcrypt password hash, Owner vs Pharmacist/Cashier permissions, inactive users, login attempts | Protects purchase prices, margins, settings, backup/restore, and user actions | Medium | Foundation for all owner-only reports, settings, backup, and audit history |
| **Medicine catalog** | Name, generic, brand, category, unit, retail price, reorder level, shelf location, notes, active/inactive | A pharmacy app starts with an accurate medicine master list | Medium | Must support soft delete so historic sales remain valid |
| **Batch-level stock tracking** | Purchase price, received date, expiry date, remaining quantity per batch | Medicines expire and purchase costs change per delivery; simple quantity-only stock is insufficient | High | Required before reliable expiry alerts, FIFO sales, profit, returns, and write-offs |
| **Fast POS / sales workflow** | Live search, add line items, quantity, stock validation, discounts, tax, payment method, confirm sale | Daily counter speed is the most visible value; target is sale under 30 seconds | High | Requires medicine catalog, batch stock, keyboard UX, sale transaction model |
| **Stock blocking rules** | Prevent zero-stock, over-quantity, and expired-batch sales | Prevents financial loss and unsafe medicine sale | Medium | Depends on batch selection and expiry status; must run at sale confirmation, not only UI search |
| **FIFO stock deduction** | Deduct oldest valid batch first during sale | Reduces expiry waste and keeps batch quantities accurate | High | Depends on purchase/batch data; must be transactional to avoid partial deductions |
| **Supplier management** | Supplier list, contact details, payment terms, active/inactive | Needed to record incoming stock and supplier history | Low-Medium | Can be simple in v1; no need for full procurement automation |
| **Purchase entry** | Purchase invoice, items, quantity, purchase price, expiry, total cost, payment status | Keeps stock and cost of goods accurate | High | Creates batches; drives inventory, expiry, profit reports, supplier purchase history |
| **Low-stock alerts** | Reorder level, low/zero stock dashboard cards and report | Prevents missed sales due to stock-outs | Medium | Depends on current stock derived from batches; should be clickable from dashboard |
| **Expiry alerts** | Warning/critical/expired lists, configurable thresholds, block expired stock | Expiry is a core pharmacy risk and a PRD problem statement | High | Depends on batch expiry; supports supplier return/write-off actions |
| **Customer returns** | Return against sale where possible, quantity validation, resellable/damaged/expired condition, refund adjustment | Real stores need corrections without corrupting sales history | High | Depends on sales, sale items, batches, stock movement logging, financial adjustment logic |
| **Supplier returns / write-offs** | Return batch quantity to supplier, record credit note/refund, write off expired/damaged stock as loss | Reduces expiry loss and keeps inventory truthful | High | Depends on batches, suppliers, purchases, return records, reports |
| **Dashboard** | Owner: today sales/profit/month sales/alerts/top sellers. Cashier: sales workflow and limited daily totals | Owner needs one-click visibility; cashier needs operational simplicity | Medium | Must enforce financial data visibility by role |
| **Reports + PDF export** | Daily sales, monthly P&L, top sellers, slow-moving stock, low stock, expiry, supplier purchases, cashier sales, margin report | Pharmacy owners expect operational and financial reports | High | Depends on clean sale/purchase/return data; PDF headers need pharmacy settings |
| **Settings** | Pharmacy info, currency, tax, discount permission, expiry thresholds, reorder defaults, backup options | Allows one installation to match the real pharmacy | Medium | Should ship after core flows but before handover |
| **Automated backup + explicit restore** | Nightly Google Drive backup, manual backup, local-folder fallback, backup history, missed-backup alert, owner-only restore | PRD success metric: avoid data loss if laptop fails | High | Depends on stable SQLite location, WAL/checkpoint strategy, restore safety backup, Google OAuth |
| **Audit / stock movement log** | Log all stock-affecting events with user, timestamp, reason | Required to explain stock discrepancies and preserve trust | Medium-High | Should be designed early; retrofit is painful |

### Non-Negotiable UX Table Stakes

| UX Requirement | Target | Complexity | Notes |
|---|---:|---|---|
| App startup | < 3 seconds | Medium | Avoid heavy startup report queries; lazy-load dashboards if needed |
| POS medicine search | < 200ms | Medium | Needs indexed local search by name/generic/brand; keyboard-first UI |
| Sale completion | < 30 seconds | High | Minimize modals and mouse-only interactions |
| Report generation | < 5 seconds | Medium | Use indexed queries and bounded date ranges |
| Offline operation | 100% daily use offline | High | No core workflow may depend on Google Drive or internet |

---

## Differentiators for PharmaCare

These features are not always present in small local systems or spreadsheets, but they create meaningful competitive advantage for this specific client.

| Differentiator | Value Proposition | Complexity | Dependencies / Implementation Notes |
|---|---|---|---|
| **Offline-first Windows desktop with zero server cost** | Fits a single-branch private pharmacy running from a Windows laptop; avoids monthly cloud fees and internet dependency | High | Tauri + local SQLite; all core workflows local; backup is disaster recovery, not source of truth |
| **Nightly Google Drive disaster-recovery backup** | Stronger than most local register/spreadsheet workflows; owner can recover after laptop theft/failure | High | Must handle missed internet, backup history, retention, explicit owner restore, backup-before-restore |
| **Keyboard-first POS optimized for under 30 seconds** | Competes on counter speed rather than feature bloat | High | Needs careful interaction design, hotkeys, focus management, fast search, minimal confirmation friction |
| **Owner-only profit visibility using batch purchase cost** | Gives more accurate margins than systems that only store one cost per medicine | High | Requires per-batch purchase price and FIFO mapping from sale items to batches |
| **Expiry-loss prevention workflow** | Upcoming-expiry alerts plus supplier return/write-off actions reduce real money loss | High | Requires batch-level expiry, dashboard alerts, return/write-off records, loss reporting |
| **Simple pharmacist mode** | Cashier can sell and handle basic returns without seeing margins or settings | Medium | Role-based screen simplification; prevents accidental business-data leaks |
| **Local-folder / USB backup fallback** | Practical for unreliable internet and local business habits | Medium | Backup scheduler, file path validation, missed-path alerts |
| **Low-friction reports as printable PDFs** | Owner can share or archive reports without Excel skills | Medium | Needs pharmacy header settings, date filters, PDF renderer, role restrictions |
| **Loss-aware returns and write-offs** | Financial reports reflect refunds and expired/damaged stock instead of hiding losses | High | Requires returns model, stock movement log, P&L logic, refund logic |

### Good Future Differentiators, But Not v1

| Future Feature | Why Valuable | Defer Because | Complexity |
|---|---|---|---|
| **Excel/CSV initial import wizard** | Speeds migration from spreadsheets/registers | Open question; can be one-time admin tool after schema stabilizes | Medium |
| **WhatsApp/SMS low-stock and expiry alerts** | Owner receives alerts without opening app | Requires internet, messaging provider, phone/account setup | Medium-High |
| **Barcode scanner support** | Faster item selection if products have usable barcodes | PRD excludes hardware integration; keyboard search is enough for v1 | Medium |
| **Customer credit/udhaar ledger** | Useful if pharmacy sells on credit often | PRD only prompts customer name for credit sale; full receivables changes reports and collections workflow | High |
| **Purchase order recommendations** | Reorder suggestions from sales velocity | Needs sales history first; v1 reorder levels are enough | Medium-High |
| **Inventory adjustment approval flow** | Better audit control when multiple staff adjust stock | Likely unnecessary for small single-branch v1 | Medium |
| **Dashboard trend forecasting** | Helps owner plan purchasing | Requires months of reliable data | Medium |

---

## Anti-Features

Features to deliberately avoid in v1 even though larger pharmacy platforms advertise them.

| Anti-Feature | Why Avoid for PharmaCare v1 | What to Do Instead | Complexity Avoided |
|---|---|---|---|
| **Multi-branch / chain management** | Conflicts with single-branch scope and adds stock transfer, central reporting, branch permissions, sync complexity | Keep one local SQLite database for one branch | Very High |
| **Cloud database / always-online SaaS** | Violates offline-first and no-monthly-cost constraints | Use SQLite locally; Google Drive only for backup | High |
| **Full prescription management / doctor records** | Outside PRD; expands into clinical, legal, and prescription workflow complexity | Track medicines sold as retail/POS items only | Very High |
| **Insurance adjudication / third-party reconciliation** | Common in US systems but not required for target private pharmacy v1; heavy compliance/integration burden | Payment method = Cash/Card/Credit; report totals locally | Very High |
| **Patient profiles, loyalty, med-sync, refill reminders** | Nice in advanced platforms but not core to replacing registers/spreadsheets | Optional customer name only for credit sales/notes | High |
| **Full udhaar/receivables ledger** | Changes sales, payments, collections, aging reports, customer identity, and privacy scope | For v1: allow Credit payment method + customer name/amount note only | High |
| **Mobile app companion** | Adds deployment, auth, sync, and support overhead | Windows desktop only | High |
| **Online ordering / e-commerce** | Changes product into customer-facing sales channel and requires internet/catalog/payment/shipping | In-store POS only | Very High |
| **Compounding module** | Specialized workflow for formulas, ingredients, scales, labels, compliance | Treat compounded items manually as medicines only if needed later | High |
| **Controlled-substance regulatory reporting** | Jurisdiction-specific and compliance-heavy | Keep generic audit logs; only add if legally required by client context | High |
| **Biometrics, fingerprint time clock, payroll** | Not required for pharmacy core value | Basic user login and sales-by-user report | Medium |
| **Custom report designer / arbitrary query builder** | Powerful but overkill and risky for non-technical users | Ship fixed reports with date filters and PDF export | High |
| **Store loyalty, gift cards, Apple Pay/NFC integrations** | Hardware/payment provider integrations are scope multipliers | Record payment method only; no payment processing integration | Medium-High |
| **Automatic restore** | Dangerous: could overwrite good data after transient error or stale backup | Owner-only explicit restore with confirmation and pre-restore backup | High risk avoided |

---

## Feature Dependencies

Core dependency chain for requirements definition:

```text
Authentication + roles
  → owner-only medicine management
  → purchase/supplier permissions
  → owner-only reports/settings/backup

Medicine catalog
  → purchase items
  → batches with purchase price + expiry
  → current stock calculation
  → low-stock alerts
  → POS search/selection

Purchases + batches
  → FIFO sale deduction
  → expired-stock blocking
  → expiry alerts
  → profit calculation by actual cost
  → supplier returns/write-offs

Sales + sale_items
  → daily dashboard totals
  → cashier sales report
  → top-selling / slow-moving reports
  → customer returns
  → monthly P&L

Returns + stock movement log
  → corrected stock quantities
  → loss/refund reporting
  → trustworthy audit trail

Settings
  → currency/tax/discount behavior
  → expiry thresholds
  → report headers
  → backup schedule/path

Stable local database
  → backup scheduler
  → backup history
  → safe restore flow
```

### Critical Build Order Implication

Do **not** build POS as quantity-only inventory and “add batches later.” The PRD requires FIFO, expiry blocking, margin calculation, returns, and expiry reports. Those all depend on batch-level stock from the beginning.

---

## MVP Recommendation

Prioritize these v1 capabilities in requirements:

1. **Login + owner/pharmacist role boundary** — security and data visibility foundation.
2. **Medicine catalog + batch-aware inventory** — source of truth for all later workflows.
3. **Keyboard-first POS with FIFO stock deduction** — primary daily user value.
4. **Purchase/supplier entry that creates batches** — keeps stock and profit accurate.
5. **Low-stock + expiry dashboards** — immediate operational benefit beyond manual registers.
6. **Core reports: daily sales, monthly P&L, low stock, expiry, top sellers** — owner value.
7. **Automated backup + manual restore** — disaster recovery success metric.

Defer until after v1 validation:

- Full credit/udhaar ledger
- Barcode scanner support
- WhatsApp/SMS alerts
- Patient accounts, loyalty, refill reminders, med-sync
- Prescription/doctor/insurance workflows
- Multi-branch, cloud sync, mobile companion

---

## Requirements Preservation Notes

The PRD-implied requirements that must not be lost during roadmap planning:

- Sales must be processed in **under 30 seconds** and support keyboard-only operation.
- POS search must return results in **under 200ms**.
- Stock must be deducted **FIFO from batches**, not from a single medicine quantity field.
- Expired medicines must be **blocked from sale**.
- Purchase prices and profit/margin reports must be **owner-only**.
- Reports must be date-range filterable and exportable to **PDF**.
- Returns must adjust stock and financial reports without mutating original sale history.
- No hard deletes for historical records; use active/status flags.
- Google Drive backup must be automatic but day-to-day operation must remain offline.
- Restore must be explicit, owner-only, and preceded by a current database backup.

---

## Sources

- PharmaCare PRD (`/media/saad/Data/Pharmacy/PRD.md`) — HIGH confidence project scope and requirements.
- PharmaCare PROJECT.md (`/media/saad/Data/Pharmacy/.planning/PROJECT.md`) — HIGH confidence project constraints and out-of-scope decisions.
- PioneerRx official pharmacy software page — MEDIUM confidence ecosystem reference; highlights inventory/ordering, integrated POS, financial reporting, customizable workflow, patient engagement, adherence, IVR, compounding, and multi-location/central office features: https://www.pioneerrx.com/pharmacy-software
- PrimeRx official pharmacy management packages page — MEDIUM confidence ecosystem reference; highlights POS, document management, controlled substance reporting, owner app, patient engagement, two-way SMS, delivery, task/custom workflow, and enterprise bundle: https://www.primerx.io/primerx-pharmacy-management-software/
- Liberty Software official site — MEDIUM confidence ecosystem reference; highlights prescription filling, checkout/POS, front-end inventory, reporting, patient messaging, med-sync, clinical checks, insurance management, and chain management: https://libertysoftware.com/
