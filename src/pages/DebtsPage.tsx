import { useState, useEffect, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-shell';
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
import { Loader2, Plus, MessageCircle, Search, Download, CircleDollarSign, AlertCircle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast-provider';
import { dispatchEvent, useAutoRefresh } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type { SessionDto } from '@/types/session';
import type { DebtorListItem } from '@/types/debt';
import type { MedicineListItem } from '@/types/medicine';

const MIN_MEDICINE_SEARCH_LENGTH = 2;

export function DebtsPage({ session }: { session: SessionDto }) {
  const { settings } = useSettings(session.token);
  const { toast } = useToast();
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const pharmacyName = settings?.pharmacy_name ?? 'PharmaCare';
  const [debts, setDebts] = useState<DebtorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'due_soon' | 'paid'>('all');
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [debtsEventKey] = useAutoRefresh('debts-changed');
  const refreshKey = internalRefreshKey + debtsEventKey;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [medQty, setMedQty] = useState(1);
  const [medAmount, setMedAmount] = useState(0);
  const [selectedMedicinePrice, setSelectedMedicinePrice] = useState<number | null>(null);
  const [medicineResults, setMedicineResults] = useState<MedicineListItem[]>([]);
  const [searchingMedicines, setSearchingMedicines] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [items, setItems] = useState<{ medicine_name: string; quantity: number; amount: number }[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Payment dialog
  const [payDebtId, setPayDebtId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    tauri.debt.list(session.token).then(setDebts).finally(() => setLoading(false));
  }, [session.token, refreshKey]);

  useEffect(() => {
    const query = medicineName.trim();
    if (query.length < MIN_MEDICINE_SEARCH_LENGTH || selectedMedicinePrice !== null) {
      setMedicineResults([]);
      setSearchingMedicines(false);
      return;
    }

    setSearchingMedicines(true);
    const timer = window.setTimeout(() => {
      tauri.medicines
        .search(session.token, query, 1, 200)
        .then((result) => setMedicineResults(result.items.filter((m) => m.is_active)))
        .catch(() => setMedicineResults([]))
        .finally(() => setSearchingMedicines(false));
    }, 200);

    return () => window.clearTimeout(timer);
  }, [medicineName, selectedMedicinePrice, session.token]);

  const handleAddItem = () => {
    if (!medicineName.trim() || medQty <= 0 || medAmount <= 0) return;
    setItems([...items, { medicine_name: medicineName.trim(), quantity: medQty, amount: medAmount }]);
    setMedicineName(''); setMedQty(1); setMedAmount(0); setSelectedMedicinePrice(null); setMedicineResults([]);
  };

  const handleQuantityChange = (qty: number) => {
    setMedQty(qty);
    if (selectedMedicinePrice !== null && qty > 0) {
      setMedAmount(Number((selectedMedicinePrice * qty).toFixed(2)));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || items.length === 0 || !dueDate) return;
    setSaving(true);
    try {
      await tauri.debt.create(session.token, {
        customer_name: name.trim(), phone: phone.trim() || null,
        items, due_date: dueDate, notes: notes.trim() || null,
      });
      setDialogOpen(false);
      setName(''); setPhone(''); setItems([]); setDueDate(''); setNotes('');
      dispatchEvent('debts-changed');
      setInternalRefreshKey(k => k + 1);
    } catch (err) { toast('error', 'Failed to load debts', err instanceof Error ? err.message : String(err)); }
    finally { setSaving(false); }
  };

  const handlePay = async () => {
    if (!payDebtId || payAmount <= 0) return;
    setPaying(true);
    try {
      await tauri.debt.recordPayment(session.token, payDebtId, payAmount);
      setPayDebtId(null);
      dispatchEvent('debts-changed');
      setInternalRefreshKey(k => k + 1);
    } catch (err: unknown) { toast('error', 'Payment failed', err instanceof Error ? err.message : String(err)); }
    finally { setPaying(false); }
  };

  const openWhatsApp = (phoneNum: string, nameStr: string, remaining: number, dueDate: string, totalAmount: number, paidAmount: number, daysRemaining: number) => {
    const cleanPhone = phoneNum.replace(/[^0-9]/g, '');
    const dueLabel = daysRemaining < 0
      ? `${Math.abs(daysRemaining)} day(s) overdue`
      : daysRemaining === 0
        ? 'due today'
        : `due in ${daysRemaining} day(s)`;
      const msg = encodeURIComponent(
      `Assalam-o-Alaikum ${nameStr},

This is a friendly reminder from ${pharmacyName}.

Your outstanding balance of ${currencySymbol} ${remaining.toFixed(2)} (out of ${currencySymbol} ${totalAmount.toFixed(2)}, ${currencySymbol} ${paidAmount.toFixed(2)} paid) is ${dueLabel} (${dueDate}).

Kindly clear it at your earliest convenience. We value your trust.

Thank you,
${pharmacyName}`
    );
    open(`https://wa.me/${cleanPhone}?text=${msg}`);
  };

  const statusBadge = (status: string, days: number) => {
    if (status === 'paid') return <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">Paid</Badge>;
    if (status === 'overdue' || days < 0) return <Badge variant="destructive">Overdue</Badge>;
    if (days <= 3) return <Badge className="bg-amber-500 text-white">Due in {days}d</Badge>;
    return <Badge variant="secondary">{days}d left</Badge>;
  };

  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.customer_name.toLowerCase().includes(q);
        const matchPhone = (d.phone || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }
      if (statusFilter === 'overdue' && d.status !== 'overdue' && d.days_remaining >= 0) return false;
      if (statusFilter === 'due_soon' && (d.days_remaining < 0 || d.days_remaining > 3 || d.status === 'paid')) return false;
      if (statusFilter === 'paid' && d.status !== 'paid') return false;
      return true;
    });
  }, [debts, searchQuery, statusFilter]);

  const exportCsv = () => {
    const headers = ['Customer,Phone,Total Amount,Paid Amount,Remaining,Due Date,Status'];
    const rows = filteredDebts.map(d => 
      `"${d.customer_name}","${d.phone || ''}",${d.total_amount},${d.paid_amount},${d.remaining},"${d.due_date}","${d.status}"`
    );
    const blob = new Blob([[...headers, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_debts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = debts.reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Debt Tracking</h1>
          <p className="text-sm text-muted-foreground">Total outstanding: <strong>{currencySymbol} {total.toFixed(2)}</strong> ({debts.filter(d => d.remaining > 0).length} active accounts)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredDebts.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Debt</Button>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Record New Debt</DialogTitle>
              <DialogDescription>Customer took medicine on credit. Set a due date for repayment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Customer Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" /></div>
                <div className="space-y-1"><Label>Phone (for reminders)</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92-300-1234567" /></div>
              </div>
              <div className="space-y-1"><Label>Due Date *</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>

              <div className="border rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">Items</p>
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{item.medicine_name} × {item.quantity}</span>
                    <span className="font-medium">{item.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex gap-2 items-end">
                  <div className="relative flex-1">
                    <Input
                      value={medicineName}
                      onChange={e => {
                        setMedicineName(e.target.value);
                        setSelectedMedicinePrice(null);
                        setHighlightedIndex(-1);
                      }}
                      onKeyDown={e => {
                        if (medicineResults.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex(prev => (prev < medicineResults.length - 1 ? prev + 1 : 0));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : medicineResults.length - 1));
                        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                          e.preventDefault();
                          const medicine = medicineResults[highlightedIndex];
                          setMedicineName(medicine.name);
                          setSelectedMedicinePrice(medicine.retail_price);
                          setMedAmount(Number((medicine.retail_price * medQty).toFixed(2)));
                          setMedicineResults([]);
                          setHighlightedIndex(-1);
                        } else if (e.key === 'Escape') {
                          setMedicineResults([]);
                          setHighlightedIndex(-1);
                        }
                      }}
                      placeholder="Search medicine"
                      size={1}
                    />
                    {medicineName.trim().length >= MIN_MEDICINE_SEARCH_LENGTH && selectedMedicinePrice === null && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                        {searchingMedicines ? (
                          <div className="p-2 text-xs text-muted-foreground">Searching...</div>
                        ) : medicineResults.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">No medicines found</div>
                        ) : (
                          medicineResults.map((medicine, index) => (
                            <button
                              key={medicine.id}
                              type="button"
                              className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ${
                                index === highlightedIndex ? 'bg-accent' : 'hover:bg-accent'
                              }`}
                              onClick={() => {
                                setMedicineName(medicine.name);
                                setSelectedMedicinePrice(medicine.retail_price);
                                setMedAmount(Number((medicine.retail_price * medQty).toFixed(2)));
                                setMedicineResults([]);
                                setHighlightedIndex(-1);
                              }}
                            >
                              <span>{medicine.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                Rs. {medicine.retail_price.toFixed(2)} | Stock {medicine.current_stock}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-16"><Input type="number" min={1} value={medQty} onChange={e => handleQuantityChange(Number(e.target.value))} placeholder="Qty" /></div>
                  <div className="w-24"><Input type="number" min={0} step={0.01} value={medAmount} onChange={e => setMedAmount(Number(e.target.value))} placeholder="Amount" /></div>
                  <Button variant="outline" size="sm" onClick={handleAddItem}>+</Button>
                </div>
              </div>

              <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim() || items.length === 0 || !dueDate}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save Debt ({items.reduce((s, i) => s + i.amount, 0).toFixed(2)})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or phone..."
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
              { id: 'due_soon', label: 'Due Soon (≤3d)' },
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
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading...</div>
      ) : filteredDebts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="size-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="font-semibold text-foreground">No matching debts found</p>
            <p className="text-xs mt-1">Try adjusting your search query or status filter.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Total ({currencySymbol})</TableHead>
                <TableHead className="text-right">Paid ({currencySymbol})</TableHead>
                <TableHead className="text-right">Remaining ({currencySymbol})</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDebts.map((d) => (
                <TableRow key={d.id} className={d.status === 'overdue' ? 'bg-red-50/60 dark:bg-red-950/30' : ''}>
                  <TableCell className="font-semibold text-foreground">{d.customer_name}</TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{d.phone || '-'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{d.total_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{d.paid_amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-bold text-foreground">{d.remaining.toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.due_date)}</TableCell>
                  <TableCell>{statusBadge(d.status, d.days_remaining)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {d.phone && d.remaining > 0 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => openWhatsApp(d.phone!, d.customer_name, d.remaining, d.due_date, d.total_amount, d.paid_amount, d.days_remaining)} title="Send WhatsApp reminder">
                          <MessageCircle className="size-4 text-emerald-600" />
                        </Button>
                      )}
                      {d.remaining > 0 && (
                        <Button variant="ghost" size="icon-sm" onClick={() => { setPayDebtId(d.id); setPayAmount(d.remaining); }} title="Record payment">
                          <CircleDollarSign className="size-4 text-primary" />
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

      {/* Payment dialog */}
      <Dialog open={payDebtId !== null} onOpenChange={(o) => { if (!o) setPayDebtId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <Input type="number" min={0.01} step={0.01} value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDebtId(null)}>Cancel</Button>
            <Button onClick={handlePay} disabled={paying || payAmount <= 0}>
              {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
