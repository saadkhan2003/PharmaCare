import { useState } from 'react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Trash2, EyeOff, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SupplierDto } from '@/types/supplier';

interface SupplierListProps {
  suppliers: SupplierDto[];
  loading: boolean;
  onEdit: (id: number) => void;
  onDeactivate: (id: number) => void;
  onDelete: (id: number) => Promise<void>;
}

export function SupplierList({
  suppliers,
  loading,
  onEdit,
  onDeactivate,
  onDelete,
}: SupplierListProps) {
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Truck className="mx-auto h-10 w-10 mb-3 opacity-50" />
        No suppliers found. Add your first supplier to get started.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company Name</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Payment Terms</TableHead>
            <TableHead className="text-right">Outstanding Debt</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow
              key={supplier.id}
              className={!supplier.is_active ? 'opacity-50' : ''}
            >
              <TableCell className="font-medium">{supplier.company_name}</TableCell>
              <TableCell>{supplier.contact_person || '-'}</TableCell>
              <TableCell>{supplier.phone || '-'}</TableCell>
              <TableCell>{supplier.payment_terms || '-'}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {supplier.outstanding_debt > 0 ? (
                  <Link
                    to="/supplier-debts"
                    className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    title="Manage supplier debt"
                  >
                    Rs. {supplier.outstanding_debt.toFixed(2)}
                  </Link>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    Clear
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    supplier.is_active
                      ? 'border-green-300 text-green-700'
                      : 'text-muted-foreground'
                  }
                >
                  {supplier.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(supplier.id)}
                    aria-label="Edit supplier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {supplier.is_active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeactivateTarget(supplier)}
                      aria-label="Deactivate supplier"
                    >
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  {supplier.is_active && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeleteError(null); setDeleteTarget(supplier); }}
                      aria-label="Delete supplier permanently"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Supplier</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">
                {deactivateTarget?.company_name}
              </span>
              ? They will no longer appear in supplier selection lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deactivateTarget) {
                  onDeactivate(deactivateTarget.id);
                  setDeactivateTarget(null);
                }
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Supplier</DialogTitle>
            <DialogDescription>
              Permanently delete{' '}
              <span className="font-medium text-foreground">{deleteTarget?.company_name}</span>
              ? This action cannot be undone. Only possible if no purchase records exist.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(null); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleting} onClick={async () => {
              if (deleteTarget) {
                setDeleting(true);
                try {
                  await onDelete(deleteTarget.id);
                  setDeleteTarget(null);
                } catch (err: unknown) {
                  setDeleteError(err instanceof Error ? err.message : 'Delete failed');
                } finally {
                  setDeleting(false);
                }
              }
            }}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
