import { useEffect, useState, useCallback } from 'react';
import { tauri } from '@/lib/tauri';
import { useAutoRefresh } from '@/lib/eventBus';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Printer, Receipt } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import type { SessionDto } from '@/types/session';
import type { SaleDetailDto, SaleListDto } from '@/types/sale';
import { formatDateTime } from '@/lib/formatDate';

export function SalesHistoryPage({ session }: { session: SessionDto }) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const pharmacyName = settings?.pharmacy_name || 'PharmaCare';
  const pharmacyPhone = settings?.phone || '';
  const [sales, setSales] = useState<SaleListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SaleDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 50;
  const [salesRefreshKey] = useAutoRefresh('sales-changed');

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, startDate, endDate]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tauri.sales.list(session.token, debouncedSearch, startDate, endDate, page, perPage);
      setSales(result.items);
      setTotalPages(result.total_pages);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  }, [session.token, debouncedSearch, startDate, endDate, page, perPage]);

  useEffect(() => {
    loadSales();
  }, [loadSales, salesRefreshKey]);

  const openDetail = async (saleId: number) => {
    setDetailLoading(true);
    try {
      setSelected(await tauri.sales.getDetail(session.token, saleId));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">POS Sales History</h1>
          <p className="text-sm text-muted-foreground">Recent POS sales and receipt details.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, customer, payment method, or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-36"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-36"
            />
          </div>
          {(startDate || endDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading sales...
        </div>
      ) : sales.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No POS sales recorded yet.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Returns</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>#{sale.id}</TableCell>
                  <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                  <TableCell>{sale.item_count}</TableCell>
                  <TableCell>{sale.payment_method}</TableCell>
                  <TableCell>{sale.customer_name || '-'}</TableCell>
                  <TableCell className="text-right font-medium">{currencySymbol} {sale.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {sale.total_returned_qty > 0 ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-900 text-xs font-semibold">
                        {sale.total_returned_qty} returned ({currencySymbol}{sale.total_refund_amount.toFixed(2)})
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openDetail(sale.id)} disabled={detailLoading}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="flex flex-row items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Sale #{selected?.sale.id}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm bg-muted/40 p-3 rounded-lg border border-border">
                <div className="min-w-0 break-words">Payment: <strong className="text-foreground">{selected.sale.payment_method}</strong></div>
                <div className="min-w-0 break-words">Date: <strong className="text-foreground">{formatDateTime(selected.sale.created_at)}</strong></div>
                <div className="min-w-0 break-words">Customer: <strong className="text-foreground">{selected.sale.customer_name || 'Walk-in'}</strong></div>
                <div className="min-w-0 break-words">Total: <strong className="text-foreground">{currencySymbol} {selected.sale.total.toFixed(2)}</strong></div>
              </div>
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.medicine_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">#{item.batch_id}</TableCell>
                      <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{currencySymbol} {item.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{currencySymbol} {item.item_discount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{currencySymbol} {item.line_total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Thermal Receipt Print Container for window.print() */}
              <div id="printable-receipt" className="hidden">
                <div className="text-center pb-2 border-b border-black">
                  <h2 className="text-base font-bold uppercase">{pharmacyName}</h2>
                  {pharmacyPhone && <p className="text-xs">Tel: {pharmacyPhone}</p>}
                  <p className="text-[11px] mt-1">*** DUPLICATE RECEIPT ***</p>
                </div>
                <div className="text-xs py-2 border-b border-black space-y-0.5">
                  <div className="flex justify-between"><span>Sale #:</span><span>{selected.sale.id}</span></div>
                  <div className="flex justify-between"><span>Date:</span><span>{formatDateTime(selected.sale.created_at)}</span></div>
                  <div className="flex justify-between"><span>Payment:</span><span>{selected.sale.payment_method}</span></div>
                  {selected.sale.customer_name && (
                    <div className="flex justify-between"><span>Customer:</span><span>{selected.sale.customer_name}</span></div>
                  )}
                </div>
                <table className="w-full text-xs my-2">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left">Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-dotted border-gray-300">
                        <td className="py-0.5">{it.medicine_name}</td>
                        <td className="text-center py-0.5">{it.quantity}</td>
                        <td className="text-right py-0.5">{currencySymbol} {it.line_total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs pt-1 border-t border-black space-y-1">
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>{currencySymbol} {selected.sale.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="size-4" />
              Reprint Thermal Slip
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
