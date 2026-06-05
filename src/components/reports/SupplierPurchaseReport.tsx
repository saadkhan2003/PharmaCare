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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FileDown } from 'lucide-react';
import { SupplierPurchasePDF } from '../../lib/pdf/SupplierPurchasePDF';
import type { SessionDto } from '../../types/session';
import type { SupplierPurchaseRow } from '../../types/report';

interface SupplierPurchaseReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function SupplierPurchaseReport({ session, startDate, endDate }: SupplierPurchaseReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<SupplierPurchaseRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.supplierPurchases(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = (data ?? []).map((r) => ({
    name: r.company_name.length > 14 ? r.company_name.slice(0, 12) + '…' : r.company_name,
    total_spent: r.total_spent,
  }));

  const totalSpent = (data ?? []).reduce((s, r) => s + r.total_spent, 0);

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
          <CardTitle className="text-sm">Supplier Spend Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 100 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip formatter={(v: number) => `${currencySymbol}${v.toFixed(2)}`} />
                <Bar dataKey="total_spent" name="Total Spent" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Supplier Purchase History</CardTitle>
            <p className="text-xs text-muted-foreground">
              Total Spent: {currencySymbol}{totalSpent.toFixed(2)}
            </p>
          </div>
          <PDFDownloadLink
            document={<SupplierPurchasePDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`supplier-purchases-${startDate}-to-${endDate}.pdf`}
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
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Avg Order</TableHead>
                <TableHead>Last Purchase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No supplier purchases found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.supplier_id}>
                    <TableCell className="font-medium">{row.company_name}</TableCell>
                    <TableCell className="text-right">{row.purchase_count}</TableCell>
                    <TableCell className="text-right">{row.item_count}</TableCell>
                    <TableCell className="text-right font-medium">{currencySymbol}{row.total_spent.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.avg_order_value.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{row.last_purchase_date ?? '—'}</TableCell>
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
