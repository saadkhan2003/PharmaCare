import { useState, useEffect, useCallback, useMemo } from 'react';
import { tauri } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, CreditCard, Eye, CircleDollarSign, Download, Search, AlertCircle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast-provider';
import { dispatchEvent, useAutoRefresh } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type { SessionDto } from '@/types/session';
import type { SupplierDebtListItem, SupplierDebtDetail } from '@/types/supplier-debt';
import type { SupplierDto } from '@/types/supplier';

export function SupplierDebtsPage({ session }: { session: SessionDto }) {
  const { settings } = useSettings(session.token);
  const { toast } = useToast();
  const currencySymbol = settings?.currency_symbol || 'Rs.';

  const [debts, setDebts] = useState<SupplierDebtListItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [supplierDebtsEventKey] = useAutoRefresh('supplier-debts-changed');
  const refreshKey = internalRefreshKey + supplierDebtsEventKey;
  const [filterSupplierId, setFilterSupplierId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'partial' | 'paid'>('all');

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState('');
  const [newTotalAmount, setNewTotalAmount] = useState('');
  const [newPaidAmount, setNewPaidAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDebtId, setPayDebtId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detail, setDetail] = useState<SupplierDebtDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const supplierId = filterSupplierId === 'all' ? undefined : parseInt(filterSupplierId);
      const result = await tauri.supplierDebts.list(session.token, supplierId);
      setDebts(result);
    } catch {
      toast('error', 'Failed to load supplier debts');
    } finally {
      setLoading(false);
    }
  }, [session.token, filterSupplierId, toast]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts, refreshKey]);

  useEffect(() => {
    tauri.suppliers.list(session.token)
      .then((result) => setSuppliers(result.filter((s) => s.is_active)))
      .catch(() => {});
  }, [session.token]);

  const handleCreate = async () => {
    if (!newSupplierId || !newTotalAmount || parseFloat(newTotalAmount) <= 0) return;
    setCreating(true);
    try {
      await tauri.supplierDebts.create(session.token, {
        supplier_id: parseInt(newSupplierId),
        total_amount: parseFloat(newTotalAmount),
        paid_amount: newPaidAmount ? parseFloat(newPaidAmount) : undefined,
        due_date: newDueDate || undefined,
        notes: newNotes.trim() || undefined,
      });
      setCreateDialogOpen(false);
      setNewSupplierId('');
      setNewTotalAmount('');
      setNewPaidAmount('');
      setNewDueDate('');
      setNewNotes('');
      dispatchEvent('supplier-debts-changed');
      setInternalRefreshKey((k) => k + 1);
      toast('success', 'Supplier debt created');
    } catch (err) {
      toast('error', 'Failed to create debt', err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handlePay = async () => {
    if (!payDebtId || !payAmount || parseFloat(payAmount) <= 0) return;
    setPaying(true);
    try {
      await tauri.supplierDebts.recordPayment(session.token, {
        debt_id: payDebtId,
        amount: parseFloat(payAmount),
        notes: payNotes.trim() || undefined,
        recorded_by: session.user_id,
      });
      setPayDialogOpen(false);
      setPayDebtId(null);
      setPayAmount('');
      setPayNotes('');
      dispatchEvent('supplier-debts-changed');
      setInternalRefreshKey((k) => k + 1);
      toast('success', 'Payment recorded');
    } catch (err) {
      toast('error', 'Payment failed', err instanceof Error ? err.message : String(err));
    } finally {
      setPaying(false);
    }
  };

  const openDetail = async (debtId: number) => {
    setLoadingDetail(true);
    setDetailDialogOpen(true);
    try {
      const result = await tauri.supplierDebts.get(session.token, debtId);
      setDetail(result);
    } catch {
      toast('error', 'Failed to load debt details');
      setDetailDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openPayment = (debtId: number, remaining: number) => {
    setPayDebtId(debtId);
    setPayAmount(remaining.toString());
    setPayNotes('');
    setPayDialogOpen(true);
  };

  const statusBadge = (status: string, dueDate: string | null) => {
    if (status === 'Paid') return <Badge variant="outline" className="border-green-300 text-green-700">Paid</Badge>;
    if (status === 'Pending' && dueDate) {
      const due = new Date(dueDate);
      const now = new Date();
      if (due < now) return <Badge variant="destructive">Overdue</Badge>;
    }
    if (status === 'Partial') return <Badge className="bg-amber-500">Partial</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (statusFilter === 'overdue') {
        const isOverdue = d.status !== 'Paid' && d.due_date && new Date(d.due_date) < new Date();
        if (!isOverdue) return false;
      } else if (statusFilter === 'partial') {
        if (d.status !== 'Partial') return false;
      } else if (statusFilter === 'paid') {
        if (d.status !== 'Paid') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSupplier = d.supplier_name.toLowerCase().includes(q);
        if (!matchesSupplier) return false;
      }

      return true;
    });
  }, [debts, statusFilter, searchQuery]);

  const total = debts.reduce((s, d) => s + d.remaining_amount, 0);

  const exportCsv = () => {
    const headers = ['Supplier,Total Amount,Paid Amount,Remaining,Due Date,Status'];
    const rows = filteredDebts.map(d => 
      `"${d.supplier_name}",${d.total_amount},${d.paid_amount},${d.remaining_amount},"${d.due_date || ''}","${d.status}"`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier_debts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Debts</h1>
          <p className="text-sm text-muted-foreground">
            Total outstanding: <strong>{currencySymbol} {total.toFixed(2)}</strong> ({debts.filter(d => d.remaining_amount > 0).length} active liabilities)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterSupplierId} onValueChange={(v) => setFilterSupplierId(v || 'all')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredDebts.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Debt
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier name..."
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
              { id: 'overdue', label: 'Overdue' },
              { id: 'partial', label: 'Partial' },
              { id: 'paid', label: 'Paid' },
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
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading...
        </div>
      ) : debts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CircleDollarSign className="mx-auto h-10 w-10 mb-3 opacity-50" />
            No supplier debts recorded.
          </CardContent>
        </Card>
      ) : filteredDebts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="size-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-semibold text-foreground">No matching supplier debts found</p>
            <p className="text-xs mt-1">Try adjusting your search query or status filter.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((d) => (
                <TableRow
                  key={d.id}
                  className={d.status !== 'Paid' && d.due_date && new Date(d.due_date) < new Date() ? 'bg-red-50/60 dark:bg-red-950/30' : ''}
                >
                  <TableCell className="font-medium">{d.supplier_name}</TableCell>
                  <TableCell className="text-right">{currencySymbol}{d.total_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{currencySymbol}{d.paid_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">{currencySymbol}{d.remaining_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{d.due_date ? formatDate(d.due_date) : '-'}</TableCell>
                  <TableCell>{statusBadge(d.status, d.due_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(d.id)} title="View details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {d.remaining_amount > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => openPayment(d.id, d.remaining_amount)} title="Record payment">
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Supplier Debt</DialogTitle>
            <DialogDescription>Record an outstanding debt to a supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Supplier *</Label>
              <Select value={newSupplierId} onValueChange={(v) => setNewSupplierId(v || '')}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Total Amount *</Label>
                <Input type="number" min={0.01} step={0.01} value={newTotalAmount} onChange={(e) => setNewTotalAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Paid Amount</Label>
                <Input type="number" min={0} step={0.01} value={newPaidAmount} onChange={(e) => setNewPaidAmount(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newSupplierId || !newTotalAmount || parseFloat(newTotalAmount) <= 0}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Debt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment towards this supplier debt.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" min={0.01} step={0.01} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Optional payment notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debt Details</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Supplier:</span> <span className="font-medium">{detail.debt.supplier_name}</span></div>
                <div><span className="text-muted-foreground">Status:</span> {statusBadge(detail.debt.status, detail.debt.due_date)}</div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{currencySymbol}{detail.debt.total_amount.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Paid:</span> {currencySymbol}{detail.debt.paid_amount.toFixed(2)}</div>
                <div><span className="text-muted-foreground">Remaining:</span> <span className="font-semibold">{currencySymbol}{detail.debt.remaining_amount.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Due Date:</span> {detail.debt.due_date ? formatDate(detail.debt.due_date) : '-'}</div>
                {detail.debt.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {detail.debt.notes}</div>}
              </div>

              {detail.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Payment History</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{formatDate(p.payment_date)}</TableCell>
                          <TableCell className="text-right font-medium">{currencySymbol}{p.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
