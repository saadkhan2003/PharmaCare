import { useEffect, useState, useMemo } from 'react';
import { tauri } from '@/lib/tauri';
import { useAutoRefresh } from '@/lib/eventBus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, AlertTriangle, Boxes, Edit2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { useSettings } from '@/hooks/useSettings';
import type { BatchListDto } from '@/types/batch';
import type { SessionDto } from '@/types/session';
import { formatDate } from '@/lib/formatDate';

export function BatchesPage({ session }: { session: SessionDto }) {
  const { toast } = useToast();
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [batches, setBatches] = useState<BatchListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BatchListDto | null>(null);
  const [batchCode, setBatchCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'due_soon' | 'zero_stock'>('all');
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [medicinesRefreshKey] = useAutoRefresh('medicines-changed');

  const load = async () => {
    if (batches.length === 0) setLoading(true);
    try {
      const result = await tauri.batches.list(session.token);
      setBatches(result);
    } catch (err: unknown) {
      toast('error', 'Failed to load batches', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [session.token, medicinesRefreshKey]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const openEdit = (batch: BatchListDto) => {
    setEditing(batch);
    setBatchCode(batch.batch_code || '');
    setExpiryDate(batch.expiry_date);
  };

  const save = async () => {
    if (!editing || !expiryDate) return;
    setSaving(true);
    try {
      await tauri.batches.update(session.token, editing.id, {
        batch_code: batchCode.trim() || null,
        expiry_date: expiryDate,
      });
      toast('success', 'Batch updated successfully');
      setEditing(null);
      load();
    } catch (err: unknown) {
      toast('error', 'Failed to save batch', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const getExpiryMeta = (dateStr: string) => {
    if (!dateStr) return { days: 999, status: 'good' };
    const now = new Date();
    const expiry = new Date(dateStr);
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return { days: diff, status: 'expired' };
    if (diff <= 30) return { days: diff, status: 'critical' };
    if (diff <= 60) return { days: diff, status: 'warning' };
    return { days: diff, status: 'good' };
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.medicine_name.toLowerCase().includes(q);
        const matchCode = (b.batch_code || '').toLowerCase().includes(q);
        const matchId = String(b.id).includes(q);
        if (!matchName && !matchCode && !matchId) return false;
      }

      // Status
      const meta = getExpiryMeta(b.expiry_date);
      if (statusFilter === 'active' && b.remaining_qty <= 0) return false;
      if (statusFilter === 'expired' && meta.status !== 'expired') return false;
      if (statusFilter === 'due_soon' && (meta.status !== 'warning' && meta.status !== 'critical')) return false;
      if (statusFilter === 'zero_stock' && b.remaining_qty > 0) return false;

      return true;
    });
  }, [batches, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBatches.length / perPage));
  const paginatedBatches = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredBatches.slice(start, start + perPage);
  }, [filteredBatches, page, perPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="size-6 text-emerald-600" />
            Stock Batches
          </h1>
          <p className="text-sm text-muted-foreground">Monitor FIFO inventory batches, track expiration, and maintain lot numbers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
            {batches.length} Total Batches
          </Badge>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by medicine name, lot code, or #ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-muted/60 p-1 rounded-lg border border-border">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'active', label: 'In Stock' },
              { id: 'due_soon', label: 'Due Soon (≤60d)' },
              { id: 'expired', label: 'Expired' },
              { id: 'zero_stock', label: 'Zero Qty' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
          <span>Loading inventory batches...</span>
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <AlertTriangle className="size-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-semibold text-foreground">No matching batches found</p>
            <p className="text-xs mt-1">Try modifying your search or changing the filter criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-border shadow-sm">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[120px]">Batch Code</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="w-[110px]">Purchase Ref</TableHead>
                  <TableHead className="text-right w-[80px]">Original</TableHead>
                  <TableHead className="text-right w-[90px]">Remaining</TableHead>
                  <TableHead className="text-right w-[100px]">Unit Cost</TableHead>
                  <TableHead className="w-[140px]">Expiry Status</TableHead>
                  <TableHead className="w-[110px]">Received</TableHead>
                  <TableHead className="text-right w-[80px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBatches.map((batch) => {
                  const meta = getExpiryMeta(batch.expiry_date);
                  return (
                    <TableRow key={batch.id} className={batch.remaining_qty === 0 ? 'opacity-50 bg-muted/20' : ''}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {batch.batch_code || <span className="text-muted-foreground">#{batch.id}</span>}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-foreground block">{batch.medicine_name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {batch.purchase_id ? `#${batch.purchase_id}` : 'Opening Stock'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {batch.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                        {batch.remaining_qty}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {currencySymbol} {batch.purchase_price.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {meta.status === 'expired' ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            Expired ({formatDate(batch.expiry_date)})
                          </Badge>
                        ) : meta.status === 'critical' ? (
                          <Badge className="bg-rose-500 text-white hover:bg-rose-600 text-[10px] font-bold">
                            {meta.days}d ({formatDate(batch.expiry_date)})
                          </Badge>
                        ) : meta.status === 'warning' ? (
                          <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[10px] font-bold">
                            {meta.days}d ({formatDate(batch.expiry_date)})
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(batch.expiry_date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {formatDate(batch.received_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(batch)} title="Edit batch code or expiry">
                          <Edit2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Batch {editing?.batch_code || `#${editing?.id}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Medicine</Label>
              <Input value={editing?.medicine_name || ''} disabled className="bg-muted text-muted-foreground font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-code">Batch / Lot Code</Label>
              <Input
                id="batch-code"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="e.g. BATCH-2026-A"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-expiry">Expiry Date *</Label>
              <Input
                id="batch-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock quantity cannot be manually modified here to preserve the strict FIFO ledger audit trail.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !expiryDate}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

