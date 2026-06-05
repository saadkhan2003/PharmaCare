---
phase: 05-reports-backup-admin
plan: 02
subsystem: frontend
tags: [reports, charts, pdf-export, master-detail]
requires: [05-01]
provides: [frontend-reports-page]
affects: [frontend-routing]
tech-stack:
  added: []
  patterns:
    - Master-detail: ReportSelector sidebar + chart/table/PDF detail area
    - Per-report component: useTauriCommand → data → shadcn Table + Recharts Chart + PDFDownloadLink
    - Date filtering: shared DateRangePicker with quick-select presets (Today/Week/Month/30d/Year)
    - PDF: @react-pdf/renderer Document/Page/Text/View with Helvetica (built-in standard font)
key-files:
  created:
    - src/pages/ReportsPage.tsx (master-detail layout, 9 report type routing)
    - src/components/reports/DateRangePicker.tsx (reusable date range with quick-select)
    - src/components/reports/ReportSelector.tsx (sidebar with 3 categories, 9 report types)
    - src/components/reports/DailySalesReport.tsx (BarChart + table + PDF)
    - src/components/reports/MonthlyPnLReport.tsx (BarChart revenue/profit + color-coded table)
    - src/components/reports/TopSellersReport.tsx (horizontal BarChart top 10 + table)
    - src/components/reports/SlowMovingReport.tsx (table-only with investment summary)
    - src/components/reports/LowStockReport.tsx (color-coded rows, alert badges)
    - src/components/reports/ExpiryReport.tsx (stacked BarChart by month + color-coded table + badges)
    - src/components/reports/SupplierPurchaseReport.tsx (horizontal BarChart spend comparison)
    - src/components/reports/SalesByUserReport.tsx (grouped BarChart + role badges)
    - src/components/reports/ProfitMarginReport.tsx (BarChart margin % + color-coded percentages)
    - src/lib/pdf/CommonStyles.ts (shared StyleSheet + formatting helpers)
    - src/lib/pdf/DailySalesPDF.tsx (8-column landscape table + totals)
    - src/lib/pdf/MonthlyPnLPDF.tsx (8-column landscape table + summary)
    - src/lib/pdf/TopSellersPDF.tsx (5-column, LIMIT 50)
    - src/lib/pdf/SlowMovingPDF.tsx (5-column with unit cost calculation)
    - src/lib/pdf/LowStockPDF.tsx (7-column with color-coded status)
    - src/lib/pdf/ExpiryPDF.tsx (9-column with color-coded status + potential loss)
    - src/lib/pdf/SupplierPurchasePDF.tsx (6-column)
    - src/lib/pdf/SalesByUserPDF.tsx (7-column with revenue/profit totals)
    - src/lib/pdf/ProfitMarginPDF.tsx (8-column with avg margin + total profit)
  modified:
    - src/App.tsx (added Route path='/reports')
    - src/hooks/useSettings.ts (fixed fallback with all 18 SettingsMap fields)
    - src/components/reports/ExpiryReport.tsx (rewritten for new report system)
    - src/pages/ExpiryReportPage.tsx (updated to pass session prop)
decisions:
  - "PDF components use Helvetica (built-in standard PDF font, no registration needed per D-59)"
  - "All charts use ResponsiveContainer for responsive sizing"
  - "Date filter hidden for Low Stock and Expiry (current-state snapshots with no date params)"
  - "Low stock rows color-coded: red bg when stock=0, amber bg when below reorder level"
  - "Expiry badges use 3-tier color: red=expired/critical, amber=warning, green=ok"
  - "Profit margin color-coded: green ≥20%, amber ≥10%, red <10%"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-06-05"
---

# Phase 5 Plan 2: Reports Frontend — Master-Detail with Recharts + PDF Export

**One-liner:** Complete reports frontend with master-detail layout, 9 report views each showing a shadcn Table + appropriate Recharts chart + @react-pdf/renderer PDF download button, plus route registration.

## Summary

This plan implements the entire Phase 5 frontend reports page in three atomic commits:

### Task 1: PDF Document Components (10 files)
- `CommonStyles.ts`: shared `@react-pdf/renderer` StyleSheet with typography, table layout, status colors, and `formatCurrency`/`formatNumber` helpers
- 9 PDF document components (`DailySalesPDF` through `ProfitMarginPDF`) — each renders a landscape A4 page with:
  - Pharmacy name header + report title + date range subtitle
  - Table with proper column alignment matching the plan's column specs
  - Summary totals row for applicable reports
  - Footer with generation timestamp
- All use Helvetica (built-in standard PDF font, no registration needed)

### Task 2: Report UI Components (11 files)
- `DateRangePicker.tsx`: two date inputs with 5 quick-select buttons (Today, This Week, This Month, Last 30 Days, This Year)
- `ReportSelector.tsx`: left sidebar with 9 report types organized in Sales/Stock/Financial categories with Lucide icons
- 9 per-report components, each:
  1. Fetches data via `useTauriCommand` calling `tauri.reports.*` methods
  2. Renders a shadcn `<Table>` with appropriate column configuration
  3. Renders a Recharts chart matched to the data shape:
     - Daily Sales: BarChart (net_sales + profit dual bars)
     - Monthly P&L: BarChart (revenue + profit)
     - Top Sellers: horizontal BarChart (top 10 by quantity)
     - Expiry: stacked BarChart grouped by month (critical/warning/ok)
     - Supplier Purchases: horizontal BarChart (spend comparison)
     - Sales by User: grouped BarChart (revenue + profit by user)
     - Profit Margin: BarChart (margin % by medicine)
     - Slow Moving / Low Stock: table-only
  4. Shows PDFDownloadLink wrapping the matching PDF document component

### Task 3: ReportsPage + Route (2 files)
- `ReportsPage.tsx`: master-detail layout with ReportSelector on the left + date picker + per-report component on the right
- State management for `selectedReport`, `startDate` (default 30 days ago), `endDate` (default today)
- `App.tsx`: added `Route path="/reports"` inside the owner-only role block

### Fixes Applied
- `useSettings.ts`: fallback now includes all 18 `SettingsMap` fields (preventing TS errors from new fields)
- `ExpiryReportPage.tsx`: updated to pass `session` (not `sessionToken`) to the new `ExpiryReport` component
- All PDF components: removed unused `React` imports (React 18 JSX transform)
- LowStockPDF: removed unused `formatCurrency` import
- Recharts Tooltip formatters: fixed type compatibility for Recharts 3.8

## Commit History

| Commit | Hash | Description |
|--------|------|-------------|
| Task 1 | 442a8a9 | PDF document components for 9 report types |
| Task 2 | 7741aab | Report UI components with Recharts and PDF export |
| Task 3 | 84270f8 | ReportsPage master-detail + route + fixes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useSettings.ts fallback missing new SettingsMap fields**
- **Found during:** `npx tsc --noEmit`
- **Issue:** The fallback `setSettings()` call only included 6 of 18 fields — missing `pharmacy_name`, `owner_name`, `phone`, `address`, `logo_path`, `auto_backup_time`, `local_backup_path`, `last_backup_time`, `last_backup_status`, `google_drive_connected`, `tax_enabled_default`
- **Fix:** Added all missing fields with sensible defaults
- **Files modified:** `src/hooks/useSettings.ts`
- **Commit:** 84270f8

**2. [Rule 3 - Blocking] Recharts Tooltip formatter type mismatch with Recharts 3.8**
- **Found during:** `npx tsc --noEmit`
- **Issue:** `(value: number) => string` is not assignable to `Formatter<ValueType, NameType>` — the parameter type is `ValueType | undefined` where `ValueType = number | string | Array<number | string>`
- **Fix:** Changed formatters to `(value: any) => ...` to match the broad Recharts type definition
- **Files modified:** 6 report components
- **Commit:** 84270f8

**3. [Rule 3] ExpiryReportPage.tsx passed `sessionToken` but new ExpiryReport expects `session`**
- **Found during:** `npx tsc --noEmit`
- **Issue:** The rewritten `ExpiryReport` component now takes `session: SessionDto` instead of `sessionToken: string`
- **Fix:** Changed `<ExpiryReport sessionToken={session.token} />` to `<ExpiryReport session={session} />`
- **Files modified:** `src/pages/ExpiryReportPage.tsx`
- **Commit:** 84270f8

## Success Criteria

- [x] ReportsPage shows master-detail layout with selector + chart/table/PDF area
- [x] All 9 report types render table + appropriate Recharts chart
- [x] DateRangePicker filters date-param reports; hides for Low Stock / Expiry
- [x] PDF export works for all 9 report types via PDFDownloadLink
- [x] Route /reports registered for owner role only
- [x] Loading states with Skeleton components
- [x] Error states with red error banner
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes

## Self-Check: PASSED

All source files verified present. All commit hashes confirmed in git log. Build output confirms 2754 modules transformed successfully.
