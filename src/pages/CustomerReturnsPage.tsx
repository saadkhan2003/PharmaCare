import { useState } from 'react';
import { CustomerReturnForm } from '@/components/returns/CustomerReturnForm';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { History, Loader2, RotateCcw } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { formatDateTime } from '@/lib/formatDate';
import type { SessionDto } from '@/types/session';
import type { SaleListDto } from '@/types/sale';

interface Props {
  session: SessionDto;
}

export function CustomerReturnsPage({ session }: Props) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<SaleListDto[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const openBrowse = async () => {
    setBrowseOpen(true);
    setLoadingSales(true);
    try {
      const res = await tauri.sales.list(session.token, '', '', '', 1, 20);
      setRecentSales(res.items);
    } catch (err) {
      console.error('Failed to load recent sales:', err);
    } finally {
      setLoadingSales(false);
    }
  };

  const handleSelectSale = (saleId: number) => {
    setSelectedSaleId(saleId);
    setBrowseOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <RotateCcw className="size-6 text-emerald-600" />
            Customer Return
          </h1>
          <p className="text-sm text-muted-foreground">Process medicine returns and issue customer refunds against original sales.</p>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={openBrowse} className="gap-1.5">
            <History className="size-4 text-primary" />
            Browse Recent Sales
          </Button>
        </div>
      </div>

      <CustomerReturnForm
        key={`${refreshKey}-${selectedSaleId || 'default'}`}
        sessionToken={session.token}
        currencySymbol={currencySymbol}
        initialSaleId={selectedSaleId}
        onReturnComplete={() => {
          setSelectedSaleId(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Browse Recent Sales Dialog */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5 text-primary" />
              Select Sale to Return
            </DialogTitle>
          </DialogHeader>
          {loadingSales ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> Loading recent sales...
            </div>
          ) : recentSales.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent sales found.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[80px]">Sale #</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right w-[90px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono font-bold">#{s.id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</TableCell>
                      <TableCell className="font-medium text-sm">{s.customer_name || 'Walk-in'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{currencySymbol} {s.total.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="xs" onClick={() => handleSelectSale(s.id)}>
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

