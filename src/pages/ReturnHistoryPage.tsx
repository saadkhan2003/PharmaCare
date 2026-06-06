import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tauri } from '@/lib/tauri';
import type { ReturnListItemDto } from '@/types/return';
import type { SessionDto } from '@/types/session';
import { formatDate } from '@/lib/formatDate';

interface Props {
  session: SessionDto;
}

function getReturnTypeLabel(type: string): string {
  switch (type) {
    case 'customer':
      return 'Customer Return';
    case 'supplier':
      return 'Supplier Return';
    case 'write_off':
      return 'Write-Off';
    default:
      return type;
  }
}

function getConditionBadge(condition: string | null): string {
  switch (condition) {
    case 'resellable':
      return 'bg-green-100 text-green-800';
    case 'damaged':
      return 'bg-amber-100 text-amber-800';
    case 'expired':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function ReturnHistoryPage({ session }: Props) {
  const [returns, setReturns] = useState<ReturnListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tauri.returns.listReturns(session.token);
      setReturns(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load return history'
      );
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Return History</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading return history...
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && returns.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No returns recorded yet.
            </div>
          )}

          {/* Returns Table */}
          {!loading && returns.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead className="w-[130px]">Type</TableHead>
                    <TableHead className="w-[130px]">Date</TableHead>
                    <TableHead className="min-w-[140px]">Medicine</TableHead>
                    <TableHead className="w-[60px]">Qty</TableHead>
                    <TableHead className="w-[110px]">Condition</TableHead>
                    <TableHead className="w-[100px] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns.map((ret) => (
                    <TableRow key={ret.id}>
                      <TableCell className="font-mono text-sm">
                        #{ret.id}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {getReturnTypeLabel(ret.return_type)}
                        </span>
                        {ret.reference_id && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (Ref: {ret.reference_id})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(ret.return_date)}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {ret.medicine_name}
                      </TableCell>
                      <TableCell>{ret.quantity}</TableCell>
                      <TableCell>
                        {ret.condition ? (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getConditionBadge(
                              ret.condition
                            )}`}
                          >
                            {ret.condition}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {ret.return_type === 'write_off'
                          ? '—'
                          : `Rs. ${ret.refund_amount.toFixed(2)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Refresh button */}
          {!loading && returns.length > 0 && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={loadReturns}
                className="text-sm text-primary hover:underline"
              >
                Refresh
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
