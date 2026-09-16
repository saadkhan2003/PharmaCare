import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  RotateCcw,
  Loader2,
  CheckCircle2,
  X,
  PackageX,
} from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type { ReturnReceiptDto, WriteOffItemDto } from '@/types/return';
import type { ExpiryReportRow } from '@/lib/tauri';

interface WriteOffFormProps {
  sessionToken: string;
  currencySymbol: string;
  onComplete: () => void;
}

export interface BulkWriteOffItem {
  key: string;
  medicine_id: number;
  medicine_name: string;
  generic_name: string | null;
  batch_id: number;
  remaining_qty: number;
  purchase_price: number;
  expiry_date: string;
  days_remaining: number;
  quantity: number;
  condition: 'expired' | 'damaged';
  reason: string;
}

export function WriteOffForm({
  sessionToken,
  currencySymbol,
  onComplete,
}: WriteOffFormProps) {
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<ExpiryReportRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [queue, setQueue] = useState<Record<string, BulkWriteOffItem>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReturnReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load all pharmacy batches with remaining stock
  const loadAvailableBatches = useCallback(async () => {
    setLoadingAvailable(true);
    try {
      const report = await tauri.expiry.getReport(sessionToken);
      setAvailableBatches(report.filter((b) => b.remaining_qty > 0));
    } catch {
      setAvailableBatches([]);
    } finally {
      setLoadingAvailable(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    loadAvailableBatches();
  }, [loadAvailableBatches]);

  // Filtered available batches for search
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return availableBatches
      .filter((b) => {
        const inQueue = queue[`${b.medicine_id}-${b.batch_id}`];
        if (inQueue) return false;
        return (
          b.medicine_name.toLowerCase().includes(term) ||
          (b.generic_name && b.generic_name.toLowerCase().includes(term)) ||
          b.batch_id.toString().includes(term)
        );
      })
      .slice(0, 8);
  }, [searchTerm, availableBatches, queue]);

  // Counts for quick action indicators
  const expiredCount = useMemo(
    () => availableBatches.filter((b) => b.days_remaining <= 0).length,
    [availableBatches]
  );
  const nearExpiryCount = useMemo(
    () =>
      availableBatches.filter(
        (b) => b.days_remaining > 0 && b.days_remaining <= 30
      ).length,
    [availableBatches]
  );

  // Add a batch to the write-off queue
  const addToQueue = (
    batch: ExpiryReportRow,
    defaultCondition?: 'expired' | 'damaged',
    defaultReason?: string
  ) => {
    const key = `${batch.medicine_id}-${batch.batch_id}`;
    const condition =
      defaultCondition || (batch.days_remaining <= 0 ? 'expired' : 'damaged');
    const reason =
      defaultReason ||
      (batch.days_remaining <= 0
        ? 'Expired stock write-off'
        : 'Damaged stock write-off');

    setQueue((prev) => ({
      ...prev,
      [key]: {
        key,
        medicine_id: batch.medicine_id,
        medicine_name: batch.medicine_name,
        generic_name: batch.generic_name,
        batch_id: batch.batch_id,
        remaining_qty: batch.remaining_qty,
        purchase_price: batch.purchase_price,
        expiry_date: batch.expiry_date,
        days_remaining: batch.days_remaining,
        quantity: batch.remaining_qty,
        condition,
        reason,
      },
    }));
  };

  // Quick Action 1: Load all expired batches into queue
  const handleLoadExpired = () => {
    const expiredBatches = availableBatches.filter((b) => b.days_remaining <= 0);
    setQueue((prev) => {
      const updated = { ...prev };
      for (const b of expiredBatches) {
        const key = `${b.medicine_id}-${b.batch_id}`;
        updated[key] = {
          key,
          medicine_id: b.medicine_id,
          medicine_name: b.medicine_name,
          generic_name: b.generic_name,
          batch_id: b.batch_id,
          remaining_qty: b.remaining_qty,
          purchase_price: b.purchase_price,
          expiry_date: b.expiry_date,
          days_remaining: b.days_remaining,
          quantity: b.remaining_qty,
          condition: 'expired',
          reason: 'Expired stock write-off',
        };
      }
      return updated;
    });
    setSuccess(null);
  };

  // Quick Action 2: Load near-expiry batches (< 30 days)
  const handleLoadNearExpiry = () => {
    const nearBatches = availableBatches.filter(
      (b) => b.days_remaining > 0 && b.days_remaining <= 30
    );
    setQueue((prev) => {
      const updated = { ...prev };
      for (const b of nearBatches) {
        const key = `${b.medicine_id}-${b.batch_id}`;
        updated[key] = {
          key,
          medicine_id: b.medicine_id,
          medicine_name: b.medicine_name,
          generic_name: b.generic_name,
          batch_id: b.batch_id,
          remaining_qty: b.remaining_qty,
          purchase_price: b.purchase_price,
          expiry_date: b.expiry_date,
          days_remaining: b.days_remaining,
          quantity: b.remaining_qty,
          condition: 'expired',
          reason: 'Near-expiry stock write-off',
        };
      }
      return updated;
    });
    setSuccess(null);
  };

  // Update item in queue
  const updateQueueItem = (key: string, updates: Partial<BulkWriteOffItem>) => {
    setQueue((prev) => {
      if (!prev[key]) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], ...updates },
      };
    });
  };

  // Remove single item from queue
  const removeFromQueue = (key: string) => {
    setQueue((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Clear entire queue
  const clearQueue = () => {
    setQueue({});
  };

  // Calculations
  const queueList = useMemo(() => Object.values(queue), [queue]);
  const totalUnits = useMemo(
    () => queueList.reduce((sum, item) => sum + item.quantity, 0),
    [queueList]
  );
  const totalCostLoss = useMemo(
    () =>
      queueList.reduce(
        (sum, item) => sum + item.quantity * item.purchase_price,
        0
      ),
    [queueList]
  );

  const isFormValid =
    queueList.length > 0 &&
    queueList.every((item) => item.quantity > 0 && item.quantity <= item.remaining_qty);

  // Submit bulk write-off
  const handleSubmit = async () => {
    if (!isFormValid) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const items: WriteOffItemDto[] = queueList.map((item) => ({
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        condition: item.condition,
        reason: item.reason.trim() || null,
      }));

      const receipt = await tauri.returns.processWriteOff(sessionToken, { items });

      setSuccess(receipt);
      setQueue({});
      loadAvailableBatches();
      dispatchEvent('medicines-changed');
      dispatchEvent('batches-changed');
      dispatchEvent('returns-changed');
      onComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to process write-off'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Quick Actions Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/30 bg-destructive/5 hover:border-destructive/50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-destructive flex items-center gap-1.5">
                <AlertTriangle className="size-4" />
                Expired Batches
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {loadingAvailable ? '...' : expiredCount}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Eligible for immediate write-off
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleLoadExpired}
              disabled={expiredCount === 0 || loadingAvailable}
            >
              <Plus className="size-3.5 mr-1" />
              Add All Expired
            </Button>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="size-4" />
                Near Expiry (&lt; 30d)
              </div>
              <div className="text-2xl font-bold text-foreground mt-1">
                {loadingAvailable ? '...' : nearExpiryCount}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expiring in the next month
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950"
              onClick={handleLoadNearExpiry}
              disabled={nearExpiryCount === 0 || loadingAvailable}
            >
              <Plus className="size-3.5 mr-1" />
              Add Near Expiry
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Write-Off Queue
              </span>
              {queueList.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearQueue}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                >
                  Clear Queue
                </Button>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-bold text-foreground">
                {queueList.length}
              </span>
              <span className="text-xs text-muted-foreground">
                batches ({totalUnits} total units)
              </span>
            </div>
            <p className="text-xs font-semibold text-destructive mt-1">
              Estimated Loss: {currencySymbol}
              {totalCostLoss.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Bulk Write-Off Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-xl">Bulk Write-Off Queue</CardTitle>
              <CardDescription>
                Search and select multiple medicine batches to write off in a single transaction.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadAvailableBatches}
              disabled={loadingAvailable}
              className="w-fit"
            >
              {loadingAvailable ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5 mr-1" />
              )}
              Refresh Stock
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Success Message */}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 p-4 text-emerald-900 dark:text-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Bulk write-off processed successfully!</p>
                  <p className="text-sm mt-0.5 opacity-90">
                    Wrote off {success.item_count} batch(es) with an inventory cost loss of{' '}
                    <strong>
                      {currencySymbol}
                      {success.total_refund.toFixed(2)}
                    </strong>
                    . Movements have been registered in the stock ledger.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="h-6 w-6 p-0 text-destructive"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {/* Search to Add More Batches */}
          <div className="relative">
            <Label htmlFor="searchBatch" className="mb-2 block text-sm font-medium">
              Search &amp; Add Medicine Batches to Write Off
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="searchBatch"
                type="text"
                placeholder="Type medicine name, generic name, or batch ID to add..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="pl-9"
              />
            </div>

            {/* Autocomplete Search Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
                {searchResults.map((batch) => (
                  <button
                    key={`${batch.medicine_id}-${batch.batch_id}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      addToQueue(batch);
                      setSearchTerm('');
                      setShowSearchResults(false);
                    }}
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {batch.medicine_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Batch #{batch.batch_id} • Available: {batch.remaining_qty} units • Expiry: {formatDate(batch.expiry_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={batch.days_remaining <= 0 ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {batch.days_remaining <= 0 ? 'Expired' : `${batch.days_remaining}d left`}
                      </Badge>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        + Add
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Queue Table */}
          {queueList.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="min-w-[180px]">Medicine &amp; Batch</TableHead>
                      <TableHead className="w-[110px]">Expiry</TableHead>
                      <TableHead className="w-[80px]">In Stock</TableHead>
                      <TableHead className="w-[110px]">Write-Off Qty</TableHead>
                      <TableHead className="w-[110px]">Cost Loss</TableHead>
                      <TableHead className="w-[130px]">Condition</TableHead>
                      <TableHead className="min-w-[140px]">Reason</TableHead>
                      <TableHead className="w-[50px] text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueList.map((item) => {
                      const lineLoss = item.quantity * item.purchase_price;
                      return (
                        <TableRow key={item.key}>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {item.medicine_name}
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              Batch #{item.batch_id}
                              {item.generic_name ? ` • ${item.generic_name}` : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">{formatDate(item.expiry_date)}</div>
                            <Badge
                              variant={item.days_remaining <= 0 ? 'destructive' : 'outline'}
                              className="text-[10px] px-1 py-0 mt-0.5 font-normal"
                            >
                              {item.days_remaining <= 0
                                ? 'Expired'
                                : `${item.days_remaining}d left`}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {item.remaining_qty}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              max={item.remaining_qty}
                              step="1"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const clamped = Math.max(
                                  0,
                                  Math.min(val, item.remaining_qty)
                                );
                                updateQueueItem(item.key, { quantity: clamped });
                              }}
                              className="w-24 text-sm"
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-destructive">
                            {currencySymbol}
                            {lineLoss.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={item.condition}
                              onValueChange={(val: 'expired' | 'damaged' | null) => {
                                if (val) updateQueueItem(item.key, { condition: val });
                              }}
                            >
                              <SelectTrigger className="w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="damaged">Damaged</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text"
                              value={item.reason}
                              placeholder="Reason for write-off"
                              onChange={(e) =>
                                updateQueueItem(item.key, { reason: e.target.value })
                              }
                              className="text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromQueue(item.key)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Remove from write-off queue"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Summary and Submit Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Selected for disposal: <strong>{queueList.length}</strong> batches (
                    <strong>{totalUnits}</strong> total units)
                  </div>
                  <div className="text-lg font-bold text-destructive">
                    Total Inventory Loss: {currencySymbol}
                    {totalCostLoss.toFixed(2)}
                  </div>
                </div>

                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                  className="w-full sm:w-auto"
                >
                  {submitting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <PackageX className="size-4 mr-2" />
                  )}
                  {submitting
                    ? 'Processing Write-Off...'
                    : `Confirm Bulk Write-Off (${queueList.length} items)`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground bg-muted/10 space-y-3">
              <PackageX className="size-10 mx-auto opacity-40 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground text-base">
                  Write-Off Queue is Empty
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Use the quick action buttons above to automatically load all expired or near-expiry batches, or search for any medicine to write off specific stock.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadExpired}
                  disabled={expiredCount === 0 || loadingAvailable}
                >
                  <AlertTriangle className="size-3.5 mr-1 text-destructive" />
                  Load {expiredCount} Expired Batches
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLoadNearExpiry}
                  disabled={nearExpiryCount === 0 || loadingAvailable}
                >
                  <Clock className="size-3.5 mr-1 text-amber-600" />
                  Load {nearExpiryCount} Near-Expiry
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
