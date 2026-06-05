import { useState, useEffect } from 'react';
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
import { Loader2, Plus, Phone, MessageCircle } from 'lucide-react';
import type { SessionDto } from '@/types/session';
import type { DebtorListItem } from '@/types/debt';

export function DebtsPage({ session }: { session: SessionDto }) {
  const [debts, setDebts] = useState<DebtorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [medQty, setMedQty] = useState(1);
  const [medAmount, setMedAmount] = useState(0);
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

  const handleAddItem = () => {
    if (!medicineName.trim() || medQty <= 0 || medAmount <= 0) return;
    setItems([...items, { medicine_name: medicineName.trim(), quantity: medQty, amount: medAmount }]);
    setMedicineName(''); setMedQty(1); setMedAmount(0);
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
      setRefreshKey(k => k + 1);
    } catch (err) { alert(err); }
    finally { setSaving(false); }
  };

  const handlePay = async () => {
    if (!payDebtId || payAmount <= 0) return;
    setPaying(true);
    try {
      await tauri.debt.recordPayment(session.token, payDebtId, payAmount);
      setPayDebtId(null);
      setRefreshKey(k => k + 1);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Payment failed'); }
    finally { setPaying(false); }
  };

  const openWhatsApp = (phoneNum: string, nameStr: string, remaining: number) => {
    const msg = encodeURIComponent(`Dear ${nameStr}, this is a reminder from PharmaCare about your pending balance of ${remaining.toFixed(2)} Rs. Please clear it at your earliest convenience. Thank you.`);
    window.open(`https://wa.me/${phoneNum.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
  };

  const statusBadge = (status: string, days: number) => {
    if (status === 'paid') return <Badge variant="outline" className="border-green-300 text-green-700">Paid</Badge>;
    if (status === 'overdue' || days < 0) return <Badge variant="destructive">Overdue</Badge>;
    if (days <= 3) return <Badge className="bg-amber-500">Due in {days}d</Badge>;
    return <Badge variant="secondary">{days}d left</Badge>;
  };

  const total = debts.reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debt Tracking</h1>
          <p className="text-sm text-muted-foreground">Total outstanding: <strong>{total.toFixed(2)} Rs.</strong></p>
        </div>
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
                  <div className="flex-1"><Input value={medicineName} onChange={e => setMedicineName(e.target.value)} placeholder="Medicine name" size={1} /></div>
                  <div className="w-16"><Input type="number" min={1} value={medQty} onChange={e => setMedQty(Number(e.target.value))} placeholder="Qty" /></div>
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

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 mr-2 animate-spin" />Loading...</div>
      ) : debts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No debts recorded. Use "New Debt" to add one.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((d) => (
                <TableRow key={d.id} className={d.status === 'overdue' ? 'bg-red-50/50' : ''}>
                  <TableCell className="font-medium">{d.customer_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.phone || '-'}</TableCell>
                  <TableCell>{d.total_amount.toFixed(2)}</TableCell>
                  <TableCell>{d.paid_amount.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">{d.remaining.toFixed(2)}</TableCell>
                  <TableCell className="text-sm">{d.due_date}</TableCell>
                  <TableCell>{statusBadge(d.status, d.days_remaining)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {d.phone && d.remaining > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => openWhatsApp(d.phone!, d.customer_name, d.remaining)} title="Send WhatsApp reminder">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {d.remaining > 0 && (
                        <Button variant="ghost" size="icon" onClick={() => { setPayDebtId(d.id); setPayAmount(d.remaining); }} title="Record payment">
                          <Phone className="h-4 w-4" />
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
