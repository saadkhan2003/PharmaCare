import { useEffect, useCallback } from 'react';
import { useTauriCommand } from '../../hooks/useTauriCommand';
import { useSettings } from '../../hooks/useSettings';
import { tauri } from '../../lib/tauri';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChartTooltipContent, chartAxisStyle, useChartColors } from './ChartTooltip';
import { MonthlyPnLPDF } from '../../lib/pdf/MonthlyPnLPDF';
import { ExportPdfButton } from './ExportPdfButton';
import type { SessionDto } from '../../types/session';
import type { MonthlyPnLRow } from '../../types/report';
import { useIsDark } from '../../hooks/useIsDark';

interface MonthlyPnLReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function MonthlyPnLReport({ session, startDate, endDate }: MonthlyPnLReportProps) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';
  const dark = useIsDark();
  const colors = useChartColors();

  const { data, error, loading, execute } = useTauriCommand<MonthlyPnLRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.monthlyPnl(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).map((r) => ({
    month: r.month,
    revenue: r.total_revenue,
    profit: r.net_profit,
  }));

  const totalRevenue = (data ?? []).reduce((s, r) => s + r.total_revenue, 0);
  const totalNetProfit = (data ?? []).reduce((s, r) => s + r.net_profit, 0);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const rows = data ?? [];
  const axis = chartAxisStyle(dark);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Revenue vs Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="month" {...axis} />
                <YAxis {...axis} />
                <Tooltip content={<ChartTooltipContent formatter={(v: any) => `${currencySymbol}${Number(v).toFixed(2)}`} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: dark ? '#a1a1aa' : '#6b7280' }} />
                <Bar dataKey="revenue" name="Revenue" fill={colors.revenue} radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" name="Net Profit" fill={colors.profit} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Monthly P&L Detail</CardTitle>
            <p className="text-xs text-muted-foreground">
              Revenue: {currencySymbol}{totalRevenue.toFixed(2)} | Net Profit: {currencySymbol}{totalNetProfit.toFixed(2)}
            </p>
          </div>
          <ExportPdfButton
            document={<MonthlyPnLPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`monthly-pnl-${startDate}-to-${endDate}.pdf`}
            sessionToken={session.token}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Gross Profit</TableHead>
                <TableHead className="text-right">Refunds</TableHead>
                <TableHead className="text-right">Write-offs</TableHead>
                <TableHead className="text-right">Net Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No P&L data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{row.sale_count}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.total_revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.total_cogs.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">{currencySymbol}{row.gross_profit.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-500 dark:text-red-400">{currencySymbol}{row.total_refunds.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-red-500 dark:text-red-400">{currencySymbol}{row.write_off_losses.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-medium ${row.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {currencySymbol}{row.net_profit.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
