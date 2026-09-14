import { useEffect, useCallback } from 'react';
import { useTauriCommand } from '../../hooks/useTauriCommand';
import { useSettings } from '../../hooks/useSettings';
import { tauri } from '../../lib/tauri';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SlowMovingPDF } from '../../lib/pdf/SlowMovingPDF';
import { ExportPdfButton } from './ExportPdfButton';
import type { SessionDto } from '../../types/session';
import type { SlowMovingRow } from '../../types/report';

interface SlowMovingReportProps {
  session: SessionDto;
  startDate: string;
  endDate: string;
}

export function SlowMovingReport({ session, startDate, endDate }: SlowMovingReportProps) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<SlowMovingRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.slowMoving(session.token, startDate, endDate));
  }, [execute, session.token, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const rows = data ?? [];
  const totalInvestment = rows.reduce((s, r) => s + r.total_investment, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm">Slow-Moving Stock</CardTitle>
            <p className="text-xs text-muted-foreground">
              Total Investment: {currencySymbol}{totalInvestment.toFixed(2)}
            </p>
          </div>
          <ExportPdfButton
            document={<SlowMovingPDF data={rows} startDate={startDate} endDate={endDate} pharmacyName={pharmacyName} currencySymbol={currencySymbol} />}
            fileName={`slow-moving-${startDate}-to-${endDate}.pdf`}
            sessionToken={session.token}
          />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-right">Total Investment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No slow-moving stock found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.medicine_id}>
                    <TableCell className="font-medium">{row.medicine_name}</TableCell>
                    <TableCell>{row.category ?? '—'}</TableCell>
                    <TableCell className="text-right">{row.current_stock}</TableCell>
                    <TableCell className="text-right">{currencySymbol}{row.total_investment.toFixed(2)}</TableCell>
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
