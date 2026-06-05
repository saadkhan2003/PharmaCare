import { useEffect, useCallback } from 'react';
import { useTauriCommand } from '../../hooks/useTauriCommand';
import { useSettings } from '../../hooks/useSettings';
import { tauri } from '../../lib/tauri';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FileDown } from 'lucide-react';
import { DailySalesPDF } from '../../lib/pdf/DailySalesPDF';
import type { SessionDto } from '../../types/session';
import type { DailySalesRow } from '../../types/report';

interface DailySalesReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function DailySalesReport({ session, startDate, endDate }: DailySalesReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<DailySalesRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.dailySales(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).map((r) => ({
    date: r.date.slice(5),
    net_sales: r.net_sales,
    profit: r.profit,
  }));

  const totalNet = (data ?? []).reduce((s, r) => s + r.net_sales, 0);
  const totalProfit = (data ?? []).reduce((s, r) => s + r.profit, 0);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Sales Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => `${currencySymbol}${v.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="net_sales" name="Net Sales" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Daily Sales Detail</CardTitle>
            <p className="text-xs text-muted-foreground">
              Net: {currencySymbol}{totalNet.toFixed(2)} | Profit: {currencySymbol}{totalProfit.toFixed(2)}
            </p>
          </div>
          <PDFDownloadLink
            document={<DailySalesPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`daily-sales-${startDate}-to-${endDate}.pdf`}
          >
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
          </PDFDownloadLink>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No daily sales data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right">{row.sale_count}</TableCell>
                    <TableCell className="text-right">{row.item_count}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.gross_sales.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.discounts.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.tax_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{currencySymbol}{row.net_sales.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600">{currencySymbol}{row.profit.toFixed(2)}</TableCell>
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
