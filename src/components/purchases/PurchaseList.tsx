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
import { ShoppingCart, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { tauri } from '@/lib/tauri';
import { formatDate } from '@/lib/formatDate';
import type { PurchaseListDto } from '@/types/purchase';

interface PurchaseListProps {
  sessionToken: string;
  refreshKey: number;
}

export function PurchaseList({ sessionToken, refreshKey }: PurchaseListProps) {
  const [purchases, setPurchases] = useState<PurchaseListDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="space-y-3">
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
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => (
          <TableRow key={purchase.id}>
            <TableCell>{formatDate(purchase.purchase_date)}</TableCell>
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
              {formatDate(purchase.created_at)}
            </TableCell>
            <TableCell className="text-right">
              {purchase.payment_status !== 'Paid' && (
                <Link
                  to="/supplier-debts"
                  className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
                  title="Manage supplier debt"
                >
                  <CreditCard className="h-4 w-4" />
                  Debt
                </Link>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
