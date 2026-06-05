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
import { ProfitMarginPDF } from '../../lib/pdf/ProfitMarginPDF';
import type { SessionDto } from '../../types/session';
import type { ProfitMarginRow } from '../../types/report';

interface ProfitMarginReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function ProfitMarginReport({ session, startDate, endDate }: ProfitMarginReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<ProfitMarginRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.profitMargin(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).slice(0, 15).map((r) => ({
    name: r.medicine_name.length > 12 ? r.medicine_name.slice(0, 10) + '…' : r.medicine_name,
    margin_pct: r.margin_pct,
    total_profit: r.total_profit,
  }));

  const totalProfit = (data ?? []).reduce((s, r) => s + r.total_profit, 0);
  const avgMargin = (data ?? []).length > 0
    ? (data ?? []).reduce((s, r) => s + r.margin_pct, 0) / (data ?? []).length
    : 0;

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-48 w-full" /><Skeleton className="h-32 w-full" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Margin % by Medicine (Top 15)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" interval={0} height={50} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend />
                <Bar dataKey="margin_pct" name="Margin %" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Profit Margin Analysis</CardTitle>
            <p className="text-xs text-muted-foreground">
              Avg Margin: {avgMargin.toFixed(1)}% | Total Profit: {currencySymbol}{totalProfit.toFixed(2)}
            </p>
          </div>
          <PDFDownloadLink
            document={<ProfitMarginPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`profit-margin-${startDate}-to-${endDate}.pdf`}
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
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Times Sold</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Sell</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Margin/Unit</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead className="text-right">Total Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No profit margin data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.medicine_id}>
                    <TableCell className="font-medium">{row.medicine_name}</TableCell>
                    <TableCell className="text-right">{row.times_sold}</TableCell>
                    <TableCell className="text-right">{row.total_qty}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.avg_sell_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.avg_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.avg_margin_per_unit.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-bold ${row.margin_pct >= 20 ? 'text-green-600' : row.margin_pct >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                      {row.margin_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-green-600">{currencySymbol}{row.total_profit.toFixed(2)}</TableCell>
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
