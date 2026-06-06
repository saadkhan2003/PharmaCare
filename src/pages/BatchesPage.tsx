import { useEffect, useState } from 'react';
import { tauri } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import type { BatchListDto } from '@/types/batch';
import type { SessionDto } from '@/types/session';
import { formatDate } from '@/lib/formatDate';

export function BatchesPage({ session }: { session: SessionDto }) {
  const [batches, setBatches] = useState<BatchListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BatchListDto | null>(null);
  const [batchCode, setBatchCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    tauri.batches.list(session.token).then(setBatches).finally(() => setLoading(false));
  };

  useEffect(load, [session.token]);

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
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batches</h1>
        <p className="text-sm text-muted-foreground">View stock batches and update batch code or expiry date.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading batches...
        </div>
      ) : batches.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No batches created yet. Purchases create batches.</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead>Purchase</TableHead>
                <TableHead>Original</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id} className={batch.remaining_qty === 0 ? 'opacity-60' : ''}>
                  <TableCell>{batch.batch_code || `#${batch.id}`}</TableCell>
                  <TableCell>{batch.medicine_name}</TableCell>
                  <TableCell>{batch.purchase_id ? `#${batch.purchase_id}` : 'Opening'}</TableCell>
                  <TableCell>{batch.quantity}</TableCell>
                  <TableCell>{batch.remaining_qty}</TableCell>
                  <TableCell>Rs. {batch.purchase_price.toFixed(2)}</TableCell>
                  <TableCell>{formatDate(batch.expiry_date) || batch.expiry_date}</TableCell>
                  <TableCell>{formatDate(batch.received_date)}</TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openEdit(batch)}>Edit</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Batch {editing?.batch_code || `#${editing?.id}`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Batch Code</Label>
              <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="Optional batch code" />
            </div>
            <div className="space-y-1">
              <Label>Expiry Date *</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Quantities cannot be edited here. Use purchases, returns, write-off, or sales so stock history stays accurate.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !expiryDate}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
