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
import { Skeleton } from '@/components/ui/skeleton';
import { tauri } from '@/lib/tauri';
import type { PurchaseListDto } from '@/types/purchase';

interface PurchaseListProps {
  sessionToken: string;
  refreshKey: number;
}

export function PurchaseList({ sessionToken, refreshKey }: PurchaseListProps) {
  const [purchases, setPurchases] = useState<PurchaseListDto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tauri.purchases.list(sessionToken);
      setPurchases(result);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases, refreshKey]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No purchases recorded yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead className="text-right">Total Cost</TableHead>
          <TableHead>Payment Status</TableHead>
          <TableHead>Created At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => (
          <TableRow key={purchase.id}>
            <TableCell>{purchase.purchase_date}</TableCell>
            <TableCell>{purchase.invoice_number || '-'}</TableCell>
            <TableCell className="font-medium">{purchase.supplier_name}</TableCell>
            <TableCell className="text-right">{purchase.item_count}</TableCell>
            <TableCell className="text-right font-medium">
              {purchase.total_cost.toFixed(2)}
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
                    ? 'border-green-300 text-green-700'
                    : purchase.payment_status === 'Pending'
                      ? 'text-amber-700 bg-amber-50'
                      : ''
                }
              >
                {purchase.payment_status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(purchase.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
