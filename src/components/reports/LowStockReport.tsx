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
import { FileDown } from 'lucide-react';
import { LowStockPDF } from '../../lib/pdf/LowStockPDF';
import type { SessionDto } from '../../types/session';
import type { LowStockRow } from '../../types/report';

interface LowStockReportProps {
  session: SessionDto;
}

export function LowStockReport({ session }: LowStockReportProps) {
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol ?? 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';

  const { data, error, loading, execute } = useTauriCommand<LowStockRow[]>();

  const fetchData = useCallback(() => {
    execute(() => tauri.reports.lowStock(session.token));
  }, [execute, session.token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-32 w-full" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Low Stock Items</CardTitle>
          <PDFDownloadLink
            document={<LowStockPDF data={rows} pharmacyName={pharmacyName} />}
            fileName={`low-stock-${new Date().toISOString().split('T')[0]}.pdf`}
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
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Deficit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    All items are sufficiently stocked.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.medicine_id}
                    className={row.current_stock === 0 ? 'bg-red-50' : row.current_stock < row.reorder_level ? 'bg-amber-50' : ''}
                  >
                    <TableCell className="font-medium">{row.medicine_name}</TableCell>
                    <TableCell>{row.category ?? '—'}</TableCell>
                    <TableCell className="text-right">{row.reorder_level}</TableCell>
                    <TableCell className={`text-right font-bold ${row.current_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {row.current_stock}
                    </TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-right">{row.deficit}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={row.current_stock === 0 ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
                        {row.current_stock === 0 ? 'Out of Stock' : 'Below Reorder'}
                      </Badge>
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
