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
import { Pencil, Trash2 } from 'lucide-react';
import type { MedicineListItem, MedicinePharmacistDto } from '@/types/medicine';

interface MedicineListProps {
  medicines: (MedicineListItem | MedicinePharmacistDto)[];
  loading: boolean;
  role: string;
  onEdit: (id: number) => void;
  onDeactivate: (id: number) => void;
}

export function MedicineList({
  medicines,
  loading,
  role,
  onEdit,
  onDeactivate,
}: MedicineListProps) {
  const [deactivateTarget, setDeactivateTarget] = useState<number | null>(null);

  const isOwner = role === 'owner';
  const selectedMedicine = deactivateTarget !== null
    ? medicines.find((m) => m.id === deactivateTarget)
    : null;

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No medicines found. Add your first medicine to get started.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Generic Name</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Retail Price</TableHead>
            {isOwner && <TableHead>Purchase Price</TableHead>}
            <TableHead>Current Stock</TableHead>
            <TableHead>Reorder Level</TableHead>
            <TableHead>Status</TableHead>
            {isOwner && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {medicines.map((medicine) => {
            const stock = 'purchase_price' in medicine
              ? (medicine as MedicineListItem).current_stock
              : (medicine as MedicinePharmacistDto).current_stock;
            const reorder = medicine.reorder_level;
            const isLowStock = reorder > 0 && stock <= reorder;
            const isOutOfStock = stock === 0;

            return (
              <TableRow key={medicine.id}>
                <TableCell className="font-medium">{medicine.name}</TableCell>
                <TableCell>{medicine.generic_name || '-'}</TableCell>
                <TableCell>{medicine.brand_name || '-'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="capitalize">
                    {medicine.category}
                  </Badge>
                </TableCell>
                <TableCell>{medicine.unit}</TableCell>
                <TableCell>{medicine.retail_price.toFixed(2)}</TableCell>
                {isOwner && (
                  <TableCell>
                    {'purchase_price' in medicine
                      ? (medicine as MedicineListItem).purchase_price.toFixed(2)
                      : '-'}
                  </TableCell>
                )}
                <TableCell>
                  <span
                    className={
                      isOutOfStock
                        ? 'font-semibold text-destructive'
                        : isLowStock
                          ? 'font-semibold text-amber-600'
                          : ''
                    }
                  >
                    {stock}
                  </span>
                </TableCell>
                <TableCell>{reorder}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      medicine.is_active
                        ? 'border-green-300 text-green-700'
                        : 'text-muted-foreground'
                    }
                  >
                    {medicine.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                {isOwner && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(medicine.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {medicine.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeactivateTarget(medicine.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
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
            <DialogTitle>Deactivate Medicine</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">
                {selectedMedicine?.name}
              </span>
              ? It will no longer appear in active medicine searches.
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
                if (deactivateTarget !== null) {
                  onDeactivate(deactivateTarget);
                  setDeactivateTarget(null);
                }
              }}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
