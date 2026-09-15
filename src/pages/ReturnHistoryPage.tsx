import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { tauri } from '@/lib/tauri';
import { useSettings } from '@/hooks/useSettings';
import { Search, RotateCcw } from 'lucide-react';
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
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    case 'damaged':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    case 'expired':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function ReturnHistoryPage({ session }: Props) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [returns, setReturns] = useState<ReturnListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | 'customer' | 'supplier' | 'write_off'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const perPage = 50;

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.returns.listReturns(session.token, page, perPage);
      setReturns(result.items);
      setTotalPages(result.total_pages);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load return history'
      );
    } finally {
      setLoading(false);
    }
  }, [session.token, page, perPage]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (typeFilter !== 'all' && r.return_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMed = (r.medicine_name || '').toLowerCase().includes(q);
        const matchCondition = (r.condition || '').toLowerCase().includes(q);
        const matchId = String(r.id).includes(q) || String(r.reference_id || '').includes(q);
        if (!matchMed && !matchCondition && !matchId) return false;
      }
      return true;
    });
  }, [returns, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="size-6 text-emerald-600" />
            Return & Write-Off History
          </h1>
          <p className="text-sm text-muted-foreground">Complete audit trail of all customer returns, supplier returns, and write-offs.</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by medicine, reference ID, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Type Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto bg-muted/60 p-1 rounded-lg border border-border">
          {(
            [
              { id: 'all', label: 'All Operations' },
              { id: 'customer', label: 'Customer Returns' },
              { id: 'supplier', label: 'Supplier Returns' },
              { id: 'write_off', label: 'Write-Offs' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                typeFilter === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
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
          {!loading && !error && filteredReturns.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching returns found.
            </div>
          )}

          {/* Returns Table */}
          {!loading && filteredReturns.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
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
                  {filteredReturns.map((ret) => (
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
                          : `${currencySymbol} ${ret.refund_amount.toFixed(2)}`}
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

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
