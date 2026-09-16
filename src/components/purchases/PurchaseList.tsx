import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, CreditCard, Eye, Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tauri } from '@/lib/tauri';
import { formatDate } from '@/lib/formatDate';
import { dispatchEvent } from '@/lib/eventBus';
import { useToast } from '@/components/ui/toast-provider';
import type { PurchaseListDto, PurchaseDetailDto } from '@/types/purchase';

interface PurchaseListProps {
  sessionToken: string;
  refreshKey: number;
}

export function PurchaseList({ sessionToken, refreshKey }: PurchaseListProps) {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<PurchaseListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal State
  const [detailPurchaseId, setDetailPurchaseId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PurchaseDetailDto | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quick Payment Dialog inside Detail
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.purchases.list(sessionToken);
      setPurchases(result);
    } catch (err: unknown) {
      console.error('Failed to load purchases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases, refreshKey]);

  const openDetail = async (id: number) => {
    setDetailPurchaseId(id);
    setLoadingDetail(true);
    setShowPayForm(false);
    try {
      const res = await tauri.purchases.getDetail(sessionToken, id);
      setDetail(res);
      setPayAmount(res.remaining_amount > 0 ? res.remaining_amount.toFixed(2) : '');
    } catch (err: unknown) {
      toast('error', 'Failed to load purchase details', err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePay = async () => {
    if (!detail || !detail.debt_id) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast('error', 'Please enter a valid positive payment amount');
      return;
    }
    setPaying(true);
    try {
      await tauri.supplierDebts.recordPayment(sessionToken, {
        debt_id: detail.debt_id,
        amount,
        notes: payNotes.trim() || undefined,
        recorded_by: 1,
      });
      toast('success', 'Supplier payment recorded successfully');
      setShowPayForm(false);
      dispatchEvent('purchases-changed');
      dispatchEvent('supplier-debts-changed');
      dispatchEvent('suppliers-changed');
      // Reload detail
      const updated = await tauri.purchases.getDetail(sessionToken, detail.id);
      setDetail(updated);
      setPayAmount(updated.remaining_amount > 0 ? updated.remaining_amount.toFixed(2) : '');
    } catch (err: unknown) {
      toast('error', 'Payment failed', err instanceof Error ? err.message : String(err));
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <ShoppingCart className="mx-auto h-10 w-10 mb-3 opacity-50" />
        No purchases recorded yet.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[65px]">#ID</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total Cost</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Payment Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                #{purchase.id}
              </TableCell>
              <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
              <TableCell className="font-mono text-xs font-medium">{purchase.invoice_number || '-'}</TableCell>
              <TableCell className="font-semibold">{purchase.supplier_name}</TableCell>
              <TableCell className="text-right">{purchase.item_count}</TableCell>
              <TableCell className="text-right font-medium">
                Rs. {purchase.total_cost.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                Rs. {purchase.paid_amount.toFixed(2)}
              </TableCell>
              <TableCell className={`text-right font-mono text-xs font-semibold ${purchase.remaining_amount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                Rs. {purchase.remaining_amount.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    purchase.payment_status === 'Paid'
                      ? 'outline'
                      : purchase.payment_status === 'Pending'
                        ? 'secondary'
                        : 'default'
                  }
                  className={
                    purchase.payment_status === 'Paid'
                      ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-300'
                      : purchase.payment_status === 'Pending'
                        ? 'text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300'
                        : 'text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300'
                  }
                >
                  {purchase.payment_status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDetail(purchase.id)}
                    title="View purchase details & payments"
                  >
                    <Eye className="size-4 mr-1" />
                    Details
                  </Button>
                  <Link
                    to={`/returns/supplier?search=${encodeURIComponent(purchase.invoice_number || purchase.id.toString())}`}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-semibold px-2 py-1 rounded hover:bg-muted"
                    title="Return items from this purchase"
                  >
                    <RotateCcw className="size-3.5" />
                    Return
                  </Link>
                  {purchase.payment_status !== 'Paid' && (
                    <Link
                      to="/supplier-debts"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold px-2 py-1 rounded hover:bg-muted"
                      title="Manage in Supplier Debts"
                    >
                      <CreditCard className="size-3.5" />
                      Debts
                    </Link>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Purchase Detail Modal */}
      <Dialog
        open={detailPurchaseId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPurchaseId(null);
            setDetail(null);
            setShowPayForm(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>Purchase Invoice #{detail?.invoice_number || detail?.id}</span>
              {detail && (
                <Badge
                  variant={detail.payment_status === 'Paid' ? 'outline' : 'default'}
                  className={
                    detail.payment_status === 'Paid'
                      ? 'border-green-300 text-green-700'
                      : detail.payment_status === 'Pending'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                  }
                >
                  {detail.payment_status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Financial & Supplier Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Supplier</span>
                  <span className="font-semibold text-foreground">{detail.supplier_name}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Date</span>
                  <span className="font-medium">{formatDate(detail.purchase_date)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Total Cost</span>
                  <span className="font-bold font-mono text-foreground">Rs. {detail.total_cost.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Remaining Debt</span>
                  <span className={`font-bold font-mono ${detail.remaining_amount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    Rs. {detail.remaining_amount.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">Intake Items & Batches</h4>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead className="w-[100px]">Batch</TableHead>
                        <TableHead className="text-right w-[70px]">Qty</TableHead>
                        <TableHead className="text-right w-[90px]">Price</TableHead>
                        <TableHead className="text-right w-[90px]">Line Total</TableHead>
                        <TableHead className="w-[100px]">Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.medicine_name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.batch_code || (item.batch_id ? `#${item.batch_id}` : '-')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono text-xs">Rs. {item.purchase_price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">Rs. {item.line_cost.toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(item.expiry_date)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment History Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CreditCard className="size-4 text-emerald-600" />
                    Supplier Payment History ({detail.payments.length})
                  </h4>
                  {detail.remaining_amount > 0 && detail.debt_id && !showPayForm && (
                    <Button size="sm" variant="outline" onClick={() => setShowPayForm(true)}>
                      Record Payment
                    </Button>
                  )}
                </div>

                {showPayForm && (
                  <div className="mb-4 rounded-lg border bg-card p-4 space-y-3 animate-in shadow-sm">
                    <h5 className="text-xs font-bold text-foreground">Record Payment towards this Purchase</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Payment Amount (Rs.) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={detail.remaining_amount}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notes (optional)</Label>
                        <Input
                          placeholder="e.g. Bank transfer, cash"
                          value={payNotes}
                          onChange={(e) => setPayNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowPayForm(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handlePay} disabled={paying || !payAmount}>
                        {paying && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                        Confirm Payment
                      </Button>
                    </div>
                  </div>
                )}

                {detail.payments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                    {detail.payment_status === 'Paid'
                      ? 'Fully settled at purchase creation.'
                      : 'No payments recorded yet for this purchase debt.'}
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-[120px]">Date</TableHead>
                          <TableHead className="text-right w-[110px]">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{formatDate(p.payment_date)}</TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">
                              Rs. {p.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.notes || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailPurchaseId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
