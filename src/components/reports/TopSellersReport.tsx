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
import { TopSellersPDF } from '../../lib/pdf/TopSellersPDF';
import { ExportPdfButton } from './ExportPdfButton';
import type { SessionDto } from '../../types/session';
import type { TopSellerRow } from '../../types/report';
import { useIsDark } from '../../hooks/useIsDark';

interface TopSellersReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function TopSellersReport({ session, startDate, endDate }: TopSellersReportProps) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';
  const dark = useIsDark();
  const colors = useChartColors();

  const { data, error, loading, execute } = useTauriCommand<TopSellerRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.topSellers(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).slice(0, 10).map((r) => ({
    name: r.medicine_name.length > 16 ? r.medicine_name.slice(0, 14) + '…' : r.medicine_name,
    quantity: r.total_qty,
    revenue: r.total_revenue,
  }));

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
          <CardTitle className="text-sm">Top 10 Selling Medicines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                <XAxis type="number" {...axis} />
                <YAxis type="category" dataKey="name" {...axis} width={90} />
                <Tooltip content={<ChartTooltipContent formatter={(v: any) => Number(v).toLocaleString('en-IN')} />} />
                <Legend wrapperStyle={{ fontSize: 11, color: dark ? '#a1a1aa' : '#6b7280' }} />
                <Bar dataKey="quantity" name="Quantity Sold" fill={colors.primary} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Top Selling Medicines</CardTitle>
          <ExportPdfButton
            document={<TopSellersPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`top-sellers-${startDate}-to-${endDate}.pdf`}
            sessionToken={session.token}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No sales data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={row.medicine_id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {row.medicine_name}
                      {row.generic_name && (
                        <span className="ml-1 text-xs text-muted-foreground">({row.generic_name})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{row.total_qty}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.total_revenue.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">{currencySymbol}{row.total_profit.toFixed(2)}</TableCell>
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
