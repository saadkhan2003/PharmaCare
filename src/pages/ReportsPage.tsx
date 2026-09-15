import { useState, useCallback } from 'react';
import { ReportSelector } from '../components/reports/ReportSelector';
import { DateRangePicker } from '../components/reports/DateRangePicker';
import { DailySalesReport } from '../components/reports/DailySalesReport';
import { MonthlyPnLReport } from '../components/reports/MonthlyPnLReport';
import { TopSellersReport } from '../components/reports/TopSellersReport';
import { SlowMovingReport } from '../components/reports/SlowMovingReport';
import { LowStockReport } from '../components/reports/LowStockReport';
import { ExpiryReport } from '../components/reports/ExpiryReport';
import { SupplierPurchaseReport } from '../components/reports/SupplierPurchaseReport';
import { SalesByUserReport } from '../components/reports/SalesByUserReport';
import { ProfitMarginReport } from '../components/reports/ProfitMarginReport';
import type { SessionDto } from '../types/session';

interface ReportsPageProps {
  session: SessionDto;
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * ReportsPage — master-detail view for all 9 analytic reports.
 *
 * Layout:
 * ┌────────────────────────────────────────────────┐
 * │  Reports                                 (page)│
 * ├────────────┬───────────────────────────────────┤
 * │  Selector  │  Date Range Picker                │
 * │  (left)    │  ┌──────────┐ ┌──────────┐        │
 * │            │  │ Start    │ │ End      │        │
 * │  Daily     │  └──────────┘ └──────────┘        │
 * │  Sales     │  [Today][Week][Month][30d][Year]  │
 * │  ...       │                                    │
 * │            │  ┌─────────────────────────────┐   │
 * │            │  │  Recharts Chart              │   │
 * │            │  └─────────────────────────────┘   │
 * │            │  ┌─────────────────────────────┐   │
 * │            │  │  shadcn Data Table           │   │
 * │            │  └─────────────────────────────┘   │
 * │            │  [Download PDF] button              │
 * └────────────┴───────────────────────────────────┘
 *
 * Date filter hidden for low-stock and expiry (current-state snapshots).
 */
export function ReportsPage({ session }: ReportsPageProps) {
  const [selectedReport, setSelectedReport] = useState('daily-sales');
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getTodayString);

  const handleDateChange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const showDateFilter = !['low-stock', 'expiry'].includes(selectedReport);

  return (
    <div className="p-6 h-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Analytics and insights for your pharmacy
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 min-h-0">
        {/* Left: Report selector */}
        <ReportSelector selected={selectedReport} onSelect={setSelectedReport} />

        {/* Right: Detail area */}
        <div className="flex-1 space-y-4 overflow-auto">
          {/* Date filter (shown for date-param reports, hidden for low-stock/expiry) */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            showDateFilter={showDateFilter}
          />

          {/* Report detail — render the selected report component */}
          <div className="min-h-0">
            {selectedReport === 'daily-sales' && (
              <DailySalesReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'monthly-pnl' && (
              <MonthlyPnLReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'top-sellers' && (
              <TopSellersReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'slow-moving' && (
              <SlowMovingReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'low-stock' && (
              <LowStockReport session={session} />
            )}
            {selectedReport === 'expiry' && (
              <ExpiryReport session={session} />
            )}
            {selectedReport === 'supplier-purchases' && (
              <SupplierPurchaseReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'sales-by-user' && (
              <SalesByUserReport session={session} startDate={startDate} endDate={endDate} />
            )}
            {selectedReport === 'profit-margin' && (
              <ProfitMarginReport session={session} startDate={startDate} endDate={endDate} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
