import { useEffect, useCallback } from 'react';
import { useTauriCommand } from '../../hooks/useTauriCommand';
import { useSettings } from '../../hooks/useSettings';
import { tauri } from '../../lib/tauri';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PDFDownloadLink } from '@react-pdf/renderer';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { FileDown } from 'lucide-react';
import { SalesByUserPDF } from '../../lib/pdf/SalesByUserPDF';
import type { SessionDto } from '../../types/session';
import type { SalesByUserRow } from '../../types/report';

interface SalesByUserReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function SalesByUserReport({ session, startDate, endDate }: SalesByUserReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<SalesByUserRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.salesByUser(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).map((r) => ({
    name: r.full_name,
    sales: r.total_sales,
    profit: r.total_profit,
  }));

  const totalSales = (data ?? []).reduce((s, r) => s + r.total_sales, 0);
  const totalProfit = (data ?? []).reduce((s, r) => s + r.total_profit, 0);

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
          <CardTitle className="text-sm">Sales by User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: any) => `${currencySymbol}${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="sales" name="Revenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#16a34a" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">User Performance</CardTitle>
            <p className="text-xs text-muted-foreground">
              Revenue: {currencySymbol}{totalSales.toFixed(2)} | Profit: {currencySymbol}{totalProfit.toFixed(2)}
            </p>
          </div>
          <PDFDownloadLink
            document={<SalesByUserPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`sales-by-user-${startDate}-to-${endDate}.pdf`}
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
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Avg/Sale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No sales data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={row.role === 'owner' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}>
                        {row.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.sale_count}</TableCell>
                    <TableCell className="text-right">{row.item_count}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.total_sales.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-600">{currencySymbol}{row.total_profit.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.avg_profit_per_sale.toFixed(2)}</TableCell>
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
