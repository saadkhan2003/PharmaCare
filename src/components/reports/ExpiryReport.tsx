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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { FileDown } from 'lucide-react';
import { ExpiryPDF } from '../../lib/pdf/ExpiryPDF';
import type { SessionDto } from '../../types/session';
import type { ExpiryReportDetailRow } from '../../types/report';

interface ExpiryReportProps {
  session: SessionDto;
}

export function ExpiryReport({ session }: ExpiryReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';
  const warningDays = settings?.expiry_warning_days ?? 60;
  const criticalDays = settings?.expiry_critical_days ?? 30;

  const { data, error, loading, execute } = useTauriCommand<ExpiryReportDetailRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.expiryReport(session.token, warningDays, criticalDays));
  }, [execute, session.token, warningDays, criticalDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function getStatusBadge(status: string) {
    switch (status) {
      case 'expired':
        return <Badge variant="outline" className="bg-red-700 text-white border-red-800">Expired</Badge>;
      case 'critical':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Critical</Badge>;
      case 'warning':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Warning</Badge>;
      default:
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">OK</Badge>;
    }
  }

  /** Group data by month for chart — count items per status per month */
  function getChartData() {
    const grouped: Record<string, { total: number; critical: number; warning: number; ok: number }> = {};
    for (const row of data ?? []) {
      const month = row.expiry_date.slice(0, 7);
      if (!grouped[month]) grouped[month] = { total: 0, critical: 0, warning: 0, ok: 0 };
      grouped[month].total += row.remaining_qty;
      if (row.status === 'expired' || row.status === 'critical') grouped[month].critical += row.remaining_qty;
      else if (row.status === 'warning') grouped[month].warning += row.remaining_qty;
      else grouped[month].ok += row.remaining_qty;
    }
    return Object.entries(grouped).sort().map(([month, g]) => ({ month, ...g }));
  }

  const totalPotentialLoss = (data ?? []).reduce((s, r) => s + r.potential_loss, 0);

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
          <CardTitle className="text-sm">Expiry by Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="critical" name="Critical/Expired" fill="#dc2626" stackId="a" radius={[2, 2, 0, 0]} />
                <Bar dataKey="warning" name="Warning" fill="#d97706" stackId="a" />
                <Bar dataKey="ok" name="OK" fill="#16a34a" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Expiry Report</CardTitle>
            <p className="text-xs text-muted-foreground">
              Potential Loss: {currencySymbol}{totalPotentialLoss.toFixed(2)}
            </p>
          </div>
          <PDFDownloadLink
            document={<ExpiryPDF data={rows} warningDays={warningDays} criticalDays={criticalDays} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`expiry-report-${new Date().toISOString().split('T')[0]}.pdf`}
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
                <TableHead>Batch</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Days Left</TableHead>
                <TableHead className="text-right">Potential Loss</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No expiring items found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.batch_id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.batch_code ?? `#${row.batch_id}`}
                    </TableCell>
                    <TableCell className="font-medium">{row.medicine_name}</TableCell>
                    <TableCell className="text-right">{row.original_qty}</TableCell>
                    <TableCell className="text-right">{row.remaining_qty}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>{row.expiry_date}</TableCell>
                    <TableCell className={`text-right font-bold ${
                      row.days_remaining <= 0 ? 'text-red-600' :
                      row.days_remaining <= criticalDays ? 'text-red-500' :
                      row.days_remaining <= warningDays ? 'text-amber-600' : ''
                    }`}>
                      {row.days_remaining <= 0 ? 'Expired' : `${row.days_remaining}d`}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {currencySymbol}{row.potential_loss.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
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
