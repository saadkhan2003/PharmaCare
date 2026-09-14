import { useEffect, useState } from 'react';
import { tauri } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import type { SessionDto } from '@/types/session';
import type { SaleDetailDto, SaleListDto } from '@/types/sale';
import { formatDateTime } from '@/lib/formatDate';

export function SalesHistoryPage({ session }: { session: SessionDto }) {
  const [sales, setSales] = useState<SaleListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SaleDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 50;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      tauri.sales.list(session.token, searchTerm, startDate, endDate, page, perPage).then((result) => {
        setSales(result.items);
        setTotalPages(result.total_pages);
      }).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [session.token, searchTerm, startDate, endDate, page, perPage]);

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
      <div>
        <h1 className="text-2xl font-bold">POS Sales History</h1>
        <p className="text-sm text-muted-foreground">Recent POS sales and receipt details.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, customer, payment method, or medicine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
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
                  <TableCell className="text-right font-medium">Rs. {sale.total.toFixed(2)}</TableCell>
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
          <DialogHeader><DialogTitle>Sale #{selected?.sale.id}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="min-w-0 break-words">Payment: <strong>{selected.sale.payment_method}</strong></div>
                <div className="min-w-0 break-words">Date: <strong>{formatDateTime(selected.sale.created_at)}</strong></div>
                <div className="min-w-0 break-words">Customer: <strong>{selected.sale.customer_name || '-'}</strong></div>
                <div className="min-w-0 break-words">Total: <strong>Rs. {selected.sale.total.toFixed(2)}</strong></div>
              </div>
              <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selected.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.medicine_name}</TableCell>
                        <TableCell>#{item.batch_id}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>Rs. {item.unit_price.toFixed(2)}</TableCell>
                        <TableCell>Rs. {item.item_discount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">Rs. {item.line_total.toFixed(2)}</TableCell>
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
